import ast
import collections
import difflib
import hashlib
import json
import math
import os
import re
import os
import numpy as np
import pickle
import gensim.downloader as api
from gensim.models import Word2Vec
from tqdm import tqdm
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity as sklearn_cosine

from config import INIT_JSON_PATH

'''
Supports all 3 retrieval modes:
    "tfidf"    – TF-IDF + cosine similarity (baseline)
    "word2vec" – Weighted Word2Vec vectors
    "bert"     – Sentence-BERT embeddings (best semantic quality)
    
For word2vec and bert, we compute *separate* cosine scores for:
        - ambience  (upscale, romantic, casual, …)
        - cuisine   (categories + name)
        - reviews   (what people actually said)
        - practical (price range, noise level, good-for-meal flags)
Then we combine them with configurable weights that default to
prioritising ambience
'''
##SAVING AND LOADING PROCESSED DATA#####################################################################################
BERT_CACHE_DIR = os.path.dirname(__file__)


def _bert_cache_key(restaurants: list[dict], field_weights: dict) -> str:
    payload = {
        "business_ids": [r.get("business", {}).get("business_id") for r in restaurants],
        "field_weights": field_weights,
    }
    encoded = json.dumps(payload, sort_keys=True).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()[:16]


def _bert_cache_path(cache_key: str) -> str:
    return os.path.join(BERT_CACHE_DIR, f"bert_cache_{cache_key}.pkl")


def _save_bert_corpus(corpus: dict, cache_key: str):
    """Save BERT corpus to disk, excluding the model itself (too large)."""
    saveable = {
        "model_type":    corpus["model_type"],
        "field_vectors": corpus["field_vectors"],  # numpy arrays
        "field_weights": corpus["field_weights"],
        "restaurants":   corpus["restaurants"],
    }
    cache_path = _bert_cache_path(cache_key)
    with open(cache_path, "wb") as f:
        pickle.dump(saveable, f)
    print(f"[similarity] BERT corpus cached to {cache_path}")


def _load_bert_corpus(cache_key: str) -> dict | None:
    """Load cached BERT corpus and reload the model."""
    cache_path = _bert_cache_path(cache_key)
    if not os.path.exists(cache_path):
        return None
    print(f"[similarity] Loading cached BERT corpus from {cache_path}...")
    with open(cache_path, "rb") as f:
        corpus = pickle.load(f)
    # Still need to load the model for query-time encoding
    from sentence_transformers import SentenceTransformer
    corpus["bert_model"] = SentenceTransformer("all-MiniLM-L6-v2")
    print("[similarity] BERT corpus loaded from cache ✓")
    return corpus

##HELPERS#####################################################################################
 
def parse_ambience(attributes: dict) -> dict:
    raw = attributes.get("Ambience", {})
    if isinstance(raw, str):
        try:
            raw = ast.literal_eval(raw)
        except Exception:
            raw = {}
    return raw if isinstance(raw, dict) else {}
 
 
def ambience_text(attributes: dict) -> str:
    terms = [k for k, v in parse_ambience(attributes).items() if v is True]
    return " ".join(terms)

def practical_text(attributes: dict) -> str:
    """
    Build a short document from the business structured attributes. 
    Use RestaurantsPriceRange2, NoiseLevel, GoodForMeal, RestaurantsTakeOut attributes in the json.
    This lets 'quiet cheap lunch' hit a meaningful field vector.
    """
    if not attributes:
        return ""
    tokens = []
    #price tags, e.g. "cheap cheap" for price 1, "expensive expensive" for price 4
    price = attributes.get("RestaurantsPriceRange2")
    if price:
        try:
            p = int(str(price).strip())
            tokens += ["cheap"] * max(0, 3 - p)          # price 1 → "cheap cheap"
            tokens += ["expensive"] * max(0, p - 2)      # price 4 → "expensive expensive"
        except ValueError:
            pass
        
    #noise tags, e.g. "quiet quiet" for quiet places, "loud loud" for loud places, "loud loud loud" for very_loud places (nothing for avg)
    noise = attributes.get("NoiseLevel", "")
    if "quiet" in str(noise).lower():
        tokens += ["quiet", "quiet"]
    elif "loud" in str(noise).lower():
        tokens += ["loud", "loud"]
    elif "very_loud" in str(noise).lower():
        tokens += ["loud", "loud", "loud"]
 
    #good-for-meal tags, e.g. "lunch", "dinner", "breakfast"
    good_for = attributes.get("GoodForMeal", {})
    if isinstance(good_for, str):
        try:
            good_for = ast.literal_eval(good_for)
        except Exception:
            good_for = {}
    if isinstance(good_for, dict):
        for meal, flag in good_for.items():
            if flag is True:
                tokens.append(meal)   # "lunch", "dinner", "breakfast"
                
    #takeout/delivery tags            
    if str(attributes.get("RestaurantsTakeOut", "")).lower() == "true":
        tokens.append("takeout")
    if str(attributes.get("RestaurantsDelivery", "")).lower() == "true":
        tokens.append("delivery")
        
    #alcohol tags, e.g. "bar", "cocktails", "drinks" for full_bar, "beer", "wine", "drinks" for beer_and_wine
    alcohol = attributes.get("Alcohol", "")
    if "full_bar" in str(alcohol).lower():
        tokens += ["bar", "cocktails", "drinks"]
    if "beer_and_wine" in str(alcohol).lower():
        tokens += ["beer", "wine", "drinks"]
 
    return " ".join(tokens)


def extract_fields(restaurant: dict) -> dict:
    """
    Return the four field strings used for both vectorization and late fusion.
    """
    biz = restaurant.get("business", {})
    attrs = biz.get("attributes") or {}
 
    return {
        "ambience":  ambience_text(attrs),
        "cuisine":   f"{biz.get('name', '')} {biz.get('categories', '')}",
        "reviews":   restaurant.get("combined_reviews", ""),
        "practical": practical_text(attrs),
    }

##CORPUS BUILDING#####################################################################################

DEFAULT_FIELD_WEIGHTS = {
    "ambience":  0.35,
    "cuisine":   0.30,
    "reviews":   0.20,
    "practical": 0.15,
}

def build_corpus(restaurants: list[dict], model_type: str = "word2vec", field_weights: dict | None = None,) -> dict:
    weights = {**DEFAULT_FIELD_WEIGHTS, **(field_weights or {})}
 
    if model_type == "tfidf":
        return _build_tfidf_corpus(restaurants)
    elif model_type == "word2vec":
        return _build_word2vec_corpus(restaurants, weights)
    elif model_type == "bert":
        return _build_bert_corpus(restaurants, weights)
    else:
        raise ValueError(f"Unknown model_type '{model_type}'. Choose tfidf | word2vec | bert.")
    
# TF-IDF corpus
def _build_tfidf_corpus(restaurants: list[dict]) -> dict:
    documents = []
    for r in restaurants:
        fields = extract_fields(r)
        # Ambience repeated 3× so it has more mass in the TF-IDF doc
        documents.append(
            f"{fields['cuisine']} "
            f"{fields['ambience']} {fields['ambience']} {fields['ambience']} "
            f"{fields['reviews']} "
            f"{fields['practical']}"
        )
 
    vectorizer = TfidfVectorizer(
        stop_words="english",
        sublinear_tf=True,
        min_df=2,
        ngram_range=(1, 2),
    )
    tfidf_matrix = vectorizer.fit_transform(documents)
 
    return {
        "model_type":  "tfidf",
        "vectorizer":  vectorizer,
        "tfidf_matrix": tfidf_matrix,
        "restaurants": restaurants,
    }
 
 # Word2Vec corpus  (late-fusion field vectors)
 
def _build_word2vec_corpus(restaurants, field_weights):
    print("[similarity] Loading GloVe model...")
    w2v_model = api.load("glove-wiki-gigaword-100")

    all_fields = [extract_fields(r) for r in restaurants]

    all_docs = [
        f"{f['cuisine']} {f['ambience']} {f['reviews']} {f['practical']}"
        for f in all_fields
    ]
    tfidf_vec = TfidfVectorizer(
        stop_words="english", sublinear_tf=True, min_df=2,
        ngram_range=(1, 2), lowercase=True,
    )
    tfidf_vec.fit(all_docs)

    # Build vocab embedding matrix ONCE (vocab_size, 100)
    print("[similarity] Building vocab embedding matrix...")
    vocab = tfidf_vec.get_feature_names_out()
    vocab_vectors = np.zeros((len(vocab), w2v_model.vector_size))
    for i, word in enumerate(vocab):
        if word in w2v_model:
            vocab_vectors[i] = w2v_model[word]

    field_vectors = {}
    for field_name in DEFAULT_FIELD_WEIGHTS:
        print(f"[similarity] Encoding field '{field_name}'...")
        texts = [f[field_name] for f in all_fields]

        # (N, vocab_size) — one call, no loop
        tfidf_matrix = tfidf_vec.transform(texts).toarray()

        # (N, vocab_size) @ (vocab_size, 100) = (N, 100) — one matrix multiply
        weighted = tfidf_matrix @ vocab_vectors

        # Normalize by weight sums to get weighted average
        weight_sums = tfidf_matrix.sum(axis=1, keepdims=True)
        weight_sums[weight_sums == 0] = 1
        field_vectors[field_name] = weighted / weight_sums

    return {
        "model_type": "word2vec",
        "w2v_model": w2v_model,
        "tfidf_vec": tfidf_vec,
        "field_vectors": field_vectors,
        "field_weights": field_weights,
        "restaurants": restaurants,
    }
 
 
def _compute_w2v_vector(tokens: list[str], w2v_model, tfidf_vectorizer: TfidfVectorizer, tfidf_weights: np.ndarray) -> np.ndarray:
    """
    Weighted average of Word2Vec token vectors.
    Weight = TF-IDF score for that token (falls back to 0.1 if not in vocab).
    """
    vocab = tfidf_vectorizer.get_feature_names_out()
    token_to_weight = {vocab[i]: w for i, w in enumerate(tfidf_weights) if w > 0}
 
    vectors, weights = [], []
    for token in tokens:
        if token in w2v_model:
            vectors.append(w2v_model[token])
            weights.append(token_to_weight.get(token, 0.1))
 
    if not vectors:
        return np.zeros(w2v_model.vector_size)
 
    vectors = np.array(vectors)
    weights = np.array(weights)
    weights /= weights.sum()
    return np.average(vectors, axis=0, weights=weights)
 
 
# BERT corpus
 
def _build_bert_corpus(restaurants: list[dict], field_weights: dict) -> dict:
    from sentence_transformers import SentenceTransformer

    cache_key = _bert_cache_key(restaurants, field_weights)
    cached = _load_bert_corpus(cache_key)
    if cached is not None:
        return cached
 
    print("[similarity] Loading BERT model (all-MiniLM-L6-v2)…")
    bert_model = SentenceTransformer("all-MiniLM-L6-v2")
 
    all_fields = [extract_fields(r) for r in restaurants]
 
    field_vectors = {}
    for field_name in DEFAULT_FIELD_WEIGHTS:
        texts = [f[field_name] if f[field_name].strip() else "none" for f in all_fields]
        print(f"[similarity] Encoding field '{field_name}' ({len(texts)} docs)…")
        field_vectors[field_name] = bert_model.encode(
            texts,
            batch_size=64,
            show_progress_bar=True,
            convert_to_numpy=True,
        )
 
    corpus = {
        "model_type":    "bert",
        "bert_model":    bert_model,
        "field_vectors": field_vectors,
        "field_weights": field_weights,
        "restaurants":   restaurants,
    }
    _save_bert_corpus(corpus, cache_key)
    return corpus
    
# Query vectorization
 
def vectorize_query_tfidf(query: str, corpus: dict):
    return corpus["vectorizer"].transform([query])
 
 
def vectorize_query_w2v(query: str, corpus: dict) -> np.ndarray:
    """
    For late-fusion Word2Vec, we encode the query once and compare it
    against each field's restaurant vectors separately.
    The query is treated as a single 'document' — no field splitting needed
    because the user's query is already a short mixed-intent string.
    """
    tokens = re.findall(r'\b\w+\b', query.lower())
    tfidf_weights = corpus["tfidf_vec"].transform([query.lower()]).toarray().flatten()
    return _compute_w2v_vector(tokens, corpus["w2v_model"], corpus["tfidf_vec"], tfidf_weights)
 
 
def vectorize_query_bert(query: str, corpus: dict) -> np.ndarray:
    return corpus["bert_model"].encode([query], convert_to_numpy=True)[0]

def fuse_scores(query_vec: np.ndarray, corpus: dict) -> np.ndarray:
    """
    Compute a weighted average of per-field cosine similarities.
 
    For each field (ambience, cuisine, reviews, practical):
        field_score[i] = cosine_sim(query_vec, restaurant_field_vec[i])
    
    Final score = Σ weight_f * field_score_f  for all fields f
 
    This means a query like 'quiet cheap lunch' will score high on the
    practical field even if the restaurant's review text uses different
    vocabulary, because those signals are kept separate and not diluted.
    """
    q = query_vec.reshape(1, -1)
    weights = corpus["field_weights"]
    field_vectors = corpus["field_vectors"]
 
    combined = np.zeros(len(corpus["restaurants"]))
    for field_name, weight in weights.items():
        field_mat = field_vectors[field_name]  # (N, D)
        # Some restaurants may have zero-vectors for sparse fields (e.g. no ambience tags)
        # sklearn cosine handles this gracefully (returns 0)
        sims = sklearn_cosine(q, field_mat).flatten()
        combined += weight * sims
 
    return combined


def rank_restaurants(query: str, corpus: dict, type: str = "word2vec") -> list[dict]:
    if type == "tfidf":
        query_vec = vectorize_query_tfidf(query, corpus)
        scores = sklearn_cosine(query_vec, corpus["tfidf_matrix"]).flatten()
    elif type == "word2vec":
        query_vec = vectorize_query_w2v(query, corpus)
        scores = fuse_scores(query_vec, corpus)
    elif type == "bert":
        query_vec = vectorize_query_bert(query, corpus)
        scores = fuse_scores(query_vec, corpus)
    else:
        raise ValueError(f"Unknown type '{type}'. Choose tfidf, word2vec, or bert.")
    
    results = []
    for idx, score in enumerate(scores):
        if score > 0:
            r = corpus["restaurants"][idx]
            results.append({
                "score":            round(float(score), 6),
                "business":         r["business"],
                "reviews":          r.get("reviews", []),
                "combined_reviews": r.get("combined_reviews", ""),
            })
 
    results.sort(key=lambda x: x["score"], reverse=True)
    return results

def _correct_query(query: str, vectorizer) -> str:
    """
    Replace words not in the TF-IDF vocabulary with their closest match.
    Words already in the vocabulary pass through unchanged.
    Words with no close match (cutoff=0.75) are kept as-is.
    """
    vocab = list(vectorizer.vocabulary_.keys())
    corrected = []
    for word in query.lower().split():
        if word in vectorizer.vocabulary_:
            corrected.append(word)
        else:
            matches = difflib.get_close_matches(word, vocab, n=1, cutoff=0.75)
            corrected.append(matches[0] if matches else word)
    return " ".join(corrected)


def get_similarity_scores(query: str, restaurants: list[dict], type: str = "word2vec", field_weights: dict | None = None,) -> list[float]:  
    """
    Convenience function for search.py.
    Given a query and a list of restaurant dicts (already filtered by city),
    returns a flat list of cosine similarity scores in the same order as the input.
 
    Args:
        query: user query e.g. "ramen" or "spicy tacos"
        restaurants: city-filtered list of restaurant dicts from init.json
        type: either "word2vec" or "tfidf"

    Returns:
        List of float scores, one per restaurant, in the original order.
        Scores are 0.0 for restaurants with no term overlap with the query.
    """
    if not restaurants:
        return []
    
    corpus = build_corpus(restaurants, model_type=type, field_weights=field_weights)    
    if type == "tfidf":
        corrected_query = _correct_query(query, corpus["vectorizer"])
    else:
        corrected_query = query
 
    if type == "tfidf":      
        query_vec = vectorize_query_tfidf(corrected_query, corpus)
        scores = sklearn_cosine(query_vec, corpus["tfidf_matrix"]).flatten()
    elif type == "word2vec":
        query_vec = vectorize_query_w2v(corrected_query, corpus)
        scores = fuse_scores(query_vec, corpus)
    elif type == "bert":
        query_vec = vectorize_query_bert(corrected_query, corpus)
        scores = fuse_scores(query_vec, corpus)
    else:
        raise ValueError(f"Unknown type '{type}'. Choose tfidf, word2vec, or bert.")
    
    return [round(float(s), 6) for s in scores]
 
 
if __name__ == "__main__":
    import json

    with open(os.path.join(os.path.dirname(__file__), "init.json"), "r", encoding="utf-8") as f:
        all_restaurants = json.load(f)
    
    city = "Philadelphia"
    test_queries = [
        "casual takeout sushi",
        "fancy formal sushi",
        "fancy formal japanese food",
        "romantic dinner",
        "authentic vietnamese",
        "quiet cheap lunch",
    ]
    
    city_restaurants = [
        r for r in all_restaurants
        if r["business"].get("city", "").lower().strip() == city.lower()
    ]

    print(f"✓ Loaded {len(city_restaurants)} restaurants in {city}\n")
    print("=" * 100)
    print("Building corpuses (this may take 1-2 minutes for Word2Vec)...")
    print("=" * 100)

    tfidf_corpus = build_corpus(city_restaurants, model_type="tfidf")
    word2vec_corpus = build_corpus(city_restaurants, model_type="word2vec")
    bert_corpus = build_corpus(city_restaurants, model_type="bert")

    print("\n" + "=" * 100)
    print("COMPARISON: TF-IDF vs Word2Vec vs BERT")
    print("=" * 100)
    
    for query in test_queries:
        print(f"\n🔍 Query: '{query}'")
        print("-" * 100)
        
        # TF-IDF results
        tfidf_results = rank_restaurants(query, tfidf_corpus, type="tfidf")
        print("TF-IDF Top 5:")
        for i, r in enumerate(tfidf_results[:5], 1):
            biz = r["business"]
            print(f"  {i}. [{r['score']:.4f}] {biz['name']} | {biz.get('categories', '')[:50]}")
        
        # Word2Vec results
        w2v_results = rank_restaurants(query, word2vec_corpus, type="word2vec")
        print("\nWord2Vec Top 5:")
        for i, r in enumerate(w2v_results[:5], 1):
            biz = r["business"]
            print(f"  {i}. [{r['score']:.4f}] {biz['name']} | {biz.get('categories', '')[:50]}")
        
        # BERT results
        bert_results = rank_restaurants(query, bert_corpus, type="bert")
        print("\nBERT Top 5:")
        for i, r in enumerate(bert_results[:5], 1):
            biz = r["business"]
            print(f"  {i}. [{r['score']:.4f}] {biz['name']} | {biz.get('categories', '')[:50]}")
        
        # Show overlap
        tfidf_names = set(r["business"]["name"] for r in tfidf_results[:5])
        w2v_names = set(r["business"]["name"] for r in w2v_results[:5])
        bert_names = set(r["business"]["name"] for r in bert_results[:5])
        
        tfidf_w2v_overlap = len(tfidf_names & w2v_names)
        tfidf_bert_overlap = len(tfidf_names & bert_names)
        w2v_bert_overlap = len(w2v_names & bert_names)
        
        print(f"\n📊 Top-5 Overlap: TF-IDF↔W2V={tfidf_w2v_overlap}, TF-IDF↔BERT={tfidf_bert_overlap}, W2V↔BERT={w2v_bert_overlap}")
        print()
   

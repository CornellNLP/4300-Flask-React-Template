import math
import re
import collections
import ast
import json
import numpy as np
import gensim.downloader as api
from gensim.models import Word2Vec
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity as sklearn_cosine


def build_word2vec_corpus(restaurants: list[dict]) -> dict:
    documents = []
    tokenized_docs = []
    
    for r in restaurants:
        biz = r.get("business", {})
        name       = biz.get("name", "")
        categories = biz.get("categories", "")
        reviews    = r.get("combined_reviews", "")
        
        # Add ambiance tags
        attributes = biz.get("attributes", {})
        ambience_raw = attributes.get("Ambience", {})
        if isinstance(ambience_raw, str):
            try:
                ambience_raw = ast.literal_eval(ambience_raw)
            except:
                ambience_raw = {}
        
        if not ambience_raw:
            ambience_raw = {}
        
        ambience_terms = [k for k, v in ambience_raw.items() if v is True]
        ambience_str = " ".join(ambience_terms * 3) #temporary implementation
        
        # Combine all text
        full_text = f"{name} {categories} {reviews} {ambience_str}".lower()
        documents.append(full_text)
        
        # Tokenize for Word2Vec
        tokens = re.findall(r'\b\w+\b', full_text)
        tokenized_docs.append(tokens)
    
    model = api.load("word2vec-google-news-300")   
     
    tfidf_vectorizer = TfidfVectorizer(
        stop_words="english",
        sublinear_tf=True,
        min_df=2,
        ngram_range=(1, 2),
        lowercase=True,
    )
    tfidf_matrix = tfidf_vectorizer.fit_transform(documents)
    
    # Convert TF-IDF matrix to dense for easier processing
    tfidf_dense = tfidf_matrix.toarray()
    
    # Pre-compute restaurant vectors (Word2Vec + TF-IDF weighted)
    restaurant_vectors = []
    for doc_idx, tokens in enumerate(tokenized_docs):
        vector = _compute_weighted_vector(
            tokens, 
            model, 
            tfidf_vectorizer,
            tfidf_dense[doc_idx]
        )
        restaurant_vectors.append(vector)
    
    return {
        "word2vec_model": model,
        "tfidf_vectorizer": tfidf_vectorizer,
        "tfidf_matrix": tfidf_dense,
        "restaurant_vectors": np.array(restaurant_vectors),
        "tokenized_docs": tokenized_docs,
        "restaurants": restaurants,
    }

def build_tfidf_corpus(restaurants: list[dict]) -> dict:
    """
    Pre-compute TF-IDF matrix for all restaurants.
    Call this once when the app starts (e.g. after loading init.json).
 
    Each restaurant's document = combined_reviews + business name + categories,
    so name/category terms also contribute to similarity scoring.
 
    Returns a corpus dict to pass into rank_restaurants().
    """
    documents = []
    for r in restaurants:
        biz = r.get("business", {})
        name       = biz.get("name", "")
        categories = biz.get("categories", "")
        reviews    = r.get("combined_reviews", "")
        
        # Add ambiance tags in the business into this as well so its not jts pure table lookup, the ambiance factored into the representation
        ambience_str = ""
        attributes = biz.get("attributes") or {}
        ambience_raw = attributes.get("Ambience") or {}

        if isinstance(ambience_raw, str):
            try:
                ambience_raw = ast.literal_eval(ambience_raw)
            except:
                ambience_raw = {}

        if not isinstance(ambience_raw, dict):
            ambience_raw = {}

        ambience_terms = [k for k, v in ambience_raw.items() if v is True]
        ambience_str = " ".join(ambience_terms * 3)
        
        documents.append(f"{name} {categories} {reviews} {ambience_str}")
 
    vectorizer = TfidfVectorizer(
        stop_words="english",       # sklearn's built-in English stop list
        sublinear_tf=True,          # apply log(tf) scaling, helps with long reviews
        min_df=2,                   
        ngram_range=(1, 2),         
    )
 
    tfidf_matrix = vectorizer.fit_transform(documents)
 
    return {
        "vectorizer": vectorizer,
        "tfidf_matrix": tfidf_matrix,
        "restaurants": restaurants,
    }

 
def vectorize_query(query: str, vectorizer: TfidfVectorizer):
    """
    Transform a raw user query string into a TF-IDF vector using the
    already-fitted vectorizer from the corpus.
 
    Unknown terms (not seen during fit) are silently ignored by sklearn.
    """
    return vectorizer.transform([query])

def vectorize_query_word2vec(query: str, corpus: dict) -> np.ndarray:
    """
    Transform a user query into a Word2Vec + TF-IDF weighted vector.
    """
    tokens = re.findall(r'\b\w+\b', query.lower())
    
    # Tokenize query for TF-IDF
    tfidf_vec = corpus["tfidf_vectorizer"].transform([query.lower()]).toarray().flatten()
    
    return _compute_weighted_vector(
        tokens,
        corpus["word2vec_model"],
        corpus["tfidf_vectorizer"],
        tfidf_vec
    )

def _compute_weighted_vector(tokens: list[str], word2vec_model, tfidf_vectorizer, tfidf_weights: np.ndarray) -> np.ndarray:
    """
    Compute a single restaurant's vector:
    - Get Word2Vec vectors for each token
    - Weight by TF-IDF importance
    - Return weighted average (300d vector)
    """
    vectors = []
    weights = []
    
    # Map tokens to TF-IDF weights
    tfidf_vocab = tfidf_vectorizer.get_feature_names_out()
    token_to_tfidf = {}
    for idx, weight in enumerate(tfidf_weights):
        if weight > 0:
            token_to_tfidf[tfidf_vocab[idx]] = weight
    
    # Collect Word2Vec vectors for tokens in vocab
    for token in tokens:
        if token in word2vec_model.wv:
            vectors.append(word2vec_model.wv[token])
            # Use TF-IDF weight if available, else 1.0
            weight = token_to_tfidf.get(token, 0.1)
            weights.append(weight)
    
    if not vectors:
        # Return zero vector if no valid tokens
        return np.zeros(word2vec_model.vector_size)
    
    # Weighted average
    vectors = np.array(vectors)
    weights = np.array(weights)
    weights = weights / weights.sum()  # Normalize weights
    
    return np.average(vectors, axis=0, weights=weights)
 
 
 
def rank_restaurants(query: str, corpus: dict, type: str = "word2vec") -> list[dict]:
    """
    Score every restaurant against the query and return them sorted by
    descending cosine similarity.
  
    Args:
        query:   raw user query string e.g. "casual ramen New York"
        corpus:  dict returned by build_tfidf_corpus()
        type:    either "word2vec" or "tfidf"

    Returns:
        List of result dicts sorted best-first:
        [
          {
            "score":    0.312,
            "business": { ... },
            "reviews":  [ ... ],
            "combined_reviews": "..."
          },
          ...
        ]
    """
    if type == "tfidf":
        query_vec = vectorize_query(query, corpus["vectorizer"])
        scores = sklearn_cosine(query_vec, corpus["tfidf_matrix"]).flatten()
    
        results = []
        for idx, score in enumerate(scores):
            if score > 0:
                restaurant = corpus["restaurants"][idx]
                results.append({
                    "score": round(float(score), 6),
                    "business": restaurant["business"],
                    "reviews": restaurant.get("reviews", []),
                    "combined_reviews": restaurant.get("combined_reviews", ""),
                })
    
        results.sort(key=lambda x: x["score"], reverse=True)
        return results
    else:
        query_vec = vectorize_query_word2vec(query, corpus)
    
        # Compute cosine similarity
        query_vec_reshaped = query_vec.reshape(1, -1)
        scores = sklearn_cosine(query_vec_reshaped, corpus["restaurant_vectors"]).flatten()
        
        results = []
        for idx, score in enumerate(scores):
            if score > 0:
                restaurant = corpus["restaurants"][idx]
                results.append({
                    "score": round(float(score), 6),
                    "business": restaurant["business"],
                    "reviews": restaurant.get("reviews", []),
                    "combined_reviews": restaurant.get("combined_reviews", ""),
                })
        
        results.sort(key=lambda x: x["score"], reverse=True)
        return results

#type: either word2vec or tfidf, default to word2vec
def get_similarity_scores(query: str, restaurants: list[dict], type: str = "word2vec") -> list[float]:
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
 
    if type == "tfidf":
      
        corpus = build_tfidf_corpus(restaurants)
        query_vec = vectorize_query(query, corpus["vectorizer"])
        scores = sklearn_cosine(query_vec, corpus["tfidf_matrix"]).flatten()
        return [round(float(s), 6) for s in scores]
    else:
        corpus = build_word2vec_corpus(restaurants)
        query_vec = vectorize_query_word2vec(query, corpus)
        query_vec_reshaped = query_vec.reshape(1, -1)
        scores = sklearn_cosine(query_vec_reshaped, corpus["restaurant_vectors"]).flatten()
        return [round(float(s), 6) for s in scores]
 
 
if __name__ == "__main__":

    with open("src/init.json", "r", encoding="utf-8") as f:
        all_restaurants = json.load(f)
    
    city = "Philadelphia"
    top_k = 5
    test_queries = [
        "casual takeout sushi",     
        "fancy formal sushi",
        "fancy formal japanese food",   
        "romantic dinner",     
        "authentic vietnamese", 
        "quiet cheap lunch"
    ]
    
    city_restaurants = [
        r for r in all_restaurants
        if r["business"].get("city", "").lower().strip() == city.lower()
    ]

    print(f"Loaded {len(city_restaurants)} restaurants in {city}\n")

    tfidf_corpus = build_tfidf_corpus(city_restaurants)
    word2vec_corpus = build_word2vec_corpus(city_restaurants)


    
    for q in test_queries:
        print(f"TF-IDF results for query: '{q}'")
        ranked = rank_restaurants(q, tfidf_corpus, type="tfidf")
        for r in ranked[:5]:  # show top 5
            biz = r["business"]
            print(f"  {r['score']:.4f}  {biz['name']} | {biz.get('categories', '')[:40]}")
        ranked = rank_restaurants(q, word2vec_corpus, type="word2vec")
        print(f"Word2Vec results for query: '{q}'")
        for r in ranked[:5]:  # show top 5
            biz = r["business"]
            print(f"  {r['score']:.4f}  {biz['name']} | {biz.get('categories', '')[:40]}")
        print()
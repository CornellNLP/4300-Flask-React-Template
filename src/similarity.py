import ast
import collections
import difflib
import json
import math
import os
import re

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity as sklearn_cosine

from config import INIT_JSON_PATH

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
 
 
 
def rank_restaurants(query: str, corpus: dict) -> list[dict]:
    """
    Score every restaurant against the query and return them sorted by
    descending cosine similarity.
  
    Args:
        query:   raw user query string e.g. "casual ramen New York"
        corpus:  dict returned by build_tfidf_corpus()
 
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


def get_similarity_scores(query: str, restaurants: list[dict]) -> list[float]:
    """
    Convenience function for search.py.
    Given a query and a list of restaurant dicts (already filtered by city),
    returns a flat list of cosine similarity scores in the same order as the input.
 
    Args:
        query: user query e.g. "ramen" or "spicy tacos"
        restaurants: city-filtered list of restaurant dicts from init.json
 
    Returns:
        List of float scores, one per restaurant, in the original order.
        Scores are 0.0 for restaurants with no term overlap with the query.
    """
    if not restaurants:
        return []
 
    corpus = build_tfidf_corpus(restaurants)
    corrected_query = _correct_query(query, corpus["vectorizer"])
    query_vec = vectorize_query(corrected_query, corpus["vectorizer"])
    scores = sklearn_cosine(query_vec, corpus["tfidf_matrix"]).flatten()
    return [round(float(s), 6) for s in scores]
 
 
if __name__ == "__main__":
    import json

    with open(os.path.join(os.path.dirname(__file__), "init.json"), "r", encoding="utf-8") as f:
        all_restaurants = json.load(f)
    
    city = "Philadelphia"
    city_restaurants = [
        r for r in all_restaurants
        if r["business"].get("city", "").lower().strip() == city.lower()
    ]

    print(f"Loaded {len(city_restaurants)} restaurants in {city}\n")

    corpus = build_tfidf_corpus(city_restaurants)

    test_queries = [
        "casual sushi",        
        "casual indian",       
        "romantic dinner",     
        "authentic vietnamese", 
        "quiet cheap lunch",   
    ]
    
    for q in test_queries:
        ranked = rank_restaurants(q, corpus)
        print(f"Query: '{q}'")
        if not ranked:
            print("  (no matches)")
        for r in ranked[:5]:  # show top 5
            biz = r["business"]
            print(f"  {r['score']:.4f}  {biz['name']} | {biz.get('categories', '')[:40]}")
        print()

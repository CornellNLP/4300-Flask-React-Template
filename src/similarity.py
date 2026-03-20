import math
import re
import collections 
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity as sklearn_cosine

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
        attributes = biz.get("attributes", {})
        ambience_raw = attributes.get("Ambience", {})
        if isinstance(ambience_raw, str):
            import ast
            try:
                ambience_raw = ast.literal_eval(ambience_raw)
            except:
                ambience_raw = {}
        ambience_terms = [k for k, v in ambience_raw.items() if v is True]
        ambience_str = " ".join(ambience_terms*3) #join 3 times to make ambiance more important? do we wanna do that since we wanna emphasize our ambiance aspect
        
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
                "reviews": restaurant["reviews"],
                "combined_reviews": restaurant["combined_reviews"],
            })
 
    results.sort(key=lambda x: x["score"], reverse=True)
    return results

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
    query_vec = vectorize_query(query, corpus["vectorizer"])
    scores = sklearn_cosine(query_vec, corpus["tfidf_matrix"]).flatten()
    return [round(float(s), 6) for s in scores]
 
 
if __name__ == "__main__":
    sample_restaurants = [
        {
            "business": {"business_id": "1", "name": "Tokyo Ramen House",
                         "categories": "Restaurants, Ramen, Japanese"},
            "reviews": [],
            "combined_reviews": "rich broth noodles pork belly soft boiled egg tonkotsu ramen amazing"
        },
        {
            "business": {"business_id": "2", "name": "Philly Cheesesteak Co",
                         "categories": "Restaurants, Cheesesteaks, American"},
            "reviews": [],
            "combined_reviews": "classic cheesesteak whiz onions fresh roll best philly cheese steak ever"
        },
        {
            "business": {"business_id": "3", "name": "Sushi Garden",
                         "categories": "Restaurants, Sushi, Japanese"},
            "reviews": [],
            "combined_reviews": "fresh fish nigiri sashimi rolls rice vinegar soy wasabi miso soup"
        },
        {
            "business": {"business_id": "4", "name": "Ramen Republic",
                         "categories": "Restaurants, Ramen, Noodles"},
            "reviews": [],
            "combined_reviews": "spicy miso ramen thick noodles corn butter rich pork broth chashu"
        },
    ]
 
    corpus = build_tfidf_corpus(sample_restaurants)
 
    for q in ["ramen", "cheesesteak philly", "japanese sushi"]:
        ranked = rank_restaurants(q, corpus)
        print(f"\nQuery: '{q}'")
        for r in ranked:
            print(f"  {r['score']:.4f}  {r['business']['name']}")


 
import heapq
import json
import os

from config import INIT_JSON_PATH
from preprocess import preprocess_query
from similarity import build_corpus, rank_restaurants, DEFAULT_FIELD_WEIGHTS

_PROCESSED_DATA = None
_CORPUS_CACHE = {}
SEARCH_SIMILARITY_MODEL = "bert"


def load_processed_data():
    global _PROCESSED_DATA
    if _PROCESSED_DATA is None:
        with open(os.path.join(os.path.dirname(__file__), "init.json"), "r", encoding="utf-8") as f:
            _PROCESSED_DATA = json.load(f)
    return _PROCESSED_DATA


# gets top 10 restaurants by name, ensuring no duplicates, and returns them sorted by match score
PRICE_MAP = {
    1: "$",
    2: "$$",
    3: "$$$",
    4: "$$$$",
}


def get_price_info(business):
    attributes = business.get("attributes") or {}
    price_value = attributes.get("RestaurantsPriceRange2") or business.get("RestaurantsPriceRange2")
    price_tier = None
    if isinstance(price_value, (int, float)):
        price_tier = int(price_value)
    elif isinstance(price_value, str):
        cleaned = price_value.strip()
        if cleaned.startswith("u'") and cleaned.endswith("'"):
            cleaned = cleaned[2:-1]
        cleaned = cleaned.strip("'\"")
        if cleaned.isdigit():
            price_tier = int(cleaned)
    price_label = PRICE_MAP.get(price_tier)
    return price_tier, price_label


def get_top_restaurants(ranked_results, k=10):
    """
    Takes ranked_results from rank_restaurants() (already sorted by score),
    deduplicates by name, returns top k.
    """
    best_by_name = {}
    for r in ranked_results:
        business = r["business"]
        name = business["name"]
        score = r["score"]

        if name in best_by_name and best_by_name[name]["matchScore"] >= score:
            continue

        price_tier, price_label = get_price_info(business)
        best_by_name[name] = {
            "business_id":  business["business_id"],
            "name":         name,
            "address":      business.get("address"),
            "city":         business["city"],
            "state":        business.get("state"),
            "postal_code":  business.get("postal_code"),
            "stars":        business.get("stars"),
            "review_count": business.get("review_count"),
            "categories":   business.get("categories"),
            "hours":        business.get("hours"),
            "priceTier":    price_tier,
            "priceRange":   price_label,
            "matchScore":   float(score),
        }

    return heapq.nlargest(k, best_by_name.values(), key=lambda x: x["matchScore"])


def restaurant_search(query):
    if not query or not query.strip():
        return {"error": "Missing search query", "results": []}

    processed_data = load_processed_data()
    businesses = [r["business"] for r in processed_data]

    query_info = preprocess_query(query, businesses)
    if query_info["error"] is not None:
        return {"error": query_info["error"], "results": []}

    city = query_info["city"]
    food_item = query_info["food_item"]

    city_restaurants = [
        r for r in processed_data
        if r["business"].get("city", "").lower().strip() == city
    ]
    if not city_restaurants:
        return {"error": "No restaurants found in that city", "results": []}

    # Use cached corpus for this city if available, otherwise build + cache it
    if city not in _CORPUS_CACHE:
        print(f"[search] Building {SEARCH_SIMILARITY_MODEL.upper()} corpus for {len(city_restaurants)} restaurants in {city}...")
        _CORPUS_CACHE[city] = build_corpus(city_restaurants, model_type=SEARCH_SIMILARITY_MODEL)

    corpus = _CORPUS_CACHE[city]
    scoring_query = food_item.strip() if food_item and food_item.strip() else query

    print(f"[search] Ranking restaurants for query: '{scoring_query}'...")
    ranked_results = rank_restaurants(scoring_query, corpus, type=SEARCH_SIMILARITY_MODEL)

    top_results = get_top_restaurants(ranked_results, k=10)
    if not top_results:
        return {"error": "No matching restaurants found", "results": []}

    return {"error": None, "results": top_results}
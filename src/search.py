import heapq
import json

from preprocess import preprocess_query
from similarity import get_similarity_scores

_PROCESSED_DATA = None


def load_processed_data():
    global _PROCESSED_DATA
    if _PROCESSED_DATA is None:
        with open("init.json", "r", encoding="utf-8") as f:
            _PROCESSED_DATA = json.load(f)
    return _PROCESSED_DATA


# gets top 10 restaurants by name, ensuring no duplicates, and returns them sorted by match score
def get_top_restaurants(processed_restaurants, similarity_scores, k=10):
    best_by_name = {}

    for restaurant, score in zip(processed_restaurants, similarity_scores):
        if score <= 0:
            continue

        business = restaurant["business"]

        entry = {
            "business_id": business["business_id"],
            "name": business["name"],
            "address": business.get("address"),
            "city": business["city"],
            "state": business.get("state"),
            "postal_code": business.get("postal_code"),
            "stars": business.get("stars"),
            "review_count": business.get("review_count"),
            "categories": business.get("categories"),
            "matchScore": float(score)
        }

        name = business["name"]

        if name not in best_by_name:
            best_by_name[name] = entry
        else:
            if entry["matchScore"] > best_by_name[name]["matchScore"]:
                best_by_name[name] = entry

    top_k = heapq.nlargest(k, best_by_name.values(), key=lambda x: x["matchScore"])
    return top_k


def restaurant_search(query):
    if not query or not query.strip():
        return {
            "error": "Missing search query",
            "results": []
        }

    # load processed dataset
    processed_data = load_processed_data()

    # extract plain business dicts for query parsing
    businesses = [restaurant["business"] for restaurant in processed_data]

    # parse query (city + food)
    query_info = preprocess_query(query, businesses)
    if query_info["error"] is not None:
        return {
            "error": query_info["error"],
            "results": []
        }

    city = query_info["city"]
    food_item = query_info["food_item"]

    # filter restaurants by city
    city_restaurants = []
    for restaurant in processed_data:
        business = restaurant["business"]
        business_city = business.get("city", "").lower().strip()
        if business_city == city:
            city_restaurants.append(restaurant)

    scoring_query = food_item.strip() if food_item and food_item.strip() else query
    similarity_scores = get_similarity_scores(scoring_query, city_restaurants)

    # get top results using get_top_restaurants function
    top_results = get_top_restaurants(city_restaurants, similarity_scores, k=10)

    if not top_results:
        return {
            "error": "No matching restaurants found",
            "results": []
        }

    return {
        "error": None,
        "results": top_results
    }
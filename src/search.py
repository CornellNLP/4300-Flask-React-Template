import heapq
import json

from preprocess import preprocess_query
from similarity import get_similarity_scores


def load_processed_data():
    with open("src/init.json", "r", encoding="utf-8") as f:
        return json.load(f)

# gets top 10 restaurants based on similarity scores, returns a list of dicts with business info and match score
def get_top_restaurants(processed_restaurants, similarity_scores, k = 10):
    scored_results = []

    for restaurant, score in zip(processed_restaurants, similarity_scores):
        business = restaurant["business"]

        scored_results.append({
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
        })

    top_k = heapq.nlargest(k, scored_results, key=lambda x: x["matchScore"])

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
    food_item = query_info["food_item"]  # for later similarity use

    # filter restaurants by city
    city_restaurants = []
    for restaurant in processed_data:
        business = restaurant["business"]
        business_city = business.get("city", "").lower().strip()
        if business_city == city:
            city_restaurants.append(restaurant)

    # temporary fake similarity scores (replace later)
    similarity_scores = get_similarity_scores(food_item, city_restaurants)

    # get top results using get_top_restaurants function
    top_results = get_top_restaurants(city_restaurants, similarity_scores, k=10)

    return {
        "error": None,
        "results": top_results
    }
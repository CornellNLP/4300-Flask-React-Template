import json
import re

"""
Each entry in src/init.json now looks like:
{
  "business": {
    "business_id": "...",
    "name": "...",
    "address": "...",
    "city": "...",
    "state": "...",
    "postal_code": "...",
    "latitude": 0.0,
    "longitude": 0.0,
    "stars": 4.0,
    "review_count": 25,
    "attributes": {...},
    "categories": "...",
    "hours": {...}
  },
  "combined_reviews": "all cleaned reviews joined together"
}
"""

# raw input files
BUSINESS_PATH = "data/sampled_businesses.json"
REVIEW_PATH = "data/sampled_reviews.json"

# cleaned output file for the template
OUTPUT_PATH = "src/init.json"

MAX_REVIEWS_PER_BUSINESS = 25

# simple stop word list
STOP_WORDS = {
    "a", "an", "the", "and", "or", "but", "if", "then", "so",
    "to", "of", "in", "on", "at", "for", "with", "from", "by",
    "is", "am", "are", "was", "were", "be", "been", "being",
    "it", "this", "that", "these", "those",
    "i", "me", "my", "we", "our", "you", "your",
    "he", "him", "his", "she", "her", "they", "them", "their",
    "had", "has", "have", "do", "does", "did",
    "just", "very", "really", "also", "there", "here",
    "as", "about", "into", "up", "down", "out", "over", "under",
    "again", "more", "most", "some", "such", "only", "own",
    "same", "too", "can", "will", "would", "could", "should"
}

# filler words that are not the actual food item
QUERY_FILLER_WORDS = {
    "want", "looking", "for", "find", "near", "in",
    "restaurant", "restaurants", "place", "places",
    "food", "craving", "good", "best"
}


def load_jsonl(path):
    #loads the data
    data = []

    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                data.append(json.loads(line))
            except json.JSONDecodeError:
                continue
    return data


def normalize_text(text):
    #normalizes text
    if not isinstance(text, str):
        return ""
    text = text.lower()
    text = re.sub(r"[^\w\s]", " ", text)
    text = re.sub(r"_", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text

def preprocess_text(text):
    # lowercase + punctuation removal + stop word removal
    text = normalize_text(text)
    words = text.split()
    words = [word for word in words if word not in STOP_WORDS]
    return " ".join(words)

def is_restaurant_business(business):
    # checks whether this business is a restaurant / fast food place
    categories = business.get("categories", "")
    if not isinstance(categories, str):
        return False
    categories = categories.lower()
    return ("restaurants" in categories) or ("fast food" in categories)

def get_valid_cities(businesses):
    # collect all city names from businesses
    cities = set()
    for business in businesses:
        city = business.get("city", "")
        if isinstance(city, str) and city.strip():
            cities.add(city.lower().strip())
    return cities

def extract_city(query, valid_cities):
    # find a city name inside the user query
    if not isinstance(query, str):
        return None
    query = normalize_text(query)

    # sort longest first so multi-word cities match first
    for city in sorted(valid_cities, key=len, reverse=True):
        pattern = rf"\b{re.escape(city)}\b"
        if re.search(pattern, query):
            return city
    return None


def extract_food_item(query, city):
    # remove city and filler words from the query, keep important remaining words
    query = normalize_text(query)
    if city:
        query = re.sub(rf"\b{re.escape(city)}\b", " ", query)
        query = re.sub(r"\s+", " ", query).strip()
    words = query.split()
    words = [
        word for word in words
        if word not in STOP_WORDS and word not in QUERY_FILLER_WORDS
    ]
    return " ".join(words)


def filter_businesses_by_city(businesses, city):
    # keep only restaurant businesses in one city
    filtered = []
    for business in businesses:
        business_city = business.get("city", "")
        if not isinstance(business_city, str):
            continue
        if business_city.lower().strip() != city:
            continue
        if not is_restaurant_business(business):
            continue
        filtered.append(business)
    return filtered

def filter_reviews_by_business_ids(reviews, business_ids):
    # keep only reviews whose business_id is in business_ids
    filtered = []
    for review in reviews:
        if review.get("business_id") in business_ids:
            filtered.append(review)
    return filtered

def build_processed_restaurant_data(businesses, reviews):
    business_lookup = {}
    review_text_lookup = {}
    output = []

    # keep full business info
    for business in businesses:
        if not is_restaurant_business(business):
            continue
        business_id = business.get("business_id")
        if not business_id:
            continue
        item = {
            "business": business.copy(),
            "combined_reviews": ""
        }
        business_lookup[business_id] = item
        review_text_lookup[business_id] = []
        output.append(item)

    # collect only cleaned review text
    for review in reviews:
        business_id = review.get("business_id")
        if business_id not in business_lookup:
            continue
        if len(review_text_lookup[business_id]) >= MAX_REVIEWS_PER_BUSINESS:
            continue
        clean_text = preprocess_text(review.get("text", ""))
        if clean_text:
            review_text_lookup[business_id].append(clean_text)

    # build joined cleaned review text
    final_output = []
    for item in output:
        business_id = item["business"]["business_id"]
        clean_reviews = review_text_lookup[business_id]
        if not clean_reviews:
            continue
        item["combined_reviews"] = " ".join(clean_reviews)
        final_output.append(item)
    return final_output

def write_json(path, data):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

def preprocess_query(query, businesses):
    """
    Helper for later search use.

    Returns:
    {
        "error": None or "retry with city name",
        "city": "...",
        "food_item": "..."
    }
    """
    valid_cities = get_valid_cities(businesses)
    city = extract_city(query, valid_cities)
    if city is None:
        return {
            "error": "retry with city name",
            "city": None,
            "food_item": None
        }
    food_item = extract_food_item(query, city)
    return {
        "error": None,
        "city": city,
        "food_item": food_item
    }

def preprocess_for_query(query, businesses, reviews):
    """
    uts everything tg in the pipeline:
    query
    -> find city
    -> if no valid city, return "retry with city name"
    -> filter businesses in that city
    -> filter reviews for those businesses
    -> extract food item from the rest of the query
    """
    valid_cities = get_valid_cities(businesses)
    city = extract_city(query, valid_cities)

    if city is None:
        return {
            "error": "retry with city name",
            "city": None,
            "food_item": None,
            "businesses": [],
            "reviews": []
        }

    food_item = extract_food_item(query, city)

    city_businesses = filter_businesses_by_city(businesses, city)

    business_ids = set()
    for business in city_businesses:
        business_ids.add(business.get("business_id"))

    city_reviews = filter_reviews_by_business_ids(reviews, business_ids)

    return {
        "error": None,
        "city": city,
        "food_item": food_item,
        "businesses": city_businesses,
        "reviews": city_reviews
    }

def test_queries():
    businesses = load_jsonl(BUSINESS_PATH)
    reviews = load_jsonl(REVIEW_PATH)

    sample_queries = [
    "pizza in philadelphia",
    "best sushi in philadelphia",
    "looking for tacos in philadelphia",
    "good chinese food in philadelphia",
    "burger places in philadelphia",
    "restaurants in philadelphia",
    "i want pasta in philadelphia",
]

    print("\n--- TESTING preprocess_query ---\n")
    for query in sample_queries:
        result = preprocess_query(query, businesses)
        print("QUERY:", query)
        print("RESULT:", json.dumps(result, indent=2))
        print()

    print("\n--- TESTING preprocess_for_query ---\n")
    for query in sample_queries:
        result = preprocess_for_query(query, businesses, reviews)
        print("QUERY:", query)
        print("CITY:", result["city"])
        print("FOOD ITEM:", result["food_item"])
        print("ERROR:", result["error"])
        print("NUM BUSINESSES:", len(result["businesses"]))
        print("NUM REVIEWS:", len(result["reviews"]))

        if result["businesses"]:
            print("FIRST 5 BUSINESSES:")
            for business in result["businesses"][:5]:
                print("-", business.get("name"), "|", business.get("city"))
        print()

def main():
    businesses = load_jsonl(BUSINESS_PATH)
    reviews = load_jsonl(REVIEW_PATH)

    processed_data = build_processed_restaurant_data(businesses, reviews)
    write_json(OUTPUT_PATH, processed_data)

    print("Wrote cleaned data to", OUTPUT_PATH)
    print("Number of restaurants saved:", len(processed_data))



if __name__ == "__main__":
    main()
    # test_queries()
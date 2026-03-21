from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from geopy.distance import geodesic
from data_loader import load_cities
from query_parser import parse_query
import pandas as pd


df = load_cities()

vectorizer = TfidfVectorizer(ngram_range=(1, 2), stop_words="english")
tfidf_corpus = (
    df["short_description"].fillna("") + " " +
    df["experience_tags"].fillna("") + " " +
    df["weather_text"].fillna("")
)
tfidf_matrix = vectorizer.fit_transform(tfidf_corpus)

MONTHS = ["january","february","march","april","may","june",
          "july","august","september","october","november","december"]

WEATHER_ORDER = ["freezing","very cold","cold","cool","mild","warm","hot","very hot"]


def get_climate_score(row, parsed):
    month = parsed.get("month")
    weather = parsed.get("weather")
    if not month or not weather:
        return 0.5

    temp = row.get(f"temp_{month}")
    if temp is None or pd.isna(temp):
        return 0.5

    city_label = temp_label(temp)
    if weather not in WEATHER_ORDER or city_label not in WEATHER_ORDER:
        return 0.5

    diff = abs(WEATHER_ORDER.index(weather) - WEATHER_ORDER.index(city_label))
    if diff == 0: return 1.0
    if diff == 1: return 0.6
    if diff == 2: return 0.2
    return 0.0


def temp_label(c):
    if c >= 32:  return "very hot"
    if c >= 28:  return "hot"
    if c >= 22:  return "warm"
    if c >= 15:  return "mild"
    if c >= 8:   return "cool"
    if c >= 2:   return "cold"
    if c >= -5:  return "very cold"
    return "freezing"


def get_relative_temp_score(row, parsed, user_baseline_temp):
    """Shift what 'warm/cold' means based on where the user is from."""
    if user_baseline_temp is None or not parsed.get("month") or not parsed.get("weather"):
        return 0.5

    temp = row.get(f"temp_{parsed['month']}")
    if temp is None or pd.isna(temp):
        return 0.5

    # target temps for each label at neutral baseline (15°C)
    weather_targets = {
        "very hot": 32, "hot": 28, "warm": 22, "mild": 15,
        "cool": 10, "cold": 3, "very cold": -3, "freezing": -8
    }
    target = weather_targets.get(parsed["weather"], 18)
    # adjust target based on user's home climate (0.3 scaling factor)
    adjusted_target = target + (user_baseline_temp - 15) * 0.3
    diff = abs(temp - adjusted_target)

    if diff <= 3:  return 1.0
    if diff <= 7:  return 0.7
    if diff <= 12: return 0.4
    return 0.1


def get_distance_score(row, user_lat, user_lon):
    if user_lat is None or user_lon is None:
        return 0.5
    try:
        dist_km = geodesic((user_lat, user_lon), (row["latitude"], row["longitude"])).km
        return max(0.0, 1.0 - dist_km / 15000)
    except:
        return 0.5


def get_activity_score(row, parsed):
    """Use the numeric activity columns already in the dataset (scored 1-5)."""
    activity = parsed.get("activity")
    if not activity:
        return 0.5

    activity_map = {
        "beach": "beaches", "beaches": "beaches",
        "ski": "adventure", "skiing": "adventure", "hiking": "adventure",
        "adventure": "adventure", "nightlife": "nightlife",
        "culture": "culture", "cultural": "culture",
        "nature": "nature", "wellness": "wellness",
        "food": "cuisine", "cuisine": "cuisine",
        "urban": "urban", "city": "urban",
        "seclusion": "seclusion", "remote": "seclusion"
    }
    col = activity_map.get(activity)
    if col and col in row:
        return float(row[col]) / 5.0
    return 0.5


def get_budget_score(row, parsed):
    budget = parsed.get("budget")
    if not budget:
        return 0.5
    return 1.0 if row.get("budget_level") == budget else 0.0



def rank_destinations(query, user_lat=None, user_lon=None,
                      user_baseline_temp=None, top_n=10):
    parsed = parse_query(query)

    query_vec = vectorizer.transform([parsed["raw"]])
    tfidf_scores = cosine_similarity(query_vec, tfidf_matrix).flatten()

    results = []
    for i, row in df.iterrows():
        tfidf    = float(tfidf_scores[i])
        climate  = get_climate_score(row, parsed)
        rel_temp = get_relative_temp_score(row, parsed, user_baseline_temp)
        distance = get_distance_score(row, user_lat, user_lon)
        activity = get_activity_score(row, parsed)
        budget   = get_budget_score(row, parsed)

        final_score = (
            0.30 * tfidf    +
            0.25 * climate  +
            0.15 * rel_temp +
            0.15 * activity +
            0.10 * budget   +
            0.05 * distance
        )

        results.append({
        "city":            row["city"],
        "country":         row["country"],
        "region":          row["region"],
        "budget":          row["budget_level"],
        "score":           round(final_score, 4),
        "text_similarity": round(tfidf, 4), 
        "scores": {
            "text_score":           round(tfidf, 4),
            "climate_score":        round(climate, 4),
            "relative_temp_score":  round(rel_temp, 4),
            "activity_score":       round(activity, 4),
            "budget_score":         round(budget, 4),
            "distance_score":       round(distance, 4)
        },
        "short_description": row["short_description"][:200] + "..." 
    })

    results.sort(key=lambda x: x["score"], reverse=True)
    return results[:top_n]
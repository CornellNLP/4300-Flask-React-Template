"""
Routes: React app serving and episode search API.

To enable AI chat, set USE_LLM = True below. See llm_routes.py for AI code.
"""
import json
import os
import re
import unicodedata
from flask import send_from_directory, request, jsonify
from models import db, Episode, Review
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

# ── AI toggle ────────────────────────────────────────────────────────────────
USE_LLM = False
# USE_LLM = True
# ─────────────────────────────────────────────────────────────────────────────


def json_search(query):
    if not query or not query.strip():
        query = "Kardashian"
    results = db.session.query(Episode, Review).join(
        Review, Episode.id == Review.id
    ).filter(
        Episode.title.ilike(f'%{query}%')
    ).all()
    matches = []
    for episode, review in results:
        matches.append({
            'title': episode.title,
            'descr': episode.descr,
            'imdb_rating': review.imdb_rating
        })
    return matches


current_directory = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(current_directory)
DATA_PATH = os.path.join(project_root, 'src', 'data', 'breed_data.csv')
PICTURE_DATA_PATH = os.path.join(project_root, 'src', 'data', 'breed_pictures.csv')

RANGE_COLUMN_MAP = {
    "Height": "avg_height",
    "Weight": "avg_weight",
    "Life Expectancy": "avg_expectancy",
}

CATEGORY_COLUMN_MAP = {
    "Group": "group",
    "Grooming Frequency": "grooming_frequency_category",
    "Shedding": "shedding_category",
    "Energy Level": "energy_level_category",
    "Trainability": "trainability_category",
    "Demeanor": "demeanor_category",
}


def normalize_breed_name(name):
    if pd.isna(name):
        return ""

    text = unicodedata.normalize("NFKD", str(name))
    text = text.encode("ascii", "ignore").decode("ascii")
    text = text.lower()
    text = re.sub(r"[^a-z0-9]+", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def load_picture_map():
    if not os.path.exists(PICTURE_DATA_PATH):
        return {}

    picture_df = pd.read_csv(PICTURE_DATA_PATH)
    picture_map = {}

    for _, row in picture_df.iterrows():
        breed = row.get("breed")
        picture_name = row.get("picture_name")

        if pd.notna(breed) and pd.notna(picture_name):
            picture_map[normalize_breed_name(breed)] = str(picture_name)

    return picture_map


def as_list(value):
    if value is None:
        return []
    if isinstance(value, list):
        return value
    return [value]


def parse_range(range_str):
    try:
        low, high = str(range_str).split("-")
        return float(low), float(high)
    except Exception:
        return None


def safe(val):
    return None if pd.isna(val) else val


def compute_structured_jaccard(row, trait_input):
    range_score_total = 0
    range_count = 0

    for trait, col in RANGE_COLUMN_MAP.items():
        selected_values = as_list(trait_input.get(trait, []))
        if not selected_values:
            continue

        row_value = row.get(col, None)
        if pd.isna(row_value):
            continue

        row_value = float(row_value)

        for selected in selected_values:
            parsed = parse_range(selected)
            if parsed is None:
                continue

            low, high = parsed
            mid = (low + high) / 2

            range_width = (high - low) if (high - low) != 0 else 1

            distance = abs(row_value - mid)
            similarity = max(0, 1 - (distance / range_width))

            range_score_total += similarity
            range_count += 1

    cat_user_tokens = set()
    cat_breed_tokens = set()

    for trait, col in CATEGORY_COLUMN_MAP.items():
        selected_values = as_list(trait_input.get(trait, []))
        if not selected_values:
            continue

        row_value = "" if pd.isna(row.get(col)) else str(row[col]).lower()

        for selected in selected_values:
            selected_clean = str(selected).strip().lower()
            token = f"{trait}::{selected_clean}"

            cat_user_tokens.add(token)

            if selected_clean in row_value:
                cat_breed_tokens.add(token)

    if cat_user_tokens:
        intersection = len(cat_user_tokens & cat_breed_tokens)
        union = len(cat_user_tokens | cat_breed_tokens)
        cat_score = intersection / union if union != 0 else 0
    else:
        cat_score = 0

    range_score = (range_score_total / range_count) if range_count > 0 else 0

    if range_count > 0 and cat_user_tokens:
        return 0.5 * range_score + 0.5 * cat_score
    elif range_count > 0:
        return range_score
    else:
        return cat_score


def compute_text_scores(df, query):
    query = (query or "").strip()
    if query == "":
        return None

    documents = (
        df["description"].fillna("") + " " +
        df["temperament"].fillna("") + " " +
        df["group"].fillna("") + " " +
        df["grooming_frequency_category"].fillna("") + " " +
        df["shedding_category"].fillna("") + " " +
        df["energy_level_category"].fillna("") + " " +
        df["trainability_category"].fillna("") + " " +
        df["demeanor_category"].fillna("")
    )

    vectorizer = TfidfVectorizer(stop_words="english")
    tfidf_matrix = vectorizer.fit_transform(documents)
    query_vector = vectorizer.transform([query])

    scores = cosine_similarity(query_vector, tfidf_matrix).flatten()
    return scores


def register_routes(app):
    @app.route('/', defaults={'path': ''})
    @app.route('/<path:path>')
    def serve(path):
        if path != "" and os.path.exists(os.path.join(app.static_folder, path)):
            return send_from_directory(app.static_folder, path)
        else:
            return send_from_directory(app.static_folder, 'index.html')

    @app.route("/api/config")
    def config():
        return jsonify({"use_llm": USE_LLM})

    @app.route("/api/episodes")
    def episodes_search():
        text = request.args.get("title", "")
        return jsonify(json_search(text))

    @app.route('/api/match', methods=['POST'])
    def match_dogs():
        payload = request.get_json(silent=True) or {}

        trait_input = payload.get("traitInput", {})
        write_in = payload.get("writeIn", "").strip()

        has_structured = any(len(as_list(v)) > 0 for v in trait_input.values())
        has_text = write_in != ""

        if not has_structured and not has_text:
            return jsonify([])

        df = pd.read_csv(DATA_PATH)
        picture_map = load_picture_map()

        text_scores = compute_text_scores(df, write_in)

        results = []

        for idx, row in df.iterrows():
            filter_score = compute_structured_jaccard(row, trait_input)
            text_score = float(text_scores[idx]) if text_scores is not None else None

            if has_structured and has_text:
                final_score = 0.6 * text_score + 0.4 * filter_score
            elif has_text:
                final_score = text_score
            else:
                final_score = filter_score

            breed_name = row["breed"]
            picture_name = picture_map.get(normalize_breed_name(breed_name), "")

            results.append({
                "breed": breed_name,
                "score": round(float(final_score) * 100, 1),
                "text_score": round(float(text_score) * 100, 1) if text_score is not None else None,
                "filter_score": round(float(filter_score) * 100, 1) if filter_score is not None else None,
                "description": safe(row["description"]),
                "min_height": safe(row["min_height"]),
                "max_height": safe(row["max_height"]),
                "avg_height": safe(row["avg_height"]),
                "min_weight": safe(row["min_weight"]),
                "max_weight": safe(row["max_weight"]),
                "avg_weight": safe(row["avg_weight"]),
                "min_expectancy": safe(row["min_expectancy"]),
                "max_expectancy": safe(row["max_expectancy"]),
                "avg_expectancy": safe(row["avg_expectancy"]),
                "temperament": safe(row["temperament"]),
                "group": safe(row["group"]),
                "energy": safe(row["energy_level_category"]),
                "shedding": safe(row["shedding_category"]),
                "trainability": safe(row["trainability_category"]),
                "demeanor": safe(row["demeanor_category"]),
                "picture_name": picture_name
            })

        results.sort(key=lambda x: x["score"], reverse=True)

        filtered = [r for r in results if r["score"] > 0]

        return jsonify(filtered[:10])

    if USE_LLM:
        from llm_routes import register_chat_route
        register_chat_route(app, json_search)
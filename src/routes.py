"""
Routes: React app serving and episode search API.

To enable AI chat, set USE_LLM = True below. See llm_routes.py for AI code.
"""
import json
import os
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
DATA_PATH = os.path.join(project_root, 'data', 'breed_data.csv')

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


def compute_structured_jaccard(row, trait_input):
    user_tokens = set()
    breed_tokens = set()

    for trait, col in RANGE_COLUMN_MAP.items():
        selected_values = as_list(trait_input.get(trait, []))
        if not selected_values:
            continue

        row_value = row.get(col, None)
        if pd.notna(row_value):
            row_value = float(row_value)

        for selected in selected_values:
            token = f"{trait}::{selected}"
            user_tokens.add(token)

            parsed = parse_range(selected)
            if parsed is None or pd.isna(row_value):
                continue

            low, high = parsed
            if low <= row_value <= high:
                breed_tokens.add(token)

    for trait, col in CATEGORY_COLUMN_MAP.items():
        selected_values = as_list(trait_input.get(trait, []))
        if not selected_values:
            continue

        row_value = "" if pd.isna(row.get(col, None)) else str(row[col]).strip()

        for selected in selected_values:
            token = f"{trait}::{selected}"
            user_tokens.add(token)

            if row_value == str(selected).strip():
                breed_tokens.add(token)

    if not user_tokens:
        return None

    intersection = len(user_tokens & breed_tokens)
    union = len(user_tokens | breed_tokens)

    return intersection / union if union != 0 else 0


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

            results.append({
                "breed": row["breed"],
                "score": round(float(final_score), 3),
                "text_score": round(float(text_score), 3) if text_score is not None else None,
                "filter_score": round(float(filter_score), 3) if filter_score is not None else None,
                "description": row["description"],
                "temperament": row["temperament"],
                "group": row["group"],
                "energy": row["energy_level_category"],
                "shedding": row["shedding_category"],
                "trainability": row["trainability_category"],
                "demeanor": row["demeanor_category"]
            })

        results.sort(key=lambda x: x["score"], reverse=True)

        filtered = [r for r in results if r["score"] > 0]

        return jsonify(filtered[:10])


    if USE_LLM:
        from llm_routes import register_chat_route
        register_chat_route(app, json_search)

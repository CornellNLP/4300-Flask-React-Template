"""
Routes: React app serving and episode search API.

To enable AI chat, set USE_LLM = True below. See llm_routes.py for AI code.
"""
import json
import os
import re
import unicodedata
import numpy as np
from flask import send_from_directory, request, jsonify
from models import db, Episode, Review
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.decomposition import TruncatedSVD
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
PICTURE_PATH = os.path.join(project_root, 'src', 'data', 'breed_pictures.csv')

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


def safe(val):
    return None if pd.isna(val) else val


def normalize_breed_name(name):
    if pd.isna(name):
        return ""

    name = str(name)
    name = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode("ascii")
    name = name.lower()
    name = name.replace("&", "and")
    name = re.sub(r"[^a-z0-9]+", " ", name)
    return " ".join(name.split())


def load_breed_dataframe():
    df = pd.read_csv(DATA_PATH)
    picture_df = pd.read_csv(PICTURE_PATH)

    df["breed_key"] = df["breed"].apply(normalize_breed_name)
    picture_df["breed_key"] = picture_df["breed"].apply(normalize_breed_name)

    df = df.merge(
        picture_df[["breed_key", "picture_name"]],
        on="breed_key",
        how="left"
    )

    df["search_document"] = (
        df["description"].fillna("") + " " +
        df["temperament"].fillna("") + " " +
        df["group"].fillna("") + " " +
        df["grooming_frequency_category"].fillna("") + " " +
        df["shedding_category"].fillna("") + " " +
        df["energy_level_category"].fillna("") + " " +
        df["trainability_category"].fillna("") + " " +
        df["demeanor_category"].fillna("")
    )

    return df


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


def build_tfidf_bundle(df, query):
    query = (query or "").strip()
    if query == "":
        return None

    vectorizer = TfidfVectorizer(stop_words="english")
    tfidf_matrix = vectorizer.fit_transform(df["search_document"].fillna(""))
    query_vector = vectorizer.transform([query])

    baseline_scores = cosine_similarity(query_vector, tfidf_matrix).flatten()

    return {
        "vectorizer": vectorizer,
        "tfidf_matrix": tfidf_matrix,
        "query_vector": query_vector,
        "baseline_scores": baseline_scores
    }


def build_svd_bundle(tfidf_bundle, n_components=8):
    if tfidf_bundle is None:
        return None

    tfidf_matrix = tfidf_bundle["tfidf_matrix"]
    query_vector = tfidf_bundle["query_vector"]
    vectorizer = tfidf_bundle["vectorizer"]

    max_components = min(
        n_components,
        tfidf_matrix.shape[0] - 1,
        tfidf_matrix.shape[1] - 1
    )

    if max_components < 1:
        return None

    svd = TruncatedSVD(n_components=max_components, random_state=42)
    doc_latent = svd.fit_transform(tfidf_matrix)
    query_latent = svd.transform(query_vector)

    svd_cosine_raw = cosine_similarity(query_latent, doc_latent).flatten()
    svd_scores = (svd_cosine_raw + 1.0) / 2.0

    feature_names = np.array(vectorizer.get_feature_names_out())
    dimension_summaries = []

    for i, component in enumerate(svd.components_):
        pos_idx = np.argsort(component)[-5:][::-1]
        neg_idx = np.argsort(component)[:5]

        positive_terms = feature_names[pos_idx].tolist()
        negative_terms = feature_names[neg_idx].tolist()

        dimension_summaries.append({
            "dimension": i + 1,
            "positive_terms": positive_terms,
            "negative_terms": negative_terms,
            "positive_label": ", ".join(positive_terms[:3]),
            "negative_label": ", ".join(negative_terms[:3])
        })

    return {
        "svd": svd,
        "doc_latent": doc_latent,
        "query_latent": query_latent[0],
        "svd_scores": svd_scores,
        "dimension_summaries": dimension_summaries
    }


def explain_svd_match(query_latent, doc_latent_vec, dimension_summaries):
    positive_matches = []
    negative_matches = []

    for i, (qv, dv) in enumerate(zip(query_latent, doc_latent_vec)):
        contribution = float(qv * dv)

        if contribution <= 0:
            continue

        if qv > 0 and dv > 0:
            positive_matches.append({
                "dimension": i + 1,
                "sign": "positive",
                "contribution": round(contribution, 3),
                "terms": dimension_summaries[i]["positive_terms"][:3]
            })

        elif qv < 0 and dv < 0:
            negative_matches.append({
                "dimension": i + 1,
                "sign": "negative",
                "contribution": round(contribution, 3),
                "terms": dimension_summaries[i]["negative_terms"][:3]
            })

    positive_matches.sort(key=lambda x: x["contribution"], reverse=True)
    negative_matches.sort(key=lambda x: x["contribution"], reverse=True)

    return positive_matches[:3], negative_matches[:3]


def get_matching_traits(row, trait_input):
    matching_traits = []

    for trait, col in CATEGORY_COLUMN_MAP.items():
        selected_values = as_list(trait_input.get(trait, []))
        if not selected_values:
            continue

        row_value = "" if pd.isna(row.get(col)) else str(row[col]).lower()

        for selected in selected_values:
            selected_clean = str(selected).strip()
            if selected_clean.lower() in row_value:
                matching_traits.append(selected_clean)

    return list(dict.fromkeys(matching_traits))


def get_matching_words(row, write_in):
    if not write_in or not write_in.strip():
        return []

    query_words = re.findall(r"[a-zA-Z]+", write_in.lower())
    query_words = [w for w in query_words if len(w) > 2]

    doc_text = f"{safe(row['description']) or ''} {safe(row['temperament']) or ''}".lower()

    matching_words = [word for word in query_words if word in doc_text]
    return list(dict.fromkeys(matching_words))[:6]


def build_result_payload(row, score, structured_score=None, text_score=None,
                         matching_traits=None, matching_words=None,
                         positive_dimensions=None, negative_dimensions=None):
    return {
        "breed": safe(row["breed"]),
        "score": round(float(score), 3),
        "structured_score": round(float(structured_score), 3) if structured_score is not None else None,
        "text_score": round(float(text_score), 3) if text_score is not None else None,
        "description": safe(row["description"]),
        "temperament": safe(row["temperament"]),
        "group": safe(row["group"]),
        "grooming": safe(row["grooming_frequency_category"]),
        "energy": safe(row["energy_level_category"]),
        "shedding": safe(row["shedding_category"]),
        "trainability": safe(row["trainability_category"]),
        "demeanor": safe(row["demeanor_category"]),
        "picture_name": safe(row.get("picture_name", None)),
        "min_height": safe(row["min_height"]),
        "max_height": safe(row["max_height"]),
        "avg_height": safe(row["avg_height"]),
        "min_weight": safe(row["min_weight"]),
        "max_weight": safe(row["max_weight"]),
        "avg_weight": safe(row["avg_weight"]),
        "min_expectancy": safe(row["min_expectancy"]),
        "max_expectancy": safe(row["max_expectancy"]),
        "avg_expectancy": safe(row["avg_expectancy"]),
        "matching_traits": matching_traits or [],
        "matching_words": matching_words or [],
        "positive_dimensions": positive_dimensions or [],
        "negative_dimensions": negative_dimensions or []
    }


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
            return jsonify({
                "baseline_matches": [],
                "svd_matches": [],
                "svd_dimensions": []
            })

        df = load_breed_dataframe()

        tfidf_bundle = build_tfidf_bundle(df, write_in) if has_text else None
        svd_bundle = build_svd_bundle(tfidf_bundle, n_components=8) if has_text else None

        baseline_matches = []
        svd_matches = []

        for idx, row in df.iterrows():
            structured_score = compute_structured_jaccard(row, trait_input)
            baseline_text_score = float(tfidf_bundle["baseline_scores"][idx]) if tfidf_bundle is not None else None
            svd_text_score = float(svd_bundle["svd_scores"][idx]) if svd_bundle is not None else None

            if has_structured and has_text:
                baseline_final = 0.6 * baseline_text_score + 0.4 * structured_score
                svd_final = 0.6 * svd_text_score + 0.4 * structured_score
            elif has_text:
                baseline_final = baseline_text_score
                svd_final = svd_text_score
            else:
                baseline_final = structured_score
                svd_final = structured_score

            matching_traits = get_matching_traits(row, trait_input)
            matching_words = get_matching_words(row, write_in)

            if svd_bundle is not None:
                positive_dims, negative_dims = explain_svd_match(
                    svd_bundle["query_latent"],
                    svd_bundle["doc_latent"][idx],
                    svd_bundle["dimension_summaries"]
                )
            else:
                positive_dims, negative_dims = [], []

            baseline_matches.append(
                build_result_payload(
                    row=row,
                    score=baseline_final,
                    structured_score=structured_score if has_structured else None,
                    text_score=baseline_text_score if has_text else None,
                    matching_traits=matching_traits,
                    matching_words=matching_words
                )
            )

            svd_matches.append(
                build_result_payload(
                    row=row,
                    score=svd_final,
                    structured_score=structured_score if has_structured else None,
                    text_score=svd_text_score if has_text else None,
                    matching_traits=matching_traits,
                    matching_words=matching_words,
                    positive_dimensions=positive_dims,
                    negative_dimensions=negative_dims
                )
            )

        baseline_matches.sort(key=lambda x: x["score"], reverse=True)
        svd_matches.sort(key=lambda x: x["score"], reverse=True)

        baseline_matches = [m for m in baseline_matches if m["score"] > 0][:10]
        svd_matches = [m for m in svd_matches if m["score"] > 0][:10]

        return jsonify({
            "baseline_matches": baseline_matches,
            "svd_matches": svd_matches,
            "svd_dimensions": svd_bundle["dimension_summaries"] if svd_bundle is not None else []
        })

    if USE_LLM:
        from llm_routes import register_chat_route
        register_chat_route(app, json_search)
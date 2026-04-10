"""
Routes: React app serving and episode search API.

To enable AI chat, set USE_LLM = True below. See llm_routes.py for AI code.
"""
import json
import re
from pathlib import Path
import pandas as pd
import numpy as np
import pickle
from sklearn.metrics.pairwise import cosine_similarity
import pandas as pd
import os
from flask import send_from_directory, request, jsonify
from models import db, Episode, Review, Podcast

# ── AI toggle ────────────────────────────────────────────────────────────────
USE_LLM = False
# USE_LLM = True
# ─────────────────────────────────────────────────────────────────────────────

# Open at server startup
OS_PATH = os.path.dirname(os.path.abspath(__file__))
# with open(os.path.join(OS_PATH, 'data/svd_shows_improved.pkl'), 'rb') as f:
#     svd_model = pickle.load(f) 
with open(os.path.join(OS_PATH, 'data/svd_shows_improved2.pkl'), 'rb') as f:
    svd_model = pickle.load(f) 
    
# shape: (n_podcasts, 100)
# embeddings = np.load(os.path.join(OS_PATH, 'data/embeddings/description_embeddings_mixed.npy'))
# show_ids = Path(os.path.join(OS_PATH, 'data/embeddings/embedding_show_ids.txt')).read_text().splitlines()
# df = pd.read_csv(os.path.join(OS_PATH, 'data/podcasts_cleaned.csv'))
embeddings = np.load(os.path.join(OS_PATH, 'data/embeddings/description_embeddings_improved2.npy'))
show_ids = Path(os.path.join(OS_PATH, 'data/embeddings/embedding_show_ids2.txt')).read_text().splitlines()
df = pd.read_csv(os.path.join(OS_PATH, 'data/podcasts2.csv'))

KNOWN_GENRES = [
    'Comedy',
    'News',
    'Technology',
    'Education',
    'Business',
    'Health',
    'Sports',
    'History',
    'Science',
    'True Crime',
    'Music',
    'Society',
]

def query_to_vec(query):
    if not query or not query.strip():
        query = "Joe Rogan Podcast"
    
    # Get embedding for query
    query_vec = svd_model['svd'].transform(svd_model['tfidf'].transform([query]))
    # vec = query_vec[0]  # shape: (100,)
    # norm = np.linalg.norm(vec)
    # # reshape into (1,100)
    # vec = vec.reshape(1, -1)
    # return vec / norm if norm > 0 else vec
    return query_vec

# function for getting top k for optimize_query_vec
def get_top_k(query_vec, embeddings, k=5):
    q = query_vec.reshape(-1)
    sims = embeddings @ q

    # optimization: partial sort (O(n) instead of O(n log n))
    top_k_indices = np.argpartition(sims, -k)[-k:]
    
    top_k_indices = top_k_indices[np.argsort(sims[top_k_indices])[::-1]]
    top_k_scores = sims[top_k_indices]

    return top_k_indices, top_k_scores

def optimize_query_vec(vec, embeddings, top_k_indices, top_k_scores=None, alpha=1.0, beta=0.25):
    """
    Rocchio-style query update using the centroid of top-k retrieved docs.

    Args:
        vec: np.ndarray of shape (1, d) or (d,)
            Query vector from query_to_vec().
        embeddings: np.ndarray of shape (n_docs, d)
            Podcast description embeddings.
        top_k_indices: array-like of shape (k,)
            Indices of the top-k retrieved podcast descriptions.
        top_k_scores: array-like of shape (k,), optional
            Similarity scores for the top-k docs. If provided, uses a
            weighted centroid instead of a plain mean.
        alpha: float
            Weight on the original query.
        beta: float
            Weight on the top-k centroid.

    Returns:
        np.ndarray of shape (1, d)
            Optimized and L2-normalized query vector.
    """
    vec = np.asarray(vec, dtype=np.float32)
    if vec.ndim == 1:
        vec = vec.reshape(1, -1)

    top_k_indices = np.asarray(top_k_indices)
    relevant_embs = embeddings[top_k_indices].astype(np.float32)

    if relevant_embs.shape[0] == 0:
        norm = np.linalg.norm(vec, axis=1, keepdims=True)
        return np.divide(vec, norm, out=np.zeros_like(vec), where=norm > 0)

    if top_k_scores is not None:
        weights = np.asarray(top_k_scores, dtype=np.float32).reshape(-1)
        weights = np.maximum(weights, 0)
        if weights.sum() > 0:
            weights = weights / weights.sum()
            centroid = (relevant_embs * weights[:, None]).sum(axis=0, keepdims=True)
        else:
            centroid = relevant_embs.mean(axis=0, keepdims=True)
    else:
        centroid = relevant_embs.mean(axis=0, keepdims=True)

    q_new = alpha * vec + beta * centroid

    norm = np.linalg.norm(q_new, axis=1, keepdims=True)
    # print rocchio
    print(f"Rocchio update: alpha={alpha}, beta={beta}, top_k_scores={top_k_scores}")
    return np.divide(q_new, norm, out=np.zeros_like(q_new), where=norm > 0)


def parse_query_negations(raw_query, known_genres=None):
    known_genres = known_genres or KNOWN_GENRES
    cleaned_query = (raw_query or '').strip()
    excluded_genres = []

    if not cleaned_query:
        return '', excluded_genres

    for genre in sorted(known_genres, key=len, reverse=True):
        genre_pattern = re.escape(genre)
        negation_patterns = [
            rf'\bnon(?:\s+|-){{1,2}}{genre_pattern}\b',
            rf'\bnot(?:\s+|-){{1,2}}{genre_pattern}\b',
            rf'\bwithout(?:\s+|-){{1,2}}{genre_pattern}\b',
            rf'\bno(?:\s+|-){{1,2}}{genre_pattern}\b',
            rf'(?<!\w)-{genre_pattern}\b',
        ]

        matched = False
        for pattern in negation_patterns:
            if re.search(pattern, cleaned_query, flags=re.IGNORECASE):
                cleaned_query = re.sub(pattern, ' ', cleaned_query, flags=re.IGNORECASE)
                matched = True

        if matched:
            excluded_genres.append(genre)

    cleaned_query = re.sub(r'\s+', ' ', cleaned_query).strip()
    return cleaned_query, excluded_genres

# TODO: use cosine similarity and return top 5 matches instead of all matches
def json_search(query, explicit=False, genres=None, excluded_genres=None, publisher='', release_year=None, length_metric=None, min_length=None, max_length=None):
    genres = genres or []
    excluded_genres = excluded_genres or []

    query_vec = query_to_vec(query)
    # embeddings are size (n_podcasts, 200), so query_vec needs to be (1, 200) for cosine similarity to work
    
    optimized_query_vec = optimize_query_vec(query_vec, embeddings, *get_top_k(query_vec, embeddings, k=5), alpha=0.5, beta=0.5)
    #optimized_query_vec = query_vec
    # a=1.0, b=0.25 => .722 
    # a=0.5, b=0.5
    
    scores = cosine_similarity(optimized_query_vec, embeddings)[0]  # shape: (n_podcasts,)
    id_to_score = dict(zip(show_ids, scores))
    
    # Get Podcasts and apply filters
    q = db.session.query(Podcast)
    
    if not explicit:
        q = q.filter(Podcast.explicit == False)
    if genres:
        for genre in genres:
            q = q.filter(Podcast.categories.ilike(f'%{genre}%'))
    if excluded_genres:
        for genre in excluded_genres:
            q = q.filter(~Podcast.categories.ilike(f'%{genre}%'))
    if publisher:
        q = q.filter(Podcast.owner_name.ilike(f'%{publisher}%'))
    if release_year:
        q = q.filter(Podcast.newest_item_date != None).filter(
            Podcast.newest_item_date.between(f'{release_year}-01-01', f'{release_year}-12-31')
        )
    if length_metric and (min_length is not None or max_length is not None):
        if length_metric == 'duration_ms':
            if min_length is not None:
                q = q.filter(Podcast.avg_duration_min >= min_length)
            if max_length is not None:
                q = q.filter(Podcast.avg_duration_min <= max_length)
        if length_metric == 'total_episodes':
            if min_length is not None:
                q = q.filter(Podcast.episode_count >= min_length)
            if max_length is not None:
                q = q.filter(Podcast.episode_count <= max_length)
        # TODO: popularity?
    podcasts = q.all()
    
    # add scores and sort
    results = sorted(
        [{'podcast': p, 'score': id_to_score.get(str(p.id), 0.0)} for p in podcasts], key=lambda x: x['score'], reverse=True
    )[:20]
    
    return (
        [{
            'title': r['podcast'].name,
            'description': r['podcast'].descr,
            'categories': r['podcast'].categories,
            'explicit': r['podcast'].explicit,
            'image_url': r['podcast'].image_url,
            'feed_url': r['podcast'].feed_url,
            'website_url': r['podcast'].website_url,
            'author': r['podcast'].author,
            'score': round(float(r['score']), 4),
            'popularity': r['podcast'].popularity_score,
            'episode_count': r['podcast'].episode_count,
            'avg_episode_time': r['podcast'].avg_duration_min,
        } for r in results]
    )


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
    
    @app.route("/api/podcasts")
    def podcasts_search():
        raw_query        = request.args.get('query', '')
        explicit         = request.args.get('explicit', 'false') == 'true'
        genres           = request.args.getlist('genres')
        excluded_genres  = request.args.getlist('excludedGenres')
        publisher        = request.args.get('publisher', '')
        year             = request.args.get('releaseYear', '')
        length_met       = request.args.get('lengthMetric', '')
        min_length       = request.args.get('minLength', type=float)
        max_length       = request.args.get('maxLength', type=float)

        query, negated_genres = parse_query_negations(raw_query)
        excluded_genres = list(dict.fromkeys(excluded_genres + negated_genres))

        if not query:
            query = 'podcast'

        return jsonify(json_search(
            query=query,
            explicit=explicit,
            genres=genres,
            excluded_genres=excluded_genres,
            publisher=publisher,
            release_year=year,
            length_metric=length_met,
            min_length=min_length,
            max_length=max_length
        ))

    if USE_LLM:
        from llm_routes import register_chat_route
        register_chat_route(app, json_search)

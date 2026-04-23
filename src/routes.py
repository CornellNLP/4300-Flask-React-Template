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

# --- RAG UTILS IMPORT ---
import rag_utils

# ── AI toggle ────────────────────────────────────────────────────────────────
USE_LLM = True
# USE_LLM = True
# ─────────────────────────────────────────────────────────────────────────────

# Open at server startup
OS_PATH = os.path.dirname(os.path.abspath(__file__))
with open(os.path.join(OS_PATH, 'data/svd/svd_mixed.pkl'), 'rb') as f:
    svd_model = pickle.load(f) 
    
# NOTE: switch between improved and mixed
embeddings = np.load(os.path.join(OS_PATH, 'data/embeddings/embeddings_mixed.npy'))
show_ids = Path(os.path.join(OS_PATH, 'data/ids/podcasts_embeddings_ids.txt')).read_text().splitlines()

# Create efficient mapping from show_id to embedding index
show_id_to_idx = {show_id: idx for idx, show_id in enumerate(show_ids)}

df = pd.read_csv(os.path.join(OS_PATH, 'data/podcasts_cleaned2.csv'))

# --- Initialize RAG markdown threads at startup ---
rag_utils.build_markdown_threads(df)

# Extract feature names and precompute dimension labels
tfidf_vectorizer = svd_model['tfidf']
svd_model_obj = svd_model['svd']
feature_names = tfidf_vectorizer.get_feature_names_out()

def get_dimension_label(dim_idx, top_words_count=3):
    """
    Create a meaningful label for an SVD dimension based on its top contributing words.
    
    Args:
        dim_idx: Index of the SVD dimension
        top_words_count: Number of top words to include in the label
    
    Returns:
        A string label like "music, song, artist" representing the dimension
    """
    try:
        if dim_idx >= len(svd_model_obj.components_):
            return f"Dim {dim_idx}"
        
        # Get the component (row) for this dimension
        component = svd_model_obj.components_[dim_idx]
        
        # Get top words by absolute value contribution
        top_indices = np.argsort(np.abs(component))[-top_words_count:][::-1]
        top_words = [str(feature_names[i]) for i in top_indices]
        
        return ", ".join(top_words)
    except Exception as e:
        print(f"[ERROR] get_dimension_label({dim_idx}): {e}")
        return f"Dim {dim_idx}"

# Precompute labels for faster lookup
try:
    n_components = len(svd_model_obj.components_)
    dimension_labels = {i: get_dimension_label(i) for i in range(n_components)}
    print(f"[INFO] Precomputed {len(dimension_labels)} dimension labels")
    # Print first 5 for verification
    for i in list(dimension_labels.keys())[:5]:
        print(f"  Dim {i}: {dimension_labels[i]}")
except Exception as e:
    print(f"[ERROR] Failed to precompute dimension labels: {e}")
    dimension_labels = {}

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

LLM_CONTEXT_TOP_K = 5 #LLM only wants 5 results
LLM_LOW_SCORE_THRESHOLD = 0.16 # If the top-k results all have scores below this, we consider it a "low score" case and do a generic rewrite with no context.

def clip_words(text, max_words=50):
    words = str(text or '').split()
    if len(words) <= max_words:
        return ' '.join(words)
    return ' '.join(words[:max_words]) + ' ...'

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

# def query_to_vec(query: str) -> np.ndarray:
#     """
#     Following mixed embeddings structure
#     1. TF-IDF transform
#     2. SVD transform  
#     3. L2-normalize
#     4. Apply same mix weights (even though query has no episode component,
#        we scale by alpha_show so the magnitude matches the embedding space)
#     """
#     mix_weights = svd_model.get('mix_weights', {'episode': 0.1, 'show': 0.9})
#     alpha_show = mix_weights['show']

#     tfidf_vec = tfidf_vectorizer.transform([query])
#     vec = svd_model_obj.transform(tfidf_vec)[0]

#     # L2-normalize (mirrors the normalize() call on show_embs before mixing)
#     norm = np.linalg.norm(vec)
#     vec  = vec / norm if norm > 0 else vec

#     # Scale by alpha_show — a query has no episode signal, so it's 100% show-side.
#     # Scaling keeps it in the same magnitude range as the mixed embeddings.
#     vec = alpha_show * vec

#     # Final L2-normalize (mirrors the final normalize() on new_show_embs)
#     norm = np.linalg.norm(vec)
#     return vec / norm if norm > 0 else vec

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

# cos sim
def get_top_dimensions(embedding, k=6):
    """
    Extract the top k most activated dimensions, split into positive and negative.
    Returns two lists:
    - positive_dims: Top k positive activations
    - negative_dims: Top k negative activations (sorted by absolute value)
    Each item is: {'dimension': int, 'value': float, 'label': str}
    """
    embedding = np.asarray(embedding).flatten()
    
    positive_mask = embedding > 0
    # negative_mask = embedding < 0
    
    positive_vals = embedding[positive_mask]
    # negative_vals = embedding[negative_mask]
    positive_indices = np.where(positive_mask)[0]
    # negative_indices = np.where(negative_mask)[0]
    
    pos_top_k = min(k, len(positive_vals))
    # neg_top_k = min(k, len(negative_vals))
    
    # Sort by value
    pos_sorted_idx = positive_indices[np.argsort(positive_vals)[-pos_top_k:][::-1]]
    # neg_sorted_idx = negative_indices[np.argsort(negative_vals)[:neg_top_k]]  # Most negative first
    
    positive_dims = [
        {
            'dimension': int(idx),
            'value': float(embedding[idx]),
            'label': dimension_labels.get(int(idx), f"Dim {idx}")
        }
        for idx in pos_sorted_idx
    ]
    
    # negative_dims = [
    #     {
    #         'dimension': int(idx),
    #         'value': float(embedding[idx]),
    #         'label': dimension_labels.get(int(idx), f"Dim {idx}")
    #     }
    #     for idx in neg_sorted_idx
    # ]
    
    return {
        'positive': positive_dims,
        # 'negative': negative_dims
    }



def json_search(
    query,
    explicit=False,
    genres=None,
    excluded_genres=None,
    publisher='',
    release_year=None,
    length_metric=None,
    min_length=None,
    max_length=None,
    top_k=5,
    return_metadata=False,
    use_llm_override=None,
):
    genres = genres or []
    excluded_genres = excluded_genres or []
    effective_use_llm = USE_LLM if use_llm_override is None else (USE_LLM and bool(use_llm_override))

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

    ai_overview = None

    # embeddings are size (n_podcasts, d), so query_vec must be shape (1, d).
    if effective_use_llm:
        # Path A: score candidates with the original query for context quality checks.
        original_query_vec = query_to_vec(query)
        original_scores = cosine_similarity(original_query_vec, embeddings)[0]
        original_score_map = dict(zip(show_ids, original_scores))

        baseline_ranked = sorted(
            [
                {
                    'podcast': p,
                    'score': float(original_score_map.get(str(p.id), 0.0)),
                }
                for p in podcasts
            ],
            key=lambda x: x['score'],
            reverse=True,
        )[:max(1, LLM_CONTEXT_TOP_K)]

        top_context = [
            {
                'title': item['podcast'].name,
                'description': clip_words(item['podcast'].descr, max_words=50),
                'categories': item['podcast'].categories,
                'author': item['podcast'].author,
                'score': item['score'],
            }
            for item in baseline_ranked[:LLM_CONTEXT_TOP_K]
        ]

        all_scores_low = bool(top_context) and all(item['score'] < LLM_LOW_SCORE_THRESHOLD for item in top_context)

        # Path B: rewrite query. If scores are weak, fall back to a generic rewrite with no context.
        llm_details = rag_utils.enrich_query_with_llm_details(
            user_query=query,
            max_context=LLM_CONTEXT_TOP_K,
            context_items=top_context,
            generic_only=all_scores_low,
        )
        enriched_query = llm_details.get('modified_query', query)

        query_vec = query_to_vec(enriched_query)
        ai_overview = {
            'user_query': query,
            'modified_query': enriched_query,
            'explanation': llm_details.get('explanation', ''),
            'used_context': bool(llm_details.get('used_context', False)),
            'low_score_fallback': all_scores_low,
            'context_top_k': LLM_CONTEXT_TOP_K,
            'score_threshold': LLM_LOW_SCORE_THRESHOLD,
            'top_scores': [round(item['score'], 4) for item in top_context],
        }
    else:
        query_vec = query_to_vec(query)

    optimized_query_vec = query_vec
    scores = cosine_similarity(optimized_query_vec, embeddings)[0]
    id_to_score = dict(zip(show_ids, scores))
    
    # add scores and sort
    results = sorted(
        [{'podcast': p, 'score': id_to_score.get(str(p.id), 0.0)} for p in podcasts], key=lambda x: x['score'], reverse=True
    )[:top_k]
    
    # * 100 for display
    results = [{'podcast': r['podcast'], 'score': round(float(r['score']) * 100, 4)} for r in results]
    
    # Build result dicts with latent dimension data
    result_dicts = []
    for r in results:
        podcast_id_str = str(r['podcast'].id)
        podcast_idx = show_id_to_idx.get(podcast_id_str)
        podcast_embedding = embeddings[podcast_idx] if podcast_idx is not None else None
        
        result_dicts.append({
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
            'avg_episode_time': (
                r['podcast'].avg_duration_min
                if r['podcast'].avg_duration_min is not None
                else 'No information provided'
            ),
            'top_dimensions': get_top_dimensions(podcast_embedding, k=6) if podcast_embedding is not None else {'positive': []},
        })

        if effective_use_llm:
            result_dicts[-1]['why_you_love_it'] = rag_utils.summarize_podcast_with_llm(
                {
                    'title': r['podcast'].name,
                    'description': r['podcast'].descr,
                    'categories': r['podcast'].categories,
                    'author': r['podcast'].author,
                },
                user_query=query,
                top_dimensions=result_dicts[-1]['top_dimensions'],
            )
        else:
            genres_text = r['podcast'].categories or ''
            score_text = f" with a similarity score of {r['score']:.3f}" if r['score'] is not None else ''
            result_dicts[-1]['why_you_love_it'] = f"This show aligns with your interest in {genres_text}{score_text}.".strip()
    
    if return_metadata:
        return {
            'results': result_dicts,
            'ai_overview': ai_overview,
        }
    return result_dicts


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
        use_llm_param    = request.args.get('useLLM')

        query, negated_genres = parse_query_negations(raw_query)
        excluded_genres = list(dict.fromkeys(excluded_genres + negated_genres))

        if not query:
            query = 'podcast'

        use_llm_override = None if use_llm_param is None else (use_llm_param.lower() == 'true')
        effective_use_llm = USE_LLM if use_llm_override is None else (USE_LLM and use_llm_override)

        payload = json_search(
            query=query,
            explicit=explicit,
            genres=genres,
            excluded_genres=excluded_genres,
            publisher=publisher,
            release_year=year,
            length_metric=length_met,
            min_length=min_length,
            max_length=max_length,
            top_k=LLM_CONTEXT_TOP_K,
            return_metadata=effective_use_llm,
            use_llm_override=use_llm_override,
        )

        return jsonify(payload)

    if USE_LLM:
        from llm_routes import register_chat_route
        register_chat_route(app, json_search)
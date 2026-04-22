import numpy as np
from sklearn.metrics.pairwise import cosine_similarity
import os
import pickle
import pandas as pd
from pathlib import Path
from models import db, Podcast

# Load once at startup
OS_PATH = os.path.dirname(os.path.abspath(__file__))
with open(os.path.join(OS_PATH, 'data/svd/svd_mixed.pkl'), 'rb') as f:
    svd_model = pickle.load(f) 
    
# shape: (n_podcasts, 100)
embeddings = np.load(os.path.join(OS_PATH, 'data/embeddings/embeddings_mixed.npy'))
show_ids = Path(os.path.join(OS_PATH, 'data/ids/podcasts_embeddings_ids.txt')).read_text().splitlines()
df = pd.read_csv(os.path.join(OS_PATH, 'data/podcasts_cleaned2.csv')) #Note: still kept as cleaned2
show_id_to_idx = {show_id: idx for idx, show_id in enumerate(show_ids)}

tfidf_vectorizer = svd_model['tfidf']
svd_model_obj = svd_model['svd']
feature_names = tfidf_vectorizer.get_feature_names_out()


def get_dimension_label(dim_idx: int, top_words_count: int = 3) -> str:
    if dim_idx >= len(svd_model_obj.components_):
        return f'Dim {dim_idx}'

    component = svd_model_obj.components_[dim_idx]
    top_indices = np.argsort(np.abs(component))[-top_words_count:][::-1]
    top_words = [str(feature_names[i]) for i in top_indices]
    return ', '.join(top_words)


dimension_labels = {i: get_dimension_label(i) for i in range(len(svd_model_obj.components_))}


def get_top_dimensions(embedding, k=6):
    if embedding is None:
        return {'positive': [], 'negative': []}

    embedding = np.asarray(embedding).flatten()
    positive_mask = embedding > 0
    negative_mask = embedding < 0

    positive_vals = embedding[positive_mask]
    negative_vals = embedding[negative_mask]
    positive_indices = np.where(positive_mask)[0]
    negative_indices = np.where(negative_mask)[0]

    pos_top_k = min(k, len(positive_vals))
    neg_top_k = min(k, len(negative_vals))

    pos_sorted_idx = positive_indices[np.argsort(positive_vals)[-pos_top_k:][::-1]] if pos_top_k else []
    neg_sorted_idx = negative_indices[np.argsort(negative_vals)[:neg_top_k]] if neg_top_k else []

    return {
        'positive': [
            {
                'dimension': int(idx),
                'value': float(embedding[idx]),
                'label': dimension_labels.get(int(idx), f'Dim {idx}'),
            }
            for idx in pos_sorted_idx
        ],
        'negative': [
            {
                'dimension': int(idx),
                'value': float(embedding[idx]),
                'label': dimension_labels.get(int(idx), f'Dim {idx}'),
            }
            for idx in neg_sorted_idx
        ],
    }

def query_to_vector(query: str) -> np.ndarray:
    """Transform a text query into a normalized SVD vector."""
    tfidf_vec = svd_model['tfidf'].transform([query])
    vec       = svd_model['svd'].transform(tfidf_vec)[0]  # shape: (100,)
    norm      = np.linalg.norm(vec)
    return vec / norm if norm > 0 else vec

def compute_harmonic_score(podcast, vec_a, vec_b, show_id_to_idx, embeddings):
    """Computes harmonic mean for each podcast returned from merged query. 
    This prevents results that are very skewed towards just one user."""
    show_id_str = str(podcast.id)
    
    if show_id_str not in show_id_to_idx:
        return 0.0
    
    podcast_embedding = embeddings[show_id_to_idx[show_id_str]]
    
    score_a = float(cosine_similarity([vec_a], [podcast_embedding])[0][0])
    score_b = float(cosine_similarity([vec_b], [podcast_embedding])[0][0])
    
    # Harmonic mean: 2 / (1/a + 1/b)
    if score_a > 0 and score_b > 0:
        result = 2 / (1/score_a + 1/score_b)
    elif score_a > 0 or score_b > 0:
        result = max(score_a, score_b) * 0.5  # Penalize if only one user likes it
    else:
        return 0.0
    return max(result, 0.0)

def compute_match(user_a: dict, user_b: dict) -> dict:
    """
    user_a / user_b are dicts matching your QueryComponent fields:
      { query, explicit, genres, lengthMetric, maxLength, publisher, releaseYear }
    """

    vec_a = query_to_vector(user_a['query'])
    vec_b = query_to_vector(user_b['query'])

    # Match score: cosine similarity between the two query vectors
    # This measures how semantically similar their interests are.
    # Range: -1 to 1, multiply by 100 for a percentage.
    raw_match = float(cosine_similarity([vec_a], [vec_b])[0][0])
    match_pct = round(((raw_match + 1) / 2) * 100, 1)  # rescale to 0–100%

    # ── Merged query vector: average of both 
    # TODO RAG for better merged vector?
    merged_vec = (vec_a + vec_b) / 2
    merged_norm = np.linalg.norm(merged_vec)
    if merged_norm > 0:
        merged_vec = merged_vec / merged_norm

    # ── Score all podcasts against merged vector 
    scores = cosine_similarity([merged_vec], embeddings)[0]
    id_to_score = dict(zip(show_ids, scores.tolist()))

    # ── Build filter from INTERSECTION of both users' preferences
    # For explicit: only allow if BOTH users said yes
    allow_explicit = user_a.get('explicit', False) and user_b.get('explicit', False)

    # For genres: union (recommend if either user likes it)
    genres_a = set(g.lower() for g in user_a.get('genres', []))
    genres_b = set(g.lower() for g in user_b.get('genres', []))
    genres_union = genres_a | genres_b

    # For length: use the more restrictive (smaller) max from either user
    max_length_a = user_a.get('maxLength')
    max_length_b = user_b.get('maxLength')
    if max_length_a and max_length_b:
        max_length = min(max_length_a, max_length_b)
    else:
        max_length = max_length_a or max_length_b

    length_metric = user_a.get('lengthMetric') or user_b.get('lengthMetric')

    # ── Query DB 
    q = db.session.query(Podcast)

    if not allow_explicit:
        q = q.filter(Podcast.explicit == False)

    if genres_union:
        genre_filters = [Podcast.categories.ilike(f'%{g}%') for g in genres_union]
        q = q.filter(db.or_(*genre_filters))

    if max_length and length_metric == 'total_episodes':
        q = q.filter(Podcast.episode_count <= max_length)

    if max_length and length_metric == 'duration_ms':
        q = q.filter(Podcast.avg_duration_min <= max_length)

    podcasts = q.all()

    # scores based on harmonic mean
    scores = {}
    for p in podcasts:
        scores[p.id] = compute_harmonic_score(p, vec_a, vec_b, show_id_to_idx, embeddings)
    
    # Rank by merged score
    ranked = sorted(
        podcasts,
        key=lambda p: scores.get(p.id, 0.0),
        reverse=True
    )[:5]

    results = [{
        'id':            p.id,
        'title':         p.name,
        'description':   p.descr,
        'categories':    p.categories,
        'explicit':      p.explicit,
        'image_url':     p.image_url,
        'feed_url':      p.feed_url,
        'website_url':   p.website_url,
        'author':        p.author,
        'score':         round(scores.get(p.id, 0.0), 4),
        'score_for_a':   round(float(cosine_similarity([vec_a], [embeddings[show_id_to_idx[str(p.id)]]])[0][0]), 4) if str(p.id) in show_id_to_idx else 0,
        'score_for_b':   round(float(cosine_similarity([vec_b], [embeddings[show_id_to_idx[str(p.id)]]])[0][0]), 4) if str(p.id) in show_id_to_idx else 0,
        'episode_count': p.episode_count,
        'avg_episode_time': (
            p.avg_duration_min
            if p.avg_duration_min is not None
            else 'No information provided'
        ),
        'top_dimensions': get_top_dimensions(embeddings[show_id_to_idx[str(p.id)]]) if str(p.id) in show_id_to_idx else {'positive': [], 'negative': []},
        'popularity':    p.popularity_score,
    } for p in ranked]

    return {
        'match_pct':  match_pct,
        'results':    results,
        'meta': {
            'genres_searched': list(genres_union),
            'explicit_allowed': allow_explicit,
        }
    }
import numpy as np
from sklearn.metrics.pairwise import cosine_similarity
import os
import pickle
import pandas as pd
from pathlib import Path
from models import db, Podcast

# Load once at startup
OS_PATH = os.path.dirname(os.path.abspath(__file__))
with open(os.path.join(OS_PATH, 'data/svd_shows_improved2.pkl'), 'rb') as f:
    svd_model = pickle.load(f) 
    
# shape: (n_podcasts, 100)
embeddings = np.load(os.path.join(OS_PATH, 'data/embeddings/description_embeddings_mixed2.npy'))
show_ids = Path(os.path.join(OS_PATH, 'data/embeddings/embedding_show_ids2.txt')).read_text().splitlines()
df = pd.read_csv(os.path.join(OS_PATH, 'data/podcasts_cleaned2.csv'))

def query_to_vector(query: str) -> np.ndarray:
    """Transform a text query into a normalized SVD vector."""
    tfidf_vec = svd_model['tfidf'].transform([query])
    vec       = svd_model['svd'].transform(tfidf_vec)[0]  # shape: (100,)
    norm      = np.linalg.norm(vec)
    return vec / norm if norm > 0 else vec

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
        q = q.filter(Podcast.avg_duration_min <= max_length / 60000)

    podcasts = q.all()

    # Rank by merged score
    ranked = sorted(
        podcasts,
        key=lambda p: id_to_score.get(str(p.id), 0.0),
        reverse=True
    )[:20]

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
        'score':         round(id_to_score.get(str(p.id), 0.0), 4),
        'score_for_a':   round(float(cosine_similarity([vec_a], [embeddings[show_ids.index(str(p.id))]])[0][0]), 4) if str(p.id) in show_ids else 0,
        'score_for_b':   round(float(cosine_similarity([vec_b], [embeddings[show_ids.index(str(p.id))]])[0][0]), 4) if str(p.id) in show_ids else 0,
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
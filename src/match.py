import os
import pickle
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.metrics.pairwise import cosine_similarity

import rag_utils
from models import Podcast, db

OS_PATH = os.path.dirname(os.path.abspath(__file__))

with open(os.path.join(OS_PATH, 'data/svd/svd_mixed.pkl'), 'rb') as f:
    svd_model = pickle.load(f)

embeddings = np.load(os.path.join(OS_PATH, 'data/embeddings/embeddings_mixed.npy'))
show_ids = Path(os.path.join(OS_PATH, 'data/ids/podcasts_embeddings_ids.txt')).read_text().splitlines()
_ = pd.read_csv(os.path.join(OS_PATH, 'data/podcasts_cleaned2.csv'))
show_id_to_idx = {show_id: idx for idx, show_id in enumerate(show_ids)}

tfidf_vectorizer = svd_model['tfidf']
svd_model_obj = svd_model['svd']
feature_names = tfidf_vectorizer.get_feature_names_out()

LLM_CONTEXT_TOP_K = 5
LLM_LOW_SCORE_THRESHOLD = 0.16

PODCAST_CATEGORIES = {
    'informational': [6,9,67,21,22,24,26,30,47,51,52,58,61,66,68,82],
    'entertainment': [8,10,11,12,38,41,43,54,55,56,59,62,71,84],
    'conversational': [28,36,75,77,78,91,97],
    'wellness': [27,46,49,57,72,75,83,85,95,99],
    'news': [7,13,14,23,33,34,37,44,60,70,79,88,92],
    'culture': [5,16,31,32,63,65,67,76,80,87,93,94,99]
}

def get_dimension_label(dim_idx: int, top_words_count: int = 3) -> str:
    if dim_idx >= len(svd_model_obj.components_):
        return f'Dim {dim_idx}'
    component = svd_model_obj.components_[dim_idx]
    top_indices = np.argsort(np.abs(component))[-top_words_count:][::-1]
    top_words = [str(feature_names[i]) for i in top_indices]
    return ', '.join(top_words)


dimension_labels = {i: get_dimension_label(i) for i in range(len(svd_model_obj.components_))}


def get_semantic_category_scores(embedding: np.ndarray) -> dict:
    """
    Score a podcast embedding against the podcast categories for values to plot on radar chart.
    For each category, returns the maximum activation among its constituent dimensions.
    
    Args:
        embedding: SVD embedding vector for a podcast
        
    Returns:
        dictionary structured like:
        {
            'semantic': [
                {'dimension': 'category_name', 'value': float, 'label': 'category_name'}
            ]
        }
        Normalized values (btwn 0, 1) in descending order.
    """
    if embedding is None:
        return {'semantic': []}
    
    embedding = np.asarray(embedding).flatten()
    category_scores = {}
    
    # For each semantic category, find the max activation among its dimensions
    for category, dim_indices in PODCAST_CATEGORIES.items():
        valid_indices = [d for d in dim_indices if d < len(embedding)]
        if not valid_indices:
            category_scores[category] = 0.0
        else:
            # Use the max positive activation in this category
            max_activation = max([embedding[idx] for idx in valid_indices])
            category_scores[category] = float(max(max_activation, 0.0))  # Clip negatives
    
    # Normalize scores to [0, 1] for consistent visualization
    max_score = max(category_scores.values()) if category_scores else 1.0
    if max_score == 0:
        max_score = 1.0
    
    normalized_scores = {k: v / max_score for k, v in category_scores.items()}
    
    # Sort by value descending and format for API response
    sorted_categories = sorted(normalized_scores.items(), key=lambda x: x[1], reverse=True)
    
    return {
        'semantic': [
            {
                'dimension': cat_name,
                'value': score,
                'label': cat_name.capitalize(),
            }
            for cat_name, score in sorted_categories
        ]
    }


def query_to_vector(query: str) -> np.ndarray:
    """Transform a text query into a normalized SVD vector."""
    tfidf_vec = tfidf_vectorizer.transform([query])
    vec = svd_model_obj.transform(tfidf_vec)[0]
    norm = np.linalg.norm(vec)
    return vec / norm if norm > 0 else vec

def cosine_to_pct(cosine_val: float) -> float:
    """
    Convert raw cosine similarity (-1 to 1) to a 0-100% display value.
    Clips negatives to 0: a negative cosine for a podcast
    """
    return round(max(cosine_val, 0.0), 1)

def compute_balanced_score(score_a: float, score_b: float) -> float:
    """
    Combine two per-user scores into one ranking score that:
    - Rewards podcasts both users like (high scores for both = best result)
    - Penalizes podcasts only one user likes (unbalanced = worse result)
    - Never goes negative

    Uses a weighted combination:
      base    = average of both scores (overall relevance)
      balance = 1 - |score_a - score_b| (how equal the scores are, 0-1)
      final   = base * (0.7 + 0.3 * balance)

    This is softer than harmonic mean but still penalizes imbalance.
    The 0.7/0.3 split means balance accounts for 30% of the score — tune if needed.
    """
    score_a = max(score_a, 0.0)
    score_b = max(score_b, 0.0)

    base = (score_a + score_b) / 2.0
    balance = 1.0 - abs(score_a - score_b)
    return base * (0.7 + 0.3 * balance)


def compute_match(user_a: dict, user_b: dict, use_llm: bool = True) -> dict:
    vec_a = query_to_vector(user_a.get('query', ''))
    vec_b = query_to_vector(user_b.get('query', ''))

    raw_match = float(cosine_similarity([vec_a], [vec_b])[0][0])
    match_pct = round(((raw_match + 1) / 2) * 100, 1)

    merged_vec = (vec_a + vec_b) / 2
    merged_norm = np.linalg.norm(merged_vec)
    if merged_norm > 0:
        merged_vec = merged_vec / merged_norm

    # Setting up Hard Filters
    allow_explicit = user_a.get('explicit', False) and user_b.get('explicit', False)
    genres_a = set(g.lower() for g in user_a.get('genres', []))
    genres_b = set(g.lower() for g in user_b.get('genres', []))
    genres_union = genres_a | genres_b

    max_length_a = user_a.get('maxLength')
    max_length_b = user_b.get('maxLength')
    max_length = min(max_length_a, max_length_b) if max_length_a and max_length_b else (max_length_a or max_length_b)
    length_metric = user_a.get('lengthMetric') or user_b.get('lengthMetric')

    q = db.session.query(Podcast)
    if not allow_explicit:
        q = q.filter(Podcast.explicit == False)
    if genres_union:
        q = q.filter(db.or_(*[Podcast.categories.ilike(f'%{g}%') for g in genres_union]))
    if max_length and length_metric == 'total_episodes':
        q = q.filter(Podcast.episode_count <= max_length)
    if max_length and length_metric == 'duration_ms':
        q = q.filter(Podcast.avg_duration_min <= max_length)

    podcasts = q.all()

    scored = []
    for p in podcasts:
        sid = str(p.id)
        idx = show_id_to_idx.get(sid)
        if idx is None:
            continue

        pod_emb = embeddings[idx]
        score_a = float(cosine_similarity([vec_a], [pod_emb])[0][0])
        score_b = float(cosine_similarity([vec_b], [pod_emb])[0][0])
        combined = compute_balanced_score(score_a, score_b)
        merged_score = float(cosine_similarity([merged_vec], [pod_emb])[0][0])

        scored.append(
            {
                'podcast': p,
                'idx': idx,
                'score_a': score_a,
                'score_b': score_b,
                'combined': combined,
                'merged_score': merged_score,
            }
        )

    combined_llm = {
        'modified_query': f"{user_a.get('query', '')} {user_b.get('query', '')}".strip(),
        'explanation': 'LLM was disabled for this collaborative search.',
        'used_context': False,
    }
    top_context = []
    all_scores_low = False

    if use_llm and scored:
        baseline_candidates = sorted(scored, key=lambda x: x['merged_score'], reverse=True)[:LLM_CONTEXT_TOP_K]
        top_context = [
            {
                'title': item['podcast'].name,
                'description': rag_utils._clip_words(item['podcast'].descr, max_words=50),
                'categories': item['podcast'].categories,
                'author': item['podcast'].author,
                'score': item['merged_score'],
            }
            for item in baseline_candidates
        ]
        all_scores_low = bool(top_context) and all(item['score'] < LLM_LOW_SCORE_THRESHOLD for item in top_context)

        combined_llm = rag_utils.enrich_collab_query_with_llm_details(
            user_a_query=user_a.get('query', ''),
            user_b_query=user_b.get('query', ''),
            max_context=LLM_CONTEXT_TOP_K,
            context_items=top_context,
            generic_only=all_scores_low,
        )

    ranked = sorted(scored, key=lambda x: x['combined'], reverse=True)[:LLM_CONTEXT_TOP_K]

    results = []
    for item in ranked:
        p = item['podcast']
        dims = get_semantic_category_scores(embeddings[item['idx']])
        score_pct = item['combined'] * 100.0

        if use_llm:
            why_text = rag_utils.summarize_podcast_with_llm(
                {
                    'title': p.name,
                    'description': p.descr,
                    'categories': p.categories,
                    'author': p.author,
                },
                user_query=f"{user_a.get('query', '')} {user_b.get('query', '')}".strip(),
                top_dimensions=dims,
            )
        else:
            genres_text = p.categories or ''
            why_text = f"This show aligns with both of your interests in {genres_text} with a similarity score of {score_pct:.2f}%."

        results.append(
            {
                'id': p.id,
                'title': p.name,
                'description': p.descr,
                'categories': p.categories,
                'explicit': p.explicit,
                'image_url': p.image_url,
                'feed_url': p.feed_url,
                'website_url': p.website_url,
                'author': p.author,
                'score': round(score_pct, 4),
                'score_for_a': round(max(item['score_a'], 0.0), 4),
                'score_for_b': round(max(item['score_b'], 0.0), 4),
                'episode_count': p.episode_count,
                'avg_episode_time': p.avg_duration_min if p.avg_duration_min is not None else 'No information provided',
                'top_dimensions': dims,
                'why_you_love_it': why_text,
                'popularity': p.popularity_score,
            }
        )

    return {
        'match_pct': match_pct,
        'results': results,
        'ai_overview': {
            'user_query_a': user_a.get('query', ''),
            'user_query_b': user_b.get('query', ''),
            'modified_query': combined_llm.get('modified_query', ''),
            'explanation': combined_llm.get('explanation', ''),
            'used_context': bool(combined_llm.get('used_context', False)),
            'low_score_fallback': all_scores_low,
            'context_top_k': LLM_CONTEXT_TOP_K,
            'score_threshold': LLM_LOW_SCORE_THRESHOLD,
            'top_scores': [round(item['score'], 4) for item in top_context],
        }
        if use_llm
        else None,
    }

"""
SVD-based player search and explainability.

Uses a pre-fitted sklearn TruncatedSVD on the same scaled feature matrix as
player_embeddings.npy. Compares cosine similarity in raw feature space vs
latent space, and explains matches via signed latent-dimension products.
"""
from __future__ import annotations

import os
from typing import Any

import joblib
import numpy as np
from sklearn.metrics.pairwise import cosine_similarity

from embeddings.features import CANONICAL_FEATURE_COLUMNS

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SVD_BUNDLE_PATH = os.path.join(PROJECT_ROOT, "embeddings", "svd_bundle.joblib")

_SVD_CACHE: dict[str, Any] | None = None


def load_svd_bundle() -> dict[str, Any] | None:
    global _SVD_CACHE
    if _SVD_CACHE is not None:
        return _SVD_CACHE
    if not os.path.exists(SVD_BUNDLE_PATH):
        _SVD_CACHE = None
        return None
    _SVD_CACHE = joblib.load(SVD_BUNDLE_PATH)
    return _SVD_CACHE


def clear_svd_cache() -> None:
    global _SVD_CACHE
    _SVD_CACHE = None


def _normalize_rows(matrix: np.ndarray) -> np.ndarray:
    norms = np.linalg.norm(matrix, axis=1, keepdims=True)
    norms = np.where(norms == 0, 1.0, norms)
    return matrix / norms


def _component_feature_hints(
    components: np.ndarray,
    feature_names: list[str],
    dim: int,
    top_n: int = 4,
) -> tuple[list[str], list[str]]:
    """Top positive- and negative-loading original features for latent dimension `dim`."""
    if dim < 0 or dim >= components.shape[0]:
        return [], []
    loadings = components[dim]
    order = np.argsort(loadings)
    neg_feats = [feature_names[i] for i in order[:top_n]]
    pos_feats = [feature_names[i] for i in order[-top_n:][::-1]]
    return pos_feats, neg_feats


def explain_latent_alignment(
    query_latent: np.ndarray,
    player_latent: np.ndarray,
    bundle: dict[str, Any],
    top_k_each: int = 5,
) -> dict[str, Any]:
    """
    Explain cosine alignment via per-dimension products q_d * p_d (before norm).
    Positive product = same sign on that factor (reinforcing);
    negative = opposite sign (one high + one high- pulls apart).
    """
    svd = bundle["svd"]
    components: np.ndarray = svd.components_
    feature_names: list[str] = bundle.get("feature_names", list(CANONICAL_FEATURE_COLUMNS))

    q = np.asarray(query_latent, dtype=float).ravel()
    p = np.asarray(player_latent, dtype=float).ravel()
    products = q * p
    order = np.argsort(products)

    neg_dims = []
    for idx in order[:top_k_each]:
        if products[idx] >= 0:
            break
        pos_h, neg_h = _component_feature_hints(components, feature_names, int(idx))
        neg_dims.append(
            {
                "dim": int(idx),
                "query_activation": float(q[idx]),
                "player_activation": float(p[idx]),
                "contribution": float(products[idx]),
                "top_positive_loadings": pos_h,
                "top_negative_loadings": neg_h,
            }
        )

    pos_dims = []
    for idx in order[::-1][:top_k_each]:
        if products[idx] <= 0:
            break
        pos_h, neg_h = _component_feature_hints(components, feature_names, int(idx))
        pos_dims.append(
            {
                "dim": int(idx),
                "query_activation": float(q[idx]),
                "player_activation": float(p[idx]),
                "contribution": float(products[idx]),
                "top_positive_loadings": pos_h,
                "top_negative_loadings": neg_h,
            }
        )

    return {"positive_dimensions": pos_dims, "negative_dimensions": neg_dims}


def rank_raw_vs_svd(
    prototype: np.ndarray,
    candidate_matrix: np.ndarray,
    bundle: dict[str, Any],
    top_k: int = 10,
) -> tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
    """
    Returns (raw_scores, svd_scores, raw_rank_idx_local, svd_rank_idx_local)
    for rows of candidate_matrix (same order as input).
    """
    proto = prototype.astype(float).reshape(1, -1)
    cand = candidate_matrix.astype(float)

    raw_scores = cosine_similarity(_normalize_rows(proto), _normalize_rows(cand))[0]

    svd = bundle["svd"]
    proto_lat = svd.transform(proto)
    cand_lat = svd.transform(cand)
    svd_scores = cosine_similarity(_normalize_rows(proto_lat), _normalize_rows(cand_lat))[0]

    raw_order = np.argsort(raw_scores)[::-1]
    svd_order = np.argsort(svd_scores)[::-1]
    return raw_scores, svd_scores, raw_order, svd_order


def svd_dimension_legend(bundle: dict[str, Any], max_dims: int = 16) -> list[dict[str, Any]]:
    """Short human-readable interpretation of each latent dimension from Vt loadings."""
    svd = bundle["svd"]
    components: np.ndarray = svd.components_
    feature_names: list[str] = bundle.get("feature_names", list(CANONICAL_FEATURE_COLUMNS))
    evr = getattr(svd, "explained_variance_ratio_", None)
    out: list[dict[str, Any]] = []
    k = min(max_dims, components.shape[0])
    for d in range(k):
        pos_h, neg_h = _component_feature_hints(components, feature_names, d, top_n=3)
        entry: dict[str, Any] = {
            "dim": d,
            "top_positive_loadings": pos_h,
            "top_negative_loadings": neg_h,
        }
        if evr is not None and len(evr) > d:
            entry["explained_variance_ratio"] = float(evr[d])
        out.append(entry)
    return out

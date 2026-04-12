from __future__ import annotations

import logging
import re
from typing import Any, Dict, List

import numpy as np
from sklearn.metrics.pairwise import cosine_similarity

from embeddings.similarity import (
    build_description_prototype,
    find_players_by_description,
    find_similar_players,
    parse_similarity_query,
)
from embeddings.store import get_player_index, load_embeddings, load_player_metadata
from embeddings.svd_search import (
    explain_latent_alignment,
    load_svd_bundle,
    rank_raw_vs_svd,
    svd_dimension_legend,
)

try:
    from player_search import (
        PLAYER_INDEX,
        boolean_search,
        career_start_year_for_embedding_player,
        find_player_by_name,
        nationality_normalized_for_embedding_player,
        parse_query,
        passes_max_age_under,
        reference_year_for_queries,
    )
except ImportError:  # pragma: no cover - package-style import fallback
    from src.player_search import (
        PLAYER_INDEX,
        boolean_search,
        career_start_year_for_embedding_player,
        find_player_by_name,
        nationality_normalized_for_embedding_player,
        parse_query,
        passes_max_age_under,
        reference_year_for_queries,
    )


LOGGER = logging.getLogger(__name__)

SIMILAR_PLAYER_PATTERNS = (
    re.compile(r"^\s*(?:players?\s+)?most like\s+(.+?)\s*$", re.IGNORECASE),
    re.compile(r"^\s*(?:players?\s+)?similar to\s+(.+?)\s*$", re.IGNORECASE),
    re.compile(r"^\s*who(?:'s| is)\s+like\s+(.+?)\s*$", re.IGNORECASE),
)
DESCRIPTION_HINTS = (
    "clinical",
    "creative",
    "defensive",
    "physical",
    "playmaker",
    "box-to-box",
    "prolific",
    "young",
)

_EMBEDDING_CACHE: dict[str, Any] | None = None


def _load_embeddings_bundle() -> dict[str, Any] | None:
    global _EMBEDDING_CACHE
    if _EMBEDDING_CACHE is not None:
        return _EMBEDDING_CACHE
    try:
        matrix, player_index = load_embeddings()
        player_metadata = load_player_metadata()
    except Exception as exc:  # pragma: no cover - runtime fallback
        LOGGER.warning("Embeddings unavailable for semantic search: %s", exc)
        _EMBEDDING_CACHE = None
        return None
    _EMBEDDING_CACHE = {
        "matrix": matrix,
        "player_index": player_index,
        "player_metadata": player_metadata,
    }
    return _EMBEDDING_CACHE


def _extract_similarity_target(query: str) -> str | None:
    for pattern in SIMILAR_PLAYER_PATTERNS:
        match = pattern.match(query)
        if match:
            return match.group(1).strip()
    return None


def _is_description_similarity_query(query: str) -> bool:
    normalized = query.casefold()
    return any(hint in normalized for hint in DESCRIPTION_HINTS) and not any(
        pattern.match(query) for pattern in SIMILAR_PLAYER_PATTERNS
    )


def _aggregate_embedding_result(result: Dict[str, Any]) -> Dict[str, Any]:
    display_name = result["player"]
    lookup_key = result.get("lookup_key") or display_name
    records = find_player_by_name(lookup_key) or []

    if not records:
        return {
            "player_id": None,
            "name": display_name,
            "nationality": None,
            "position": result.get("position"),
            "league": "Embedding profile",
            "team": None,
            "image": None,
            "goals": None,
            "assists": None,
            "appearances": None,
            "minutes": None,
            "shots_on_target": None,
            "dribbles_completed": None,
            "season_years": [],
            "seasons": [],
            "goals_per_game": None,
            "assists_per_game": None,
            "shot_on_target_ratio": None,
            "similarity_score": float(result.get("score", 0)),
            "search_mode": "embedding",
        }

    leagues = sorted({record.get("league") for record in records if record.get("league")})
    seasons = sorted({season for record in records for season in record.get("seasons", [])})
    season_years = sorted({year for record in records for year in record.get("season_years", [])})

    def first_non_null(field: str):
        for record in records:
            value = record.get(field)
            if value not in (None, "", []):
                return value
        return None

    def summed(field: str):
        values = [record.get(field) for record in records if record.get(field) is not None]
        return sum(values) if values else None

    return {
        "player_id": first_non_null("player_id"),
        "name": first_non_null("name") or display_name,
        "nationality": first_non_null("nationality"),
        "position": result.get("position") or first_non_null("position"),
        "league": ", ".join(leagues) if leagues else "Embedding profile",
        "team": first_non_null("team"),
        "image": first_non_null("image"),
        "goals": summed("goals"),
        "assists": summed("assists"),
        "appearances": summed("appearances"),
        "minutes": summed("minutes"),
        "shots_on_target": summed("shots_on_target"),
        "dribbles_completed": summed("dribbles_completed"),
        "season_years": season_years,
        "seasons": seasons,
        "goals_per_game": first_non_null("goals_per_game"),
        "assists_per_game": first_non_null("assists_per_game"),
        "shot_on_target_ratio": first_non_null("shot_on_target_ratio"),
        "similarity_score": float(result.get("score", 0)),
        "search_mode": "embedding",
    }


def _normalize_rows(matrix: np.ndarray) -> np.ndarray:
    norms = np.linalg.norm(matrix, axis=1, keepdims=True)
    norms = np.where(norms == 0, 1.0, norms)
    return matrix / norms


def _description_filtered_names(
    query: str,
    player_index: List[str],
    player_metadata: Dict[str, Any],
) -> List[str]:
    filters = parse_similarity_query(query)
    filtered_names: List[str] = []
    nat_key = filters.get("nationality_normalized")
    nat_region = filters.get("nationality_region")
    max_age_under = filters.get("max_age_under")
    ref_year = int(filters.get("reference_year") or reference_year_for_queries())
    for name in player_index:
        meta = player_metadata.get(name, {})
        if filters.get("position") and meta.get("primary_position") != filters["position"]:
            continue
        era_start = filters.get("era_start")
        era_end = filters.get("era_end")
        if era_start is not None and era_end is not None:
            years = meta.get("season_years", [])
            if not any(era_start <= year <= era_end for year in years):
                continue
        pnat = nationality_normalized_for_embedding_player(name, meta)
        if nat_region:
            if pnat not in nat_region:
                continue
        elif nat_key:
            if pnat != nat_key:
                continue
        if max_age_under is not None:
            start = career_start_year_for_embedding_player(name, meta)
            if not passes_max_age_under(max_age_under, ref_year, start):
                continue
        filtered_names.append(name)
    return filtered_names


def _pack_semantic_hit(
    embedding_bundle: Dict[str, Any],
    row_index: int,
    score: float,
    mode: str,
    svd_explain: Dict[str, Any] | None = None,
) -> Dict[str, Any]:
    player_index = embedding_bundle["player_index"]
    player_metadata = embedding_bundle["player_metadata"]
    norm_name = player_index[row_index]
    meta = player_metadata.get(norm_name, {})
    display = meta.get("display_name", norm_name)
    inner = {
        "player": display,
        "lookup_key": norm_name,
        "score": float(score),
        "position": meta.get("primary_position", "Unknown"),
    }
    agg = _aggregate_embedding_result(inner)
    agg["search_mode"] = mode
    if svd_explain is not None:
        agg["svd_explain"] = svd_explain
    return agg


def _dual_semantic_search(
    prototype: np.ndarray,
    candidate_indices: List[int],
    embedding_bundle: Dict[str, Any],
    mode: str,
    top_k: int = 10,
) -> Dict[str, Any]:
    """
    Rank candidates by raw cosine vs SVD latent cosine; attach per-hit latent explainability.
    """
    empty = {
        "mode": mode,
        "results": [],
        "results_svd": [],
        "results_without_svd": [],
        "svd_available": False,
        "svd_latent_dimensions": [],
    }
    if not candidate_indices:
        return empty

    matrix = embedding_bundle["matrix"]
    cand_mat = matrix[np.array(candidate_indices, dtype=int)]
    svd_bundle = load_svd_bundle()

    if svd_bundle is None:
        proto = prototype.astype(float).reshape(1, -1)
        sims = cosine_similarity(_normalize_rows(proto), _normalize_rows(cand_mat.astype(float)))[0]
        order = np.argsort(sims)[::-1][:top_k]
        results = [
            _pack_semantic_hit(embedding_bundle, candidate_indices[int(i)], sims[i], mode)
            for i in order
        ]
        return {
            "mode": mode,
            "results": results,
            "results_svd": None,
            "results_without_svd": None,
            "svd_available": False,
            "svd_latent_dimensions": [],
        }

    raw_scores, svd_scores, raw_order, svd_order = rank_raw_vs_svd(
        prototype, cand_mat, svd_bundle, top_k=top_k
    )
    svd_model = svd_bundle["svd"]
    proto_lat = svd_model.transform(prototype.reshape(1, -1))[0]
    cand_lat = svd_model.transform(cand_mat)

    raw_results: List[Dict[str, Any]] = []
    for loc in raw_order[:top_k]:
        loc = int(loc)
        raw_results.append(
            _pack_semantic_hit(
                embedding_bundle, candidate_indices[loc], raw_scores[loc], mode
            )
        )

    svd_results: List[Dict[str, Any]] = []
    for loc in svd_order[:top_k]:
        loc = int(loc)
        explain = explain_latent_alignment(proto_lat, cand_lat[loc], svd_bundle)
        svd_results.append(
            _pack_semantic_hit(
                embedding_bundle,
                candidate_indices[loc],
                svd_scores[loc],
                mode,
                svd_explain=explain,
            )
        )

    return {
        "mode": mode,
        "results": svd_results,
        "results_svd": svd_results,
        "results_without_svd": raw_results,
        "svd_available": True,
        "svd_latent_dimensions": svd_dimension_legend(svd_bundle),
    }


def search_players(query: str) -> Dict[str, Any]:
    """Route a search query to boolean or embedding-backed search."""
    semantic_target = _extract_similarity_target(query)
    embedding_bundle = _load_embeddings_bundle()

    if semantic_target and embedding_bundle is not None:
        if load_svd_bundle() is not None:
            try:
                q_idx = get_player_index(
                    semantic_target, embedding_bundle["player_index"]
                )
            except ValueError:
                pass
            else:
                matrix = embedding_bundle["matrix"]
                prototype = matrix[q_idx]
                candidate_indices = [
                    i for i in range(len(embedding_bundle["player_index"])) if i != q_idx
                ]
                return _dual_semantic_search(
                    prototype,
                    candidate_indices,
                    embedding_bundle,
                    "embedding_similarity",
                    top_k=10,
                )
        semantic_results = find_similar_players(
            semantic_target,
            embedding_bundle["matrix"],
            embedding_bundle["player_index"],
            top_k=10,
        )
        return {
            "mode": "embedding_similarity",
            "results": [_aggregate_embedding_result(r) for r in semantic_results],
            "results_svd": None,
            "results_without_svd": None,
            "svd_available": False,
            "svd_latent_dimensions": [],
        }

    if _is_description_similarity_query(query) and embedding_bundle is not None:
        if load_svd_bundle() is not None:
            pi = embedding_bundle["player_index"]
            pm = embedding_bundle["player_metadata"]
            matrix = embedding_bundle["matrix"]
            filtered_names = _description_filtered_names(query, pi, pm)
            if not filtered_names:
                bundle = load_svd_bundle()
                return {
                    "mode": "embedding_description",
                    "results": [],
                    "results_svd": [],
                    "results_without_svd": [],
                    "svd_available": bundle is not None,
                    "svd_latent_dimensions": svd_dimension_legend(bundle) if bundle else [],
                }
            index_lookup = {name: idx for idx, name in enumerate(pi)}
            candidate_indices = [index_lookup[n] for n in filtered_names]
            filters = parse_similarity_query(query)
            prototype = build_description_prototype(
                filtered_names, matrix, pi, pm, filters
            )
            return _dual_semantic_search(
                prototype,
                candidate_indices,
                embedding_bundle,
                "embedding_description",
                top_k=10,
            )
        semantic_results = find_players_by_description(
            query,
            embedding_bundle["matrix"],
            embedding_bundle["player_index"],
            embedding_bundle["player_metadata"],
            top_k=10,
        )
        return {
            "mode": "embedding_description",
            "results": [_aggregate_embedding_result(r) for r in semantic_results],
            "results_svd": None,
            "results_without_svd": None,
            "svd_available": False,
            "svd_latent_dimensions": [],
        }

    filters = parse_query(query)
    return {
        "mode": "boolean",
        "results": boolean_search(filters, PLAYER_INDEX["player_list"]),
        "results_svd": None,
        "results_without_svd": None,
        "svd_available": False,
        "svd_latent_dimensions": [],
    }

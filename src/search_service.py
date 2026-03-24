from __future__ import annotations

import logging
import re
from typing import Any, Dict, List

from embeddings.similarity import find_players_by_description, find_similar_players
from embeddings.store import load_embeddings, load_player_metadata

try:
    from player_search import PLAYER_INDEX, boolean_search, find_player_by_name, parse_query
except ImportError:  # pragma: no cover - package-style import fallback
    from src.player_search import PLAYER_INDEX, boolean_search, find_player_by_name, parse_query


LOGGER = logging.getLogger(__name__)

SIMILAR_PLAYER_PATTERNS = (
    re.compile(r"^\s*(?:players?\s+)?most like\s+(.+?)\s*$", re.IGNORECASE),
    re.compile(r"^\s*(?:players?\s+)?similar to\s+(.+?)\s*$", re.IGNORECASE),
    re.compile(r"^\s*who(?:'s| is)\s+like\s+(.+?)\s*$", re.IGNORECASE),
)
DESCRIPTION_HINTS = ("clinical", "creative", "defensive", "physical", "playmaker", "box-to-box")

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
    player_name = result["player"]
    records = find_player_by_name(player_name) or []

    if not records:
        return {
            "player_id": None,
            "name": player_name,
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
        "name": player_name,
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


def search_players(query: str) -> Dict[str, Any]:
    """Route a search query to boolean or embedding-backed search."""
    semantic_target = _extract_similarity_target(query)
    embedding_bundle = _load_embeddings_bundle()

    if semantic_target and embedding_bundle is not None:
        semantic_results = find_similar_players(
            semantic_target,
            embedding_bundle["matrix"],
            embedding_bundle["player_index"],
            top_k=10,
        )
        return {
            "mode": "embedding_similarity",
            "results": [_aggregate_embedding_result(result) for result in semantic_results],
        }

    if _is_description_similarity_query(query) and embedding_bundle is not None:
        semantic_results = find_players_by_description(
            query,
            embedding_bundle["matrix"],
            embedding_bundle["player_index"],
            embedding_bundle["player_metadata"],
            top_k=10,
        )
        return {
            "mode": "embedding_description",
            "results": [_aggregate_embedding_result(result) for result in semantic_results],
        }

    filters = parse_query(query)
    return {
        "mode": "boolean",
        "results": boolean_search(filters, PLAYER_INDEX["player_list"]),
    }

"""
Routes: React app serving, episode search API, and player stats lookup.

To enable AI chat, set USE_LLM = True below. See llm_routes.py for AI code.
"""
import csv
import json
import os
import unicodedata
from typing import Any, Dict, List

from flask import send_from_directory, request, jsonify
from models import db, Episode, Review

# ── AI toggle ────────────────────────────────────────────────────────────────
USE_LLM = False
# USE_LLM = True
# ─────────────────────────────────────────────────────────────────────────────


PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(PROJECT_ROOT, "data")
LALIGA_CSV = os.path.join(DATA_DIR, "laliga_all_players.csv")
PREM_CSV = os.path.join(DATA_DIR, "prem_all_players.csv")

laliga_players_cache: List[Dict[str, Any]] | None = None
prem_players_cache: List[Dict[str, Any]] | None = None


def safe_int(value: str | None) -> int | None:
    try:
        if value is None or value == "":
            return None
        return int(float(value))
    except (TypeError, ValueError):
        return None


def norm_text(value: str) -> str:
    """
    Normalize text for accent-insensitive, case-insensitive matching.
    Example: "Vinícius Júnior" -> "vinicius junior"
    """
    if not value:
        return ""
    normalized = unicodedata.normalize("NFKD", value)
    without_marks = "".join(ch for ch in normalized if not unicodedata.combining(ch))
    return without_marks.casefold()


def load_laliga_players() -> List[Dict[str, Any]]:
    global laliga_players_cache
    if laliga_players_cache is not None:
        return laliga_players_cache

    players: List[Dict[str, Any]] = []
    if os.path.exists(LALIGA_CSV):
        with open(LALIGA_CSV, newline="", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                players.append(row)
    laliga_players_cache = players
    return players


def load_prem_players() -> List[Dict[str, Any]]:
    global prem_players_cache
    if prem_players_cache is not None:
        return prem_players_cache

    players: List[Dict[str, Any]] = []
    if os.path.exists(PREM_CSV):
        with open(PREM_CSV, newline="", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                players.append(row)
    prem_players_cache = players
    return players


def player_search(query: str) -> List[Dict[str, Any]]:
    """
    Look up players by name across La Liga and Premier League CSVs.
    Returns a simplified stats payload for each match.
    """
    if not query or not query.strip():
        return []

    q = norm_text(query.strip())

    # ── Aggregate La Liga rows by player name ────────────────────────────────
    laliga_agg: Dict[str, Dict[str, Any]] = {}
    for row in load_laliga_players():
        name_raw = row.get("player_name") or ""
        name_norm = norm_text(name_raw)
        if q not in name_norm:
            continue

        key = name_norm  # La Liga CSV only has full name
        player = laliga_agg.get(key)

        def add_stat(field: str, value: str | None) -> None:
            v = safe_int(value)
            if v is None:
                return
            current = player.get(field, 0) if player is not None else 0
            if player is not None:
                player[field] = current + v

        if player is None:
            player = {
                "league": "La Liga",
                "name": name_raw,
                "team": row.get("team_name"),
                "position": row.get("position"),
                "image": row.get("player_image"),
                "games": 0,
                "minutes": 0,
                "goals": 0,
                "assists": 0,
                "shots": 0,
                "shots_on_target": 0,
                "touches_in_box": 0,
            }
            laliga_agg[key] = player

        add_stat("games", row.get("total_games"))
        add_stat("minutes", row.get("total_mins_played"))
        add_stat("goals", row.get("total_goals"))
        add_stat("assists", row.get("total_assists"))
        add_stat("shots", row.get("total_scoring_att"))
        add_stat("shots_on_target", row.get("total_ontarget_attempt"))
        add_stat("touches_in_box", row.get("total_touches_in_opposition_box"))

    # ── Aggregate Premier League rows by first+last name ─────────────────────
    prem_agg: Dict[str, Dict[str, Any]] = {}
    for row in load_prem_players():
        name_raw = row.get("player_name") or ""
        if q not in norm_text(name_raw):
            continue

        first = (row.get("first_name") or "").strip()
        last = (row.get("last_name") or "").strip()
        if first or last:
            key = norm_text(f"{first} {last}".strip())
        else:
            key = norm_text(name_raw)

        player = prem_agg.get(key)

        def add_stat_p(field: str, value: str | None) -> None:
            v = safe_int(value)
            if v is None:
                return
            current = player.get(field, 0) if player is not None else 0
            if player is not None:
                player[field] = current + v

        if player is None:
            player = {
                "league": "Premier League",
                "name": name_raw,
                "team": row.get("team_name"),
                "position": row.get("position"),
                "image": row.get("player_image"),
                "games": 0,
                "minutes": 0,
                "goals": 0,
                "assists": 0,
                "shots": 0,
                "shots_on_target": 0,
                "touches_in_box": 0,
            }
            prem_agg[key] = player

        # Prefer gamesPlayed, fall back to appearances
        games_val = row.get("gamesPlayed") or row.get("appearances")
        add_stat_p("games", games_val)
        add_stat_p("minutes", row.get("timePlayed"))
        add_stat_p("goals", row.get("goals"))
        add_stat_p("assists", row.get("goalAssists"))
        add_stat_p("shots", row.get("totalShots"))
        add_stat_p("shots_on_target", row.get("shotsOnTargetIncGoals"))
        add_stat_p("touches_in_box", row.get("totalTouchesInOppositionBox"))

    # Combine results from both leagues
    results: List[Dict[str, Any]] = list(laliga_agg.values()) + list(prem_agg.values())
    return results


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

    @app.route("/api/player")
    def player_lookup():
        name = request.args.get("name", "")
        return jsonify(player_search(name))

    if USE_LLM:
        from llm_routes import register_chat_route

        register_chat_route(app, json_search)

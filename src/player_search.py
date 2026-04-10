import csv
import difflib
import os
import re
import unicodedata
from typing import Any, Dict, List, Optional


PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(PROJECT_ROOT, "data")

LEAGUE_SOURCES = (
    {
        "league": "La Liga",
        "path": os.path.join(DATA_DIR, "laliga_all_players.csv"),
    },
    {
        "league": "Premier League",
        "path": os.path.join(DATA_DIR, "prem_all_players.csv"),
    },
    {
        "league": "Serie A",
        "path": os.path.join(DATA_DIR, "seriea_all_players.csv"),
    },
)

POSITION_GROUPS = {
    "Forward": ("forward", "forwards", "striker", "strikers", "fw", "st", "cf"),
    "Defender": ("defender", "defenders", "back", "backs", "cb", "lb", "rb", "df"),
    "Midfielder": ("midfielder", "midfielders", "midfield", "mf", "cm", "am", "dm"),
    "Goalkeeper": ("goalkeeper", "goalkeepers", "keeper", "keepers", "gk"),
}

NATIONALITY_KEYWORDS = {
    "spain": "Spain",
    "spanish": "Spain",
    "italy": "Italy",
    "italian": "Italy",
    "england": "England",
    "english": "England",
    "france": "France",
    "french": "France",
    "portugal": "Portugal",
    "portuguese": "Portugal",
    "argentina": "Argentina",
    "argentinian": "Argentina",
    "argentine": "Argentina",
    "brazil": "Brazil",
    "brazilian": "Brazil",
    "croatia": "Croatia",
    "croatian": "Croatia",
    "germany": "Germany",
    "german": "Germany",
    "belgium": "Belgium",
    "belgian": "Belgium",
    "netherlands": "Netherlands",
    "dutch": "Netherlands",
}

YEAR_PATTERN = re.compile(r"(19|20)\d{2}")


def normalize_text(value: Optional[str]) -> str:
    if not value:
        return ""
    normalized = unicodedata.normalize("NFKD", value)
    without_marks = "".join(ch for ch in normalized if not unicodedata.combining(ch))
    return " ".join(without_marks.casefold().split())


def safe_float(value: Any) -> Optional[float]:
    try:
        if value is None or value == "":
            return None
        return float(value)
    except (TypeError, ValueError):
        return None


def safe_int(value: Any) -> Optional[int]:
    parsed = safe_float(value)
    if parsed is None:
        return None
    return int(parsed)


def first_non_empty(*values: Any) -> Optional[str]:
    for value in values:
        if value is None:
            continue
        text = str(value).strip()
        if text:
            return text
    return None


def canonical_nationality(value: Optional[str]) -> Optional[str]:
    if not value:
        return None

    text = value.strip()
    key = normalize_text(text)
    aliases = {
        "pt": "Portugal",
        "ar": "Argentina",
        "br": "Brazil",
        "fr": "France",
        "es": "Spain",
        "it": "Italy",
        "gb-eng": "England",
        "england": "England",
    }
    return aliases.get(key, text)


def primary_position(value: Optional[str]) -> Optional[str]:
    if not value:
        return None

    normalized = normalize_text(value)
    if "goalkeeper" in normalized or normalized == "gk":
        return "Goalkeeper"
    if "defender" in normalized or normalized in {"df", "cb", "lb", "rb"}:
        return "Defender"
    if "midfielder" in normalized or normalized in {"mf", "cm", "am", "dm"}:
        return "Midfielder"
    if "forward" in normalized or normalized in {"fw", "st", "cf"}:
        return "Forward"
    return value.strip()


def choose_image(*values: Optional[str]) -> Optional[str]:
    for value in values:
        if not value:
            continue
        if "placeholder" in value:
            continue
        return value
    return None


def parse_years(text: Optional[str]) -> List[int]:
    if not text:
        return []
    return [int(match.group()) for match in YEAR_PATTERN.finditer(text)]


def expand_year_range(start: int, end: int) -> List[int]:
    if end < start:
        start, end = end, start
    return list(range(start, end + 1))


def extract_season_years(row: Dict[str, Any], league: str) -> List[int]:
    years: List[int] = []

    if league == "La Liga":
        season_range = row.get("season_range") or row.get("seasons_played") or ""
        parsed_years = parse_years(season_range)
        if len(parsed_years) >= 2:
            years.extend(expand_year_range(parsed_years[0], parsed_years[-1]))
        else:
            years.extend(parsed_years)
    elif league == "Serie A":
        season_range = row.get("season_range") or ""
        endpoints = parse_years(season_range)
        if len(endpoints) >= 2:
            years.extend(expand_year_range(endpoints[0], endpoints[1]))
        elif endpoints:
            years.append(endpoints[0])
        else:
            season = row.get("season") or ""
            season_years = parse_years(season)
            if season_years:
                years.append(season_years[0])
    elif league == "Premier League":
        season_range = row.get("season_range") or ""
        endpoints = parse_years(season_range)
        if len(endpoints) >= 2:
            years.extend(expand_year_range(endpoints[0], endpoints[1]))
        elif endpoints:
            years.append(endpoints[0])
        else:
            season = row.get("season") or row.get("season_range") or ""
            season_years = parse_years(season)
            years.extend(season_years)

    return sorted(set(years))


def rate_or_none(numerator: Optional[int], denominator: Optional[int]) -> Optional[float]:
    if numerator is None or denominator is None or denominator == 0:
        return None
    return numerator / denominator


def normalize_row(row: Dict[str, Any], league: str) -> Dict[str, Any]:
    player_id = first_non_empty(
        row.get("player_id"),
        row.get("provider_id"),
        row.get("opta_id"),
        row.get("id"),
    )

    if league == "La Liga":
        name = first_non_empty(row.get("player_name"), row.get("nickname")) or "Unknown Player"
        appearances = safe_int(row.get("total_games"))
        goals = safe_int(row.get("total_goals"))
        assists = safe_int(row.get("total_assists"))
        shots = safe_int(row.get("total_scoring_att"))
        shots_on_target = safe_int(row.get("total_ontarget_attempt"))
        dribbles = safe_int(row.get("total_dribbles_attempted"))
        seasons = [value for value in [row.get("season_range")] if value]
        team = row.get("team_name")
        nationality = canonical_nationality(row.get("country"))
        position = primary_position(row.get("position"))
        image = choose_image(row.get("player_image"))
        minutes = safe_int(row.get("total_mins_played"))
    elif league == "Premier League":
        name = (
            first_non_empty(
                f"{(row.get('first_name') or '').strip()} {(row.get('last_name') or '').strip()}".strip(),
                row.get("player_name"),
                row.get("known_name"),
            )
            or "Unknown Player"
        )
        appearances = safe_int(row.get("gamesPlayed") or row.get("appearances"))
        goals = safe_int(row.get("goals"))
        assists = safe_int(row.get("goalAssists"))
        shots = safe_int(row.get("totalShots"))
        shots_on_target = safe_int(row.get("shotsOnTargetIncGoals"))
        dribbles = safe_int(row.get("successfulDribbles"))
        season_range = row.get("season_range")
        seasons = [value for value in [season_range] if value]
        team = row.get("current_team_name")
        nationality = canonical_nationality(row.get("country"))
        position = primary_position(row.get("position"))
        image = choose_image(row.get("player_image"))
        minutes = safe_int(row.get("timePlayed"))
    else:
        name = first_non_empty(row.get("display_name"), row.get("short_name")) or "Unknown Player"
        appearances = safe_int(row.get("games-played") or row.get("Games Played"))
        goals = safe_int(row.get("goals") or row.get("Goals"))
        assists = safe_int(row.get("assists") or row.get("Goal Assists"))
        shots = safe_int(row.get("total-scoring-attempts") or row.get("Total Shots"))
        shots_on_target = safe_int(row.get("on-target-scoring-attempts") or row.get("Shots On Target ( inc goals )"))
        dribbles = safe_int(row.get("successful-dribble"))
        seasons = [value for value in [row.get("season_range"), row.get("season")] if value]
        team = row.get("team_name")
        nationality = canonical_nationality(row.get("nationality"))
        position = primary_position(row.get("role_label") or row.get("role"))
        image = choose_image(row.get("player_image"))
        minutes = safe_int(row.get("minutes-played") or row.get("Time Played"))

    normalized_name = normalize_text(name)
    season_years = extract_season_years(row, league)

    return {
        "player_id": player_id,
        "name": name,
        "normalized_name": normalized_name,
        "nationality": nationality,
        "nationality_normalized": normalize_text(nationality),
        "position": position,
        "league": league,
        "team": team,
        "seasons": seasons,
        "season_years": season_years,
        "image": image,
        "appearances": appearances,
        "minutes": minutes,
        "goals": goals,
        "assists": assists,
        "shots": shots,
        "shots_on_target": shots_on_target,
        "dribbles_completed": dribbles,
        "goals_per_game": rate_or_none(goals, appearances),
        "assists_per_game": rate_or_none(assists, appearances),
        "shot_on_target_ratio": rate_or_none(shots_on_target, shots),
    }


def serialize_player(player: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "player_id": player.get("player_id"),
        "name": player.get("name"),
        "nationality": player.get("nationality"),
        "position": player.get("position"),
        "league": player.get("league"),
        "team": player.get("team"),
        "image": player.get("image"),
        "goals": player.get("goals"),
        "assists": player.get("assists"),
        "appearances": player.get("appearances"),
        "minutes": player.get("minutes"),
        "shots_on_target": player.get("shots_on_target"),
        "dribbles_completed": player.get("dribbles_completed"),
        "season_years": player.get("season_years", []),
        "seasons": player.get("seasons", []),
        "goals_per_game": player.get("goals_per_game"),
        "assists_per_game": player.get("assists_per_game"),
        "shot_on_target_ratio": player.get("shot_on_target_ratio"),
    }


def parse_query(query: str) -> Dict[str, Any]:
    text = normalize_text(query)
    filters: Dict[str, Any] = {"sort_by": "goals"}

    if not text:
        return filters

    for keyword, nationality in NATIONALITY_KEYWORDS.items():
        if re.search(rf"\b{re.escape(keyword)}\b", text):
            filters["nationality"] = nationality
            break
    if "nationality" not in filters:
        from_match = re.search(r"\bfrom ([a-z]+(?: [a-z]+)?)(?=$|\b(?:in|during|between|with|and)\b|\d)", text)
        if from_match:
            filters["nationality"] = from_match.group(1).title()

    matched_positions: List[str] = []
    for position, keywords in POSITION_GROUPS.items():
        for keyword in keywords:
            if re.search(rf"\b{re.escape(keyword)}\b", text):
                matched_positions.append(position)
                break
    if matched_positions:
        filters["positions"] = sorted(set(matched_positions))

    decade_match = re.search(r"\b(19|20)\d0s\b", text)
    if decade_match:
        start = int(decade_match.group()[:4])
        filters["season_start"] = start
        filters["season_end"] = start + 9

    range_match = re.search(r"\b((?:19|20)\d{2})\s*(?:to|-)\s*((?:19|20)\d{2})\b", text)
    if range_match:
        filters["season_start"] = int(range_match.group(1))
        filters["season_end"] = int(range_match.group(2))

    if re.search(r"\bclinical\b", text):
        filters["sort_by"] = "shot_on_target_ratio"
    elif re.search(r"\bfast\b", text):
        filters["sort_by"] = "dribbles_completed"
    elif re.search(r"\b(best|top)\b", text):
        filters["sort_by"] = "goals"

    return filters


def boolean_search(filters: Dict[str, Any], players: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    results = players

    nationality = filters.get("nationality")
    if nationality:
        nationality_key = normalize_text(nationality)
        results = [
            player for player in results if player.get("nationality_normalized") == nationality_key
        ]

    positions = filters.get("positions")
    if positions:
        allowed = set(positions)
        results = [player for player in results if player.get("position") in allowed]

    season_start = filters.get("season_start")
    season_end = filters.get("season_end")
    if season_start is not None and season_end is not None:
        results = [
            player
            for player in results
            if any(season_start <= year <= season_end for year in player.get("season_years", []))
        ]

    sort_by = filters.get("sort_by") or "goals"

    def descending_number(value: Any) -> float:
        if value is None:
            return float("inf")
        return -float(value)

    sorted_results = sorted(
        results,
        key=lambda player: (
            descending_number(player.get(sort_by)),
            descending_number(player.get("goals")),
            player.get("name", "").casefold(),
        ),
    )
    return [serialize_player(player) for player in sorted_results[:20]]


def load_player_index() -> Dict[str, Any]:
    players_by_name: Dict[str, List[Dict[str, Any]]] = {}
    player_list: List[Dict[str, Any]] = []
    for source in LEAGUE_SOURCES:
        if not os.path.exists(source["path"]):
            continue
        with open(source["path"], newline="", encoding="utf-8") as handle:
            reader = csv.DictReader(handle)
            for row in reader:
                normalized = normalize_row(row, source["league"])
                if not normalized["normalized_name"]:
                    continue
                players_by_name.setdefault(normalized["normalized_name"], []).append(normalized)
                player_list.append(normalized)

    return {
        "players_by_name": players_by_name,
        "player_list": player_list,
        "candidate_names": list(players_by_name.keys()),
    }


PLAYER_INDEX = load_player_index()


def find_player_by_name(name: str) -> Optional[List[Dict[str, Any]]]:
    normalized_name = normalize_text(name)
    if not normalized_name:
        return None

    exact_matches = PLAYER_INDEX["players_by_name"].get(normalized_name)
    if exact_matches is not None:
        return [serialize_player(player) for player in exact_matches]

    fuzzy_matches = difflib.get_close_matches(
        normalized_name,
        PLAYER_INDEX["candidate_names"],
        n=1,
        cutoff=0.8,
    )
    if not fuzzy_matches:
        return None

    return [serialize_player(player) for player in PLAYER_INDEX["players_by_name"][fuzzy_matches[0]]]

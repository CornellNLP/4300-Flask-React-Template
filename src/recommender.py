"""
TF-IDF song recommendation utilities.

First-iteration prototype:
- Build a TF-IDF index over song lyrics only.
- Score user free-text emotion input against each song document.
"""
from __future__ import annotations

import csv
import math
import os
import re
from collections import Counter, defaultdict
from dataclasses import dataclass
from functools import lru_cache
from typing import Any


TOKEN_PATTERN = re.compile(r"[a-zA-Z']+")


@dataclass
class SongRecord:
    id: str
    title: str
    artist: str
    album: str
    danceability: float
    energy: float
    valence: float
    tempo: float
    lyrics: str


def _to_float(value: str) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return 0.0


def _tokenize(text: str) -> list[str]:
    return [t.lower() for t in TOKEN_PATTERN.findall(text or "")]


def _build_document_text(row: dict[str, str]) -> str:
    return (row.get("lyrics") or "").strip()


class TfIdfSongRecommender:
    def __init__(self, csv_path: str):
        self.csv_path = csv_path
        self.songs: list[SongRecord] = []
        self.vectors: list[dict[str, float]] = []
        self.vector_norms: list[float] = []
        self.idf: dict[str, float] = {}
        self._load_and_index()

    def _load_and_index(self) -> None:
        doc_term_counts: list[Counter[str]] = []
        doc_freq: defaultdict[str, int] = defaultdict(int)

        with open(self.csv_path, "r", encoding="utf-8", newline="") as f:
            reader = csv.DictReader(f)
            for row in reader:
                text = _build_document_text(row)
                tokens = _tokenize(text)
                if not tokens:
                    continue

                term_counts = Counter(tokens)
                doc_term_counts.append(term_counts)

                for term in term_counts.keys():
                    doc_freq[term] += 1

                self.songs.append(
                    SongRecord(
                        id=(row.get("id") or ""),
                        title=(row.get("name") or "Unknown Title"),
                        artist=(row.get("artists") or "Unknown Artist"),
                        album=(row.get("album_name") or "Unknown Album"),
                        danceability=_to_float(row.get("danceability")),
                        energy=_to_float(row.get("energy")),
                        valence=_to_float(row.get("valence")),
                        tempo=_to_float(row.get("tempo")),
                        lyrics=(row.get("lyrics") or ""),
                    )
                )

        total_docs = len(doc_term_counts)
        if total_docs == 0:
            return

        for term, freq in doc_freq.items():
            self.idf[term] = math.log((1 + total_docs) / (1 + freq)) + 1.0

        for term_counts in doc_term_counts:
            tfidf_vector: dict[str, float] = {}
            token_count = sum(term_counts.values()) or 1
            norm_sq = 0.0
            for term, count in term_counts.items():
                tf = count / token_count
                weight = tf * self.idf.get(term, 0.0)
                tfidf_vector[term] = weight
                norm_sq += weight * weight
            self.vectors.append(tfidf_vector)
            self.vector_norms.append(math.sqrt(norm_sq))

    def recommend(self, query: str, top_k: int = 10) -> list[dict[str, Any]]:
        query_tokens = _tokenize(query)
        if not query_tokens:
            return []

        query_counts = Counter(query_tokens)
        q_total = sum(query_counts.values()) or 1

        query_vec: dict[str, float] = {}
        q_norm_sq = 0.0
        for term, count in query_counts.items():
            idf = self.idf.get(term)
            if idf is None:
                continue
            weight = (count / q_total) * idf
            query_vec[term] = weight
            q_norm_sq += weight * weight

        q_norm = math.sqrt(q_norm_sq)
        if q_norm == 0:
            return []

        scored_indices: list[tuple[float, int]] = []
        for idx, song_vec in enumerate(self.vectors):
            s_norm = self.vector_norms[idx]
            if s_norm == 0:
                continue

            dot = 0.0
            if len(query_vec) <= len(song_vec):
                for term, q_weight in query_vec.items():
                    dot += q_weight * song_vec.get(term, 0.0)
            else:
                for term, s_weight in song_vec.items():
                    dot += s_weight * query_vec.get(term, 0.0)

            if dot <= 0:
                continue
            score = dot / (q_norm * s_norm)
            scored_indices.append((score, idx))

        scored_indices.sort(key=lambda x: x[0], reverse=True)
        top_matches = scored_indices[:top_k]

        recommendations: list[dict[str, Any]] = []
        for score, idx in top_matches:
            song = self.songs[idx]
            recommendations.append(
                {
                    "id": song.id,
                    "spotify_url": f"https://open.spotify.com/track/{song.id}",
                    "title": song.title,
                    "artist": song.artist,
                    "album": song.album,
                    "danceability": round(song.danceability, 3),
                    "energy": round(song.energy, 3),
                    "valence": round(song.valence, 3),
                    "tempo": round(song.tempo, 2),
                    "lyrics_preview": (song.lyrics[:240] + "...") if len(song.lyrics) > 240 else song.lyrics,
                    "lyrics_full": song.lyrics,
                    "tfidf_score": round(score, 5),
                }
            )

        return recommendations


@lru_cache(maxsize=1)
def get_recommender() -> TfIdfSongRecommender:
    current_directory = os.path.dirname(os.path.abspath(__file__))
    csv_path = os.path.join(current_directory, "data_processing", "songs_condensed.csv")
    return TfIdfSongRecommender(csv_path=csv_path)

"""
SVD-based recommender for Lyra — prototype 2.
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

import numpy as np


TOKEN_RE = re.compile(r"[a-zA-Z']+")

AUDIO_SCALE = 8.0       # higher = audio features punch harder vs lyrics
MAX_VOCAB = 3000
N_COMPONENTS = 40
CANDIDATE_POOL = 200    # how many TF-IDF candidates SVD reranks


# ---------------------------------------------------------------------------
# emotion expansion
# ---------------------------------------------------------------------------

EXPANSIONS: dict[str, list[str]] = {
    "floating":     ["dissociation", "lost", "empty", "numb", "drifting"],
    "drifting":     ["lost", "aimless", "empty", "lonely", "wandering"],
    "sinking":      ["hopeless", "depressed", "overwhelmed", "drowning"],
    "drowning":     ["overwhelmed", "anxiety", "helpless", "desperate"],
    "falling":      ["fear", "losing", "anxiety", "helpless", "spiraling"],
    "stuck":        ["trapped", "hopeless", "frustrated", "numb"],
    "frozen":       ["numb", "dissociation", "fear", "paralyzed"],
    "burning":      ["angry", "passionate", "intense", "pain", "rage"],
    "spinning":     ["anxiety", "overwhelmed", "confused", "dizzy"],
    "running":      ["escape", "fear", "freedom", "desperate", "fleeing"],
    "flying":       ["free", "joyful", "euphoric", "liberated", "soaring"],
    "dark":         ["depressed", "hopeless", "fear", "lonely", "bleak"],
    "grey":         ["numb", "empty", "depressed", "bleak", "listless"],
    "cold":         ["lonely", "distant", "numb", "isolated", "withdrawn"],
    "warm":         ["comfort", "safe", "love", "peaceful", "cozy"],
    "heavy":        ["burden", "depressed", "exhausted", "grief", "weighed"],
    "light":        ["happy", "free", "joyful", "relief", "airy"],
    "empty":        ["numb", "hollow", "depressed", "lonely", "void"],
    "broken":       ["heartbreak", "grief", "pain", "shattered", "loss"],
    "lost":         ["confused", "anxious", "lonely", "searching", "aimless"],
    "okay":         ["coping", "fine", "managing", "getting by", "surviving"],
    "fine":         ["hiding", "coping", "pretending", "mask", "forcing"],
    "happy":        ["joyful", "content", "cheerful", "upbeat", "smiling"],
    "sad":          ["grief", "sorrow", "tears", "heartbreak", "lonely"],
    "angry":        ["rage", "frustrated", "furious", "bitter", "resentment"],
    "anxious":      ["worry", "nervous", "fear", "uneasy", "stress", "dread"],
    "tired":        ["exhausted", "weary", "burnout", "drained", "depleted"],
    "excited":      ["euphoric", "thrilled", "energetic", "anticipation", "buzz"],
    "nostalgic":    ["memories", "past", "longing", "miss", "childhood", "reminisce"],
    "lonely":       ["isolated", "alone", "abandoned", "missing", "hollow"],
    "hopeful":      ["optimistic", "bright", "future", "believe", "dream", "rising"],
    "heartbroken":  ["loss", "grief", "pain", "missing", "love", "ache"],
    "numb":         ["dissociation", "empty", "void", "detached", "hollow"],
    "overwhelmed":  ["drowning", "too much", "exhausted", "panic", "crushed"],
    "peaceful":     ["calm", "serene", "quiet", "still", "tranquil", "gentle"],
    "melancholy":   ["bittersweet", "wistful", "sorrow", "longing", "aching"],
}

# expected audio profile per emotion: [danceability, energy, valence, tempo/200]
AUDIO_HINTS: dict[str, list[float]] = {
    "happy":      [0.70, 0.70, 0.90, 0.60],
    "sad":        [0.30, 0.30, 0.10, 0.40],
    "angry":      [0.50, 0.90, 0.20, 0.80],
    "calm":       [0.30, 0.20, 0.60, 0.30],
    "anxious":    [0.40, 0.70, 0.20, 0.70],
    "energetic":  [0.80, 0.90, 0.70, 0.80],
    "melancholy": [0.30, 0.30, 0.10, 0.35],
    "romantic":   [0.50, 0.40, 0.80, 0.40],
    "peaceful":   [0.20, 0.20, 0.70, 0.30],
    "euphoric":   [0.80, 0.90, 0.95, 0.75],
    "numb":       [0.25, 0.25, 0.15, 0.35],
    "nostalgic":  [0.45, 0.40, 0.55, 0.45],
    "hopeful":    [0.55, 0.55, 0.75, 0.55],
    "lonely":     [0.25, 0.25, 0.15, 0.35],
    "excited":    [0.75, 0.85, 0.80, 0.75],
    "tired":      [0.20, 0.20, 0.30, 0.30],
    "dark":       [0.35, 0.60, 0.10, 0.55],
    "floating":   [0.25, 0.20, 0.40, 0.25],
    "broken":     [0.25, 0.30, 0.08, 0.35],
    "lost":       [0.30, 0.35, 0.15, 0.40],
    "overwhelmed":[0.35, 0.75, 0.15, 0.70],
    "heartbroken":[0.25, 0.25, 0.08, 0.35],
    "cold":       [0.20, 0.25, 0.20, 0.30],
    "empty":      [0.20, 0.20, 0.10, 0.30],
}

POS_WORDS = {
    "happy","joyful","great","fun","awesome","love","excited","cheerful","upbeat"
}

NEG_WORDS = {
    "sad","grief","lonely","depressed","pain","empty","broken","hopeless","numb"
}


# ---------------------------------------------------------------------------
# data model
# ---------------------------------------------------------------------------

@dataclass
class Song:
    id: str
    title: str
    artist: str
    album: str
    danceability: float
    energy: float
    valence: float
    tempo: float
    lyrics: str


# ---------------------------------------------------------------------------
# helpers
# ---------------------------------------------------------------------------

def _tok(text: str) -> list[str]:
    return [t.lower() for t in TOKEN_RE.findall(text or "")]


def _to_float(val: Any) -> float:
    try:
        return float(val)
    except (TypeError, ValueError):
        return 0.0


def _weighted_query_counts(query: str) -> Counter:
    tokens = _tok(query)
    weights = Counter()

    # original tokens get full weight
    for t in tokens:
        weights[t] += 1.0

    # expansions get reduced weight
    for t in tokens:
        if t in EXPANSIONS:
            for e in EXPANSIONS[t]:
                for et in _tok(e):
                    weights[et] += 0.3   # <<< key line

    return weights

def _sentiment_score(tokens: list[str]) -> float:
    pos = sum(1 for t in tokens if t in POS_WORDS)
    neg = sum(1 for t in tokens if t in NEG_WORDS)
    total = pos + neg
    if total == 0:
        return 0.0
    return (pos - neg) / total

def _randomized_svd(matrix: np.ndarray, k: int) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Pure numpy randomized SVD. Returns U (n x k), S (k,), Vt (k x m)."""
    rng = np.random.default_rng(42)
    n, m = matrix.shape
    omega = rng.standard_normal((m, k + 10)).astype(np.float32)
    Y = matrix @ omega
    Q, _ = np.linalg.qr(Y)           # Q: (n x k+10)
    B = Q.T @ matrix                  # B: (k+10 x m)
    U_b, S, Vt = np.linalg.svd(B, full_matrices=False)
    U_b = U_b[:, :k]                  # (k+10 x k)
    S = S[:k]                         # (k,)
    Vt = Vt[:k, :]                    # (k x m)
    U = Q @ U_b                       # (n x k)
    return U, S, Vt


def _normalize_rows(matrix: np.ndarray) -> np.ndarray:
    norms = np.linalg.norm(matrix, axis=1, keepdims=True)
    return matrix / np.where(norms < 1e-12, 1.0, norms)


def _audio_hint_for_query(query: str) -> np.ndarray | None:
    """Average audio hints across emotion words, capping repeats at 2."""
    tokens = _tok(query)
    hint_sum = np.zeros(4, dtype=np.float32)
    count = 0
    
    # count occurrences but cap each word at 2 to prevent drowning
    word_counts: Counter = Counter(tokens)
    
    for word, freq in word_counts.items():
        weight = min(freq, 2)  # cap repetitions at 2
        if word in AUDIO_HINTS:
            hint_sum += np.array(AUDIO_HINTS[word], dtype=np.float32) * weight
            count += weight
        # also check expansion keys
        if word in EXPANSIONS:
            for exp_word in EXPANSIONS[word]:
                for et in _tok(exp_word):
                    if et in AUDIO_HINTS:
                        hint_sum += np.array(AUDIO_HINTS[et], dtype=np.float32)
                        count += 1
    return (hint_sum / count) if count > 0 else None


def _audio_distance(song_audio: np.ndarray, hint: np.ndarray) -> float:
    """Weighted L1 distance — valence and energy weighted more heavily."""
    weights = np.array([0.15, 0.30, 0.40, 0.15], dtype=np.float32)  # dance, energy, valence, tempo
    return float(np.sum(weights * np.abs(song_audio - hint)))


# ---------------------------------------------------------------------------
# main recommender
# ---------------------------------------------------------------------------

class SvdSongRecommender:
    def __init__(self, csv_path: str, n_components: int = N_COMPONENTS):
        self.csv_path = csv_path
        self.n_components = n_components

        self.songs: list[Song] = []
        self.idf: dict[str, float] = {}
        self.vocab: list[str] = []
        self.song_audio: np.ndarray = np.array([])  # (n_songs, 4) raw audio
        self.U: np.ndarray = np.array([])            # (n_songs, k) normalized
        self.S: np.ndarray = np.array([])            # (k,)
        self.Vt: np.ndarray = np.array([])           # (k, n_features)

        self._build_index()

    def _build_index(self) -> None:
        token_lists: list[list[str]] = []
        doc_freq: defaultdict[str, int] = defaultdict(int)
        audio_vecs: list[list[float]] = []

        with open(self.csv_path, encoding="utf-8", newline="") as f:
            for row in csv.DictReader(f):
                lyrics = (row.get("lyrics") or "").strip()
                tokens = _tok(lyrics)
                if not tokens:
                    continue

                token_lists.append(tokens)
                for t in set(tokens):
                    doc_freq[t] += 1

                self.songs.append(Song(
                    id=row.get("id") or "",
                    title=row.get("name") or "Unknown Title",
                    artist=row.get("artists") or "Unknown Artist",
                    album=row.get("album_name") or "Unknown Album",
                    danceability=_to_float(row.get("danceability")),
                    energy=_to_float(row.get("energy")),
                    valence=_to_float(row.get("valence")),
                    tempo=_to_float(row.get("tempo")),
                    lyrics=lyrics,
                ))

                audio_vecs.append([
                    _to_float(row.get("danceability")),
                    _to_float(row.get("energy")),
                    _to_float(row.get("valence")),
                    _to_float(row.get("tempo")) / 200.0,
                ])

        n_docs = len(self.songs)
        if n_docs == 0:
            return

        self.song_audio = np.array(audio_vecs, dtype=np.float32)

        # IDF
        for term, freq in doc_freq.items():
            self.idf[term] = math.log((1 + n_docs) / (1 + freq)) + 1.0

        self.vocab = sorted(self.idf, key=lambda t: -self.idf[t])[:MAX_VOCAB]
        v_idx = {t: i for i, t in enumerate(self.vocab)}
        n_tfidf = len(self.vocab)
        n_feat = n_tfidf + 4

        # combined TF-IDF + audio matrix
        matrix = np.zeros((n_docs, n_feat), dtype=np.float32)
        for di, tokens in enumerate(token_lists):
            counts = Counter(tokens)
            total = sum(counts.values()) or 1
            for term, cnt in counts.items():
                if term in v_idx:
                    matrix[di, v_idx[term]] = 1 + math.log(cnt) * self.idf[term]
            for j, val in enumerate(audio_vecs[di]):
                matrix[di, n_tfidf + j] = val * AUDIO_SCALE

        k = min(self.n_components, n_docs - 1, n_feat - 1)
        U_raw, self.S, self.Vt = _randomized_svd(matrix, k)
        self.U = _normalize_rows(U_raw)

    def _query_latent(self, query: str) -> np.ndarray:
        """Project query into SVD latent space."""
        counts = _weighted_query_counts(query)
        if not counts:
            return np.array([])

        v_idx = {t: i for i, t in enumerate(self.vocab)}
        total = sum(counts.values()) or 1
        n_tfidf = len(self.vocab)
        n_feat = n_tfidf + 4

        q_full = np.zeros(n_feat, dtype=np.float32)

        for term, cnt in counts.items():
            if term in self.idf and term in v_idx:
                q_full[v_idx[term]] = (1 + math.log(cnt)) * self.idf[term]

        hint = _audio_hint_for_query(query)
        if hint is not None:
            for j in range(4):
                q_full[n_tfidf + j] = hint[j] * AUDIO_SCALE

        q_latent = (q_full @ self.Vt.T) / (self.S + 1e-9)
        return q_latent

    def recommend(self, query: str, top_k: int = 10) -> list[dict[str, Any]]:
        # ── Step 1: TF-IDF candidate retrieval (preserves lyric relevance) ──
        from recommender import get_recommender
        tfidf_results = get_recommender().recommend(query=query, top_k=CANDIDATE_POOL)
        query_tokens = _tok(query)
        sentiment = _sentiment_score(query_tokens)

        if not tfidf_results:
            return []

        # ── Step 2: SVD latent query vector ──
        q_lat = self._query_latent(query)
        has_svd = q_lat.size > 0
        if has_svd:
            q_n = np.linalg.norm(q_lat)
            if q_n > 1e-12:
                q_lat = q_lat / q_n
            else:
                has_svd = False

        # ── Step 3: audio hint for direct audio scoring ──
        hint = _audio_hint_for_query(query)

        # build fast id → index lookup
        id_to_idx = {s.id: i for i, s in enumerate(self.songs)}

        # ── Step 4: score each candidate ──
        scored: list[tuple[float, dict]] = []
        tfidf_max = max((r["tfidf_score"] for r in tfidf_results), default=1.0) or 1.0

        for rank, r in enumerate(tfidf_results):
            sid = r.get("id", "")
            idx = id_to_idx.get(sid)

            # normalized TF-IDF score (0→1)
            tfidf_norm = r["tfidf_score"] / tfidf_max

            # SVD latent similarity
            svd_sim = 0.0
            if has_svd and idx is not None:
                svd_sim = float(self.U[idx] @ q_lat)
                svd_sim = (svd_sim + 1.0) / 2.0

            # direct audio similarity (1 - weighted distance)
            audio_sim = 0.5  # neutral default
            if hint is not None and idx is not None:
                dist = _audio_distance(self.song_audio[idx], hint)
                audio_sim = max(0.0, 1.0 - dist * 2.0)

            # ── weighted fusion ──
            # 45% lyrics (TF-IDF) + 30% audio + 25% SVD latent
            # this keeps "sad" lyrics relevant while correcting for audio mood
            final = 0.65 * tfidf_norm + 0.20 * audio_sim + 0.15 * svd_sim

            # push towards the more dominant emotion
            final += 0.15 * sentiment * self.songs[idx].valence

            # penalize wrong polarity
            if sentiment < -0.3:
                final -= 0.1 * self.songs[idx].valence
            elif sentiment > 0.3:
                final += 0.1 * self.songs[idx].valence
            # clamp
            final = max(0.0, min(1.0, final))

            scored.append((final, r))

        # ── Step 5: sort and return ──
        scored.sort(key=lambda x: x[0], reverse=True)

        out = []
        for final_score, r in scored[:top_k]:
            r = dict(r)
            r["tfidf_score"] = round(final_score, 5)
            out.append(r)

        return out


@lru_cache(maxsize=1)
def get_svd_recommender() -> SvdSongRecommender:
    here = os.path.dirname(os.path.abspath(__file__))
    csv_path = os.path.join(here, "data_processing", "sample_dataset.csv")
    return SvdSongRecommender(csv_path=csv_path)
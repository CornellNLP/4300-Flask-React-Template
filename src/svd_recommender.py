"""
SVD-based recommender for Lyra — prototype 2.
Semantic embedding-based query rewriting: metaphorical/poetic inputs are
mapped to emotion terms before TF-IDF + SVD matching, so raw tokens like
"time" or "dissolving" don't pollute lyric search.
Requires: pip install sentence-transformers
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
 
AUDIO_SCALE = 8.0
MAX_VOCAB = 3000
N_COMPONENTS = 40
CANDIDATE_POOL = 200
 
# semantic anchor settings
TOP_ANCHORS = 3
ANCHOR_THRESHOLD = 0.25
# if the top anchor similarity exceeds this, treat query as purely metaphorical
# and replace raw tokens entirely with emotion terms in the TF-IDF vector
REWRITE_THRESHOLD = 0.30
 
 
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
    "romantic":   ["love", "tender", "intimate", "adore", "devoted", "warmth", "cherish"],
"loving":     ["romantic", "tender", "affection", "warmth", "adore", "devoted"],
"love":       ["romantic", "tender", "intimate", "warmth", "adore", "longing"],
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
 
# Rich descriptive phrases for each anchor — gives the embedding model
# enough semantic surface to match metaphorical/poetic queries against.
ANCHOR_PHRASES: dict[str, str] = {
    "happy":       "feeling happy joyful cheerful upbeat",
    "sad":         "feeling sad sorrowful tearful grief",
    "angry":       "feeling angry furious rage resentment",
    "calm":        "feeling calm peaceful serene quiet",
    "anxious":     "feeling anxious nervous worried fearful dread unease reality slipping losing control",
    "energetic":   "feeling energetic pumped up driven motivated",
    "melancholy":  "feeling melancholy bittersweet wistful longing",
    "romantic":    "feeling romantic loving tender intimate",
    "peaceful":    "feeling peaceful still tranquil gentle",
    "euphoric":    "feeling euphoric ecstatic elated blissful",
    "numb":        "feeling numb detached dissociated hollow void",
    "nostalgic":   "feeling nostalgic reminiscing past memories longing",
    "hopeful":     "feeling hopeful optimistic bright future believing",
    "lonely":      "feeling lonely isolated alone abandoned",
    "excited":     "feeling excited thrilled anticipation buzz",
    "tired":       "feeling tired exhausted drained weary burnout",
    "dark":        "feeling dark bleak grim shadowy oppressive",
    "floating":    "floating dissociated unreal drifting detached losing grip on reality time dissolving",
    "broken":      "feeling broken shattered devastated destroyed",
    "lost":        "feeling lost confused directionless searching aimless",
    "overwhelmed": "feeling overwhelmed drowning crushed too much panic",
    "heartbroken": "feeling heartbroken devastated loss grief ache",
    "cold":        "feeling cold distant withdrawn isolated numb",
    "empty":       "feeling empty hollow void nothing inside",
}
 
POS_WORDS = {
    "happy","joyful","great","fun","awesome","love","excited","cheerful","upbeat"
}
 
NEG_WORDS = {
    "sad","grief","lonely","depressed","pain","empty","broken","hopeless","numb"
}
 
# words that are emotionally inert and should never anchor lyric matching
_STOP_TOKENS = {
    "i", "me", "my", "the", "a", "an", "is", "are", "was", "were", "be",
    "been", "being", "have", "has", "had", "do", "does", "did", "will",
    "would", "could", "should", "may", "might", "shall", "can", "need",
    "am", "it", "its", "this", "that", "these", "those", "and", "or",
    "but", "so", "yet", "for", "nor", "of", "in", "on", "at", "to",
    "by", "up", "as", "if", "then", "than", "with", "about", "into",
    "through", "around", "time", "way", "things", "something", "everything",
    "nothing", "anything", "me", "us", "we", "you", "your", "our",
}
 
 
# ---------------------------------------------------------------------------
# semantic anchor engine
# ---------------------------------------------------------------------------
 
class SemanticAnchorEngine:
    """
    Embeds ANCHOR_PHRASES once at init. At query time:
      - finds closest anchors by cosine similarity
      - blends their audio profiles (for audio hint)
      - returns their expansion terms (for query rewriting)
    """
 
    def __init__(self) -> None:
        from sentence_transformers import SentenceTransformer
        self._model = SentenceTransformer("all-MiniLM-L6-v2")
        self._anchor_keys = list(ANCHOR_PHRASES.keys())
        phrases = [ANCHOR_PHRASES[k] for k in self._anchor_keys]
        raw = self._model.encode(phrases, normalize_embeddings=True)
        self._anchor_embeddings = np.array(raw, dtype=np.float32)
 
    def query_anchors(self, query: str) -> list[tuple[str, float]]:
        """Return [(anchor_key, cosine_similarity), ...] sorted descending."""
        q_emb = self._model.encode([query], normalize_embeddings=True)
        q_emb = np.array(q_emb, dtype=np.float32)[0]
        sims = self._anchor_embeddings @ q_emb
        pairs = sorted(zip(self._anchor_keys, sims.tolist()), key=lambda x: -x[1])
        return pairs
 
    def audio_hint(self, query: str) -> np.ndarray | None:
        """Blend top-k anchor audio profiles weighted by cosine similarity."""
        pairs = self.query_anchors(query)
        hint_sum = np.zeros(4, dtype=np.float32)
        weight_sum = 0.0
        for anchor_key, sim in pairs[:TOP_ANCHORS]:
            if sim < ANCHOR_THRESHOLD:
                break
            profile = np.array(AUDIO_HINTS[anchor_key], dtype=np.float32)
            hint_sum += profile * sim
            weight_sum += sim
        if weight_sum < 1e-9:
            return None
        return hint_sum / weight_sum
 
    def rewrite_query(self, query: str) -> tuple[Counter, bool]:
        """
        Returns (token_weights, was_rewritten).
 
        If the top anchor similarity >= REWRITE_THRESHOLD, the query is treated
        as metaphorical and raw tokens are REPLACED by emotion expansion terms.
        Raw tokens that are also in the vocab as genuine emotion words are kept
        at reduced weight so legitimate keyword queries still work.
 
        If below threshold, falls back to additive expansion (old behaviour).
        """
        pairs = self.query_anchors(query)
        top_key, top_sim = pairs[0]
        weights: Counter = Counter()
 
        raw_tokens = [t for t in _tok(query) if t not in _STOP_TOKENS]
 
        if top_sim >= REWRITE_THRESHOLD:
            # --- semantic rewrite: replace raw tokens with emotion terms ---
            for anchor_key, sim in pairs[:TOP_ANCHORS]:
                if sim < ANCHOR_THRESHOLD:
                    break
                # the anchor emotion word itself
                weights[anchor_key] += sim * 2.0
                # its expansions
                if anchor_key in EXPANSIONS:
                    for phrase in EXPANSIONS[anchor_key]:
                        for et in _tok(phrase):
                            weights[et] += sim * 0.8
 
            # keep raw tokens ONLY if they're known emotion/expansion words
            # (handles queries like "i feel sad and dissolving" — "sad" stays)
            all_emotion_words = set(EXPANSIONS.keys()) | set(AUDIO_HINTS.keys())
            for t in raw_tokens:
                if t in all_emotion_words:
                    weights[t] += 0.5  # lower than semantic but not dropped
 
            return weights, True
 
        else:
            # --- additive expansion: old behaviour, just augmented ---
            for t in raw_tokens:
                weights[t] += 1.0
                if t in EXPANSIONS:
                    for phrase in EXPANSIONS[t]:
                        for et in _tok(phrase):
                            weights[et] += 0.3
            # add semantic terms at reduced weight
            for anchor_key, sim in pairs[:TOP_ANCHORS]:
                if sim < ANCHOR_THRESHOLD:
                    break
                weights[anchor_key] += sim * 0.4
                if anchor_key in EXPANSIONS:
                    for phrase in EXPANSIONS[anchor_key]:
                        for et in _tok(phrase):
                            weights[et] += sim * 0.2
 
            return weights, False
 
 
@lru_cache(maxsize=1)
def _get_anchor_engine() -> SemanticAnchorEngine:
    return SemanticAnchorEngine()
 
 
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
 
 
def _weighted_query_counts(query: str) -> tuple[Counter, bool]:
    """
    Returns (token_weights, was_semantically_rewritten).
    Delegates to SemanticAnchorEngine.rewrite_query when available,
    falls back to plain token counting if model is unavailable.
    """
    try:
        engine = _get_anchor_engine()
        return engine.rewrite_query(query)
    except Exception:
        # graceful fallback: plain tokens + dictionary expansion
        tokens = _tok(query)
        weights: Counter = Counter()
        for t in tokens:
            if t not in _STOP_TOKENS:
                weights[t] += 1.0
        for t in tokens:
            if t in EXPANSIONS:
                for phrase in EXPANSIONS[t]:
                    for et in _tok(phrase):
                        weights[et] += 0.3
        return weights, False
 
 
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
    Q, _ = np.linalg.qr(Y)
    B = Q.T @ matrix
    U_b, S, Vt = np.linalg.svd(B, full_matrices=False)
    U_b = U_b[:, :k]
    S = S[:k]
    Vt = Vt[:k, :]
    U = Q @ U_b
    return U, S, Vt
 
 
def _normalize_rows(matrix: np.ndarray) -> np.ndarray:
    norms = np.linalg.norm(matrix, axis=1, keepdims=True)
    return matrix / np.where(norms < 1e-12, 1.0, norms)
 
 
def _audio_hint_for_query(query: str) -> np.ndarray | None:
    """Semantic audio hint, falls back to token matching."""
    try:
        engine = _get_anchor_engine()
        hint = engine.audio_hint(query)
        if hint is not None:
            return hint
    except Exception:
        pass
 
    # fallback: original token matching
    tokens = _tok(query)
    hint_sum = np.zeros(4, dtype=np.float32)
    count = 0
    word_counts: Counter = Counter(tokens)
    for word, freq in word_counts.items():
        weight = min(freq, 2)
        if word in AUDIO_HINTS:
            hint_sum += np.array(AUDIO_HINTS[word], dtype=np.float32) * weight
            count += weight
        if word in EXPANSIONS:
            for exp_word in EXPANSIONS[word]:
                for et in _tok(exp_word):
                    if et in AUDIO_HINTS:
                        hint_sum += np.array(AUDIO_HINTS[et], dtype=np.float32)
                        count += 1
    return (hint_sum / count) if count > 0 else None
 
 
def _audio_distance(song_audio: np.ndarray, hint: np.ndarray) -> float:
    weights = np.array([0.15, 0.30, 0.40, 0.15], dtype=np.float32)
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
        self.song_audio: np.ndarray = np.array([])
        self.U: np.ndarray = np.array([])
        self.S: np.ndarray = np.array([])
        self.Vt: np.ndarray = np.array([])
 
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
 
        for term, freq in doc_freq.items():
            self.idf[term] = math.log((1 + n_docs) / (1 + freq)) + 1.0
 
        self.vocab = sorted(self.idf, key=lambda t: -self.idf[t])[:MAX_VOCAB]
        v_idx = {t: i for i, t in enumerate(self.vocab)}
        n_tfidf = len(self.vocab)
        n_feat = n_tfidf + 4
 
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
        counts, _ = _weighted_query_counts(query)
        if not counts:
            return np.array([])
 
        v_idx = {t: i for i, t in enumerate(self.vocab)}
        n_tfidf = len(self.vocab)
        n_feat = n_tfidf + 4
 
        q_full = np.zeros(n_feat, dtype=np.float32)
 
        for term, cnt in counts.items():
            if term in self.idf and term in v_idx:
                q_full[v_idx[term]] = (1 + math.log(max(cnt, 1))) * self.idf[term]
 
        hint = _audio_hint_for_query(query)
        if hint is not None:
            for j in range(4):
                q_full[n_tfidf + j] = hint[j] * AUDIO_SCALE
 
        q_latent = (q_full @ self.Vt.T) / (self.S + 1e-9)
        return q_latent
 
    def recommend(self, query: str, top_k: int = 10) -> list[dict[str, Any]]:
        from recommender import get_recommender
 
        # rewrite query before passing to TF-IDF retrieval
        rewritten_counts, was_rewritten = _weighted_query_counts(query)
        # synthesise a rewritten query string for the TF-IDF retriever
        # by repeating each term proportional to its weight
        if was_rewritten:
            rewritten_query = " ".join(
                " ".join([term] * max(1, round(float(w))))
                for term, w in rewritten_counts.most_common(20)
            )
        else:
            rewritten_query = query
 
        tfidf_results = get_recommender().recommend(
            query=rewritten_query, top_k=CANDIDATE_POOL
        )
 
        # sentiment based on original query
        query_tokens = _tok(query)
        sentiment = _sentiment_score(query_tokens)
 
        if not tfidf_results:
            return []
 
        q_lat = self._query_latent(query)
        has_svd = q_lat.size > 0
        if has_svd:
            q_n = np.linalg.norm(q_lat)
            if q_n > 1e-12:
                q_lat = q_lat / q_n
            else:
                has_svd = False
 
        hint = _audio_hint_for_query(query)
        id_to_idx = {s.id: i for i, s in enumerate(self.songs)}
 
        scored: list[tuple[float, dict]] = []
        tfidf_max = max((r["tfidf_score"] for r in tfidf_results), default=1.0) or 1.0
 
        for rank, r in enumerate(tfidf_results):
            sid = r.get("id", "")
            idx = id_to_idx.get(sid)
 
            tfidf_norm = r["tfidf_score"] / tfidf_max
 
            svd_sim = 0.0
            if has_svd and idx is not None:
                svd_sim = float(self.U[idx] @ q_lat)
                svd_sim = (svd_sim + 1.0) / 2.0
 
            audio_sim = 0.5
            if hint is not None and idx is not None:
                dist = _audio_distance(self.song_audio[idx], hint)
                audio_sim = max(0.0, 1.0 - dist * 2.0)
 
            final = 0.65 * tfidf_norm + 0.20 * audio_sim + 0.15 * svd_sim
 
            final += 0.15 * sentiment * self.songs[idx].valence
 
            if sentiment < -0.3:
                final -= 0.1 * self.songs[idx].valence
            elif sentiment > 0.3:
                final += 0.1 * self.songs[idx].valence
 
            final = max(0.0, min(1.0, final))
            scored.append((final, r))
 
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
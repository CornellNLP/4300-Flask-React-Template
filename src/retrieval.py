"""
Retrieval module for the Athletic Training Finder.

Uses a Vector Space Model with TF-IDF weighting and cosine similarity to rank
exercises from the Free Exercise DB (873 exercises) against a user's
natural-language query.

Key IR techniques:
    - TF-IDF vectorization (scikit-learn TfidfVectorizer) over a combined text
      representation of each exercise.
    - Cosine similarity between the query vector and every exercise vector to
      produce a relevance score.
    - Field-priority weighting: higher-priority fields (e.g. primaryMuscles)
      are repeated more often in the document string so that matching terms in
      those fields contribute more to the TF-IDF score.
    - Query expansion: goal keywords like "vertical jump" are expanded into the
      muscle groups they target (quadriceps, glutes, calves, hamstrings), and
      equipment synonyms like "bodyweight" are mapped to dataset values
      ("body only") so the user doesn't need to know exact field terminology.
"""
import json
import os
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

DATA_PATH = os.path.join(os.path.dirname(__file__), '..', 'data', 'datasets', 'exercises_free_db.json')

# ── Query expansion maps ─────────────────────────────────────────────────────
# GOAL_TO_MUSCLES maps common fitness goal keywords to the muscle groups they
# primarily involve. When any of these keywords appear in the user query, the
# corresponding muscle names are appended to the query string before TF-IDF
# vectorization.

GOAL_TO_MUSCLES = {
    "vertical jump": ["quadriceps", "glutes", "calves", "hamstrings"],
    "jump": ["quadriceps", "glutes", "calves"],
    "squat": ["quadriceps", "glutes", "hamstrings"],
    "posture": ["lower back", "abdominals", "shoulders"],
    "running": ["hamstrings", "calves", "abdominals"],
    "speed": ["hamstrings", "quadriceps", "calves"],
    "shooting": ["shoulders", "triceps", "forearms"],
    "throw": ["shoulders", "triceps", "chest"],
    "core": ["abdominals", "lower back"],
    "abs": ["abdominals"],
    "back": ["lats", "middle back", "lower back"],
    "chest": ["chest"],
    "arms": ["biceps", "triceps", "forearms"],
    "legs": ["quadriceps", "hamstrings", "calves", "glutes"],
    "shoulders": ["shoulders", "traps"],
    "grip": ["forearms"],
    "push": ["chest", "triceps", "shoulders"],
    "pull": ["lats", "biceps", "middle back"],
}

# EQUIPMENT_KEYWORDS maps user-friendly equipment terms to the exact values
# used in the dataset's "equipment" field.  A value of None (e.g. "gym") means
# "don't filter by equipment" — the user is saying all equipment is available.

EQUIPMENT_KEYWORDS = {
    "no equipment": "body only",
    "bodyweight": "body only",
    "gym": None,
    "dumbbells": "dumbbell",
    "barbell": "barbell",
    "cables": "cable",
    "machine": "machine",
    "bands": "bands",
    "kettlebell": "kettlebells",
}

# ── Field weights ─────────────────────────────────────────────────────────────
# Each exercise field is assigned a priority weight (1.0 = highest).  During
# document construction, each field's text is repeated proportionally to its
# weight (weight * 5, minimum 1 repetition).  This causes TF-IDF to assign
# higher term frequencies to tokens that appear in important fields, so that
# e.g. a query term matching primaryMuscles contributes more to the cosine
# similarity score than the same term matching the exercise name.

FIELD_WEIGHTS = {
    "primaryMuscles": 1.0,
    "secondaryMuscles": 0.8,
    "category": 0.6,
    "level": 0.5,
    "equipment": 0.4,
    "name": 0.3,
    "mechanic": 0.2,
    "force": 0.2,
}


def _safe(val):
    """Convert a field value to a lowercase string safe for concatenation.

    Args:
        val: A field value from the exercise JSON — may be a string, a list of
             strings, or None.

    Returns:
        A single space-joined string.  None becomes "", lists are joined with
        spaces, and scalar values are cast to str.
    """
    if val is None:
        return ""
    if isinstance(val, list):
        return " ".join(val)
    return str(val)


def _build_weighted_doc(ex):
    """Build a single TF-IDF document string for one exercise.

    Concatenates exercise fields into a single string, repeating each field's
    text proportionally to its priority weight so that the TF-IDF vectorizer
    naturally assigns higher term frequencies to high-priority fields.

    For example, with weight 1.0 and a multiplier of 5, the primaryMuscles
    text appears 5 times, while mechanic (weight 0.2) appears only once.
    Instructions are appended once at the end (unweighted) to provide
    additional context without dominating the score.

    Args:
        ex: A single exercise dict from the Free Exercise DB JSON.

    Returns:
        A space-joined string ready for TF-IDF vectorization.
    """
    parts = []
    for field, weight in FIELD_WEIGHTS.items():
        text = _safe(ex.get(field, ""))
        if text:
            repeat = max(1, int(weight * 5))  # scale weights into repeat counts
            parts.extend([text] * repeat)
    instructions = " ".join(ex.get("instructions", []))
    if instructions:
        parts.append(instructions)
    return " ".join(parts)


def _expand_query(query):
    """Expand a user query with muscle group names and equipment synonyms.

    This bridges the vocabulary gap between how users describe their goals
    (e.g. "vertical jump", "bodyweight") and the terminology used in the
    exercise dataset (e.g. "quadriceps", "body only").

    Expansion steps:
        1. Lowercase the raw query.
        2. Check for goal keywords in GOAL_TO_MUSCLES (longest keys first to
           avoid partial matches) and append the mapped muscle names.
        3. Check for equipment keywords in EQUIPMENT_KEYWORDS and append the
           mapped dataset value (skipping None, which means "no filter").

    Args:
        query: The raw natural-language query string from the user.

    Returns:
        A single expanded query string with the original terms plus any
        appended muscle/equipment tokens, ready for TF-IDF vectorization.
    """
    query_lower = query.lower()
    expanded_terms = [query_lower]

    # multi-word goal matching first
    for goal, muscles in sorted(GOAL_TO_MUSCLES.items(), key=lambda x: -len(x[0])):
        if goal in query_lower:
            expanded_terms.extend(muscles)

    # equipment synonyms
    for kw, mapped in EQUIPMENT_KEYWORDS.items():
        if kw in query_lower and mapped is not None:
            expanded_terms.append(mapped)

    return " ".join(expanded_terms)


class ExerciseSearcher:
    """Loads the exercise dataset and builds a TF-IDF index for retrieval.

    On instantiation the class reads every exercise from the Free Exercise DB
    JSON file, constructs a weighted document string for each exercise (see
    ``_build_weighted_doc``), and fits a scikit-learn ``TfidfVectorizer`` over
    the full corpus.  The resulting sparse TF-IDF matrix is stored in memory
    so that subsequent searches only need to vectorize the query and compute
    cosine similarities — no re-indexing required.

    Attributes:
        exercises (list[dict]): The raw list of exercise dicts loaded from JSON.
        vectorizer (TfidfVectorizer): The fitted TF-IDF vectorizer.  English
            stop words are removed and the vocabulary is capped at 10 000
            features for performance.
        tfidf_matrix (scipy.sparse.csr_matrix): The sparse term-document matrix
            of shape (n_exercises, n_features).
    """

    def __init__(self):
        """Load exercises from disk and build the TF-IDF index.

        Reads ``exercises_free_db.json``, builds a weighted document for every
        exercise, and fits/transforms the TF-IDF vectorizer in a single pass.
        """
        with open(DATA_PATH, 'r', encoding='utf-8') as f:
            self.exercises = json.load(f)

        docs = [_build_weighted_doc(ex) for ex in self.exercises]
        self.vectorizer = TfidfVectorizer(stop_words='english', max_features=10000)
        self.tfidf_matrix = self.vectorizer.fit_transform(docs)

    def search(self, query, k=5):
        """Rank exercises against a natural-language query.

        Steps:
            1. Expand the query via ``_expand_query`` (goal → muscles,
               equipment synonyms).
            2. Transform the expanded query into a TF-IDF vector using the
               already-fitted vectorizer.
            3. Compute cosine similarity between the query vector and every
               exercise vector in the pre-built TF-IDF matrix.
            4. Return the top-k exercises sorted by descending similarity,
               excluding any with a score of 0 (no term overlap at all).

        Args:
            query: Raw natural-language query string (e.g. "improve vertical
                   jump for basketball with gym equipment").
            k: Number of top results to return (default 5).

        Returns:
            A list of up to *k* dicts, each containing:
                - name (str): Exercise name.
                - score (float): Cosine similarity score, rounded to 4 decimals.
                - primaryMuscles (list[str]): Primary muscle groups targeted.
                - secondaryMuscles (list[str]): Secondary muscle groups.
                - level (str): Difficulty level (beginner/intermediate/expert).
                - equipment (str | None): Required equipment.
                - category (str): Exercise category (strength, plyometrics, …).
                - instructions (list[str]): Step-by-step instructions.
        """
        expanded = _expand_query(query)
        query_vec = self.vectorizer.transform([expanded])
        scores = cosine_similarity(query_vec, self.tfidf_matrix).flatten()

        top_indices = np.argsort(scores)[::-1][:k]
        results = []
        for idx in top_indices:
            if scores[idx] <= 0:
                break
            ex = self.exercises[idx]
            results.append({
                "name": ex.get("name"),
                "score": round(float(scores[idx]), 4),
                "primaryMuscles": ex.get("primaryMuscles", []),
                "secondaryMuscles": ex.get("secondaryMuscles", []),
                "level": ex.get("level"),
                "equipment": ex.get("equipment"),
                "category": ex.get("category"),
                "instructions": ex.get("instructions", []),
            })
        return results


# Module-level singleton — lazily initialized on first call to search() so
# that the JSON loading and TF-IDF fitting only happen once per process
# lifetime, not on every request.
_searcher = None


def search(query, k=5):
    """Public entry point: search exercises by natural-language query.

    Lazily initializes a singleton ``ExerciseSearcher`` on first call, then
    delegates to its ``search`` method.  This is the function imported by
    ``routes.py`` and exposed via the ``POST /api/search`` endpoint.

    Args:
        query: Raw query string from the user.
        k: Number of top results to return (default 5).

    Returns:
        A list of result dicts — see ``ExerciseSearcher.search`` for the
        full schema.
    """
    global _searcher
    if _searcher is None:
        _searcher = ExerciseSearcher()
    return _searcher.search(query, k=k)

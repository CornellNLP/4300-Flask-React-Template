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
    - Spell correction: each query token is checked against the TF-IDF
      vocabulary using the Wagner-Fisher minimum edit distance algorithm.
      Tokens not found in the vocabulary are replaced with the closest
      vocabulary term within a maximum edit distance of 2.
    - Light load-time cleaning of the Free Exercise DB: secondaryMuscles is
      deduped against primaryMuscles so a muscle listed in both fields is
      not double-weighted. See data/DATASETS.md for the full data audit.
"""
import csv
import json
import os
import re
import sys
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

# programs_kaggle_clean.csv has very long exercise-list fields; bump the csv
# field size limit so the stdlib reader doesn't choke on them.
csv.field_size_limit(min(sys.maxsize, 2**31 - 1))

# ── Porter Stemmer ───────────────────
# Implements Martin Porter's algorithm (1980).  Reduces inflected/derived forms
# to a common stem so that "strengthening", "strengthens", and "strength" all
# map to the same index term.
#
# The algorithm is split into six steps, each applying suffix-replacement rules
# gated on the "measure" m — the number of consonant-vowel (VC) sequences in
# the candidate stem.  A higher measure means a longer, less ambiguous stem and
# therefore a more aggressive replacement is safe.

_VOWELS = frozenset('aeiou')

# Common English stop words handled in the tokenizer so we can pass
# stop_words=None to TfidfVectorizer and avoid sklearn's "inconsistent
# stop-words" warning when a custom tokenizer is used.
_STOP_WORDS = frozenset([
    'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'is', 'it', 'its', 'be', 'are', 'was',
    'were', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did',
    'will', 'would', 'could', 'should', 'may', 'might', 'can', 'as', 'this',
    'that', 'these', 'those', 'which', 'who', 'what', 'how', 'when', 'where',
    'while', 'if', 'not', 'no', 'so', 'than', 'then', 'also', 'more', 'most',
    'other', 'such', 'same', 'your', 'you', 'they', 'their', 'them', 'he',
    'she', 'his', 'her', 'we', 'our', 'us', 'me', 'my', 'i', 'each', 'both',
    # Domain-specific stop words: too generic to discriminate in an exercise DB
    'exercise', 'exercises', 'workout', 'workouts', 'target', 'targets',
    'targeting', 'muscle', 'muscles', 'movement', 'movements', 'position',
    'body', 'starting', 'repeat',
])


def _is_consonant(word, i):
    """Return True if word[i] is a consonant.

    'y' is treated as a consonant when it immediately follows another consonant
    (e.g. the 'y' in 'sky'), and as a vowel otherwise (e.g. 'yes').
    """
    c = word[i]
    if c in _VOWELS:
        return False
    if c == 'y':
        return i == 0 or not _is_consonant(word, i - 1)
    return True


def _measure(word):
    """Count VC sequences (Porter's measure m) in *word*.

    The measure m counts how many times a vowel run is followed by a consonant
    run: [C](VC)^m[V].  A stem with m > 0 has at least one interior vowel and
    is long enough for most suffix rules to apply safely.
    """
    n, i, m = len(word), 0, 0
    while i < n and _is_consonant(word, i):
        i += 1                              # skip leading consonant cluster
    while i < n:
        while i < n and not _is_consonant(word, i):
            i += 1                          # skip vowel run
        if i < n:
            m += 1                          # counted one VC pair
            while i < n and _is_consonant(word, i):
                i += 1                      # skip consonant run
    return m


def _has_vowel(word):
    """Return True if *word* contains at least one vowel."""
    return any(not _is_consonant(word, i) for i in range(len(word)))


def _ends_double_consonant(word):
    """Return True if *word* ends with the same consonant twice (e.g. 'tt')."""
    return (len(word) >= 2
            and word[-1] == word[-2]
            and _is_consonant(word, len(word) - 1))


def _ends_cvc(word):
    """Return True if *word* ends with consonant-vowel-consonant, last c ∉ {w,x,y}.

    Used in step 1b to decide whether to append 'e' after removing -ed/-ing.
    """
    n = len(word)
    return (n >= 3
            and _is_consonant(word, n - 1)
            and not _is_consonant(word, n - 2)
            and _is_consonant(word, n - 3)
            and word[-1] not in 'wxy')


def _step1ab(word):
    """Step 1a: handle plurals.  Step 1b: handle -ed and -ing."""
    # Step 1a
    if word.endswith('sses'):
        word = word[:-2]
    elif word.endswith('ies'):
        word = word[:-2]
    elif not word.endswith('ss') and word.endswith('s'):
        word = word[:-1]

    # Step 1b
    if word.endswith('eed'):
        if _measure(word[:-3]) > 0:
            word = word[:-1]
    elif word.endswith('ed') or word.endswith('ing'):
        stem = word[:-2] if word.endswith('ed') else word[:-3]
        if _has_vowel(stem):
            word = stem
            if word.endswith(('at', 'bl', 'iz')):
                word += 'e'
            elif _ends_double_consonant(word) and word[-1] not in 'lsz':
                word = word[:-1]
            elif _measure(word) == 1 and _ends_cvc(word):
                word += 'e'
    return word


def _step1c(word):
    """Step 1c: replace trailing y with i when the stem has a vowel."""
    if word.endswith('y') and len(word) > 1 and _has_vowel(word[:-1]):
        word = word[:-1] + 'i'
    return word


def _step2(word):
    """Step 2: reduce double-suffixes (m > 0 required)."""
    rules = [
        ('ational', 'ate'), ('tional', 'tion'), ('enci', 'ence'),
        ('anci', 'ance'), ('izer', 'ize'), ('abli', 'able'),
        ('alli', 'al'),  ('entli', 'ent'), ('eli', 'e'),
        ('ousli', 'ous'), ('ization', 'ize'), ('ation', 'ate'),
        ('ator', 'ate'), ('alism', 'al'), ('iveness', 'ive'),
        ('fulness', 'ful'), ('ousness', 'ous'), ('aliti', 'al'),
        ('iviti', 'ive'), ('biliti', 'ble'),
    ]
    for suffix, replacement in rules:
        if word.endswith(suffix) and _measure(word[:-len(suffix)]) > 0:
            return word[:-len(suffix)] + replacement
    return word


def _step3(word):
    """Step 3: reduce single suffixes (m > 0 required)."""
    rules = [
        ('icate', 'ic'), ('ative', ''), ('alize', 'al'),
        ('iciti', 'ic'), ('ical', 'ic'), ('ful', ''), ('ness', ''),
    ]
    for suffix, replacement in rules:
        if word.endswith(suffix) and _measure(word[:-len(suffix)]) > 0:
            return word[:-len(suffix)] + replacement
    return word


def _step4(word):
    """Step 4: strip derivational suffixes (m > 1 required)."""
    for suffix in ('al', 'ance', 'ence', 'er', 'ic', 'able', 'ible',
                   'ant', 'ement', 'ment', 'ent', 'ou', 'ism', 'ate',
                   'iti', 'ous', 'ive', 'ize'):
        if word.endswith(suffix) and _measure(word[:-len(suffix)]) > 1:
            return word[:-len(suffix)]
    # -ion is only removed when the preceding letter is s or t
    if word.endswith('ion'):
        stem = word[:-3]
        if _measure(stem) > 1 and stem and stem[-1] in 'st':
            return stem
    return word


def _step5(word):
    """Step 5: tidy up final e and double-l."""
    # Step 5a: remove trailing e
    if word.endswith('e'):
        stem = word[:-1]
        m = _measure(stem)
        if m > 1 or (m == 1 and not _ends_cvc(stem)):
            word = stem
    # Step 5b: remove doubled l when m > 1
    if _ends_double_consonant(word) and word.endswith('l') and _measure(word[:-1]) > 1:
        word = word[:-1]
    return word


def _stem(word):
    """Reduce *word* to its Porter stem (pure Python, no libraries).

    Words of length ≤ 2 are returned unchanged — the algorithm is not
    reliable on very short strings and they're unlikely to have inflections
    worth stripping.
    """
    if len(word) <= 2:
        return word
    word = _step1ab(word)
    word = _step1c(word)
    word = _step2(word)
    word = _step3(word)
    word = _step4(word)
    word = _step5(word)
    return word


def _tokenize_and_stem(text):
    """Tokenize *text* into lowercase alpha tokens, remove stop words, then stem.

    Used as the custom tokenizer for TfidfVectorizer so that index terms and
    query terms go through identical preprocessing.
    """
    tokens = re.findall(r'[a-z]+', text.lower())
    return [_stem(t) for t in tokens if t not in _STOP_WORDS and len(t) > 1]

DATA_PATH = os.path.join(os.path.dirname(__file__), '..', 'data', 'datasets', 'exercises_free_db.json')
PROGRAMS_CSV_PATH = os.path.join(os.path.dirname(__file__), '..', 'data', 'datasets', 'programs_cleaned.csv')
PROGRAMS_SCHEDULE_CSV_PATH = os.path.join(os.path.dirname(__file__), '..', 'data', 'datasets', 'programs_kaggle_clean.csv')

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
    "secondaryMuscles": 0.4,
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


def _dedup_secondary(ex):
    """Return secondaryMuscles with any entries that also appear in
    primaryMuscles removed.

    9 exercises in the upstream Free Exercise DB list the same muscle in both
    primaryMuscles and secondaryMuscles (e.g. "Barbell Step Ups" has
    quadriceps in both). Without this dedup, those muscles would be weighted
    1.0 (primary) + 0.4 (secondary) = 1.4x, giving those 9 docs a small but
    unearned TF bump on the shared muscle term. See data/DATASETS.md.
    """
    primary = set(ex.get("primaryMuscles") or [])
    secondary = ex.get("secondaryMuscles") or []
    return [m for m in secondary if m not in primary]


def _build_weighted_doc(ex):
    """Build a single TF-IDF document string for one exercise.

    Concatenates exercise fields into a single string, repeating each field's
    text proportionally to its priority weight so that the TF-IDF vectorizer
    naturally assigns higher term frequencies to high-priority fields.

    For example, with weight 1.0 and a multiplier of 5, the primaryMuscles
    text appears 5 times, while mechanic (weight 0.2) appears only once.
    Instructions are appended once at the end (unweighted) to provide
    additional context without dominating the score.

    secondaryMuscles is deduped against primaryMuscles (see _dedup_secondary)
    so that a muscle listed in both fields is not double-weighted.

    Args:
        ex: A single exercise dict from the Free Exercise DB JSON.

    Returns:
        A space-joined string ready for TF-IDF vectorization.
    """
    parts = []
    for field, weight in FIELD_WEIGHTS.items():
        if field == "secondaryMuscles":
            text = _safe(_dedup_secondary(ex))
        else:
            text = _safe(ex.get(field, ""))
        if text:
            repeat = max(1, int(weight * 5))  # scale weights into repeat counts
            parts.extend([text] * repeat)
    instructions = " ".join(ex.get("instructions", []))
    if instructions:
        parts.append(instructions)
    return " ".join(parts)


def _wagner_fisher(s1, s2):
    """Compute the Levenshtein edit distance between two strings.

    Implements the Wagner-Fisher dynamic programming algorithm.  The DP table
    is compressed to a single row to keep memory usage O(min(|s1|, |s2|)).

    Args:
        s1: First string.
        s2: Second string.

    Returns:
        Integer minimum edit distance (insertions, deletions, substitutions).
    """
    if len(s1) < len(s2):
        s1, s2 = s2, s1

    m, n = len(s1), len(s2)
    dp = list(range(n + 1))

    for i in range(1, m + 1):
        prev = dp[0]
        dp[0] = i
        for j in range(1, n + 1):
            temp = dp[j]
            if s1[i - 1] == s2[j - 1]:
                dp[j] = prev
            else:
                dp[j] = 1 + min(prev,
                                dp[j],
                                dp[j - 1])
            prev = temp

    return dp[n]


def _correct_token(token, vocab_by_length, max_dist=2):
    """Return the closest vocabulary term to *token*, or *token* itself.

    To avoid an expensive O(V) scan on every token, candidate vocabulary terms
    are pre-bucketed by length.  Only terms whose length differs from the query
    token by at most *max_dist* characters can possibly be within *max_dist*
    edits, so we restrict the search to those buckets.

    Args:
        token: A single lowercase query token.
        vocab_by_length: Dict mapping token_length → list of vocab terms of
            that length.  Built once in ExerciseSearcher.__init__.
        max_dist: Maximum edit distance to accept a correction (default 2).
            Tokens needing more than this many edits are returned unchanged.

    Returns:
        The best-matching vocabulary term if one is found within *max_dist*
        edits, otherwise the original token.
    """
    if len(token) <= 2:
        return token

    best_term = token
    best_dist = max_dist + 1 

    for length in range(len(token) - max_dist, len(token) + max_dist + 1):
        for candidate in vocab_by_length.get(length, []):
            d = _wagner_fisher(token, candidate)
            if d < best_dist:
                best_dist = d
                best_term = candidate
                if d == 0: 
                    return best_term

    return best_term if best_dist <= max_dist else token


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
        # stop_words=None because _tokenize_and_stem already filters them;
        # passing stop_words='english' with a custom tokenizer triggers a
        # sklearn UserWarning about inconsistency (stop words aren't stemmed).
        self.vectorizer = TfidfVectorizer(tokenizer=_tokenize_and_stem,
                                          stop_words=None,
                                          max_features=10000)
        self.tfidf_matrix = self.vectorizer.fit_transform(docs)

        # Build a length-bucketed vocabulary index for O(1) candidate lookup
        # during spell correction.  Keys are token lengths; values are lists of
        # all vocabulary terms of that length.
        self.vocab_by_length = {}
        for term in self.vectorizer.vocabulary_:
            self.vocab_by_length.setdefault(len(term), []).append(term)

    def search(self, query, k=5, equipment=None, max_level=None, injured_muscles=None):
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
        # Spell-correct each query token against the TF-IDF vocabulary.
        # Stem and remove stop words BEFORE spell correction so that valid
        # words like "triceps" aren't needlessly "corrected" to their stemmed
        # form, and stop words like "that" aren't mangled into "th".
        raw_tokens = query.lower().split()
        corrected_display = []  # for "Did you mean?" (human-readable)
        any_corrected = False

        for raw in raw_tokens:
            if raw in _STOP_WORDS or len(raw) <= 1:
                corrected_display.append(raw)
                continue
            stemmed = _stem(raw)
            corrected = _correct_token(stemmed, self.vocab_by_length)
            if corrected != stemmed:
                corrected_display.append(corrected)
                any_corrected = True
            else:
                corrected_display.append(raw)

        corrected_query = " ".join(corrected_display)

        expanded = _expand_query(corrected_query)
        query_vec = self.vectorizer.transform([expanded])
        scores = cosine_similarity(query_vec, self.tfidf_matrix).flatten()

        # Apply optional filters as a pre-ranking mask. Masked-out rows get a
        # negative score so they never enter the top-k.
        equipment_set = {e.strip().lower() for e in equipment} if equipment else None
        _LEVEL_ORDER = ["beginner", "intermediate", "expert"]
        allowed_levels = None
        if max_level:
            ml = max_level.strip().lower()
            if ml in _LEVEL_ORDER:
                allowed_levels = set(_LEVEL_ORDER[: _LEVEL_ORDER.index(ml) + 1])
        injured_set = {m.strip().lower() for m in injured_muscles} if injured_muscles else None

        if equipment_set or allowed_levels or injured_set:
            for i, ex in enumerate(self.exercises):
                if equipment_set is not None:
                    eq = ex.get("equipment")
                    if eq is None or eq not in equipment_set:
                        scores[i] = -1.0
                        continue
                if allowed_levels is not None:
                    if ex.get("level") not in allowed_levels:
                        scores[i] = -1.0
                        continue
                if injured_set is not None:
                    muscles = set(ex.get("primaryMuscles") or []) | set(ex.get("secondaryMuscles") or [])
                    if not injured_set.isdisjoint(muscles):
                        scores[i] = -1.0
                        continue

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
        return {
            "results": results,
            "corrected_query": corrected_query if any_corrected else None,
        }


# Module-level singleton — lazily initialized on first call to search() so
# that the JSON loading and TF-IDF fitting only happen once per process
# lifetime, not on every request.
_searcher = None


def search(query, k=5, equipment=None, max_level=None, injured_muscles=None):
    """Public entry point: search exercises by natural-language query.

    Lazily initializes a singleton ``ExerciseSearcher`` on first call, then
    delegates to its ``search`` method.  This is the function imported by
    ``routes.py`` and exposed via the ``POST /api/search`` endpoint.

    Args:
        query: Raw query string from the user.
        k: Number of top results to return (default 5).

    Returns:
        A dict with keys:
            - "results": list of result dicts (see ExerciseSearcher.search).
            - "corrected_query": corrected query string if any token was
              spell-corrected, otherwise None.
    """
    global _searcher
    if _searcher is None:
        _searcher = ExerciseSearcher()
    return _searcher.search(
        query,
        k=k,
        equipment=equipment,
        max_level=max_level,
        injured_muscles=injured_muscles,
    )


# ── Program retrieval ────────────────────────────────────────────────────────
# Separate TF-IDF index over the 2,598 unique workout programs in
# programs_cleaned.csv. Uses the same tokenizer / stemmer / spell-correction
# primitives as ExerciseSearcher so query preprocessing is identical across
# the two search surfaces.

PROGRAM_FIELD_WEIGHTS = {
    "title": 3,
    "goal": 3,
    "exercises": 2,
    "description": 1,
}


def _parse_json_list(raw):
    """Parse a JSON-encoded list column from programs_cleaned.csv.

    The CSV round-trips ``json.dumps`` lists (e.g. ``["Powerlifting",
    "Bodybuilding"]``), so ``json.loads`` is the right parser. Falls back to
    an empty list on any failure — downstream code treats missing fields as
    empty space-joined strings.
    """
    if not raw:
        return []
    try:
        val = json.loads(raw)
        return val if isinstance(val, list) else []
    except (ValueError, TypeError):
        return []


def _build_program_doc(row):
    """Build a weighted TF-IDF document string for one program row.

    Field weights mirror ``FIELD_WEIGHTS`` semantics: each field's text is
    repeated ``weight`` times so the TF-IDF vectorizer upweights tokens from
    high-priority fields. ``goal`` and ``exercises`` are JSON lists on disk
    and are space-joined before repetition.
    """
    parts = []
    fields = {
        "title": row.get("title", "") or "",
        "goal": " ".join(_parse_json_list(row.get("goal", ""))),
        "exercises": " ".join(_parse_json_list(row.get("exercises", ""))),
        "description": row.get("description", "") or "",
    }
    for field, weight in PROGRAM_FIELD_WEIGHTS.items():
        text = fields[field]
        if text:
            parts.extend([text] * weight)
    return " ".join(parts)


def _to_float(val):
    """Best-effort float coercion; returns None on failure or empty input."""
    if val is None or val == "":
        return None
    try:
        return float(val)
    except (ValueError, TypeError):
        return None


def _to_int(val):
    """Best-effort int coercion via float (handles ``"1.0"`` from pandas)."""
    f = _to_float(val)
    return int(f) if f is not None else None


class ProgramSearcher:
    """TF-IDF index over workout programs from ``programs_cleaned.csv``.

    Builds one document per program from the weighted concatenation of
    title, goal, exercises, and description. At init, also eager-loads the
    week/day/exercise breakdown from ``programs_kaggle_clean.csv`` into a
    ``title -> list[schedule entry]`` dict so search results can carry a
    full schedule for the UI to render. The schedule is **not** part of the
    TF-IDF document — it's purely for display.

    Attributes:
        programs (list[dict]): Program rows from programs_cleaned.csv.
        vectorizer (TfidfVectorizer): Fitted TF-IDF vectorizer sharing
            ``_tokenize_and_stem`` with ``ExerciseSearcher``.
        tfidf_matrix (scipy.sparse.csr_matrix): (n_programs, n_features).
        schedule_by_title (dict[str, list[dict]]): Week/day exercise
            breakdown per program title.
        vocab_by_length (dict[int, list[str]]): Length-bucketed vocabulary
            for fast Wagner-Fisher spell correction.
    """

    def __init__(self):
        with open(PROGRAMS_CSV_PATH, 'r', encoding='utf-8', newline='') as f:
            reader = csv.DictReader(f)
            self.programs = list(reader)

        docs = [_build_program_doc(row) for row in self.programs]
        self.vectorizer = TfidfVectorizer(
            tokenizer=_tokenize_and_stem,
            stop_words=None,
            max_features=10000,
        )
        self.tfidf_matrix = self.vectorizer.fit_transform(docs)

        self.vocab_by_length = {}
        for term in self.vectorizer.vocabulary_:
            self.vocab_by_length.setdefault(len(term), []).append(term)

        # Eager-load the week/day schedule. One ~605k-row pass, grouped by
        # title into a display-only dict. Not part of retrieval scoring.
        self.schedule_by_title = {}
        with open(PROGRAMS_SCHEDULE_CSV_PATH, 'r', encoding='utf-8', newline='') as f:
            reader = csv.DictReader(f)
            for row in reader:
                title = row.get("title")
                if not title:
                    continue
                entry = {
                    "week": _to_int(row.get("week")),
                    "day": _to_int(row.get("day")),
                    "exercise_name": row.get("exercise_name", "") or "",
                    "sets": _to_float(row.get("sets")),
                    "reps": _to_float(row.get("reps")),
                    "rep_type": row.get("rep_type") or None,
                }
                self.schedule_by_title.setdefault(title, []).append(entry)

    def search(self, query, k=5):
        """Rank programs against a natural-language query.

        Mirrors ``ExerciseSearcher.search``: spell-correct each query token
        against the program vocabulary, TF-IDF transform, cosine similarity
        against the program matrix, then return the top-k non-zero scores
        with their schedule payload attached.
        """
        raw_tokens = query.lower().split()
        corrected_display = []
        any_corrected = False

        for raw in raw_tokens:
            if raw in _STOP_WORDS or len(raw) <= 1:
                corrected_display.append(raw)
                continue
            stemmed = _stem(raw)
            corrected = _correct_token(stemmed, self.vocab_by_length)
            if corrected != stemmed:
                corrected_display.append(corrected)
                any_corrected = True
            else:
                corrected_display.append(raw)

        corrected_query = " ".join(corrected_display)
        query_vec = self.vectorizer.transform([corrected_query])
        scores = cosine_similarity(query_vec, self.tfidf_matrix).flatten()

        top_indices = np.argsort(scores)[::-1][:k]
        results = []
        for idx in top_indices:
            if scores[idx] <= 0:
                break
            row = self.programs[idx]
            title = row.get("title", "")
            results.append({
                "title": title,
                "description": row.get("description", "") or "",
                "goal": _parse_json_list(row.get("goal", "")),
                "level": row.get("level_primary") or None,
                "program_length_weeks": _to_float(row.get("program_length_weeks")),
                "score": round(float(scores[idx]), 4),
                "schedule": self.schedule_by_title.get(title, []),
            })
        return {
            "results": results,
            "corrected_query": corrected_query if any_corrected else None,
        }


_program_searcher = None


def search_programs(query, k=5):
    """Public entry point: search workout programs by natural-language query.

    Lazily initializes a singleton ``ProgramSearcher`` on first call. Exposed
    via ``POST /api/search_programs`` in ``routes.py``.
    """
    global _program_searcher
    if _program_searcher is None:
        _program_searcher = ProgramSearcher()
    return _program_searcher.search(query, k=k)

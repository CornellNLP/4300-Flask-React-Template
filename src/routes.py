"""
Routes for Forkcast — natural language restaurant search via TF-IDF + embeddings + RAG.
"""
import os
import math
import pickle
import numpy as np
from collections import defaultdict
from flask import send_from_directory, request, jsonify
from sklearn.metrics.pairwise import cosine_similarity

USE_LLM = True

# ── Index loading ─────────────────────────────────────────────────────────────
DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'data')
INDEX_PATH = os.path.join(DATA_DIR, 'forkcast_index.pkl')

_index = None

def get_index():
    global _index
    if _index is None:
        if not os.path.exists(INDEX_PATH):
            raise FileNotFoundError(
                f"Index not found at {INDEX_PATH}. "
                "Run: python src/preprocess.py"
            )
        print("Loading Forkcast index...")
        with open(INDEX_PATH, 'rb') as f:
            _index = pickle.load(f)
        print(f"Index loaded: {len(_index['restaurants'])} restaurants.")
    return _index


_embed_model = None

def get_embed_model(model_name: str = 'all-MiniLM-L6-v2'):
    global _embed_model
    if _embed_model is None:
        from sentence_transformers import SentenceTransformer
        print(f"Loading embedding model ({model_name})...")
        _embed_model = SentenceTransformer(model_name)
    return _embed_model


# ── Spell correction ──────────────────────────────────────────────────────────

_spell_checker = None

def _get_spell_checker():
    global _spell_checker
    if _spell_checker is None:
        from spellchecker import SpellChecker
        _spell_checker = SpellChecker(distance=1)
    return _spell_checker


def _correct_spelling(query: str) -> tuple:
    """Return (corrected_query, display_string) — display is None if nothing changed."""
    checker = _get_spell_checker()
    tokens = query.split()
    corrected = []
    changed = False
    for token in tokens:
        clean = token.lower()
        # Only attempt correction on purely alphabetic tokens longer than 2 chars
        if clean.isalpha() and len(clean) > 2 and clean not in checker:
            fix = checker.correction(clean)
            if fix and fix != clean:
                corrected.append(fix)
                changed = True
                continue
        corrected.append(token)
    result = ' '.join(corrected)
    return (result, result) if changed else (query, None)


# ── City centroid helpers ─────────────────────────────────────────────────────

_city_centroids_cache: dict = {}


def _get_city_centroids(restaurants: list) -> dict:
    """Lazily compute and cache {city_label: (mean_lat, mean_lng)} for the loaded index."""
    global _city_centroids_cache
    if _city_centroids_cache:
        return _city_centroids_cache
    coords: dict = defaultdict(list)
    for row in restaurants:
        parts = [p.strip() for p in str(row.get('full_address', '')).split(',')]
        if len(parts) >= 4:
            city = parts[-3].strip()
            state = parts[-2].strip()
            if city and len(city) > 2 and not city.isdigit() and state:
                try:
                    lat = float(row.get('lat'))
                    lng = float(row.get('lng'))
                    if not math.isnan(lat) and not math.isnan(lng):
                        coords[f"{city}, {state}"].append((lat, lng))
                except (TypeError, ValueError):
                    pass
    for label, pts in coords.items():
        lats = [p[0] for p in pts]
        lngs = [p[1] for p in pts]
        _city_centroids_cache[label] = (sum(lats) / len(lats), sum(lngs) / len(lngs))
    return _city_centroids_cache


def _nearest_cities(queried_city: str, restaurants: list, n: int = 3) -> list:
    """Return the n city labels nearest to queried_city (excluding itself)."""
    centroids = _get_city_centroids(restaurants)
    target = centroids.get(queried_city)
    if target is None:
        return [c for c in list(centroids.keys()) if c != queried_city][:n]
    qlat, qlng = target
    ranked = sorted(
        [(label, haversine_miles(qlat, qlng, lat, lng))
         for label, (lat, lng) in centroids.items() if label != queried_city],
        key=lambda x: x[1],
    )
    return [label for label, _ in ranked[:n]]


# ── Query expansion ───────────────────────────────────────────────────────────
# Minimal synonyms kept only where TF-IDF candidate retrieval would otherwise
# miss relevant restaurants. Semantic similarity is handled by embeddings in ranking.
SYNONYMS = {
    'spicy':       ['hot', 'chili'],
    'sushi':       ['japanese', 'maki', 'sashimi'],
    'noodles':     ['ramen', 'pho', 'udon'],
    'breakfast':   ['brunch', 'eggs', 'pancakes'],
    'bbq':         ['barbecue', 'ribs', 'brisket'],
    'vegetarian':  ['veggie', 'meatless'],
    'vegan':       ['plant-based', 'dairy-free'],
    'burger':      ['burgers', 'hamburger'],
}


def expand_query(query: str) -> str:
    tokens = query.lower().split()
    expanded = list(tokens)
    for token in tokens:
        if token in SYNONYMS:
            expanded.extend(SYNONYMS[token])
    return ' '.join(expanded)

# ── Price-intent scoring ──────────────────────────────────────────────────────

_PRICE_CHEAP_WORDS  = {'cheap', 'inexpensive', 'affordable', 'budget', 'value', 'low-cost', 'economical'}
_PRICE_PRICEY_WORDS = {'expensive', 'upscale', 'fancy', 'fine dining', 'pricey', 'high-end', 'luxurious', 'splurge'}
_PRICE_RANK = {'$': 1, '$$': 2, '$$$': 3, '$$$$': 4}

def _price_intent_boost(query_tokens: set, price_range: str) -> float:
    """Return a multiplier that boosts restaurants matching the price intent in the query."""
    rank = _PRICE_RANK.get(str(price_range).strip(), 2)
    if query_tokens & _PRICE_CHEAP_WORDS:
        return [1.8, 1.0, 0.45, 0.25][rank - 1]
    if query_tokens & _PRICE_PRICEY_WORDS:
        return [0.3, 0.75, 1.15, 1.5][rank - 1]
    return 1.0


def _best_item_score(items: list, query_words: set) -> float:
    """Fraction of query words matched in the single best menu item (0–1)."""
    if not items or not query_words:
        return 0.0
    best = 0.0
    for item in items:
        text_words = set(f"{item['name']} {item['description']}".lower().split())
        score = len(query_words & text_words) / len(query_words)
        if score > best:
            best = score
    return best


# ── Location helpers ─────────────────────────────────────────────────────────

def haversine_miles(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 3958.8
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _location_filter(restaurants: list, city: str, user_lat, user_lng, miles) -> np.ndarray:
    """Return indices of restaurants that pass the city and/or distance filter."""
    use_city = bool(city)
    use_geo = user_lat is not None and user_lng is not None and miles is not None

    if not use_city and not use_geo:
        return np.arange(len(restaurants))

    keep = []
    for i, row in enumerate(restaurants):
        if use_city and city.lower() not in str(row.get('full_address', '')).lower():
            continue
        if use_geo:
            try:
                rlat = float(row.get('lat'))
                rlng = float(row.get('lng'))
                if math.isnan(rlat) or math.isnan(rlng):
                    continue
            except (TypeError, ValueError):
                continue
            if haversine_miles(user_lat, user_lng, rlat, rlng) > miles:
                continue
        keep.append(i)

    return np.array(keep, dtype=int)


# ── Dietary negative-keyword filter on menu items ────────────────────────────
# Words whose presence disqualifies a menu item for the given dietary preference.
_DIETARY_ITEM_BLOCKLIST: dict[str, set[str]] = {
    'vegetarian': {
        'beef', 'chicken', 'pork', 'lamb', 'turkey', 'bacon', 'ham', 'steak',
        'brisket', 'chorizo', 'sausage', 'pepperoni', 'salami', 'prosciutto',
        'duck', 'veal', 'venison', 'anchovy', 'anchovies', 'lard', 'gelatin',
        'meatball', 'meatballs', 'pulled pork', 'carnitas', 'carne', 'meat',
    },
    'vegan': {
        # everything vegetarian blocks, plus dairy/eggs
        'beef', 'chicken', 'pork', 'lamb', 'turkey', 'bacon', 'ham', 'steak',
        'brisket', 'chorizo', 'sausage', 'pepperoni', 'salami', 'prosciutto',
        'duck', 'veal', 'venison', 'anchovy', 'anchovies', 'lard', 'gelatin',
        'meatball', 'meatballs', 'pulled pork', 'carnitas', 'carne', 'meat',
        'cheese', 'butter', 'cream', 'milk', 'egg', 'eggs', 'honey',
        'whey', 'casein', 'mayonnaise', 'mayo',
    },
    'pescatarian': {
        'beef', 'pork', 'lamb', 'turkey', 'bacon', 'ham', 'steak', 'brisket',
        'chorizo', 'sausage', 'pepperoni', 'salami', 'prosciutto', 'duck',
        'veal', 'venison', 'lard', 'meatball', 'meatballs', 'pulled pork',
        'carnitas', 'carne',
    },
    'gluten-free': {
        'bread', 'breadcrumbs', 'croutons', 'flour tortilla', 'pasta',
        'noodles', 'ramen', 'udon', 'soy sauce', 'tempura', 'breaded',
        'battered', 'wheat', 'barley', 'rye', 'malt',
    },
    'dairy-free': {
        'cheese', 'butter', 'cream', 'milk', 'whey', 'casein', 'yogurt',
        'parmesan', 'mozzarella', 'cheddar', 'feta', 'gouda', 'brie',
        'ricotta', 'ghee', 'half-and-half',
    },
}


def _item_passes_dietary(item: dict, dietary: list) -> bool:
    """Return True if the menu item doesn't contain blocked ingredients for any active dietary filter."""
    if not dietary:
        return True
    text = f"{item['name']} {item['description']}".lower()
    for pref in dietary:
        blocklist = _DIETARY_ITEM_BLOCKLIST.get(pref, set())
        if any(bad in text for bad in blocklist):
            return False
    return True


# ── Dietary filter ───────────────────────────────────────────────────────────

def _dietary_filter(idx: dict, dietary: list) -> np.ndarray:
    """Return indices of restaurants that satisfy ALL requested dietary constraints."""
    if not dietary:
        return np.arange(len(idx['restaurants']))
    dietary_tags = idx.get('dietary_tags', [])
    if not dietary_tags:
        return np.arange(len(idx['restaurants']))  # index pre-dates dietary tagging
    required = set(dietary)
    keep = [i for i, tags in enumerate(dietary_tags) if required.issubset(tags)]
    return np.array(keep, dtype=int)


# ── SVD explainability ───────────────────────────────────────────────────────

def get_svd_explanation(idx, query_vec, top_concepts: int = 3, top_terms: int = 5) -> list:
    """Return top latent concepts activated by the query, each with their defining terms."""
    svd = idx['svd_model']
    feature_names = idx['feature_names']
    query_concepts = svd.transform(query_vec).flatten()
    top_ci = np.abs(query_concepts).argsort()[::-1][:top_concepts]
    concepts = []
    for ci in top_ci:
        component = svd.components_[ci]
        top_ti = component.argsort()[::-1][:top_terms]
        concepts.append({
            'concept_id': int(ci),
            'activation': round(float(query_concepts[ci]), 4),
            'top_terms': [
                {'term': feature_names[ti], 'weight': round(float(component[ti]), 4)}
                for ti in top_ti
            ],
        })
    return concepts


# ── Menu item matching ────────────────────────────────────────────────────────

def find_matching_items(items: list, query_words: set, original_query: str = '',
                        max_items: int = 3, dietary: list = None) -> list:
    """Return up to max_items menu items relevant to the query.

    Scoring:
      +10 per full-phrase match (e.g. 'ice cream' found verbatim)
      + 1 per individual query word match
    Only items with score > 0 are returned.
    Items containing ingredients blocked by the active dietary filters are excluded.
    """
    if not items or not query_words:
        return []

    # Build multi-word phrases from the original query (2+ word sequences)
    orig_tokens = original_query.lower().split()
    phrases = [
        ' '.join(orig_tokens[i:j])
        for i in range(len(orig_tokens))
        for j in range(i + 2, len(orig_tokens) + 1)
    ]

    scored = []
    for item in items:
        # ── Dietary negative filter: skip items with blocked ingredients ──────
        if not _item_passes_dietary(item, dietary or []):
            continue
        text = f"{item['name']} {item['description']}".lower()
        hit_phrases = [p for p in phrases if p in text]
        hit_words   = [w for w in query_words if w in text]
        score = len(hit_phrases) * 10 + len(hit_words)
        if score > 0:
            # Build a short explanation of why this item matched
            phrase_set = set(' '.join(hit_phrases).split())
            extra_words = [w for w in hit_words if w not in phrase_set]
            reason_parts = hit_phrases + extra_words
            item_with_reason = {**item, 'match_reason': ', '.join(reason_parts[:4])}
            scored.append((score, item_with_reason))
    scored.sort(key=lambda x: x[0], reverse=True)
    return [item for _, item in scored[:max_items]]

# ── SVD per-restaurant match explanation ─────────────────────────────────────

def _svd_match_dims(idx, query_transformed, global_i: int, top_dims: int = 3, top_terms: int = 3) -> list:
    """Return the top latent dimensions shared between the query and a restaurant.

    Contribution of dimension k = query_svd[k] * restaurant_svd[k].
    High positive contribution means both query and restaurant activate that
    dimension strongly — those are the dimensions that drove the match.
    """
    q_vec  = query_transformed.flatten()                    # (n_components,)
    r_vec  = idx['tfidf_svd_matrix'][global_i]              # (n_components,)
    contribs = q_vec * r_vec                                # element-wise product
    top_ki   = np.abs(contribs).argsort()[::-1][:top_dims]

    feature_names = idx['feature_names']
    dims = []
    for k in top_ki:
        component = idx['svd_model'].components_[k]
        top_ti    = component.argsort()[::-1][:top_terms]
        dims.append({
            'concept_id': int(k),
            'activation': round(float(contribs[k]), 4),
            'top_terms':  [
                {'term': feature_names[ti], 'weight': round(float(component[ti]), 4)}
                for ti in top_ti
            ],
        })
    return dims


# ── Core search ───────────────────────────────────────────────────────────────

def search_restaurants(
    query: str,
    price_filter: str = '',
    limit: int = 10,
    use_svd: bool = False,
    city: str = '',
    user_lat=None,
    user_lng=None,
    miles=None,
    dietary: list = None,
) -> dict:
    mode = 'svd' if use_svd else 'tfidf'
    if not query.strip():
        return {'results': [], 'meta': {'mode': mode, 'concepts': []}}

    idx = get_index()

    if use_svd and 'svd_model' not in idx:
        return {
            'results': [],
            'meta': {
                'mode': 'tfidf',
                'concepts': [],
                'error': 'SVD index not found. Re-run: python src/preprocess.py',
            },
        }

    has_embeddings = 'embedding_matrix' in idx

    corrected_q, corrected_display = _correct_spelling(query)
    expanded = expand_query(corrected_q)
    query_vec = idx['vectorizer'].transform([expanded])
    concepts = get_svd_explanation(idx, query_vec) if use_svd else []

    # Pre-filters (location AND dietary — intersection)
    loc_indices = _location_filter(idx['restaurants'], city, user_lat, user_lng, miles)
    diet_indices = _dietary_filter(idx, dietary or [])
    filtered_indices = np.intersect1d(loc_indices, diet_indices)
    if len(filtered_indices) == 0:
        meta: dict = {'mode': mode, 'concepts': concepts}
        if corrected_display:
            meta['corrected_query'] = corrected_display
        if city:
            meta['suggested_cities'] = _nearest_cities(city, idx['restaurants'])
        return {'results': [], 'meta': meta}

    # ── Step 1: lexical retrieval (TF-IDF or SVD) → top-K candidates ─────────
    query_transformed = None
    if use_svd:
        query_transformed = idx['svd_model'].transform(query_vec)
        local_scores = cosine_similarity(query_transformed, idx['tfidf_svd_matrix'][filtered_indices]).flatten()
    else:
        local_scores = cosine_similarity(query_vec, idx['tfidf_matrix'][filtered_indices]).flatten()

    CANDIDATE_K = min(len(filtered_indices), max(limit * 10, 120))
    top_local = local_scores.argsort()[::-1][:CANDIDATE_K]
    candidate_global = filtered_indices[top_local]
    candidate_scores = local_scores[top_local]

    # Drop candidates below minimum relevance threshold
    valid = candidate_scores >= 0.01
    candidate_global = candidate_global[valid]
    candidate_scores = candidate_scores[valid]

    if len(candidate_global) == 0:
        meta = {'mode': mode, 'concepts': concepts}
        if corrected_display:
            meta['corrected_query'] = corrected_display
        return {'results': [], 'meta': meta}

    # ── Step 2: embed similarity for candidates → hybrid score ────────────────
    if has_embeddings:
        embed_model = get_embed_model(idx.get('embed_model_name', 'all-MiniLM-L6-v2'))
        query_embedding = embed_model.encode([corrected_q], convert_to_numpy=True)
        embed_scores = cosine_similarity(
            query_embedding, idx['embedding_matrix'][candidate_global]
        ).flatten()

        # Min-max normalize each signal independently before blending
        def _norm(arr):
            lo, hi = arr.min(), arr.max()
            return (arr - lo) / (hi - lo + 1e-9)

        hybrid_scores = 0.6 * _norm(candidate_scores) + 0.4 * _norm(embed_scores)
    else:
        hybrid_scores = candidate_scores

    # ── Step 3: rerank by item match + price intent ───────────────────────────
    query_words  = set(expanded.lower().split())        # expanded for item matching
    query_tokens = set(corrected_q.lower().split())     # corrected for price intent

    use_geo = user_lat is not None and user_lng is not None and miles is not None

    candidates = []
    for global_i, lexical_score, hybrid_score in zip(
        candidate_global, candidate_scores, hybrid_scores
    ):
        row = idx['restaurants'][global_i]
        rid = str(int(float(str(row['id'])))) if str(row['id']).replace('.', '', 1).isdigit() else str(row['id'])
        all_items = idx['menu_data'].get(rid, [])

        item_s = _best_item_score(all_items, query_words)
        pb     = _price_intent_boost(query_tokens, row.get('price_range', ''))
        # Price intent multiplies the hybrid score; item match adds a bonus
        combined = hybrid_score * pb * (1.0 + 0.5 * item_s)

        dist = None
        if use_geo:
            try:
                rlat, rlng = float(row.get('lat')), float(row.get('lng'))
                if not math.isnan(rlat) and not math.isnan(rlng):
                    dist = round(haversine_miles(user_lat, user_lng, rlat, rlng), 1)
            except (TypeError, ValueError):
                pass

        candidates.append((combined, lexical_score, global_i, row, rid, all_items, dist))

    candidates.sort(key=lambda x: x[0], reverse=True)

    # ── Step 4: build final results (apply price hard-filter) ─────────────────
    results = []
    for combined, tfidf_score, global_i, row, rid, all_items, dist in candidates:
        if len(results) >= limit:
            break
        if price_filter and str(row.get('price_range', '')).strip() != price_filter:
            continue

        matched = find_matching_items(all_items, query_words, original_query=query, dietary=dietary)

        # Fallback: if no query-matched items, surface the highest-rated menu item
        # (first item in list, as stored order is preserved from source data).
        # Only use items that pass the dietary filter so the fallback is always safe.
        safe_items = [it for it in all_items if _item_passes_dietary(it, dietary or [])]
        popular_dish = safe_items[0] if safe_items else None

        score = round(float(row.get('score') or 0), 1)

        result = {
            'name':          row.get('name', ''),
            'category':      row.get('category', ''),
            'price_range':   row.get('price_range', ''),
            'score':         score,
            'is_top_rated':  score >= 4.5,
            'ratings':       str(row.get('ratings', '')),
            'address':       row.get('full_address', ''),
            'similarity':    round(float(tfidf_score), 4),
            'matched_items': matched,
            'popular_dish':  popular_dish,
            'has_menu_items': bool(matched or popular_dish),
        }
        if dist is not None:
            result['distance_miles'] = dist
        if query_transformed is not None:
            result['svd_match_dims'] = _svd_match_dims(idx, query_transformed, global_i)

        results.append(result)

    # ── Step 4: surface restaurants with menu items first ─────────────────────
    results.sort(key=lambda r: (not r['has_menu_items'], -r['similarity']))

    meta = {'mode': mode, 'concepts': concepts}
    if corrected_display:
        meta['corrected_query'] = corrected_display
    return {'results': results, 'meta': meta}


# ── Route registration ────────────────────────────────────────────────────────

def register_routes(app):
    @app.route('/', defaults={'path': ''})
    @app.route('/<path:path>')
    def serve(path):
        if path and os.path.exists(os.path.join(app.static_folder, path)):
            return send_from_directory(app.static_folder, path)
        return send_from_directory(app.static_folder, 'index.html')

    @app.route('/api/config')
    def config():
        return jsonify({'use_llm': USE_LLM})

    @app.route('/api/cities')
    def get_cities():
        try:
            idx = get_index()
            cities = set()
            for row in idx['restaurants']:
                parts = [p.strip() for p in str(row.get('full_address', '')).split(',')]
                if len(parts) >= 4:  # need at least: street, city, state, zip
                    city = parts[-3].strip()
                    state = parts[-2].strip()
                    if city and len(city) > 2 and not city.isdigit() and state:
                        cities.add(f"{city}, {state}")
            return jsonify(sorted(cities))
        except FileNotFoundError as e:
            return jsonify({'error': str(e)}), 503

    @app.route('/api/search')
    def search():
        query = request.args.get('q', '').strip()
        price = request.args.get('price', '').strip()
        limit = min(int(request.args.get('limit', 10)), 25)
        use_svd = request.args.get('svd', '0') == '1'
        city = request.args.get('city', '').strip()
        try:
            user_lat = float(request.args['lat']) if 'lat' in request.args else None
            user_lng = float(request.args['lng']) if 'lng' in request.args else None
            miles = float(request.args['miles']) if 'miles' in request.args else None
        except (ValueError, TypeError):
            user_lat = user_lng = miles = None
        dietary_raw = request.args.get('dietary', '').strip()
        dietary = [d.strip() for d in dietary_raw.split(',') if d.strip()] if dietary_raw else []
        try:
            data = search_restaurants(
                query, price_filter=price, limit=limit, use_svd=use_svd,
                city=city, user_lat=user_lat, user_lng=user_lng, miles=miles,
                dietary=dietary,
            )
            return jsonify(data)
        except FileNotFoundError as e:
            return jsonify({'error': str(e)}), 503

    if USE_LLM:
        from llm_routes import register_rag_route
        register_rag_route(app)
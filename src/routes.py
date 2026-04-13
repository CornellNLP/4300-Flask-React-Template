"""
Routes for Forkcast — natural language restaurant search via TF-IDF.
"""
import os
import math
import pickle
import numpy as np
from flask import send_from_directory, request, jsonify
from sklearn.metrics.pairwise import cosine_similarity

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


# ── Query expansion ───────────────────────────────────────────────────────────
SYNONYMS = {
    'spicy':       ['hot', 'fiery', 'spiced', 'chili', 'pepper', 'jalapeño'],
    'cheap':       ['inexpensive', 'affordable', 'budget', 'value', '$'],
    'healthy':     ['fresh', 'organic', 'salad', 'vegetarian', 'vegan', 'nutritious', 'light', 'greens'],
    'burger':      ['burgers', 'cheeseburger', 'hamburger'],
    'pizza':       ['pizzas', 'pie', 'flatbread', 'italian'],
    'sushi':       ['japanese', 'roll', 'maki', 'sashimi', 'nigiri'],
    'vegetarian':  ['vegan', 'plant-based', 'meatless', 'veggie'],
    'vegan':       ['plant-based', 'vegetarian', 'meatless', 'dairy-free'],
    'noodles':     ['pasta', 'ramen', 'pho', 'udon', 'lo mein', 'spaghetti'],
    'breakfast':   ['brunch', 'morning', 'eggs', 'pancakes', 'waffles', 'omelette'],
    'dessert':     ['sweet', 'cake', 'ice cream', 'cookie', 'pastry', 'chocolate'],
    'seafood':     ['fish', 'shrimp', 'lobster', 'crab', 'salmon', 'tuna'],
    'mexican':     ['tacos', 'burritos', 'enchiladas', 'quesadilla', 'salsa'],
    'chinese':     ['fried rice', 'dumplings', 'dim sum', 'noodles', 'stir fry'],
    'indian':      ['curry', 'masala', 'biryani', 'naan', 'tikka'],
    'thai':        ['pad thai', 'curry', 'basil', 'lemongrass', 'coconut'],
    'bbq':         ['barbecue', 'grilled', 'smoked', 'ribs', 'brisket'],
    'sandwich':    ['sub', 'hoagie', 'wrap', 'panini', 'hero'],
    'salad':       ['greens', 'bowl', 'healthy', 'fresh', 'lettuce'],
    'wings':       ['chicken wings', 'buffalo', 'hot wings'],

    # ── Cuisines ──────────────────────────────────────────────────────────────
    'korean':        ['bibimbap', 'bulgogi', 'kimchi', 'japchae', 'galbi', 'tteokbokki'],
    'mediterranean': ['hummus', 'falafel', 'gyro', 'tzatziki', 'shawarma', 'pita', 'kebab', 'baba ganoush'],
    'vietnamese':    ['pho', 'banh mi', 'spring rolls', 'vermicelli', 'lemongrass'],
    'greek':         ['gyro', 'souvlaki', 'feta', 'spanakopita', 'moussaka', 'baklava'],
    'french':        ['crepe', 'croissant', 'baguette', 'coq au vin', 'bouillabaisse', 'soufflé'],
    'japanese':      ['ramen', 'tempura', 'teriyaki', 'miso', 'yakitori', 'tonkatsu', 'gyoza'],
    'caribbean':     ['jerk chicken', 'plantains', 'oxtail', 'roti'],
    'southern':      ['fried chicken', 'biscuits', 'gravy', 'grits', 'collard greens', 'hush puppies'],
    'american':      ['burger', 'mac and cheese', 'hot dog', 'apple pie', 'fries'],
    'ethiopian':     ['injera', 'berbere', 'doro wat', 'tibs'],

    # ── Dishes ────────────────────────────────────────────────────────────────
    'steak':         ['ribeye', 'sirloin', 'filet mignon', 't-bone', 'tenderloin', 'porterhouse', 'beef'],
    'chicken':       ['poultry', 'breast', 'thigh', 'rotisserie', 'grilled chicken'],
    'soup':          ['broth', 'chowder', 'bisque', 'stew', 'minestrone', 'tom yum'],
    'poke':          ['ahi', 'hawaiian', 'tuna', 'salmon', 'poke bowl'],
    'tacos':         ['street tacos', 'carne asada', 'al pastor', 'fish taco'],
    'bowl':          ['grain bowl', 'rice bowl', 'burrito bowl', 'bibimbap', 'donburi', 'poke bowl'],
    'pasta':         ['spaghetti', 'fettuccine', 'penne', 'linguine', 'carbonara', 'bolognese', 'alfredo'],

    # ── Preparations ──────────────────────────────────────────────────────────
    'grilled':       ['chargrilled', 'flame-broiled', 'wood-fired', 'barbecue'],
    'fried':         ['deep fried', 'crispy', 'golden', 'battered', 'tempura', 'pan fried'],
    'smoked':        ['slow-smoked', 'hickory', 'mesquite', 'wood smoked'],
    'roasted':       ['slow-roasted', 'oven-roasted', 'rotisserie', 'wood-fired'],
    'fresh':         ['seasonal', 'farm-to-table', 'locally sourced', 'house-made'],

    # ── Ingredients ───────────────────────────────────────────────────────────
    'avocado':       ['guacamole', 'avo', 'avocado toast'],
    'truffle':       ['truffle oil', 'black truffle', 'fungi'],
    'cheese':        ['cheddar', 'mozzarella', 'parmesan', 'gouda', 'brie', 'feta', 'goat cheese'],
    'mushroom':      ['portabella', 'shiitake', 'truffle', 'cremini'],
    'bacon':         ['pork belly', 'pancetta', 'crispy bacon'],
    'tofu':          ['silken', 'firm tofu', 'fried tofu', 'bean curd'],
}


def expand_query(query: str) -> str:
    tokens = query.lower().split()
    expanded = list(tokens)
    for token in tokens:
        if token in SYNONYMS:
            expanded.extend(SYNONYMS[token])
    return ' '.join(expanded)

# ── Price-intent scoring ──────────────────────────────────────────────────────

_PRICE_CHEAP_WORDS  = {'cheap', 'inexpensive', 'affordable', 'budget'}
_PRICE_PRICEY_WORDS = {'expensive', 'upscale', 'fancy', 'fine dining', 'pricey', 'high-end'}
_PRICE_RANK = {'$': 1, '$$': 2, '$$$': 3, '$$$$': 4}

def _price_intent_boost(query_tokens: set, price_range: str) -> float:
    """Return a multiplier that boosts restaurants matching the price intent in the query."""
    rank = _PRICE_RANK.get(str(price_range).strip(), 2)
    if query_tokens & _PRICE_CHEAP_WORDS:
        return [1.4, 1.0, 0.65, 0.45][rank - 1]
    if query_tokens & _PRICE_PRICEY_WORDS:
        return [0.5, 0.85, 1.1, 1.35][rank - 1]
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
                        max_items: int = 3) -> list:
    """Return up to max_items menu items relevant to the query.

    Scoring:
      +10 per full-phrase match (e.g. 'ice cream' found verbatim)
      + 1 per individual query word match
    Only items with score > 0 are returned.
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
        text = f"{item['name']} {item['description']}".lower()
        score = sum(10 for p in phrases if p in text)
        score += sum(1 for w in query_words if w in text)
        if score > 0:
            scored.append((score, item))
    scored.sort(key=lambda x: x[0], reverse=True)
    return [item for _, item in scored[:max_items]]

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

    expanded = expand_query(query)
    query_vec = idx['vectorizer'].transform([expanded])
    concepts = get_svd_explanation(idx, query_vec) if use_svd else []

    # Pre-filters (location AND dietary — intersection)
    loc_indices = _location_filter(idx['restaurants'], city, user_lat, user_lng, miles)
    diet_indices = _dietary_filter(idx, dietary or [])
    filtered_indices = np.intersect1d(loc_indices, diet_indices)
    if len(filtered_indices) == 0:
        return {'results': [], 'meta': {'mode': mode, 'concepts': concepts}}

    # Similarity against the filtered subset
    if use_svd:
        query_transformed = idx['svd_model'].transform(query_vec)
        local_scores = cosine_similarity(query_transformed, idx['tfidf_svd_matrix'][filtered_indices]).flatten()
    else:
        local_scores = cosine_similarity(query_vec, idx['tfidf_matrix'][filtered_indices]).flatten()

    # ── Step 1: take top-K candidates from TF-IDF/SVD ────────────────────────
    CANDIDATE_K = min(len(filtered_indices), max(limit * 6, 60))
    top_local = local_scores.argsort()[::-1][:CANDIDATE_K]
    candidate_global = filtered_indices[top_local]
    candidate_scores = local_scores[top_local]

    # Drop candidates below minimum relevance threshold
    valid = candidate_scores >= 0.01
    candidate_global = candidate_global[valid]
    candidate_scores = candidate_scores[valid]

    if len(candidate_global) == 0:
        return {'results': [], 'meta': {'mode': mode, 'concepts': concepts}}

    # ── Step 2: rerank by item match + price intent ───────────────────────────
    query_words  = set(expanded.lower().split())   # expanded for item matching
    query_tokens = set(query.lower().split())       # original for price intent

    use_geo = user_lat is not None and user_lng is not None and miles is not None

    candidates = []
    for global_i, tfidf_score in zip(candidate_global, candidate_scores):
        row = idx['restaurants'][global_i]
        rid = str(int(float(str(row['id'])))) if str(row['id']).replace('.', '', 1).isdigit() else str(row['id'])
        all_items = idx['menu_data'].get(rid, [])

        item_s = _best_item_score(all_items, query_words)
        pb     = _price_intent_boost(query_tokens, row.get('price_range', ''))
        # Combined: price intent multiplies; item match adds a bonus
        combined = tfidf_score * pb * (1.0 + 0.5 * item_s)

        dist = None
        if use_geo:
            try:
                rlat, rlng = float(row.get('lat')), float(row.get('lng'))
                if not math.isnan(rlat) and not math.isnan(rlng):
                    dist = round(haversine_miles(user_lat, user_lng, rlat, rlng), 1)
            except (TypeError, ValueError):
                pass

        candidates.append((combined, tfidf_score, row, rid, all_items, dist))

    candidates.sort(key=lambda x: x[0], reverse=True)

    # ── Step 3: build final results (apply price hard-filter) ─────────────────
    results = []
    for combined, tfidf_score, row, rid, all_items, dist in candidates:
        if len(results) >= limit:
            break
        if price_filter and str(row.get('price_range', '')).strip() != price_filter:
            continue

        matched = find_matching_items(all_items, query_words, original_query=query)
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
            'popular_dish':  all_items[0] if not matched and all_items else None,
        }
        if dist is not None:
            result['distance_miles'] = dist

        results.append(result)

    return {'results': results, 'meta': {'mode': mode, 'concepts': concepts}}


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
        return jsonify({'use_llm': False})

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

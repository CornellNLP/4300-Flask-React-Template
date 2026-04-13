"""
preprocess.py — Run once to build the TF-IDF index from the Uber Eats dataset.

Usage:
    python src/preprocess.py

Outputs:
    data/forkcast_index.pkl  — vectorizer + TF-IDF matrix + restaurant/menu data
"""

import os
import pickle
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.decomposition import TruncatedSVD

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'data')
RESTAURANT_CSV = os.path.join(DATA_DIR, 'restaurants.csv')
MENUS_FULL_CSV = os.path.join(DATA_DIR, 'restaurant-menus.csv')
MENUS_SAMPLE_CSV = os.path.join(DATA_DIR, 'restaurant-menus-sample.csv')
OUTPUT_PATH = os.path.join(DATA_DIR, 'forkcast_index.pkl')

SAMPLE_SIZE = 5000
MAX_MENU_ITEMS_PER_RESTAURANT = 50  # stored; only 3 shown in UI

DIETARY_KEYWORDS = {
    'vegan':       ['vegan', 'plant-based', 'plant based', 'dairy-free', 'dairy free'],
    'vegetarian':  ['vegetarian', 'veggie', 'meatless', 'no meat'],
    'gluten-free': ['gluten-free', 'gluten free', 'celiac'],
    'dairy-free': ['dairy-free', 'dairy free', 'lactose-free', 'lactose free'],
    'halal':       ['halal'],
    'kosher':      ['kosher'],
    'paleo':       ['paleo'],
    'keto':        ['keto', 'ketogenic', 'low-carb', 'low carb'],
    'pescatarian': ['pescatarian'],
}


def build_index(use_sample_menus=False):
    print("Loading restaurants...")
    restaurants = pd.read_csv(RESTAURANT_CSV)
    restaurants['id'] = pd.to_numeric(restaurants['id'], errors='coerce').astype('Int64').astype(str)
    restaurants['name'] = restaurants['name'].fillna('')
    restaurants['category'] = restaurants['category'].fillna('')
    restaurants['price_range'] = restaurants['price_range'].fillna('')
    restaurants['full_address'] = restaurants['full_address'].fillna('')
    restaurants['score'] = pd.to_numeric(restaurants['score'], errors='coerce').fillna(0.0)
    restaurants['ratings'] = restaurants['ratings'].fillna('').astype(str)
    restaurants['lat'] = pd.to_numeric(restaurants['lat'], errors='coerce')
    restaurants['lng'] = pd.to_numeric(restaurants['lng'], errors='coerce')

    if len(restaurants) > SAMPLE_SIZE:
        restaurants = restaurants.sample(SAMPLE_SIZE, random_state=42).reset_index(drop=True)
        print(f"Sampled {SAMPLE_SIZE} restaurants from full dataset.")

    restaurant_ids = set(restaurants['id'])

    # Choose menus file
    menus_file = MENUS_SAMPLE_CSV if use_sample_menus else MENUS_FULL_CSV
    if not os.path.exists(menus_file):
        menus_file = MENUS_SAMPLE_CSV
        print(f"Full menus file not found, falling back to sample: {menus_file}")

    print(f"Loading menus from {os.path.basename(menus_file)}...")
    chunks = []
    for chunk in pd.read_csv(menus_file, chunksize=100_000, low_memory=False):
        chunk['restaurant_id'] = pd.to_numeric(chunk['restaurant_id'], errors='coerce').astype('Int64').astype(str)
        filtered = chunk[chunk['restaurant_id'].isin(restaurant_ids)]
        if not filtered.empty:
            chunks.append(filtered)

    if chunks:
        menus = pd.concat(chunks, ignore_index=True)
        menus['name'] = menus['name'].fillna('')
        menus['description'] = menus['description'].fillna('')
        menus['price'] = menus['price'].fillna('').astype(str)
        print(f"Loaded {len(menus):,} menu items for {menus['restaurant_id'].nunique()} restaurants.")
    else:
        menus = pd.DataFrame(columns=['restaurant_id', 'category', 'name', 'description', 'price'])
        print("Warning: no matching menu items found.")

    # Group menus by restaurant for fast lookup
    menus_by_restaurant = {
        rid: group for rid, group in menus.groupby('restaurant_id')
    }

    print("Building composite documents and dietary tags...")
    docs = []
    menu_data = {}
    dietary_tags = []  # one set per restaurant (indexed by position)

    for _, row in restaurants.iterrows():
        rid = row['id']
        rest_menus = menus_by_restaurant.get(rid, pd.DataFrame())

        parts = [row['name'], row['category'], row['price_range']]

        # Seed tags from restaurant name + category
        tags: set = set()
        base_text = f"{row['name']} {row['category']}".lower()
        for tag, keywords in DIETARY_KEYWORDS.items():
            if any(kw in base_text for kw in keywords):
                tags.add(tag)

        items_for_display = []
        for i, (_, item) in enumerate(rest_menus.iterrows()):
            parts.append(item['name'])
            if item['description'].strip():
                parts.append(item['description'])
            if i < MAX_MENU_ITEMS_PER_RESTAURANT:
                items_for_display.append({
                    'name': item['name'],
                    'description': item['description'],
                    'price': item['price'],
                })
            # Scan ALL menu items for dietary keywords (not capped at MAX)
            item_text = f"{item['name']} {item['description']}".lower()
            for tag, keywords in DIETARY_KEYWORDS.items():
                if tag not in tags and any(kw in item_text for kw in keywords):
                    tags.add(tag)

        dietary_tags.append(tags)
        docs.append(' '.join(p for p in parts if p))
        menu_data[rid] = items_for_display

    tagged = sum(1 for t in dietary_tags if t)
    print(f"Dietary tags built: {tagged}/{len(dietary_tags)} restaurants tagged.")

    print("Fitting TF-IDF vectorizer...")
    vectorizer = TfidfVectorizer(
        stop_words='english',
        ngram_range=(1, 2),
        max_features=60_000,
        min_df=1,
        sublinear_tf=True,
    )
    tfidf_matrix = vectorizer.fit_transform(docs)
    print(f"TF-IDF matrix shape: {tfidf_matrix.shape}")

    SVD_COMPONENTS = 100
    print(f"Computing SVD ({SVD_COMPONENTS} components)...")
    svd = TruncatedSVD(n_components=SVD_COMPONENTS, random_state=42)
    tfidf_svd_matrix = svd.fit_transform(tfidf_matrix)
    print(f"SVD explained variance: {svd.explained_variance_ratio_.sum():.1%}")

    index = {
        'restaurants': restaurants.to_dict('records'),
        'menu_data': menu_data,
        'dietary_tags': dietary_tags,
        'vectorizer': vectorizer,
        'tfidf_matrix': tfidf_matrix,
        'svd_model': svd,
        'tfidf_svd_matrix': tfidf_svd_matrix,
        'feature_names': vectorizer.get_feature_names_out().tolist(),
    }

    with open(OUTPUT_PATH, 'wb') as f:
        pickle.dump(index, f, protocol=4)

    print(f"Index saved to {OUTPUT_PATH}")
    return index


if __name__ == '__main__':
    import sys
    use_sample = '--sample' in sys.argv
    build_index(use_sample_menus=use_sample)

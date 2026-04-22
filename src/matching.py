from sklearn.decomposition import TruncatedSVD
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.preprocessing import normalize
from scipy.sparse.linalg import svds
from sklearn.feature_extraction.text import ENGLISH_STOP_WORDS
import numpy as np
import re


DIM_NAMES = {
    0:  "Roasted Poultry",
    1:  "Bell Peppers & Spanish",
    2:  "Pumpkin & Squash",
    3:  "Quick Cafe Meals",
    4:  "Enchiladas & Tex-Mex",
    5:  "Citrus & Lemonade",
    6:  "Fall & Thanksgiving",
    7:  "Breakfast & Brunch",
    8:  "Delicate Bites",
    9:  "Holiday & Cranberry",
    10: "Gluten-Free & Dietary",
    11: "Grandma's Comfort Food",
    12: "French & Spanish Flavors",
    13: "Ricotta & Topped Dishes",
    14: "Crab & Stone Fruit",
    15: "Pancakes & Waffles",
    16: "Eggs & Moroccan Brunch",
    17: "Middle Eastern & Yogurt",
    18: "Cocktails & Louisiana",
    19: "Grilled Steaks & BBQ",
    20: "Slow Cooker & Crockpot",
    21: "Creamy Desserts & Ice Cream",
    22: "Asian & Soy",
    23: "Goat Cheese & Salads",
    24: "Chocolate & Fudge",
    25: "Emotional Playlist Vibes",
    26: "Budget & Beginner",
    27: "Fish & Breadcrumbs",
    28: "Potatoes & Yams",
    29: "Grilling & Marinades",
    30: "Pudding & Mousse",
    31: "Chilled Cocktails",
    32: "Fruit Breads & Caribbean",
    33: "Pasta & Grains",
    34: "Cheese & Mac",
    35: "Beef & Burgers",
    36: "Playlist Emotions",
    37: "Healthy & Low Calorie",
    38: "Playlist Lyrics",
    39: "Quick Main Courses",
}

# Builds a TF-IDF index for recipes or playlists
def build_tfidf_index(data, data_set_category):
    if data_set_category == "recipe":
        corpus = [
        f"{d.name} {d.description} {d.tags} {d.ingredients}"
        for d in data
        ]
        min_df = 10 if len(corpus) >= 10 else 1
        vectorizer = TfidfVectorizer(
            max_features=5000, stop_words='english', max_df=0.8, min_df=min_df, norm='l2')
        if len(corpus) == 0:
            return None, None
        doc_by_vocab = vectorizer.fit_transform(corpus)
        return vectorizer, doc_by_vocab

    elif data_set_category == "playlist":
        name_corpus = [d.name for d in data]
        song_corpus = [d.songs for d in data]

        name_vectorizer = TfidfVectorizer(
            max_features=5000, stop_words='english', max_df=0.8, min_df=2, norm='l2')
        song_vectorizer = TfidfVectorizer(
            max_features=5000, stop_words='english', max_df=0.8, min_df=10, norm='l2')

        name_vecs = name_vectorizer.fit_transform(name_corpus)
        song_vecs = song_vectorizer.fit_transform(song_corpus)
        return (name_vectorizer, song_vectorizer), (name_vecs, song_vecs)

# Computes cosine-similarities between recipes and query vector
def query_data(query, data, data_set_category, vectorizer, doc_by_vocab, name_weight):
    matches = []
    if data_set_category == "recipe":
        query_vec = vectorizer.transform([query])
        scores = cosine_similarity(query_vec, doc_by_vocab).flatten()
        for i, score in enumerate(scores):
            link_suffix = data[i].name.lower().replace(' ', '-') + '-' + str(data[i].site_id)
            reconstructed_link = "https://www.food.com/recipe/" + link_suffix
            matches.append(({
                'name': data[i].name,
                'description': data[i].description,
                'minutes': data[i].minutes,
                'ingredients': data[i].ingredients,
                'link': reconstructed_link,
            }, float(score)))

    elif data_set_category == "playlist":
        name_vectorizer, song_vectorizer = vectorizer
        name_vecs, song_vecs = doc_by_vocab

        name_query = name_vectorizer.transform([query])
        song_query = song_vectorizer.transform([query])

        name_scores = cosine_similarity(name_query, name_vecs).flatten()
        song_scores = cosine_similarity(song_query, song_vecs).flatten()

        scores = name_weight * name_scores + (1 - name_weight) * song_scores

        for i, score in enumerate(scores):
            matches.append(({
                'name': data[i].name,
                'songs': data[i].songs,
                'artist': data[i].artists,
            }, float(score)))

    matches.sort(key=lambda x: x[1], reverse=True)
    list_desc = [x[0] for x in matches]
    return list_desc
def build_svd_index(data, playlists=None, k=40):
    """
    Build a Truncated SVD index for recipes.
    Playlists are optional — if provided, vocabulary is fit on recipes + playlist enriched_text
    Returns: vectorizer, docs_normed, words_normed, singular_values, index_to_word
    """
    recipe_corpus = [
        f"{d.name} {d.description} {d.tags} {d.ingredients}"
        for d in data
    ]
    if len(recipe_corpus) == 0:
        return None, None, None, None, None

    # fit vocabulary on combined corpus so playlist words aren't out-of-vocabulary
    if playlists:
        playlist_corpus = [p.enriched_text or "" for p in playlists]
        combined_corpus = recipe_corpus + playlist_corpus
    else:
        combined_corpus = recipe_corpus

    min_df = 10 if len(recipe_corpus) >= 10 else 1
    vectorizer = TfidfVectorizer(
        max_features=5000, stop_words='english', max_df=0.8, min_df=min_df, norm='l2'
    )

    td_matrix = vectorizer.fit_transform(combined_corpus)
 
    actual_k = min(k, min(td_matrix.shape) - 1)
    if actual_k < 1:
        return vectorizer, None, None, None, None
 
    docs_compressed, s, words_compressed_T = svds(td_matrix, k=actual_k)
    words_compressed = words_compressed_T.T  # shape = (vocab_size, k)
    
    docs_normed = normalize(docs_compressed, axis=1)
    words_normed = normalize(words_compressed, axis=1)
 
    index_to_word = {i: t for t, i in vectorizer.vocabulary_.items()}
 
    return vectorizer, docs_normed, words_normed, s, index_to_word

# for a given vector and a list of dimension indices, what does each dimension mean in plain English
def _dim_info(vec, dim_indices, words_normed, index_to_word, top_keywords):
    """Build dimension info objects for a list of dimension indices."""
    info = []
    for dim in dim_indices:
        if dim >= words_normed.shape[1]:
            continue
        dim_col = words_normed[:, dim]
        top_word_idx = np.argsort(-dim_col)[:top_keywords]
        keywords = [index_to_word[i] for i in top_word_idx if i in index_to_word]
        info.append({
            "dim": int(dim),
            "name": DIM_NAMES.get(int(dim), " / ".join(keywords[:3])),
            "magnitude": round(float(vec[dim]), 4),
            "keywords": keywords,
        })
    return info

def query_svd_recipes(query, data, vectorizer, docs_normed, words_normed, index_to_word,
              top_n=5, top_dims=3, top_keywords=6):
    """
    Query the SVD latent space and return results with explanation about why these were matched, including:
      - similarity score
      - top latent dimensions for query and doc
      - shared dimensions (the conceptual overlap)
      - top keywords per dimension
      - magnitude vectors for sparkline charts
    """
    if docs_normed is None or words_normed is None:
        return []
 
    query_tfidf = vectorizer.transform([query]).toarray()
    # because words_normed maps from word-space to latent-space, multiplying it by query_tfidf => 40-dimensional query vector in the same latent space as the recipes
    raw = query_tfidf.dot(words_normed)
 
    if raw.shape[0] == 0 or np.linalg.norm(raw) == 0:
        return []
 
    query_vec = normalize(raw).squeeze()
    if query_vec.ndim == 0:
        query_vec = np.array([float(query_vec)])
 
    # gives a similarity score for every recipe
    sims = docs_normed.dot(query_vec)
    top_indices = np.argsort(-sims)[:top_n]
 
    # get top latent dimensions for query
    query_top_dim_idx = np.argsort(np.abs(query_vec))[::-1][:top_dims].tolist()
    # get dimensrion info from indices
    query_dim_info = _dim_info(query_vec, query_top_dim_idx, words_normed, index_to_word, top_keywords)
 
    results = []
    for idx in top_indices:
        recipe = data[idx]
        score = float(sims[idx])
 
        doc_vec = docs_normed[idx]
        doc_top_dim_idx = np.argsort(np.abs(doc_vec))[::-1][:top_dims].tolist()
 
        # shared_dim_idx = list(set(query_top_dim_idx) & set(doc_top_dim_idx))
        joint_contribution = np.abs(query_vec) * np.abs(doc_vec)
        shared_dim_idx = np.argsort(-joint_contribution)[:top_dims].tolist()
        shared_dim_info = _dim_info(doc_vec, shared_dim_idx, words_normed, index_to_word, top_keywords)
 
        # Surface query words that actually appear in the recipe
        # recipe_text = f"{recipe.name} {recipe.description} {recipe.tags} {recipe.ingredients}".lower()
        recipe_text = re.sub(r"['\[\],]", " ",
            f"{recipe.name} {recipe.description} {recipe.tags} {recipe.ingredients}"
        ).lower()
        
        RECIPE_STOPWORDS = {"serve", "make", "add", "cook", "use", "place", "put", "mix", "combine", "using", "made", "party"}
        
        query_words = [
            w.lower() for w in query.split() 
            if len(w) > 2 
            and w.lower() not in ENGLISH_STOP_WORDS 
            and w.lower() not in RECIPE_STOPWORDS
        ]
        highlighted_keywords = list(dict.fromkeys(
            w for w in query_words if w in recipe_text
        ))
 
        link_suffix = recipe.name.lower().replace(' ', '-') + '-' + str(recipe.site_id)
        reconstructed_link = "https://www.food.com/recipe/" + link_suffix
 
        results.append({
            'name': recipe.name,
            'description': recipe.description,
            'minutes': recipe.minutes,
            'ingredients': recipe.ingredients,
            'link': reconstructed_link,
            'similarity': round(score, 4),
            'query_dims': query_dim_info,
            'doc_dims': _dim_info(doc_vec, doc_top_dim_idx, words_normed, index_to_word, top_keywords),
            'shared_dims': shared_dim_info,
            'highlighted_keywords': highlighted_keywords,
            'doc_magnitudes': doc_vec.tolist(),
            'query_magnitudes': query_vec.tolist(),
        })
 
    return results

def query_svd_playlists(query, playlists, vectorizer, words_normed, top_n=3, name_weight=0.4):
    """
    Query the SVD recupe latent space and return results with playlist name weighted higher
    """
    if words_normed is None:
        return []

    # project query into recipe latent space
    query_tfidf = vectorizer.transform([query]).toarray()
    raw = query_tfidf.dot(words_normed)
    if raw.shape[0] == 0 or np.linalg.norm(raw) == 0:
        return []
    query_vec = normalize(raw).squeeze()

    # project each playlist's enriched_text into the same latent space
    playlist_corpus = [p.enriched_text or "" for p in playlists]
    playlist_tfidf = vectorizer.transform(playlist_corpus).toarray()
    docs_normed = normalize(playlist_tfidf.dot(words_normed))

    # svd cosine similarity in latent space
    svd_sims = docs_normed.dot(query_vec)

    # use existing playlist TF-IDF index for name scoring
    (name_vectorizer, _), (name_vecs, _) = build_tfidf_index(playlists, "playlist")
    name_query_vec = name_vectorizer.transform([query])
    name_sims = cosine_similarity(name_query_vec, name_vecs).flatten()

    # blend ame_weight on names, with the rest on SVD
    sims = name_weight * name_sims + (1 - name_weight) * svd_sims
    top_indices = np.argsort(-sims)[:top_n]

    return [{
        'name': playlists[i].name,
        'songs': playlists[i].songs,
        'artist': playlists[i].artists,
    } for i in top_indices]
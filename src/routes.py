"""
Routes: React app serving and episode search API.

To enable AI chat, set USE_LLM = True below. See llm_routes.py for AI code.
"""
import os
import numpy as np
from flask import send_from_directory, request, jsonify
from models import db, Song
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.decomposition import TruncatedSVD
from sklearn.preprocessing import normalize

# ── AI toggle ────────────────────────────────────────────────────────────────
USE_LLM = False
# USE_LLM = True
# ─────────────────────────────────────────────────────────────────────────────

vectorizer = None
song_vectors = None
songs_data = None

svd_model = None
lyrics_latent = None

# Number of latent dimensions (tune between 50-200)
N_COMPONENTS = 50 

# Blend weight: 0 = pure cosine, 1 = pure SVD
ALPHA = 0.5        

def build_search_index():
    global vectorizer, song_vectors, songs_data, svd_model, lyrics_latent

    songs_data = db.session.query(Song).all()

    all_text = []
    for song in songs_data:
        if isinstance(song.lyrics, list):
            text = " ".join(song.lyrics)
        else:
            text = song.lyrics or ""
        all_text.append(text)

    # Cosine similarity TF-IDF
    custom_stopwords = list(TfidfVectorizer(stop_words='english').get_stop_words()) + [
        'da', 'na', 'la', 'oh', 'ah', 'ooh', 'uh', 'yeah', 'hey', 'gonna',
        'wanna', 'gotta', 'ain', 'don', 'cause', 'em', 'til', 'ya', 'yo',
        'duh', 'ha', 'hm', 'mm', 'wa', 'ba', 'sha', 'ra', 'ta', 'pa', 'eh', 'oooh'
    ]
    vectorizer = TfidfVectorizer(stop_words=custom_stopwords)
    song_vectors = vectorizer.fit_transform(all_text)

    # SVD
    n_components = min(N_COMPONENTS, len(all_text) - 1) 
    svd_model = TruncatedSVD(n_components=n_components, random_state=42)
    lyrics_latent = svd_model.fit_transform(song_vectors)
    lyrics_latent = normalize(lyrics_latent)

    print(f"Search index built: {len(all_text)} songs, {n_components} SVD dimensions")

def svd_search(user_input):
    """Project query into SVD latent space and compute cosine similarity."""
    global vectorizer, svd_model, lyrics_latent

    query_tfidf = vectorizer.transform([user_input])       # sparse TF-IDF vector
    query_latent = svd_model.transform(query_tfidf)        # project into latent space
    query_latent = normalize(query_latent)                 # L2 normalize

    scores = lyrics_latent @ query_latent.T                # cosine sim in latent space
    return scores.flatten()

def explain_svd(user_input, n_topics=3):
    """Return top latent mood dimensions the query activates, with representative words."""
    global vectorizer, svd_model

    query_tfidf = vectorizer.transform([user_input])
    query_latent = svd_model.transform(query_tfidf).flatten()

    top_dims = np.argsort(np.abs(query_latent))[::-1][:n_topics]
    explanations = []
    for dim in top_dims:
        top_word_indices = np.argsort(svd_model.components_[dim])[::-1][:5]
        top_words = [vectorizer.get_feature_names_out()[i] for i in top_word_indices]
        explanations.append({
            "dimension": int(dim),
            "strength": round(float(query_latent[dim]), 4),
            "mood_words": top_words   # e.g. ["love", "heart", "feel", "miss", "cry"]
        })
    return explanations

def recommend_by_lyrics(user_input, top_n=5, instrument="guitar", difficulty="all"):
    global vectorizer, song_vectors, songs_data

    # Cosine similarity score
    user_vector = vectorizer.transform([user_input])
    cosine_scores = cosine_similarity(user_vector, song_vectors).flatten()

    # SVD score
    svd_scores = svd_search(user_input)

    # Combined score = ALPHA * svd + (1 - ALPHA) * cosine
    combined_scores = ALPHA * svd_scores + (1 - ALPHA) * cosine_scores

    if difficulty == "all":
        indices = np.argsort(combined_scores)[::-1][:top_n]
    else:
        temp = np.argsort(combined_scores)[::-1]
        indices = []
        i = 0;
        if difficulty == "easy":
            low = 1
            high = 4
        elif difficulty == "medium":
            low = 4.01
            high = 7
        else:
            low = 7.01
            high = 10
            
        while len(indices) < top_n and i < len(temp):
            song = songs_data[temp[i]]
            if instrument == "guitar":
                if song.guitar_difficulty >= low and song.guitar_difficulty <= high:
                    indices.append(temp[i])
            else:
                if song.piano_difficulty >= low and song.piano_difficulty <= high:
                    indices.append(temp[i])
            i += 1


    results = []
    for idx in indices:
        results.append([
            songs_data[int(idx)],
            float(combined_scores[int(idx)]) * 100,
            float(cosine_scores[int(idx)]) * 100,
            float(svd_scores[int(idx)]) * 100
        ])
    return results

def json_search(query, top_n=5, instrument="guitar", difficulty="all"):
    if not query or not query.strip():
        query = "Love"

    results = recommend_by_lyrics(query, top_n, instrument, difficulty)

    # Get query's latent vector once
    query_tfidf = vectorizer.transform([query])
    query_latent = svd_model.transform(query_tfidf).flatten()

    matches = []
    for song in results:
        song_idx = songs_data.index(song[0])
        song_latent = lyrics_latent[song_idx]  # this specific song's latent vector

        # Element-wise product: high where BOTH query and song activate the same dimension
        combined_activation = query_latent * song_latent
        top_dims = np.argsort(np.abs(combined_activation))[::-1][:3]

        per_song_explanation = []
        for dim in top_dims:
            top_word_indices = np.argsort(svd_model.components_[dim])[::-1][:5]
            top_words = [vectorizer.get_feature_names_out()[i] for i in top_word_indices]
            per_song_explanation.append({
                "dimension": int(dim),
                "strength": round(float(combined_activation[dim]), 4),
                "mood_words": top_words
            })

        if instrument == "guitar":
            diff = song[0].guitar_difficulty
        else:
            diff = song[0].piano_difficulty

        matches.append({
            'title': song[0].title,
            'artist': song[0].artist,
            'similarity': round(song[1], 2),
            'cosine_score': round(song[2], 2),
            'svd_score': round(song[3], 2),
            'chords': song[0].chords,
            'difficulty': diff,
            'svd_explanation': per_song_explanation  # unique per song now
        })

    return {'results': matches}

def register_routes(app):
    with app.app_context():
        build_search_index()
    @app.route('/', defaults={'path': ''})
    @app.route('/<path:path>')
    def serve(path):
        if path != "" and os.path.exists(os.path.join(app.static_folder, path)):
            return send_from_directory(app.static_folder, path)
        else:
            return send_from_directory(app.static_folder, 'index.html')

    @app.route("/api/config")
    def config():
        return jsonify({"use_llm": USE_LLM})

    @app.route("/api/songs")
    def song_search():
        text = request.args.get("title", "")
        
        top_n = request.args.get("topn", 5 ,type=int)
        print(f"Title: {text}")
        print(f"Num results: {top_n}")
        instrument = request.args.get("instrument", "")
        difficulty = request.args.get("difficulty", "")
        
        print(f"Instrument: {instrument}")
        print(f"Difficulty: {difficulty}")
        return jsonify(json_search(text, top_n, instrument, difficulty))

    if USE_LLM:
        from llm_routes import register_chat_route
        register_chat_route(app, json_search)

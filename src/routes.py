"""
Routes: React app serving and episode search API.

To enable AI chat, set USE_LLM = True below. See llm_routes.py for AI code.
"""
import os
from flask import send_from_directory, request, jsonify
from models import db, Song
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

# ── AI toggle ────────────────────────────────────────────────────────────────
USE_LLM = False
# USE_LLM = True
# ─────────────────────────────────────────────────────────────────────────────

vectorizer = None
song_vectors = None
songs_data = None

def build_search_index():
    global vectorizer, song_vectors, songs_data

    songs_data = db.session.query(Song).all()

    all_text = []
    for song in songs_data:
        if isinstance(song.lyrics, list):
            text = " ".join(song.lyrics)
        else:
            text = song.lyrics or ""
        all_text.append(text)

    vectorizer = TfidfVectorizer(stop_words='english')
    song_vectors = vectorizer.fit_transform(all_text)

def recommend_by_lyrics(user_input, top_n=5):
    global vectorizer, song_vectors, songs_data

    user_vector = vectorizer.transform([user_input])
    similarities = cosine_similarity(user_vector, song_vectors).flatten()

    indices = sorted(range(len(similarities)), key=lambda k: similarities[k], reverse=True)[:top_n]

    results = []
    for idx in indices:
        results.append([songs_data[idx], similarities[idx] * 100])

    return results

def json_search(query):
    if not query or not query.strip():
        query = "Love"

    results = recommend_by_lyrics(query)

    matches = []
    for song in results:
        matches.append({
            'title': song[0].title,
            'artist': song[0].artist,
            'similarity': (round(song[1], 2)),
            'chords': song[0].chords,
            'guitar_difficulty': song[0].guitar_difficulty,
            'piano_difficulty': song[0].piano_difficulty
        })

    return matches

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

    @app.route("/api/episodes")
    def episodes_search():
        text = request.args.get("title", "")
        return jsonify(json_search(text))

    if USE_LLM:
        from llm_routes import register_chat_route
        register_chat_route(app, json_search)

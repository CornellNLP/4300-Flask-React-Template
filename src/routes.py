"""
Routes: React app serving and episode search API.

To enable AI chat, set USE_LLM = True below. See llm_routes.py for AI code.
"""
import json
import os
from flask import send_from_directory, request, jsonify
from models import db, Recipe, Playlist
import matching
# ── AI toggle ────────────────────────────────────────────────────────────────
USE_LLM = False
# USE_LLM = True
# ─────────────────────────────────────────────────────────────────────────────

def json_search(query):
    if not query or not query.strip():
        query = "food"
    results = db.session.query(Recipe).filter(
        Recipe.name.ilike(f'%{query}%')
    ).all()
    matches = []
    for recipe in results:
        matches.append({
            'name': recipe.name,
            'description': recipe.description,
            'minutes': recipe.minutes
        })
    return matches

def cosine_search_recipes(query):
    if not query or not query.strip():
        query = "food"
    recipes = db.session.query(Recipe).all()
    vectorizer, doc_by_vocab = matching.build_tfidf_index(recipes, "recipe")
    matches = matching.query_data(query, recipes, "recipe", vectorizer, doc_by_vocab)
    return matches[: 5]

def cosine_search_playlists(query):
    if not query or not query.strip():
        query = "music"
    playlists = db.session.query(Playlist).all()
    vectorizer, doc_by_vocab = matching.build_tfidf_index(playlists, "playlist")
    matches = matching.query_data(query, playlists, "playlist", vectorizer, doc_by_vocab)
    return matches[: 3]

def register_routes(app):
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

    # recipes
    @app.route("/api/recipes")
    def recipes_search():
        text = request.args.get("name", "")
        # return jsonify(json_search(text))
        return jsonify(cosine_search_recipes(text))
    
    #playlists
    @app.route("/api/playlists")
    def playlists_search():
        text = request.args.get("name", "")
        return jsonify(cosine_search_playlists(text))


    if USE_LLM:
        from llm_routes import register_chat_route
        # register_chat_route(app, json_search)
        register_chat_route(app, cosine_search_recipes)
        register_chat_route(app, cosine_search_playlists)

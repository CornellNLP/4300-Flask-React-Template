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

DIETARY_FILTERS = {
    "vegetarian": {
        "include": ["vegetarian"],
        "exclude": ["beef", "chicken", "pork", "fish", "seafood", "bacon", "ham", "meat", "veal", "shrimp", "salmon", "tuna", "turkey", "duck"]
    },
    "vegan": {
        "include": ["vegan"],
        "exclude": ["beef", "chicken", "pork", "fish", "seafood", "bacon", "ham", "meat", "veal", "shrimp", "salmon", "tuna", "turkey", "duck", "cheese", "milk", "eggs"]
    },
    "gluten-free": {
        "include": ["gluten-free"],
    },
    "dairy-free": {
        "include": ["dairy-free"],
        "exclude": ["milk", "cheese"]
    },
    "nut-free": {
        "include": ["nut-free"],
        "exclude": ["nuts"]
    },
}

COURSE_FILTERS = {
  "appetizer": {
    "include": ["appetizers", "side-dishes"]
  },
  "entrée": {
    "include": ["main-dish", "dinner", "lunch"]
  },
  "dessert": {
    "include": ["desserts", "cakes", "brownies", "pies", "ice-cream"]
  },
  "beverage": {
    "include": ["beverages"],
  }
}

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



def filter_recipes(recipes, filters, filter_type):
    if not filters:
        return recipes
    
    filtered = []
    for r in recipes:
        skip = False
        for selected in filters:
            # key = selected.strip().lower().replace("_", "-")
            config = filter_type.get(selected) or {}
            include_tags = config.get("include", [])
            exclude_tags = config.get("exclude", [])

            if include_tags and not any(tag in r.tags for tag in include_tags):
                skip = True
                break

            if exclude_tags and any(tag in r.tags for tag in exclude_tags):
                skip = True
                break

        if skip:
            continue

        filtered.append(r)

    return filtered


def cosine_search_recipes(query, dietary_filters, course_filters):
    if not query or not query.strip():
        query = "food"
    recipes = db.session.query(Recipe).all()
    recipes = filter_recipes(recipes, dietary_filters, DIETARY_FILTERS)
    recipes = filter_recipes(recipes, course_filters, COURSE_FILTERS)
    print(f"Filtered from 2000 to {len(recipes)} recipes based on dietary filters: {dietary_filters} and course filters: {course_filters}")

    vectorizer, doc_by_vocab = matching.build_tfidf_index(recipes, "recipe")
    if vectorizer is None or doc_by_vocab is None:
        return []
    matches = matching.query_data(query, recipes, "recipe", vectorizer, doc_by_vocab, 0.0)
    return matches[: 5]

def cosine_search_playlists(query):
    if not query or not query.strip():
        query = "music"
    playlists = db.session.query(Playlist).all()
    vectorizer, doc_by_vocab = matching.build_tfidf_index(playlists, "playlist")
    matches = matching.query_data(query, playlists, "playlist", vectorizer, doc_by_vocab, 0.7)
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
        dietary = request.args.get("dietary", "").split(",")
        courses = request.args.get("courses", "").split(",")

        return jsonify(cosine_search_recipes(text, dietary, courses))
    
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

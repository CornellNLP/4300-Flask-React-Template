"""
Routes: React app serving and episode search API.

To enable AI chat, set USE_LLM = True below. See llm_routes.py for AI code.
"""
import json
import os
import csv
from flask import send_from_directory, request, jsonify
from models import db, Episode, Review

EXERCISES_CSV = os.path.join(os.path.dirname(__file__), '..', 'data', 'datasets', 'gym_exercises.csv')

def search_exercises(query):
    results = []
    with open(EXERCISES_CSV, newline='', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            if query.lower() in row['Title'].lower() or query.lower() in (row['Desc'] or '').lower():
                results.append({
                    'title': row['Title'],
                    'desc': row['Desc'] or None,
                    'Type': row['Type'] or None,
                    'BodyPart': row['BodyPart'] or None,
                    'Equipment': row['Equipment'] or None,
                    'Level': row['Level'] or None,
                    'Rating': row['Rating'] or None,
                    'RatingDesc': row['RatingDesc'] or None,
                })
            if len(results) >= 5:
                break
    return results

# ── AI toggle ────────────────────────────────────────────────────────────────
USE_LLM = False
# USE_LLM = True
# ─────────────────────────────────────────────────────────────────────────────


def json_search(query):
    if not query or not query.strip():
        query = "Kardashian"
    results = db.session.query(Episode, Review).join(
        Review, Episode.id == Review.id
    ).filter(
        Episode.title.ilike(f'%{query}%')
    ).all()
    matches = []
    for episode, review in results:
        matches.append({
            'title': episode.title,
            'descr': episode.descr,
            'imdb_rating': review.imdb_rating
        })
    return matches


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

    @app.route("/api/episodes")
    def episodes_search():
        text = request.args.get("title", "")
        return jsonify(json_search(text))

    @app.route("/api/exercises")
    def exercises_search():
        query = request.args.get("q", "")
        return jsonify(search_exercises(query))

    if USE_LLM:
        from llm_routes import register_chat_route
        register_chat_route(app, json_search)

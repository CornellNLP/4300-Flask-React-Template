"""
Routes: React app serving and episode search API.

To enable AI chat, set USE_LLM = True below. See llm_routes.py for AI code.
"""
import json
import os
from flask import send_from_directory, request, jsonify
from models import db, Episode, Review, Podcast

# ── AI toggle ────────────────────────────────────────────────────────────────
USE_LLM = False
# USE_LLM = True
# ─────────────────────────────────────────────────────────────────────────────


# TODO: change this to search podcasts instead of episodes, and return podcast info + episodes in the response
# TODO: use cosine similarity for getting better matches instead of just substring search, and return top 5 matches instead of all matches
def json_search(query):
    if not query or not query.strip():
        query = "Joe Rogan Podcast"
    results = db.session.query(Podcast, Review).join(
        Review, Podcast.id == Review.id
    ).filter(
        Podcast.title.ilike(f'%{query}%')
    ).all()
    matches = []
    for podcast, review in results:
        matches.append({
            'title': podcast.title,
            'descr': podcast.descr,
            'category': podcast.category,
            'explicit': podcast.explicit,
            'image_url': podcast.image_url,
            'feed_url': podcast.feed_url,
            'author': podcast.author,
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
    
    @app.route("/api/podcasts")
    def podcasts_search():
        text = request.args.get("title", "")
        return jsonify(json_search(text))

    if USE_LLM:
        from llm_routes import register_chat_route
        register_chat_route(app, json_search)

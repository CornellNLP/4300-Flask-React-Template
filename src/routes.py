"""
Routes: React app serving and episode search API.

To enable AI chat, set USE_LLM = True below. See llm_routes.py for AI code.
"""
import json
import os
from flask import send_from_directory, request, jsonify
from models import db, Postings
from utils import generate_rabbit_hole, load_data


# ── AI toggle ────────────────────────────────────────────────────────────────
USE_LLM = False
# USE_LLM = True
# ─────────────────────────────────────────────────────────────────────────────

load_data()

def json_search(query):
    return

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

    @app.route('/api/rabbithole', methods=['GET'])
    def rabbithole():
        start_article = request.args.get('article', '')
        keywords = request.args.get('keywords', '')
        if not start_article and not keywords:
            return jsonify([])
        
        pathway = generate_rabbit_hole(
            start_article=start_article,
            additional_keywords=keywords,
            postings_model=Postings,
            path_length=5,
            diversity_lambda=1,
            logger=app.logger
        )
        return jsonify(pathway)
    
    if USE_LLM:
        from llm_routes import register_chat_route
        register_chat_route(app, json_search)

    

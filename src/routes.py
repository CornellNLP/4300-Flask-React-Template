# Routes: React app serving and Wikipedia rabbit-hole search API.
import json
import os
from flask import send_from_directory, request, jsonify
from models import db, Postings
from utils import generate_rabbit_hole_svd
from utils import generate_rabbit_hole, load_data, get_svd_graph_data

USE_LLM = False

load_data()

def register_routes(app):

    @app.route('/', defaults={'path': ''})
    @app.route('/<path:path>')
    def serve(path):
        if path != "" and os.path.exists(os.path.join(app.static_folder, path)):
            return send_from_directory(app.static_folder, path)
        return send_from_directory(app.static_folder, 'index.html')

    @app.route("/api/config")
    def config():
        return jsonify({"use_llm": USE_LLM})

    @app.route('/api/rabbithole', methods=['GET'])
    def rabbithole():
        start_article = request.args.get('article', '').strip()
        keywords      = request.args.get('keywords', '').strip()
        scoring_mode  = request.args.get('scoring_mode', 'tfidf')   # tfidf and svd
        num_branches  = int(request.args.get('num_branches', 3))
        path_length   = int(request.args.get('path_length', 5))
        diversity_lam = float(request.args.get('diversity_lambda', 0.6))

        if not start_article and not keywords:
            return jsonify([])

        if scoring_mode not in ('tfidf', 'svd'):
            scoring_mode = 'tfidf'

        if scoring_mode == 'tfidf':
            branches = generate_rabbit_hole(
                start_article=start_article,
                additional_keywords=keywords,
                postings_model=Postings,
                path_length=path_length,
                diversity_lambda=1,
                num_branches=num_branches,
            )
        else:
            branches = generate_rabbit_hole_svd(start_article, path_length=path_length, num_branches=num_branches)
        return jsonify(branches)

    @app.route('/api/svd/graph', methods=['GET'])
    def svd_graph():
        terms_per_theme = int(request.args.get('terms_per_theme', 8))
        return jsonify(get_svd_graph_data(terms_per_theme))

    if USE_LLM:
        from llm_routes import register_chat_route
        register_chat_route(app, lambda q: [])
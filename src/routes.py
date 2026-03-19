"""
Routes for the first-iteration song recommendation prototype.
"""
import os
from flask import send_from_directory, request, jsonify
from recommender import get_recommender


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
        return jsonify({"prototype": "tfidf-v1"})

    @app.route("/api/recommendations")
    def recommendations():
        query = request.args.get("query", "")
        if not query.strip():
            return jsonify([])

        try:
            top_k = int(request.args.get("top_k", "10"))
        except ValueError:
            top_k = 10
        top_k = max(1, min(top_k, 25))

        recommender = get_recommender()
        matches = recommender.recommend(query=query, top_k=top_k)
        return jsonify(matches)

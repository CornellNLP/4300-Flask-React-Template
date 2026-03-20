"""
Routes: React app serving plus FootySearch player search APIs.

To enable AI chat, set USE_LLM = True below. See llm_routes.py for AI code.
"""
import os

from flask import jsonify, request, send_from_directory

from player_search import PLAYER_INDEX, boolean_search, find_player_by_name, parse_query

# ── AI toggle ────────────────────────────────────────────────────────────────
USE_LLM = False
# USE_LLM = True
# ─────────────────────────────────────────────────────────────────────────────


def register_routes(app):
    @app.route("/", defaults={"path": ""})
    @app.route("/<path:path>")
    def serve(path):
        if path != "" and os.path.exists(os.path.join(app.static_folder, path)):
            return send_from_directory(app.static_folder, path)
        return send_from_directory(app.static_folder, "index.html")

    @app.route("/api/config")
    def config():
        return jsonify({"use_llm": USE_LLM})

    @app.route("/api/search")
    def search():
        query = request.args.get("q", "")
        filters = parse_query(query)
        results = boolean_search(filters, PLAYER_INDEX["player_list"])
        return jsonify({"results": results})

    @app.route("/api/player")
    def player_lookup():
        name = request.args.get("name", "")
        players = find_player_by_name(name)
        if players is None:
            return jsonify({"player": None}), 404
        return jsonify(players)

    if USE_LLM:
        from llm_routes import register_chat_route

        register_chat_route(app, lambda query: boolean_search(parse_query(query), PLAYER_INDEX["player_list"]))

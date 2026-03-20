"""
Routes: React app serving and episode search API.
 
Search behaviour:
  - Splits the query into individual keywords
  - Matches keywords against episode *titles* only (case-insensitive)
  - Returns results sorted by number of keyword matches (most first)
  - Optional metadata filters: abusive, time, talking, school
    Pass as query-string params, e.g. ?title=love&abusive=0&school=1
 
To enable AI chat, set USE_LLM = True below. See llm_routes.py for AI code.
"""
import os
from flask import send_from_directory, request, jsonify
from models import db, Episode
 
# ── AI toggle ────────────────────────────────────────────────────────────────
USE_LLM = False
# USE_LLM = True
# ─────────────────────────────────────────────────────────────────────────────
 
 
def keyword_search(query, filters=None):
    """
    Search episodes by keyword matches in the title.
 
    Args:
        query   (str):  Space-separated keywords to search for.
        filters (dict): Optional metadata filters, e.g.
                        {'abusive': 0, 'school': 1}.
 
    Returns:
        List of episode dicts sorted by descending keyword-match count.
        Episodes with zero matches are excluded.
    """
    # Split query into non-empty lowercase keywords
    keywords = [kw.lower() for kw in (query or "").split() if kw.strip()]
 
    # Base query — apply metadata filters first (cheap DB-side filtering)
    q = db.session.query(Episode)
    if filters:
        if filters.get('abusive') is not None:
            q = q.filter(Episode.abusive == filters['abusive'])
        if filters.get('time') is not None:
            q = q.filter(Episode.time == filters['time'])
        if filters.get('talking') is not None:
            q = q.filter(Episode.talking == filters['talking'])
        if filters.get('school') is not None:
            q = q.filter(Episode.school == filters['school'])
 
    episodes = q.all()
 
    # Score each episode by how many keywords appear in its title
    scored = []
    for ep in episodes:
        title_lower = ep.title.lower()
        if keywords:
            match_count = sum(1 for kw in keywords if kw in title_lower)
            if match_count == 0:
                continue  # exclude episodes with no keyword matches
        else:
            match_count = 0  # no query → return all (after filters)
 
        scored.append((match_count, ep))
 
    # Sort by match count descending
    scored.sort(key=lambda x: x[0], reverse=True)
 
    results = []
    for match_count, ep in scored:
        results.append({
            'id': ep.id,
            'title': ep.title,
            'descr': ep.descr,
            'abusive': ep.abusive,
            'time': ep.time,
            'talking': ep.talking,
            'school': ep.school,
            'match_count': match_count,
        })
 
    return results
 
 
def _parse_int_param(value):
    """Return int if value is a valid integer string, else None."""
    if value is not None:
        try:
            return int(value)
        except ValueError:
            pass
    return None
 
 
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
        """
        Query params:
          title    (str)  – keywords to search in episode titles
          abusive  (int)  – filter by abusive flag (0 or 1)
          time     (int)  – filter by time value
          talking  (int)  – filter by talking value
          school   (int)  – filter by school flag (0 or 1)
 
        Example:
          GET /api/episodes?title=boyfriend&abusive=0
        """
        query = request.args.get("title", "")
        filters = {
            'abusive': _parse_int_param(request.args.get('abusive')),
            'time':    _parse_int_param(request.args.get('time')),
            'talking': _parse_int_param(request.args.get('talking')),
            'school':  _parse_int_param(request.args.get('school')),
        }
        return jsonify(keyword_search(query, filters))
 
    if USE_LLM:
        from llm_routes import register_chat_route
        register_chat_route(app, keyword_search)
 
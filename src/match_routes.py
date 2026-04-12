from flask import Blueprint, request, jsonify
from match import compute_match

match_bp = Blueprint('match', __name__)

@match_bp.route('/api/match', methods=['POST'])
# @match_bp.route('/match', methods=['POST'])
def match():
    body   = request.get_json()
    user_a = body.get('userA')
    user_b = body.get('userB')

    if not user_a or not user_b:
        return jsonify({'error': 'Both userA and userB required'}), 400
    if not user_a.get('query') or not user_b.get('query'):
        return jsonify({'error': 'Both users must provide a query'}), 400

    result = compute_match(user_a, user_b)
    print(f'Match result: {result}')
    return jsonify(result)
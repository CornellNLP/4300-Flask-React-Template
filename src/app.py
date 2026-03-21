from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from geopy.distance import geodesic
from ranker import rank_destinations, df as _df
from data_loader import load_cities
import numpy as np
import os

app = Flask(__name__, static_folder='../frontend/dist', static_url_path='/')
CORS(app)

_df = load_cities()

def get_nearest_city_baseline(user_lat, user_lon):
    dists = np.sqrt(
        (_df["latitude"] - user_lat) ** 2 +
        (_df["longitude"] - user_lon) ** 2
    )
    idx = dists.idxmin()
    return float(_df.loc[idx, "annual_avg_c"]), _df.loc[idx, "city"]

@app.route("/api/search", methods=["GET"])
def search():
    query = request.args.get("q", "")
    user_lat = request.args.get("lat", type=float)
    user_lon = request.args.get("lon", type=float)
    top_n = request.args.get("top_n", default=10, type=int)
    top_n = max(1, min(top_n, 50))

    if not query:
        return jsonify({"error": "no query provided"}), 400

    baseline_temp = None
    nearest_city = None

    if user_lat is not None and user_lon is not None:
        baseline_temp, nearest_city = get_nearest_city_baseline(user_lat, user_lon)

    results = rank_destinations(
        query,
        user_lat=user_lat,
        user_lon=user_lon,
        user_baseline_temp=baseline_temp,
        top_n=top_n
    )

    response = {"query": query, "results": results}
    if nearest_city is not None:
        response["user_nearest_city"] = nearest_city
        response["user_baseline_temp_c"] = baseline_temp

    return jsonify(response)

@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"})

# ⬇️ catch-all — MUST be last
@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve(path):
    if path.startswith('api/'):
        return jsonify({'error': 'Not found'}), 404
    static = app.static_folder
    if path and os.path.exists(os.path.join(static, path)):
        return send_from_directory(static, path)
    return send_from_directory(static, 'index.html')

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001, debug=True)

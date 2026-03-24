import os
from dotenv import load_dotenv
from flask import Flask

load_dotenv()
from flask_cors import CORS
try:
    from routes import register_routes
except ImportError:  # pragma: no cover
    from src.routes import register_routes

# src/ directory and project root (one level up)
current_directory = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(current_directory)

# Serve React build files from <project_root>/frontend/dist
app = Flask(__name__,
    static_folder=os.path.join(project_root, 'frontend', 'dist'),
    static_url_path='')
CORS(app)

# Register routes
register_routes(app)

if __name__ == '__main__':
    # threaded=True helps the dev server keep accepting requests
    # while an SSE/streaming response is in-flight.
    app.run(debug=True, host="0.0.0.0", port=5001, threaded=True)

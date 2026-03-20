import csv
import os
from dotenv import load_dotenv
from flask import Flask

load_dotenv()
from flask_cors import CORS
from models import db, Song
from routes import register_routes

# src/ directory and project root (one level up)
current_directory = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(current_directory)

# Serve React build files from <project_root>/frontend/dist
app = Flask(__name__,
    static_folder=os.path.join(project_root, 'frontend', 'dist'),
    static_url_path='')
CORS(app)

# Configure SQLite database - using 3 slashes for relative path
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///data.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# Initialize database with app
db.init_app(app)

# Register routes
register_routes(app)

# Function to initialize database, change this to your own database initialization logic
def init_db():
    with app.app_context():
        # Create all tables
        db.create_all()
        
        # Initialize database with data from init.json if empty
        if Song.query.count() == 0:
            csv_file_path = os.path.join(current_directory, 'music.csv')
            with open(csv_file_path, 'r') as file:
                data = csv.reader(file)
                idx = 0
                for song_data in data:
                    if (idx > 0): #ignore header
                        song = Song(
                            id = idx,
                            title = song_data[1],
                            artist = song_data[0],
                            lyrics = song_data[2],
                            chords = song_data[3],
                            genres = song_data[5],
                            popularity = song_data[6],
                            guitar_difficulty = song_data[7],
                            piano_difficulty = song_data[8]
                        )
                        db.session.add(song)
                    idx += 1

            
            db.session.commit()
            print("Database initialized with songs")

init_db()

if __name__ == '__main__':
    app.run(debug=True, host="0.0.0.0", port=5001)

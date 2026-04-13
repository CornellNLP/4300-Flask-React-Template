import csv
import json
import os
from dotenv import load_dotenv
from flask import Flask

load_dotenv()
from flask_cors import CORS
from models import db, Recipe, Playlist
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

def init_recipes():
        if Recipe.query.count() > 0:
            print("Database already initialized with", Recipe.query.count(), 'recipes')
            return
            
        file_path = os.path.join(current_directory, 'cleaned_recipes.csv')
        with open(file_path, 'r', encoding='utf-8') as file:
            csv_reader = csv.reader(file)

            recipe_data = list(csv_reader)
            headers = recipe_data[0]
            rows = recipe_data[1:]
            for i, row in enumerate(rows):
                try:
                    desc_words = row[9].split()
                    cleaned_desc = " ".join(desc_words)
                    recipe = Recipe(
                        id=i,
                        site_id=row[1],
                        name=row[0],
                        minutes=row[2],
                        tags=row[5],
                        description=cleaned_desc,
                        ingredients=row[10]
                    )
                    db.session.add(recipe)
                except:
                    print('Error in adding recipe', i)
        
        db.session.commit()
        print("Database initialized with recipe data")

def init_playlists():
    if Playlist.query.count() > 0:
        print("Database already initialized with", Playlist.query.count(), 'playlists')
        return

    file_path = os.path.join(current_directory, 'combined.json')
    with open(file_path, 'r') as file:
        data = json.load(file)

    for name, tracks in data.items():
        try:
            songs = [track[0] for track in tracks]
            artists = [track[1] for track in tracks]
            lyrics = [track[2] for track in tracks if track[2]]
            enriched_text = f"{name} {' '.join(songs)} {' '.join(lyrics)}"
            playlist = Playlist(
                name=name,
                songs=','.join(songs),
                artists=','.join(artists),
                enriched_text=enriched_text
            )
            db.session.add(playlist)
        except:
            continue

    db.session.commit()
    print("Database initialized with playlist data")

# Function to initialize database, change this to your own database initialization logic
def init_db():
    with app.app_context():
        # Create all tables
        db.create_all()
        init_recipes()
        init_playlists()
        
init_db()

if __name__ == '__main__':
    app.run(debug=True, host="0.0.0.0", port=5001)
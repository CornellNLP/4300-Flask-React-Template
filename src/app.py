import json
import os
import pandas as pd
from dotenv import load_dotenv
from flask import Flask

load_dotenv()
from flask_cors import CORS
from models import db, Episode, Review, Podcast
from routes import register_routes
from match_routes import match_bp

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
app.register_blueprint(match_bp)

# Function to initialize database
# TODO: change from init.json to like podcast.csv, and create Podcast Objects instead
def init_db():
    with app.app_context():
        # Create all tables
        db.create_all()

        # Load podcasts
        # df_podcasts = pd.read_csv('data/podcasts.csv')
        # TODO: check with cleaned another time
        df_podcasts = pd.read_csv('data/podcasts_cleaned2.csv')
        for _, row in df_podcasts.iterrows():
            if db.session.get(Podcast, row['id']) is None:  # Check if podcast already exists
                podcast = Podcast(
                    id=row['id'],
                    podcast_guid=row['podcast_guid'],
                    name=row['name'],
                    author=row['author'],
                    owner_name=row['owner_name'] if pd.notna(row['owner_name']) else None,
                    descr=row['description'] if pd.notna(row['description']) else None,
                    categories=row['categories'],
                    explicit=row['explicit'],
                    avg_duration_min=row['avg_duration_min'] if pd.notna(row['avg_duration_min']) else None,
                    episode_count=row['episode_count'],
                    language=row['language'] if pd.notna(row['language']) else None,
                    image_url=row['image_url'] if pd.notna(row['image_url']) else None,
                    feed_url=row['feed_url'],
                    website_url=row['website_url'] if pd.notna(row['website_url']) else None,
                    itunes_id=str(int(row['itunes_id'])) if pd.notna(row['itunes_id']) else None,
                    newest_item_date=None,
                    popularity_score=row['popularity_score']
                )
                db.session.add(podcast)
        db.session.commit()
        print(f'Loaded {len(df_podcasts)} podcasts.')

        # Load episodes of each podcast
        df_episodes = pd.read_csv('data/episodes_cleaned2.csv')
        for _, row in df_episodes.iterrows():
            if db.session.get(Episode, row['id']) is None:  # Check if episode already exists
                episode = Episode(
                    id=row['id'],
                    podcast_id=row['podcast_id'],
                    podcast_name=row['podcast_name'],
                    category=row['category'],
                    episode_name=row['episode_name'],
                    description=row['description'] if pd.notna(row['description']) else None,
                    duration_min=row['duration_min'],
                    release_date=pd.to_datetime(row['release_date']) if pd.notna(row['release_date']) else None,
                    release_year=int(row['release_year']) if pd.notna(row['release_year']) else None,
                    explicit=row['explicit'],
                    episode_type=row['episode_type'] if pd.notna(row['episode_type']) else None,
                    image_url=row['image_url'],
                    audio_url=row['audio_url'],
                    external_url=row['external_url'] if pd.notna(row['external_url']) else None
                )
                db.session.add(episode)
        db.session.commit()
        print(f'Loaded {len(df_episodes)} episodes.')

init_db()

if __name__ == '__main__':
    app.run(debug=True, host="0.0.0.0", port=5001)

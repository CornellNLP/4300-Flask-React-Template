from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()

# Define Recipe model
class Recipe(db.Model):
    __tablename__ = 'recipes'
    id = db.Column(db.Integer, primary_key=True)
    site_id = db.Column(db.Integer, nullable=False)
    name = db.Column(db.String(64), nullable=False)
    minutes = db.Column(db.Integer, nullable=False)
    tags = db.Column(db.String(1024), nullable=False)
    description = db.Column(db.String(1024), nullable=False)
    ingredients = db.Column(db.String(1024), nullable=False)

    def __repr__(self):
        return f'Recipe {self.id}: {self.name}'
    
class Playlist(db.Model):
    __tablename__ = 'playlists'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(64), nullable=False)
    songs = db.Column(db.String(1028), nullable=False)
    artists = db.Column(db.String(1028), nullable=False) # len(songs) == len(artists)
    enriched_text = db.Column(db.Text, nullable=True)  # playlist name + song titles + matched lyrics for SVD

    def __repr__(self):
        return f'Playlist {self.id}: {self.name}'
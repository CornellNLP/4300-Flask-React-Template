from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import JSON

db = SQLAlchemy()

# Define Song model
class Song(db.Model):
    __tablename__ = 'songs'
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(64), nullable=False)
    artist = db.Column(db.String(64), nullable=False)
    lyrics = db.Column(JSON, nullable=False)
    chords = db.Column(db.String, nullable=False)
    genres = db.Column(JSON, nullable=False)
    popularity = db.Column(db.Float, nullable=False)
    guitar_difficulty = db.Column(db.Float, nullable=False)
    piano_difficulty = db.Column(db.Float, nullable=False)
    
    def __repr__(self):
        return f'Song {self.id}: {self.title}'

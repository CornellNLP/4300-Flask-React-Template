from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()

# Define submission model
class AitaPost(db.Model):
    __tablename__ = 'aita_posts'

    id = db.Column(db.Integer, primary_key=True)
    submission_id = db.Column(db.String(20))
    title = db.Column(db.Text)
    selftext = db.Column(db.Text)
    score = db.Column(db.Integer)
    
    # Community verdict fields
    nta_count = db.Column(db.Integer, default=0)
    yta_count = db.Column(db.Integer, default=0)
    esh_count = db.Column(db.Integer, default=0)
    nah_count = db.Column(db.Integer, default=0)
    total_verdict_comments = db.Column(db.Integer, default=0)
    dominant_verdict = db.Column(db.String(10), nullable=True)
    verdict_confidence = db.Column(db.Float, default=0.0)

# Define Review model
class Review(db.Model):
    __tablename__ = 'reviews'
    id = db.Column(db.Integer, primary_key=True)
    imdb_rating = db.Column(db.Float, nullable=False)
    
    def __repr__(self):
        return f'Review {self.id}: {self.imdb_rating}'


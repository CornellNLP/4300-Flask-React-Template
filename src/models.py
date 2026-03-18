from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()

# Define Podcast model
class Podcast(db.Model):
    __tablename__ = 'podcasts'
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(64), nullable=False)
    descr = db.Column(db.String(1024), nullable=False)
    category = db.Column(db.String(64), nullable=False)
    explicit = db.Column(db.Boolean, nullable=False)
    image_url = db.Column(db.String(256), nullable=False)
    feed_url = db.Column(db.String(256), nullable=False)
    author = db.Column(db.String(64), nullable=False) # TODO: author or owner_name
    
    def __repr__(self):
        return f'Podcast {self.id}: {self.title}'

# ------------ Old Models from Example ---------------
# Define Episode model
class Episode(db.Model):
    __tablename__ = 'episodes'
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(64), nullable=False)
    descr = db.Column(db.String(1024), nullable=False)
    
    def __repr__(self):
        return f'Episode {self.id}: {self.title}'

# Define Review model
class Review(db.Model):
    __tablename__ = 'reviews'
    id = db.Column(db.Integer, primary_key=True)
    imdb_rating = db.Column(db.Float, nullable=False)
    
    def __repr__(self):
        return f'Review {self.id}: {self.imdb_rating}'


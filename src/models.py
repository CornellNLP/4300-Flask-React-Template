from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()

# Define Podcast model
# Note: author and owner_name may be the same, so not required
class Podcast(db.Model):
    __tablename__ = 'podcasts'
    id = db.Column(db.String, primary_key=True)
    podcast_guid = db.Column(db.String(64), nullable=False)
    name = db.Column(db.String(64), nullable=False)
    author = db.Column(db.String(64), default="Unknown", nullable=False)
    owner_name = db.Column(db.String(64), nullable=True, default="Unknown")
    descr = db.Column(db.Text, nullable=True, default="No description available.")
    categories = db.Column(db.String(256), nullable=False)
    explicit = db.Column(db.Boolean, nullable=False)
    avg_duration_min = db.Column(db.Float, nullable=True, default=0) # TODO: implement
    episode_count = db.Column(db.Integer, nullable=True, default=0)
    language = db.Column(db.String(16), nullable=True, default="Unknown")
    image_url = db.Column(db.String(256), nullable=True, default="No image URL")
    feed_url = db.Column(db.String(256), nullable=False)
    website_url = db.Column(db.String(256), nullable=True, default="No website URL")
    itunes_id = db.Column(db.String(64), nullable=True, default="No itunes id")
    newest_item_date = db.Column(db.DateTime)
    popularity_score = db.Column(db.Float, nullable=False, default=0.0)
    
    def __repr__(self):
        return f'Podcast {self.id}: {self.name} by {self.author}'

# ------------ Old Models from Example ---------------
# Define Episode model
class Episode(db.Model):
    __tablename__ = 'episodes'
    id = db.Column(db.String, primary_key=True)
    podcast_id = db.Column(db.String, db.ForeignKey('podcasts.id'), nullable=False)
    podcast_name = db.Column(db.String(64), nullable=False)
    category = db.Column(db.String(64), nullable=False)
    episode_name = db.Column(db.String(64), nullable=True, default="Unknown Episode Name")
    description = db.Column(db.String(1024), nullable=True, default="No description available.")
    duration_min = db.Column(db.Float, nullable=False)
    release_date = db.Column(db.DateTime, nullable=True, default=None)
    release_year = db.Column(db.Integer, nullable=True, default=0)
    explicit = db.Column(db.Boolean, nullable=False)
    episode_type = db.Column(db.String(16), nullable=True, default="Unknown")
    image_url = db.Column(db.String(256), nullable=False)
    audio_url = db.Column(db.String(256), nullable=False)
    external_url = db.Column(db.String(256), nullable=True, default="No external URL")
    
    def __repr__(self):
        return f'Episode {self.id}: {self.episode_name} from {self.podcast_name}'

# Define Review model
class Review(db.Model):
    __tablename__ = 'reviews'
    id = db.Column(db.Integer, primary_key=True)
    imdb_rating = db.Column(db.Float, nullable=False)
    
    def __repr__(self):
        return f'Review {self.id}: {self.imdb_rating}'


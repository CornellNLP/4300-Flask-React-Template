from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()

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

# Define Product model
class Product(db.Model):
    __tablename__ = 'products'
    product_id = db.Column(db.Integer, primary_key=True)
    product_name = db.Column(db.String)
    brand_name = db.Column(db.String)
    price = db.Column(db.Float)
    description = db.Column(db.Text)
    ingredients = db.Column(db.Text)
    primary_category = db.Column(db.String)
    secondary_category = db.Column(db.String)
    tertiary_category = db.Column(db.String)

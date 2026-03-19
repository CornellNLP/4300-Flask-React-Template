from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()

class Postings(db.Model):
    __tablename__ = 'postings' 
    term_id = db.Column(db.Integer, primary_key=True) 
    postings = db.Column(db.LargeBinary, nullable=False)
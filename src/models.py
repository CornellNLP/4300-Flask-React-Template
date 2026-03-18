from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()

class Postings(db.Model):
    __tablename__ = 'postings'
    id = db.Column(db.Integer, primary_key=True)
    postings = db.column(db.LargeBinary, nullable=False)


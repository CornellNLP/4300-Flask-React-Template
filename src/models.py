from flask_sqlalchemy import SQLAlchemy
 
db = SQLAlchemy()
 
class Episode(db.Model):
    __tablename__ = 'episodes'
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(256), nullable=False)
    descr = db.Column(db.Text, nullable=False)
    abusive = db.Column(db.Integer, default=0)   # 0 or 1
    time = db.Column(db.Integer, default=0)       # numeric metadata
    talking = db.Column(db.Integer, default=0)    # numeric metadata
    school = db.Column(db.Integer, default=0)     # 0 or 1
 
    def __repr__(self):
        return f'Episode {self.id}: {self.title}'
 
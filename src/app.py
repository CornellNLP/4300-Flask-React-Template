import json
import os
import csv
from dotenv import load_dotenv
from flask import Flask
# from fastapi import FastAPI

load_dotenv()
from flask_cors import CORS
from models import db, Product, Review
from routes import register_routes

# src/ directory and project root (one level up)
current_directory = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(current_directory)

# app = FastAPI()

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

# score_name = "My Score"

# @app.get("/score")
# def get_score_name():
#     return {"Similarity Score": score_name}

# Function to initialize database, change this to your own database initialization logic
def to_bool(val):
    return str(val).lower() in ["true", "1", "yes"]

def to_float(val):
    try:
        return float(val)
    except:
        return None

def to_int(val):
    try:
        return int(float(val))
    except:
        return None


def sanitize_description(val):
    desc = (val or "").strip()
    if not desc:
        return ""

    desc_norm = " ".join(desc.lower().split())
    placeholder_values = {"na", "n/a", "none", "null", "unknown", "tbd", "wf", "-", "--"}
    if desc_norm in placeholder_values:
        return ""

    # Remove clearly non-informative short descriptions.
    if len(desc_norm) < 4:
        return ""
    if len(desc_norm.split()) <= 2 and len(desc_norm) <= 12:
        return ""

    return desc

def init_db():
    with app.app_context():
        db.create_all()

        # Check if the products table is empty
        if Product.query.count() == 0:
            csv_path = os.path.join(os.path.dirname(__file__), 'final_merged_clean_skincare.csv')
            df = pd.read_csv(csv_path)

            for _, row in df.iterrows():
                product = Product(
                    product_id=int(row['product_id']),
                    product_name=row['product_name'],
                    brand_name=row['brand_name'],
                    price=float(row['price']) if not pd.isna(row['price']) else None,
                    description=row.get('description', None),
                    ingredients=row.get('ingredients', None),
                    primary_category=row.get('primary_category', None),
                    secondary_category=row.get('secondary_category', None),
                    tertiary_category=row.get('tertiary_category', None)
                )
                db.session.add(product)

            db.session.commit()
            print("Database initialized with skincare products data")


init_db()

if __name__ == '__main__':
    app.run(debug=True, host="0.0.0.0", port=5001)

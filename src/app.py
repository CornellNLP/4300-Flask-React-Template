import csv
import os
from dotenv import load_dotenv
from flask import Flask

load_dotenv()
from flask_cors import CORS
from models import db, Recipe
from routes import register_routes

# src/ directory and project root (one level up)
current_directory = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(current_directory)

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

# Function to initialize database, change this to your own database initialization logic
def init_db():
    with app.app_context():
        # Create all tables
        db.create_all()
        
        if Recipe.query.count() > 0:
            print("Database already initialized with", Recipe.query.count(), 'recipes')
            return
        
        file_path = 'data/recipes_sample.csv'
        with open(file_path, 'r', encoding='utf-8') as file:
            csv_reader = csv.reader(file)

            recipe_data = list(csv_reader)
            headers = recipe_data[0]
            rows = recipe_data[1:]
            for i, row in enumerate(rows):
                try:
                    recipe = Recipe(
                        id=i,
                        name=row[0],
                        minutes=row[2],
                        tags=row[5],
                        n_steps=row[7],
                        steps=row[8],
                        description=row[9],
                        n_ingredients=row[11],
                        ingredients=row[10]
                    )
                    db.session.add(recipe)
                except:
                    print('Error in adding recipe', i)
        
        db.session.commit()
        print("Database initialized with recipe data")

init_db()

if __name__ == '__main__':
    app.run(debug=True, host="0.0.0.0", port=5001)
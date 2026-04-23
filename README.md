# bring the party!

## Quick Start

For the fastest way to get started with development:

### Windows
```bash
# 1. Set up Python virtual environment
python -m venv venv
venv\Scripts\activate

# 2. Install Python dependencies
pip install -r requirements.txt

# 3. Start Flask backend (in one terminal)
python src/app.py

# 4. In a NEW terminal, install and start React
cd frontend
npm install
npm run dev
```

### Mac/Linux
```bash
# 1. Set up Python virtual environment
python3 -m venv venv
source venv/bin/activate

# 2. Install Python dependencies
pip install -r requirements.txt

# 3. Start Flask backend (in one terminal)
python src/app.py

# 4. In a NEW terminal, install and start React
cd frontend
npm install
npm run dev
```

Then open `http://localhost:5173` in your browser!

### Backend (Flask)
- **Entry point**: `src/app.py`
- **Database**: SQLite with SQLAlchemy ORM
- **API Routes**: prefixed with `/api` (e.g., `GET /api/episodes`, `POST /api/chat`)
- **Config endpoint**: `GET /api/config` — tells the frontend whether `USE_LLM` is on

### Frontend (React + TypeScript)
- **Build tool**: Vite
- **Dev server**: port 5173, proxies `/api` calls to Flask on port 5001
- **Production**: React is built into `frontend/dist` and served by Flask

### Production Mode

Build React and serve everything through Flask:
```bash
cd frontend && npm install && npm run build && cd ..
python3 src/app.py
```
Open `http://localhost:5001`.

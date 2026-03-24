#!/bin/bash
# Start both Flask backend and React frontend for development/testing.
# Usage: ./dev.sh

set -e

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"

#Edit this to your virtual environment path if different
VENV_DIR="$PROJECT_DIR/4300-IR"

# Activate Python virtual environment
source "$VENV_DIR/bin/activate"

# Start Flask backend in background
echo "Starting Flask backend..."
python "$PROJECT_DIR/src/app.py" &
FLASK_PID=$!

#Flask API runs on `http://localhost:5001

# Start React frontend
echo "Starting React frontend..."
cd "$PROJECT_DIR/frontend"
npm install --silent
npm run dev &
REACT_PID=$!

#Open `http://localhost:5173`. The Vite dev server proxies `/api` requests to Flask automatically.

# Trap Ctrl+C to kill both processes
trap "echo 'Shutting down...'; kill $FLASK_PID $REACT_PID 2>/dev/null; exit" INT TERM

echo "Backend PID: $FLASK_PID | Frontend PID: $REACT_PID"
echo "Press Ctrl+C to stop both servers."
wait

# Athletic Training Finder — CLAUDE.md

## Project Overview
Athletic Training Finder is an information retrieval system where users input a natural language
query describing their athletic or fitness goals, and the system returns a ranked list of relevant
exercises and workout plans. The output should feel like a cohesive workout plan, not just a
flat list of exercises.

**Example query:** "improve my vertical jump for basketball with gym equipment"
**Expected output:** A ranked, structured workout plan with exercises, sets, reps, rest periods,
and target muscles — all sourced from the dataset.

---

## Current Goal (Tonight's Deadline)
Extract keywords from user input and return the best-matching exercises from the
Free Exercise DB JSON dataset. Focus on field-based keyword matching with weighted
priorities. Do not over-engineer — core IR logic only.

---

## Dataset
**Primary dataset for tonight:** Free Exercise DB (JSON)
- Source: https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json
- 873 exercises, no API key needed, single request download
- Already saved locally as: `datasets/exercises_free_db.json`

**Each exercise entry has these fields:**
```json
{
  "id": "Barbell_Squat",
  "name": "Barbell Squat",
  "force": "push",
  "level": "beginner" | "intermediate" | "expert",
  "mechanic": "compound" | "isolation" | null,
  "equipment": "barbell" | "dumbbell" | "body only" | "cable" | "machine" | "kettlebells" | "bands" | "medicine ball" | "exercise ball" | "foam roll" | "e-z curl bar" | "other" | null,
  "primaryMuscles": ["quadriceps", "glutes"],
  "secondaryMuscles": ["hamstrings", "calves"],
  "instructions": ["Step 1...", "Step 2..."],
  "category": "strength" | "stretching" | "plyometrics" | "powerlifting" | "olympic weightlifting" | "strongman" | "cardio",
  "images": ["..."]
}
```

**Null values to be aware of:**
- `force`: 29 nulls
- `mechanic`: 87 nulls
- `equipment`: 77 nulls

---

## IR Approach (Tonight)

### Field Priority Weights
Match user query keywords against exercise fields with the following priority:

| Priority | Field | Weight |
|---|---|---|
| 1 (highest) | primaryMuscles | 1.0 |
| 2 | secondaryMuscles | 0.8 |
| 3 | category | 0.6 |
| 4 | level | 0.5 |
| 5 | equipment | 0.4 |
| 6 | name | 0.3 |
| 7 | mechanic / force | 0.2 |

### Core Strategy
1. Tokenize and lowercase the user query
2. For each exercise, compute a relevance score by checking which query tokens
   appear in each field, multiplied by that field's weight
3. Return top-k exercises ranked by score

### IR Techniques Covered in Class (use these)
- **TF-IDF**: Build a TF-IDF matrix over a combined text representation of each exercise
  (concatenate name + primaryMuscles + secondaryMuscles + category + instructions)
  and score each exercise against the query vector
- **Cosine Similarity**: Use as the ranking metric between query vector and exercise vectors
- **Vector Space Model**: Represent both queries and exercises as vectors in term space

### What NOT to do tonight
- Do not implement SVD/LSA embeddings yet (save for later milestone)
- Do not implement co-occurrence matrices yet
- Do not implement minimum edit distance (too primitive, not useful here)
- Do not build the full workout plan assembly logic yet

---

## Keyword-to-Muscle Mapping (Query Expansion)
Users won't say "quadriceps" — they'll say "vertical jump" or "posture." Use this lookup
to expand query terms before retrieval:

```python
GOAL_TO_MUSCLES = {
    "vertical jump": ["quadriceps", "glutes", "calves", "hamstrings"],
    "jump": ["quadriceps", "glutes", "calves"],
    "squat": ["quadriceps", "glutes", "hamstrings"],
    "posture": ["lower back", "abdominals", "shoulders"],
    "running": ["hamstrings", "calves", "abdominals"],
    "speed": ["hamstrings", "quadriceps", "calves"],
    "shooting": ["shoulders", "triceps", "forearms"],
    "throw": ["shoulders", "triceps", "chest"],
    "core": ["abdominals", "lower back"],
    "abs": ["abdominals"],
    "back": ["lats", "middle back", "lower back"],
    "chest": ["chest"],
    "arms": ["biceps", "triceps", "forearms"],
    "legs": ["quadriceps", "hamstrings", "calves", "glutes"],
    "shoulders": ["shoulders", "traps"],
    "grip": ["forearms"],
    "push": ["chest", "triceps", "shoulders"],
    "pull": ["lats", "biceps", "middle back"],
}
```

---

## Equipment Keyword Mapping
```python
EQUIPMENT_KEYWORDS = {
    "no equipment": "body only",
    "bodyweight": "body only",
    "gym": None,  # no filter, gym implies all equipment available
    "dumbbells": "dumbbell",
    "barbell": "barbell",
    "cables": "cable",
    "machine": "machine",
    "bands": "bands",
    "kettlebell": "kettlebells",
}
```

---

## Output Format (Target)
```
Query: "improve vertical jump for basketball with gym equipment"

Top 5 Exercises:
1. Barbell Squat          | Score: 0.91 | Muscles: Quadriceps, Glutes | Level: Intermediate
2. Box Jump               | Score: 0.87 | Muscles: Quadriceps, Glutes | Level: Intermediate
3. Bulgarian Split Squat  | Score: 0.82 | Muscles: Quadriceps         | Level: Intermediate
4. Calf Raise             | Score: 0.75 | Muscles: Calves             | Level: Beginner
5. Jump Squat             | Score: 0.71 | Muscles: Quadriceps, Glutes | Level: Intermediate
```

---

## Architecture & Entry Points

This project uses the **CS/INFO 4300 Flask + React + TypeScript template**.

### How user input flows:
1. User types a query in `frontend/src/App.tsx` (React search bar)
2. Frontend sends a `POST /api/search` request to Flask with the query string
3. Flask receives it in `src/routes.py` and calls the retrieval function
4. Retrieval function scores and ranks exercises from `datasets/exercises_free_db.json`
5. Flask returns a JSON response with the ranked list
6. React renders the results in `App.tsx`

### Key files to work in:
- **`src/routes.py`** — add the `/api/search` POST route here, call the retrieval function
- **`src/retrieval.py`** — create this file for all IR logic (TF-IDF, cosine similarity, ranking)
- **`frontend/src/App.tsx`** — search bar input and results display (React)
- **`frontend/src/types.ts`** — add TypeScript types for the exercise result object

### Expected API contract:
```
POST /api/search
Body: { "query": "improve vertical jump for basketball" }

Response: {
  "results": [
    {
      "name": "Barbell Squat",
      "score": 0.91,
      "primaryMuscles": ["quadriceps", "glutes"],
      "level": "intermediate",
      "equipment": "barbell",
      "category": "strength",
      "instructions": ["Step 1...", "Step 2..."]
    },
    ...
  ]
}
```

### Running locally:
```bash
# Terminal 1 - Flask backend (port 5001)
source venv/bin/activate
python src/app.py

# Terminal 2 - React frontend (port 5173)
cd frontend
npm run dev
```

---

## File Structure
```
project/
├── datasets/
│   ├── exercises_free_db.json        # Free Exercise DB (873 exercises)
│   ├── programs_cleaned.csv          # 2,598 unique workout programs
│   └── programs_detailed_boostcamp_kaggle.csv  # Full 605k row dataset
├── CLAUDE.md                         # This file
└── ...
```

---

## Notes
- The programs dataset (Kaggle) is NOT in scope for tonight — focus only on exercises_free_db.json
- The Cornell Reddit corpus is also NOT in scope for tonight
- Keep retrieval logic simple and modular so it can be extended later with SVD embeddings
  and the programs dataset in future milestones

# Programs Datasets

Three files in `data/datasets/`, all derived from a single Boostcamp Kaggle
dump. Cleaning is reproducible via `data/clean_programs.py` (run under the
`analytics` conda env — **not** `4300-IR`).

## `programs_kaggle.csv` — raw source (do not modify)
- Shape: **605,033 rows × 16 cols**, **2,598 unique programs** (`title`).
- ~282 MB, untracked in git. One row per exercise entry (week/day/exercise).
- Stringified Python lists for `level` and `goal` (e.g. `"['Beginner', 'Novice']"`).
- Negative `reps` values encode time-based holds in seconds (e.g. `-180` = 180s).
- Within a single `title`, `level`, `goal`, and `number_of_exercises` are **not**
  constant across rows (1,600+ programs have varying level/goal lists, and
  `number_of_exercises` is actually per-workout-day). The stable program-level
  fields are `description`, `equipment`, `program_length`, `time_per_workout`.

## `programs_kaggle_clean.csv` — cleaned step-by-step (USE THIS)
Same granularity as raw (605,033 rows × 18 cols), but workable. This is the
file to use when rendering week/day/exercise breakdowns.

Columns:

| column | notes |
|---|---|
| `title` | join key back to program-level |
| `description` | empty string if missing |
| `level` | JSON list, Novice normalized to Beginner, deduped |
| `level_primary` | most accessible of Beginner/Intermediate/Advanced (or Unknown) |
| `goal` | JSON list |
| `equipment` | empty string if missing |
| `program_length_weeks` | float |
| `time_per_workout_min` | float |
| `num_exercises_this_workout` | per-workout-day count (NOT per program) |
| `week`, `day` | Int64 |
| `exercise_name` | str |
| `sets` | float |
| `reps` | magnitude (always ≥ 0 after cleaning) |
| `rep_type` | `"reps"` or `"seconds"` — required to interpret `reps` correctly |
| `intensity` | float (RPE / %1RM, dataset-specific) |
| `created`, `last_edit` | ISO timestamp strings |

25,967 / 605,033 entries (≈ 4.3%) are time-based holds (`rep_type = "seconds"`).

## `programs_cleaned.csv` — program-level summary
One row per unique program title (**2,598 rows × 16 cols**). Rebuilt from the
full dataset; **not** the "first row of each program" trick that the old
version used. Use this for program-level retrieval.

Columns:

| column | notes |
|---|---|
| `title` | unique |
| `description` | first non-null across the program's rows |
| `level` | JSON list = **union** of all level lists seen for this title, Novice→Beginner, deduped |
| `level_primary` | most accessible from the union |
| `goal` | JSON list = union of all goal lists for this title |
| `num_goals` | len(goal) |
| `equipment` | first non-null |
| `program_length_weeks` | first non-null |
| `time_per_workout_min` | first non-null |
| `num_weeks` | max `week` seen for this title |
| `num_days_per_week` | max `day` seen for this title |
| `num_exercises` | count of unique `exercise_name` in the program |
| `total_exercise_entries` | total row count in the full file for this title |
| `exercises` | JSON list of unique `exercise_name` values (sorted) — useful as an IR text field |
| `created`, `last_edit` | first non-null timestamp |

### Distributions
- `level_primary`: Beginner 1954, Intermediate 588, Advanced 54, Unknown 2.
  (The previous first-row-only version reported 1481/988/121/8; taking the
  union pushes programs toward Beginner because most list multiple levels.)
- `program_length_weeks`: mean 8.8, median 8, range 1–18.
- `time_per_workout_min`: mean 69, median 60, range 10–180.

### Canonical vocabularies
Use these exact strings for filtering and weighting.

- `goal` (7 values, exploded counts over the raw data):
  Bodybuilding 1723, Muscle & Sculpting 936, Powerbuilding 905, Athletics 539,
  Powerlifting 494, Bodyweight Fitness 322, Olympic Weightlifting 39.
- `equipment` (4 values): Full Gym 1848, Garage Gym 561, At Home 119,
  Dumbbell Only 69. One program has an empty equipment string.
- `level` (post-normalization): Beginner, Intermediate, Advanced.

## Regeneration
```bash
source /home/cisco16/miniconda3/etc/profile.d/conda.sh && conda activate analytics
python data/clean_programs.py
```
Reads `programs_kaggle.csv`, rewrites `programs_kaggle_clean.csv` and
`programs_cleaned.csv`. Join key between the clean files is `title`.

---

# Exercises Dataset

Single file, `data/datasets/exercises_free_db.json`, pulled from the
[yuhonas/free-exercise-db](https://github.com/yuhonas/free-exercise-db)
public repo. **This is the only dataset the TF-IDF index in
`src/retrieval.py` is built from today** — the `FIELD_WEIGHTS` dict and the
keys returned by `search()` reference its field names verbatim, so renaming
a field here requires a matching edit in `retrieval.py`.

## `exercises_free_db.json` — 873 exercises × 11 fields

| field | type | nulls / empties | notes |
|---|---|---|---|
| `id` | str | 0 | unique, safe as a primary key |
| `name` | str | 0 | unique across the dataset |
| `level` | str | 0 | one of `beginner` / `intermediate` / `expert` |
| `category` | str | 0 | 7 values (see vocab below) |
| `force` | str \| null | 29 null | `pull` / `push` / `static` |
| `mechanic` | str \| null | 87 null | `compound` / `isolation` (null for most stretches) |
| `equipment` | str \| null | 77 null | 12 values (see vocab below); null = not specified |
| `primaryMuscles` | list[str] | 0 empty | always populated, 1+ muscles |
| `secondaryMuscles` | list[str] | 272 empty `[]` | frequently empty, especially for isolation moves |
| `instructions` | list[str] | 5 empty `[]` | 2 more have at least one blank step inside the list |
| `images` | list[str] | 0 | dropped in the viz DataFrame, unused by retrieval |

### Canonical vocabularies
Use these exact strings when writing query-expansion maps (`GOAL_TO_MUSCLES`,
`EQUIPMENT_KEYWORDS`) or when filtering. All values are lowercase.

- **level** (3): `beginner` 523, `intermediate` 293, `expert` 57.
- **category** (7): `strength` 581, `stretching` 123, `plyometrics` 61,
  `powerlifting` 38, `olympic weightlifting` 35, `strongman` 21, `cardio` 14.
- **equipment** (12, plus 77 nulls): `barbell` 170, `dumbbell` 123, `other` 122,
  `body only` 111, `cable` 81, `machine` 67, `kettlebells` 53, `bands` 20,
  `medicine ball` 17, `exercise ball` 12, `foam roll` 11, `e-z curl bar` 9.
  Note that the dataset uses `body only` for bodyweight and `kettlebells`
  (plural) — `EQUIPMENT_KEYWORDS` in `retrieval.py` already maps these.
- **force** (3, plus 29 nulls): `pull`, `push`, `static`.
- **mechanic** (2, plus 87 nulls): `compound`, `isolation`.
- **muscles** (17, shared across `primaryMuscles` and `secondaryMuscles`):
  `abdominals`, `abductors`, `adductors`, `biceps`, `calves`, `chest`,
  `forearms`, `glutes`, `hamstrings`, `lats`, `lower back`, `middle back`,
  `neck`, `quadriceps`, `shoulders`, `traps`, `triceps`. No casing or
  whitespace drift — these are safe to hardcode.

### Data quality audit
Run as the last cell of `data/datasets-visualizations.py`. Verdict:
**CLEANING NEEDED: yes, minor** — three issues, one of which affects scoring:

1. **9 rows** list the same muscle in both `primaryMuscles` and
   `secondaryMuscles` (e.g. `Barbell Step Ups` has `quadriceps` in both).
   Without dedup, the shared muscle would be weighted 1.0 (primary) + 0.4
   (secondary) = 1.4x for those docs. **Fixed at load time** in
   `src/retrieval.py` via `_dedup_secondary()`, called from
   `_build_weighted_doc()`. The JSON file on disk is untouched.
2. **5 rows** have an empty `instructions` list (`Iron Cross`,
   `One-Arm Kettlebell Swings`, `Push Press`, `Side Bridge`, `Side Jackknife`).
   Not "cleaned" — these docs just get less text appended during indexing.
   `_build_weighted_doc` already handles this gracefully.
3. **2 rows** contain at least one blank-string step inside their
   `instructions` list. Joined with `" "`, blanks contribute nothing and
   do not distort TF-IDF, so no fix is applied.

Nullable fields (`force`, `mechanic`, `equipment`) are **not** a data quality
issue — `_safe()` in `retrieval.py` already coerces `None → ""` and lists
to space-joined strings, so indexing is crash-safe. The nulls are documented
here so downstream code knows not to depend on these fields being populated.

### Regeneration
The file is not generated by a script — it's downloaded directly from the
upstream repo by a cell in the viz script. To refresh:
```bash
source /home/cisco16/miniconda3/etc/profile.d/conda.sh && conda activate analytics
python data/datasets-visualizations.py   # re-runs the requests.get(...) cell
```
After refresh, re-run the last cell of that script to re-check the audit
verdict — if upstream introduces a new casing variant, the viz script will
print a warning.

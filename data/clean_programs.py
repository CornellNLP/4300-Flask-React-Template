"""
Clean the Boostcamp Kaggle programs dataset.

Inputs:
  data/datasets/programs_kaggle.csv  (raw, ~605k rows, one row per exercise entry)

Outputs:
  data/datasets/programs_kaggle_clean.csv  (same granularity as raw but cleaned)
  data/datasets/programs_cleaned.csv       (program-level: one row per unique title)

Run under the `analytics` conda env:
  source /home/cisco16/miniconda3/etc/profile.d/conda.sh && conda activate analytics
  python data/clean_programs.py
"""
from __future__ import annotations

import ast
import json
from pathlib import Path

import pandas as pd

HERE = Path(__file__).parent
RAW = HERE / "datasets" / "programs_kaggle.csv"
OUT_FULL = HERE / "datasets" / "programs_kaggle_clean.csv"
OUT_PROGRAM = HERE / "datasets" / "programs_cleaned.csv"

LEVEL_ORDER = ["Beginner", "Intermediate", "Advanced"]


def parse_list(val) -> list[str]:
    if pd.isna(val):
        return []
    try:
        parsed = ast.literal_eval(val)
    except (ValueError, SyntaxError):
        return [g.strip() for g in str(val).split(",") if g.strip()]
    if isinstance(parsed, list):
        return [str(x).strip() for x in parsed if str(x).strip()]
    return [str(parsed)]


def normalize_levels(levels: list[str]) -> list[str]:
    out: list[str] = []
    for lvl in levels:
        norm = "Beginner" if lvl == "Novice" else lvl
        if norm and norm not in out:
            out.append(norm)
    return out


def primary_level(levels: list[str]) -> str:
    for lvl in LEVEL_ORDER:
        if lvl in levels:
            return lvl
    return "Unknown"


def classify_reps(reps: float) -> tuple[float, str]:
    """Raw dataset encodes time-based holds as negative rep counts (e.g. -180 = 180s).
    Return (magnitude, 'seconds' | 'reps')."""
    if pd.isna(reps):
        return (float("nan"), "reps")
    if reps < 0:
        return (abs(reps), "seconds")
    return (reps, "reps")


def main() -> None:
    print(f"Reading {RAW}...")
    df = pd.read_csv(RAW)
    print(f"  raw: {len(df):,} rows x {df.shape[1]} cols, {df['title'].nunique():,} unique programs")

    # ---- Per-row cleaning (applied to the full step-by-step file) ------------
    df["level_list"] = df["level"].apply(parse_list).apply(normalize_levels)
    df["goal_list"] = df["goal"].apply(parse_list)
    df["description"] = df["description"].fillna("")
    df["equipment"] = df["equipment"].fillna("")

    reps_split = df["reps"].apply(classify_reps)
    df["reps_clean"] = reps_split.apply(lambda t: t[0])
    df["rep_type"] = reps_split.apply(lambda t: t[1])

    full = pd.DataFrame({
        "title": df["title"],
        "description": df["description"],
        "level": df["level_list"].apply(json.dumps),
        "level_primary": df["level_list"].apply(primary_level),
        "goal": df["goal_list"].apply(json.dumps),
        "equipment": df["equipment"],
        "program_length_weeks": df["program_length"],
        "time_per_workout_min": df["time_per_workout"],
        "num_exercises_this_workout": df["number_of_exercises"],
        "week": df["week"].astype("Int64"),
        "day": df["day"].astype("Int64"),
        "exercise_name": df["exercise_name"],
        "sets": df["sets"],
        "reps": df["reps_clean"],
        "rep_type": df["rep_type"],
        "intensity": df["intensity"],
        "created": df["created"],
        "last_edit": df["last_edit"],
    })

    print(f"Writing {OUT_FULL}...")
    full.to_csv(OUT_FULL, index=False)
    print(f"  {len(full):,} rows x {full.shape[1]} cols")

    # ---- Program-level aggregation -----------------------------------------
    def union_lists(series: pd.Series) -> list[str]:
        seen: list[str] = []
        for lst in series:
            for item in lst:
                if item not in seen:
                    seen.append(item)
        return seen

    def first_non_null(series: pd.Series):
        for v in series:
            if pd.notna(v) and v != "":
                return v
        return None

    grouped = df.groupby("title", sort=False)
    program_level = pd.DataFrame({
        "title": grouped["title"].first(),
        "description": grouped["description"].apply(first_non_null).fillna(""),
        "level": grouped["level_list"].apply(union_lists).apply(normalize_levels),
        "goal": grouped["goal_list"].apply(union_lists),
        "equipment": grouped["equipment"].apply(first_non_null).fillna(""),
        "program_length_weeks": grouped["program_length"].first(),
        "time_per_workout_min": grouped["time_per_workout"].first(),
        "num_weeks": grouped["week"].max().astype("Int64"),
        "num_days_per_week": grouped["day"].max().astype("Int64"),
        "total_exercise_entries": grouped.size(),
        "exercises": grouped["exercise_name"].apply(lambda s: sorted(set(s.dropna()))),
        "created": grouped["created"].apply(first_non_null),
        "last_edit": grouped["last_edit"].apply(first_non_null),
    }).reset_index(drop=True)

    program_level["level_primary"] = program_level["level"].apply(primary_level)
    program_level["num_goals"] = program_level["goal"].apply(len)
    program_level["num_exercises"] = program_level["exercises"].apply(len)

    program_level["level"] = program_level["level"].apply(json.dumps)
    program_level["goal"] = program_level["goal"].apply(json.dumps)
    program_level["exercises"] = program_level["exercises"].apply(json.dumps)

    program_level = program_level[[
        "title", "description",
        "level", "level_primary",
        "goal", "num_goals",
        "equipment",
        "program_length_weeks", "time_per_workout_min",
        "num_weeks", "num_days_per_week",
        "num_exercises", "total_exercise_entries",
        "exercises",
        "created", "last_edit",
    ]]

    print(f"Writing {OUT_PROGRAM}...")
    program_level.to_csv(OUT_PROGRAM, index=False)
    print(f"  {len(program_level):,} rows x {program_level.shape[1]} cols")

    # ---- Summary diagnostics ------------------------------------------------
    print("\nlevel_primary:")
    print(program_level["level_primary"].value_counts().to_string())
    print("\nequipment:")
    print(program_level["equipment"].value_counts().to_string())
    print("\ntime-based exercise entries (rep_type='seconds'):",
          f"{(full['rep_type']=='seconds').sum():,} / {len(full):,}")


if __name__ == "__main__":
    main()

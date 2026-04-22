import sqlite3
import pandas as pd
import re
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
DB_PATH = BASE_DIR / "data" / "AmItheAsshole.sqlite"
INPUT_CSV = BASE_DIR / "data" / "AITA_clean1.csv"
OUTPUT_CSV = BASE_DIR / "data" / "AITA_enriched_with_verdicts.csv"

VERDICTS = ["nta", "yta", "esh", "nah"]

def extract_verdict_counts(comments):
    """
    Extract verdict counts from comments using word boundary regex.
    
    Returns:
        dict with keys: nta_count, yta_count, esh_count, nah_count, 
                       total_verdict_comments, dominant_verdict, verdict_confidence
    """
    counts = {v: 0 for v in VERDICTS}
    
    for comment in comments:
        if not comment:
            continue
        text = comment.lower()
        
        # Use word boundaries to match only whole verdicts
        found = None
        for v in VERDICTS:
            if re.search(rf'\b{v}\b', text):
                found = v
                break
        
        if found:
            counts[found] += 1
    
    total_verdict_comments = sum(counts.values())
    dominant = None
    confidence = 0.0
    
    if total_verdict_comments > 0:
        dominant = max(counts, key=counts.get)
        max_count = counts[dominant]
        confidence = round(max_count / total_verdict_comments, 3)
    
    return {
        "nta_count": counts["nta"],
        "yta_count": counts["yta"],
        "esh_count": counts["esh"],
        "nah_count": counts["nah"],
        "total_verdict_comments": total_verdict_comments,
        "dominant_verdict": dominant,
        "verdict_confidence": confidence
    }


def main():
    print("Loading CSV...")
    df = pd.read_csv(INPUT_CSV)
    print(f"Processing {len(df)} posts...")

    conn = sqlite3.connect(DB_PATH)

    nta_counts = []
    yta_counts = []
    esh_counts = []
    nah_counts = []
    total_verdict_comments_list = []
    dominant_verdicts = []
    verdict_confidences = []

    for idx, row in df.iterrows():
        submission_id = row["submission_id"]

        query = """
        SELECT message
        FROM comment
        WHERE submission_id = ?
        LIMIT 50
        """

        comments_df = pd.read_sql_query(query, conn, params=(submission_id,))
        comment_texts = comments_df["message"].dropna().tolist()

        verdicts = extract_verdict_counts(comment_texts)

        nta_counts.append(verdicts["nta_count"])
        yta_counts.append(verdicts["yta_count"])
        esh_counts.append(verdicts["esh_count"])
        nah_counts.append(verdicts["nah_count"])
        total_verdict_comments_list.append(verdicts["total_verdict_comments"])
        dominant_verdicts.append(verdicts["dominant_verdict"])
        verdict_confidences.append(verdicts["verdict_confidence"])
        
        if (idx + 1) % 100 == 0:
            print(f"  Processed {idx + 1}/{len(df)} posts", end='\r')

    print()
    df["nta_count"] = nta_counts
    df["yta_count"] = yta_counts
    df["esh_count"] = esh_counts
    df["nah_count"] = nah_counts
    df["total_verdict_comments"] = total_verdict_comments_list
    df["dominant_verdict"] = dominant_verdicts
    df["verdict_confidence"] = verdict_confidences

    df.to_csv(OUTPUT_CSV, index=False)
    conn.close()

    print(f"✅ Saved enriched data to {OUTPUT_CSV}")
    print(f"   Columns: {list(df.columns)}")


if __name__ == "__main__":
    main()
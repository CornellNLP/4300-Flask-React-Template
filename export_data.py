import sqlite3
import pandas as pd

conn = sqlite3.connect("AmItheAsshole.sqlite")

query = """
SELECT 
    id,
    submission_id,
    title,
    selftext,
    score
FROM submission
WHERE score > 1500
  AND selftext IS NOT NULL
  AND LENGTH(selftext) > 50
"""

df = pd.read_sql_query(query, conn)

df.to_csv("AITA_clean1.csv", index=False)

print(f"Exported {len(df)} rows")
import os
import csv
import json
from collections import defaultdict

current_directory = os.path.dirname(os.path.abspath(__file__))

file_path = os.path.join(current_directory, 'lyrics.csv')
with open(file_path, 'r', encoding='utf-8') as file:
    csv_reader = csv.reader(file)

    playlist_data = list(csv_reader)
    headers = playlist_data[0]
    rows = playlist_data[1:]
    res = defaultdict(set)

    for i in range(len(rows)):
        row = rows[i]
        try:
            artist_name = row[0]
            song_name = row[1]
            lyrics = row[3]

            res[song_name].add((lyrics, artist_name))
        except:
            continue

res_dict = {k: list(v) for k, v in res.items()}
output_path = os.path.join(current_directory, 'lyrics.json')
with open(output_path, 'w') as f:
    json.dump(res_dict, f, indent=4)

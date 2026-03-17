import os
import csv
import json
from collections import defaultdict

current_directory = os.path.dirname(os.path.abspath(__file__))

file_path = os.path.join(current_directory, 'spotify_dataset.csv')
with open(file_path, 'r', encoding='utf-8') as file:
    csv_reader = csv.reader(file)

    playlist_data = list(csv_reader)
    headers = playlist_data[0]
    rows = playlist_data[1:]
    res = defaultdict(set)

    for i in range(30000):
        row = rows[i]
        try:
            artist_name = row[1]
            track_name = row[2]
            playlist_name = row[3]

            res[playlist_name].add((track_name, artist_name))
        except:
            continue

res_dict = {k: list(v) for k, v in res.items()}
with open('spotify_playlists.json', 'w') as f:
    json.dump(res_dict, f, indent=4)

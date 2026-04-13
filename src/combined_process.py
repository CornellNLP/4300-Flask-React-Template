import os
import json

current_directory = os.path.dirname(os.path.abspath(__file__))

with open(os.path.join(current_directory, 'spotify_playlists.json'), 'r') as f:
    playlists = json.load(f)

with open(os.path.join(current_directory, 'lyrics.json'), 'r') as f:
    lyrics = json.load(f)

# Build lookup: (lowercase song name, lowercase artist) -> lyric text
lyric_lookup = {}
for song_name, entries in lyrics.items():
    for lyric, artist in entries:
        key = (song_name.lower(), artist.lower())
        lyric_lookup[key] = lyric

# Combine: for each playlist, attach lyrics to songs that match on both title and artist
combined = {}
for playlist_name, tracks in playlists.items():
    enriched_tracks = []
    for track in tracks:
        song, artist = track[0], track[1]
        lyric_text = lyric_lookup.get((song.lower(), artist.lower()), "")
        enriched_tracks.append([song, artist, lyric_text])
    combined[playlist_name] = enriched_tracks

output_path = os.path.join(current_directory, 'combined.json')
with open(output_path, 'w') as f:
    json.dump(combined, f, indent=4)

matched = sum(1 for tracks in combined.values() for t in tracks if t[2])
total = sum(len(tracks) for tracks in combined.values())
print(f"Done. {matched}/{total} songs matched with lyrics.")
print(f"Output: {output_path}")

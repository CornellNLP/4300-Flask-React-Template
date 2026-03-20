import json
import re

def add_counts_to_json(input_file, output_file):
    # 1. Load the original JSON data
    with open(input_file, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    # Define the keywords to search for
    keywords = ["abusive", "time", "talking", "school"]
    
    # 2. Iterate through each episode
    for episode in data.get('episodes', []):
        # Get the description text (handling potential nulls)
        text = episode.get('descr', '') or ''
        
        for word in keywords:
            # Use regex with \b (word boundaries) for accurate counting
            # flags=re.IGNORECASE ensures 'Cheat' and 'cheat' are both counted
            count = len(re.findall(rf'\b{word}\b', text, flags=re.IGNORECASE))
            
            # Append the count as a new key in the dictionary
            episode[word] = count
            
    # 3. Save the modified data to a new JSON file
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2)
        
    print(f"Success! New JSON file created: {output_file}")

# Usage
# Make sure your input file name matches 'episodes.json'
add_counts_to_json('reddit_posts.json', 'episodes_vectorized.json')
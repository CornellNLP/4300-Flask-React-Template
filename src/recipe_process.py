import csv
import os

current_directory = os.path.dirname(os.path.abspath(__file__))
input_file = os.path.join(current_directory, 'recipes_sample.csv')
output_file = os.path.join(current_directory, 'cleaned_recipes.csv')

LIM = 20

with open(input_file, 'r', encoding='utf-8') as infile, \
     open(output_file, 'w', encoding='utf-8', newline='') as outfile:
    
    reader = csv.reader(infile)
    writer = csv.writer(outfile)
    
    headers = next(reader)
    writer.writerow(headers)
    count = 0
    
    for row in reader:
        description = row[9].strip()
        word_count = len(description.split())
        
        if word_count >= LIM:
            writer.writerow(row)
            count += 1
        if count >= 2000:
            break
    
    print(f"Kept {count} recipes with {LIM}+ word descriptions")
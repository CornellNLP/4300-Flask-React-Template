import pandas as pd
import os

BASE_DIR = os.path.dirname(__file__)
def load_cities(path="src/data/goataway_cleaned_dataset.csv"):
    df = pd.read_csv(path)

    # extract monthly avg temps from weather_text using the patterns already in the data
    # e.g. "January is very cold with an average temperature of 3.7°C"
    import re
    months = ["january","february","march","april","may","june",
              "july","august","september","october","november","december"]

    for month in months:
        pattern = rf"{month} is \w[\w ]* with an average temperature of ([-\d.]+)°C"
        df[f"temp_{month}"] = df["weather_text"].str.lower().str.extract(pattern).astype(float)

    return df
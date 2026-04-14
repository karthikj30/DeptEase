import pandas as pd
import json

df = pd.read_excel("merged_dataset.xlsx")

# Convert to list of dictionaries
data = df.to_dict(orient="records")

with open("merged_dataset.json", "w") as f:
    json.dump(data, f, indent=4)

print("JSON file created: merged_dataset.json")
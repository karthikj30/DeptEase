import pandas as pd
import glob

# Read all CSV files inside Dataset folder
files = glob.glob("Dataset/*.csv")

all_data = []

for file in files:
    df = pd.read_csv(file)
    df["source_file"] = file  # optional
    all_data.append(df)

merged_df = pd.concat(all_data, ignore_index=True)

print("Total Records:", len(merged_df))
print(merged_df.head())

# Save merged dataset
merged_df.to_excel("merged_dataset.xlsx", index=False)
merged_df.to_csv("merged_dataset.csv", index=False)

print("Merged dataset saved as merged_dataset.xlsx and merged_dataset.csv")
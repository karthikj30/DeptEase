# DebtEase - Smart Debt Settlement System

## 📋 Project Overview

DebtEase is a complete debt settlement system that:
- **Merges** multiple expense datasets (CSV/Excel)
- **Converts** data into clean JSON format
- **Applies** an advanced greedy algorithm to minimize settlement transactions
- **Displays** results via an interactive web dashboard
- **Integrates** with APIs (JSONBin.io) for remote data access

---

## ✅ Completed Steps (1-9)

### Step 1: Upload Excel Files ✓
All CSV files are in the `Dataset/` folder:
- `SmartSettle_MultiScenario_RealNames_INR (1).csv` - Main dataset (2,750 transactions)
- `personal_expense_dataset.csv`
- `AggregatedData.csv`
- And more...

### Step 2: Install Python Libraries ✓
```bash
pip install pandas openpyxl
```

### Step 3: Merge All CSV Files ✓
**File:** `merge_csv.py`
```bash
python merge_csv.py
```
**Output:**
- `merged_dataset.xlsx` - Combined Excel file
- `merged_dataset.csv` - Combined CSV file
- **19,400 total records** from all datasets

### Step 4: Convert to JSON ✓
**File:** `convert_to_json.py`
```bash
python convert_to_json.py
```
**Output:** `merged_dataset.json` - Clean JSON format for APIs

### Step 5: Apply Settlement Algorithm ✓
**File:** `settle_expenses.py`
```bash
python settle_expenses.py
```
**Output:** Console display of net balances and transactions

### Step 6: Run DebtEase Algorithm ✓
**File:** `debt_ease_algorithm.py`
```bash
python debt_ease_algorithm.py
```
**Outputs:**
- `balances.json` - Net balance for each of 122 participants
- `settlements.json` - 87 optimized settlement transactions

**Summary:**
```
Total participants: 122
Original transactions: 2,750
Minimum settlements required: 87
Reduction: 2,663 fewer transactions (96.8% reduction!)
```

### Step 7: Create UI Dashboard ✓
**Files:**
- `index.html` - Basic dashboard (local data fetching)
- `index_api.html` - Enhanced dashboard with API integration

**Features:**
- 📊 Summary statistics (total participants, min transactions, total balance)
- 🔄 Settlement plan with debtor→creditor transfers
- 💵 Net balances table (owed vs owing)
- 🎨 Modern, responsive design
- 🔗 API integration support

### Step 8: Run Local Web Server ✓
```bash
python -m http.server 8000
```
**Access:**
- Local: `http://localhost:8000`
- Codespace: Use the **Port Preview** feature
- View `index.html` for local data display

### Step 9: API Integration ✓
**File:** `api_integration.py`
```bash
python api_integration.py
```

---

## 📁 File Structure

```
/workspaces/Demo1/
├── Dataset/                              # Original datasets
│   ├── SmartSettle_MultiScenario_RealNames_INR (1).csv
│   ├── personal_expense_dataset.csv
│   ├── AggregatedData.csv
│   └── ... other datasets
│
├── Python Scripts (Data Processing)
│   ├── merge_csv.py                     # Merge all CSVs
│   ├── convert_to_json.py              # Convert to JSON
│   ├── settle_expenses.py              # Basic settlement
│   ├── debt_ease_algorithm.py          # DebtEase algorithm (Main)
│   └── api_integration.py              # API setup helper
│
├── Data Files (Generated)
│   ├── merged_dataset.csv              # All data in CSV
│   ├── merged_dataset.xlsx             # All data in Excel
│   ├── merged_dataset.json             # All data in JSON
│   ├── balances.json                   # Net balances (OUTPUT)
│   ├── settlements.json                # Settlement plan (OUTPUT)
│   └── settlement_results.json         # Combined results
│
├── Web UI (Frontend)
│   ├── index.html                      # Basic dashboard
│   ├── index_api.html                  # Advanced dashboard with API
│   └── .../files served on port 8000
│
└── README.md                            # This file
```

---

## 🚀 Quick Start Guide

### 1. Run the Complete Pipeline
```bash
# Step 1: Merge all datasets
python merge_csv.py

# Step 2: Convert to JSON
python convert_to_json.py

# Step 3: Apply DebtEase Algorithm
python debt_ease_algorithm.py

# Step 4: Start web server
python -m http.server 8000
```

### 2. View the Dashboard
- Open `http://localhost:8000` in your browser
- Click on `index.html`
- You'll see:
  - 📊 Summary stats (122 participants, 87 min transactions)
  - 🔄 Settlement plan (debtor→creditor transfers)
  - 💵 Net balances (who owes what)

### 3. Optional: API Integration
```bash
# Setup API credentials
python api_integration.py

# Then use index_api.html for remote data fetching
```

---

## 📊 Algorithm Explanation

### DebtEase Greedy Algorithm
1. **Calculate Net Balances:** For each person, compute:
   - `net_balance = total_paid - total_owed`
   - Positive = owed money (creditor)
   - Negative = owes money (debtor)

2. **Minimize Transactions:** Use greedy approach:
   - Sort creditors and debtors by amount (descending)
   - Match largest debtor with largest creditor
   - Record transaction and reduce both amounts
   - Continue until all balances = 0

3. **Result:** 
   - Original: 2,750 transactions
   - Optimized: 87 transactions
   - **Reduction: 96.8%**

---

## 📈 Output Files

### `balances.json`
```json
{
  "Varun Bansal": 64473.67,
  "Ayaan Khan": 62528.29,
  "Adnan Sami": 59977.04,
  ...
  "Pihu Verma": -57655.75,
  "Xenia D'Souza": -59894.72
}
```

### `settlements.json`
```json
{
  "total_transactions": 87,
  "settlements": [
    {
      "debtor": "Xenia D'Souza",
      "creditor": "Varun Bansal",
      "amount": 59894.72
    },
    ...
  ]
}
```

---

## 🔗 API Integration (JSONBin.io)

### Option 1: Auto Upload
```bash
python api_integration.py
```
Follow the prompts to upload `merged_dataset.json`

### Option 2: Manual Upload
1. Go to [https://jsonbin.io](https://jsonbin.io)
2. Create a new bin
3. Paste `merged_dataset.json` content
4. Copy Bin ID and API Key
5. Create `api_credentials.json`:
```json
{
  "bin_id": "YOUR_BIN_ID",
  "api_key": "YOUR_API_KEY"
}
```

### Option 3: Use in Web App
Open `index_api.html` and:
1. Select "API Integration"
2. Enter Bin ID and API Key
3. Click "Connect to API"
4. Dashboard now fetches data remotely

---

## 📊 Key Statistics

| Metric | Value |
|--------|-------|
| **Total Datasets** | 6 CSV files |
| **Merged Records** | 19,400 |
| **Shared Expenses** | 2,750 |
| **Unique Participants** | 122 |
| **Total Balance** | ₹398,871.75 |
| **Original Transactions** | 2,750 |
| **Minimum Settlements** | 87 |
| **Reduction Percentage** | 96.8% |

---

## 🌐 Deployment Options

### Option 1: Local Codespace
```bash
python -m http.server 8000
# Access: http://localhost:8000
```

### Option 2: GitHub Pages
1. Push `index.html` to GitHub
2. Enable GitHub Pages in settings
3. Access: `https://username.github.io/repo/index.html`

### Option 3: Remote API
1. Upload `merged_dataset.json` to JSONBin.io
2. Use `index_api.html` for remote access
3. No server maintenance needed

---

## ✨ Features

- ✅ Data merging (multiple formats)
- ✅ Algorithm optimization (96.8% reduction)
- ✅ Interactive dashboard
- ✅ API integration support
- ✅ Real-time data fetching
- ✅ Responsive design
- ✅ Clean JSON output

---

## 🔧 Troubleshooting

### "Module not found: pandas"
```bash
pip install pandas openpyxl
```

### "Port 8000 already in use"
```bash
python -m http.server 8001  # Use different port
```

### "API connection error"
- Check internet connection
- Verify Bin ID and API Key
- Ensure JSONBin.io service is online

### "Data not loading in dashboard"
- Check browser console for errors (F12)
- Verify JSON files exist
- Check data source radio button selection

---

## 📚 Additional Resources

- [JSONBin.io Documentation](https://jsonbin.io/docs)
- [MockAPI.io Guide](https://mockapi.io/)
- [Bootstrap Documentation](https://getbootstrap.com/docs/5.0/)
- [Python Pandas Tutorial](https://pandas.pydata.org/docs/)

---

## 👤 Author
**DebtEase Team** - Smart Debt Settlement Algorithm

---

**Last Updated:** April 12, 2026  
**Status:** ✅ All Steps Completed
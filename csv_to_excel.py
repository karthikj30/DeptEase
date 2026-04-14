import pandas as pd
import ast
from collections import defaultdict

def compute_balances(csv_file):
    balances = defaultdict(float)
    df = pd.read_csv(csv_file)
    for _, row in df.iterrows():
        paid_by = row['paid_by']
        total = float(row['total_amount_inr'])
        split_details = ast.literal_eval(row['split_details'])
        balances[paid_by] += total
        for person, amount in split_details.items():
            balances[person] -= amount
    return balances

def minimize_transactions(balances):
    creditors = []
    debtors = []
    for person, balance in balances.items():
        if balance > 0:
            creditors.append((person, balance))
        elif balance < 0:
            debtors.append((person, -balance))

    creditors.sort(key=lambda x: x[1], reverse=True)
    debtors.sort(key=lambda x: x[1], reverse=True)

    transactions = []
    i, j = 0, 0
    while i < len(debtors) and j < len(creditors):
        debtor, debt = debtors[i]
        creditor, credit = creditors[j]
        amount = min(debt, credit)
        transactions.append((debtor, creditor, amount))
        debt -= amount
        credit -= amount
        if debt == 0:
            i += 1
        else:
            debtors[i] = (debtor, debt)
        if credit == 0:
            j += 1
        else:
            creditors[j] = (creditor, credit)
    return transactions

# Read the CSV file
csv_file = 'Dataset/SmartSettle_MultiScenario_RealNames_INR (1).csv'
df = pd.read_csv(csv_file)

# Compute balances and transactions
balances = compute_balances(csv_file)
transactions = minimize_transactions(balances)

# Create balances DataFrame
balances_list = [{'Person': person, 'Balance': balance} for person, balance in sorted(balances.items(), key=lambda x: x[1], reverse=True) if abs(balance) > 0.01]
balances_df = pd.DataFrame(balances_list)

# Create transactions DataFrame
transactions_df = pd.DataFrame(transactions, columns=['Debtor', 'Creditor', 'Amount_INR'])

# Write to Excel with multiple sheets
excel_file = 'Dataset/SmartSettle_MultiScenario_RealNames_INR.xlsx'
with pd.ExcelWriter(excel_file, engine='openpyxl') as writer:
    df.to_excel(writer, sheet_name='Transactions', index=False)
    balances_df.to_excel(writer, sheet_name='Balances', index=False)
    transactions_df.to_excel(writer, sheet_name='Settlements', index=False)

print(f"Excel file created with multiple sheets: {excel_file}")
print(f"Minimum number of transactions: {len(transactions)}")
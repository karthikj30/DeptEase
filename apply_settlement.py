import json
import ast
from collections import defaultdict

# Load the merged JSON
with open("merged_dataset.json", "r") as f:
    data = json.load(f)

# Filter for shared expenses (records with 'paid_by' not null and 'split_details' as string)
shared_expenses = [record for record in data if record.get('paid_by') is not None and isinstance(record.get('split_details'), str)]

print(f"Shared expenses records: {len(shared_expenses)}")

# Compute balances
balances = defaultdict(float)
for row in shared_expenses:
    paid_by = row['paid_by']
    total = float(row['total_amount_inr'])
    split_details_str = row['split_details']
    split_details = ast.literal_eval(split_details_str)
    balances[paid_by] += total
    for person, amount in split_details.items():
        balances[person] -= amount

# Minimize transactions
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

transactions = minimize_transactions(balances)

# Prepare results
results = {
    "net_balances": {person: balance for person, balance in sorted(balances.items(), key=lambda x: x[1], reverse=True) if abs(balance) > 0.01},
    "minimum_transactions_count": len(transactions),
    "settlement_transactions": [{"debtor": d, "creditor": c, "amount": a} for d, c, a in transactions]
}

# Save to JSON
with open("settlement_results.json", "w") as f:
    json.dump(results, f, indent=4)

print("Settlement results saved to settlement_results.json")
print(f"Minimum number of transactions: {len(transactions)}")
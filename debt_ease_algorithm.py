import json
import ast
from collections import defaultdict

# Load the merged JSON
with open("merged_dataset.json", "r") as f:
    data = json.load(f)

# Filter for shared expenses (records with 'paid_by' not null and 'split_details' as string)
shared_expenses = [record for record in data if record.get('paid_by') is not None and isinstance(record.get('split_details'), str)]

print(f"Processing {len(shared_expenses)} shared expense records...")

# Compute balances
balances = defaultdict(float)
for row in shared_expenses:
    paid_by = row['paid_by']
    total = float(row['total_amount_inr'])
    split_details_str = row['split_details']
    try:
        split_details = ast.literal_eval(split_details_str)
        balances[paid_by] += total
        for person, amount in split_details.items():
            balances[person] -= amount
    except (ValueError, SyntaxError):
        continue

# Convert balances to sorted dictionary (creditors first)
net_balances = {}
for person, balance in sorted(balances.items(), key=lambda x: x[1], reverse=True):
    if abs(balance) > 0.01:  # Only include non-zero balances
        net_balances[person] = round(balance, 2)

print(f"Computed net balances for {len(net_balances)} participants")

# Greedy settlement algorithm
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
        transactions.append({
            "debtor": debtor,
            "creditor": creditor,
            "amount": round(amount, 2)
        })
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

settlements = minimize_transactions(balances)

# Save balances.json
with open("balances.json", "w") as f:
    json.dump(net_balances, f, indent=4)

print(f"✅ Saved net balances to balances.json")

# Save settlements.json
settlement_data = {
    "total_transactions": len(settlements),
    "settlements": settlements
}

with open("settlements.json", "w") as f:
    json.dump(settlement_data, f, indent=4)

print(f"✅ Saved {len(settlements)} settlement transactions to settlements.json")

# Summary
print("\n" + "="*50)
print("DEBTEASE ALGORITHM SUMMARY")
print("="*50)
print(f"Total participants: {len(net_balances)}")
print(f"Total balance in system: ₹{sum(net_balances.values()):.2f}")
print(f"Original transactions: {len(shared_expenses)}")
print(f"Minimum settlements required: {len(settlements)}")
print(f"Reduction: {len(shared_expenses) - len(settlements)} fewer transactions")
print("="*50)
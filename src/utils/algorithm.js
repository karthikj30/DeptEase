export function computeNetBalancesFromExpenses(expenses) {
  const balances = {};
  
  // Ensure everyone exists
  expenses.forEach(exp => {
      if (!balances[exp.paid_by]) balances[exp.paid_by] = 0;
      exp.split_between.forEach(person => {
          if (!balances[person]) balances[person] = 0;
      });
  });

  expenses.forEach(exp => {
      const total = parseFloat(exp.amount);
      const participants = exp.split_between;
      const share = total / participants.length;

      balances[exp.paid_by] += total;
      participants.forEach(person => {
          balances[person] -= share;
      });
  });
  
  return balances;
}

export function buildRawGraph(expenses) {
  const nodes = new Set();
  const links = [];

  expenses.forEach(exp => {
      nodes.add(exp.paid_by);
      const total = parseFloat(exp.amount);
      const share = total / exp.split_between.length;

      exp.split_between.forEach(person => {
          nodes.add(person);
          if (person !== exp.paid_by) {
              links.push({
                  source: person,
                  target: exp.paid_by,
                  value: share
              });
          }
      });
  });

  return {
      nodes: Array.from(nodes).map(id => ({ id })),
      links
  };
}

export function greedyOptimize(balances) {
  const creditors = [];
  const debtors = [];
  
  for (const [person, balance] of Object.entries(balances)) {
      if (balance > 0.01) creditors.push({ id: person, balance: Math.round(balance * 100) / 100 });
      else if (balance < -0.01) debtors.push({ id: person, balance: Math.round(-balance * 100) / 100 });
  }

  creditors.sort((a, b) => b.balance - a.balance);
  debtors.sort((a, b) => b.balance - a.balance);

  const transactions = [];
  const steps = [];
  let stepIndex = 1;

  if (creditors.length === 0 && debtors.length === 0) {
      steps.push({ id: stepIndex++, type: 'info', text: 'No imbalances found. Everyone is settled up!' });
      return { transactions: [], steps };
  }

  steps.push({ id: stepIndex++, type: 'info', text: `Step 1: Computed net balances. Found ${creditors.length} creditors and ${debtors.length} debtors.` });
  
  let i = 0; let j = 0;
  while (i < debtors.length && j < creditors.length) {
      let debtor = debtors[i];
      let creditor = creditors[j];
      
      let amount = Math.min(debtor.balance, creditor.balance);
      amount = Math.round(amount * 100) / 100;
      
      transactions.push({
          source: debtor.id,
          target: creditor.id,
          amount: amount
      });
      
      steps.push({
          id: stepIndex++,
          type: 'action',
          text: `Matched debtor ${debtor.id} (owed ₹${debtor.balance}) with creditor ${creditor.id} (owed ₹${creditor.balance}). Transferred ₹${amount}.`
      });

      debtor.balance -= amount;
      creditor.balance -= amount;
      
      debtor.balance = Math.round(debtor.balance * 100) / 100;
      creditor.balance = Math.round(creditor.balance * 100) / 100;

      if (debtor.balance === 0) i++;
      if (creditor.balance === 0) j++;
  }
  
  steps.push({ id: stepIndex, type: 'success', text: `Algorithm complete. Total transactions minimized to ${transactions.length}.` });

  return { transactions, steps };
}

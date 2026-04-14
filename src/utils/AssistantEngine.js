/**
 * Logic Engine for DebtEase Smart Assistant
 * Processes natural language queries against local expense/balance data.
 */

export async function processAssistantQuery(query, user = 'Me') {
  const text = query.toLowerCase();
  
  // 1. Get raw data from localStorage
  const expenses = JSON.parse(localStorage.getItem('debtEaseExpenses') || '[]');
  
  // 2. Fetch latest optimized balances from API
  let balances = {};
  let transactions = [];
  try {
    const res = await fetch('/api/optimize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ expenses })
    });
    const data = await res.json();
    balances = data.balances || {};
    transactions = data.transactions || [];
  } catch (err) {
    console.error("Assistant failed to fetch optimized data", err);
  }

  // --- QUERY HANDLERS ---

  // Q: "Who owes me?" or "Who is left to pay me?"
  if (text.includes('owe') || text.includes('pay me') || text.includes('receivable') || text.includes('milne')) {
    const creditors = Object.entries(balances).filter(([name, bal]) => bal > 1);
    // Find who owes the current user specifically (from transaction plan)
    const owingToMe = transactions.filter(t => 
      t.target?.toLowerCase().includes(user.toLowerCase()) || (user === 'Me' && t.target === 'Me')
    );
    
    if (owingToMe.length === 0) {
      return "According to the latest settlement plan, no one needs to pay you directly. You're all square! ✅";
    }

    const list = owingToMe.map(t => `${t.source} owes you ₹${Math.round(t.amount)}`).join(', ');
    return `Here is who is left to pay you: ${list}. These are optimized to minimize the number of transfers.`;
  }

  // Q: "How much do I owe?" or "Who do I pay?" / "Who do I need to pay?"
  const payIntent = (
    text.includes('i owe') ||
    text.includes('owe anyone') ||
    text.includes('need to pay') ||
    text.includes('who do i pay') ||
    text.includes('who do i need to pay') ||
    text.includes('pay karna') ||
    text.includes('dena hai')
  );

  if (payIntent) {
    const myDebt = transactions.filter(t => 
      t.source?.toLowerCase().includes(user.toLowerCase()) || (user === 'Me' && t.source === 'Me')
    );
    
    if (myDebt.length === 0) {
        return "You don't owe anyone anything in the current settlement plan! Great job. 😎";
    }

    const list = myDebt.map(t => `₹${Math.round(t.amount)} to ${t.target}`).join(', ');
    return `You need to pay: ${list}.`;
  }

  // Q: "Total spend" or "How much did I spend?"
  if (text.includes('total spend') || text.includes('kharcha') || text.includes('spend') || text.includes('spent') || text.includes('spending')) {
    const myTotal = expenses
      .filter(e => e.paid_by.toLowerCase().includes(user.toLowerCase()) || (user === 'Me' && e.paid_by === 'Me'))
      .reduce((sum, e) => sum + parseFloat(e.amount || 0), 0);
    
    return `You have personally paid for a total of ₹${myTotal.toLocaleString()} across all recorded expenses.`;
  }

  // Q: "What is done?" or "Status"
  if (text.includes('status') || text.includes('done') || text.includes('summary')) {
    const totalTransactions = transactions.length;
    const totalVolume = transactions.reduce((s, t) => s + t.amount, 0);
    return `We have ${expenses.length} expenses logged. The optimized plan requires ${totalTransactions} transfers totaling ₹${Math.round(totalVolume).toLocaleString()} to settle everything.`;
  }

  // Q: Help / fallback
  return "I can help with questions like: 'Who owes me?', 'How much did I spend?', 'Who do I need to pay?', or 'What is the current status?'. Try asking in English or Hinglish!";
}

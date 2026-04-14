import React, { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import Topbar from '../components/Topbar';
import { useCurrency } from '../utils/CurrencyContext';
import { computeNetBalancesFromExpenses, greedyOptimize } from '../utils/algorithm';

function WhatIf({ onSignOut }) {
  const { formatFromBase } = useCurrency();
  const [realExpenses, setRealExpenses] = useState([]);
  const [tempExpenses, setTempExpenses] = useState([]);
  const [participants, setParticipants] = useState([]);
  
  // Form state
  const [newExp, setNewExp] = useState({
    paid_by: '',
    amount: '',
    category: 'Simulation',
    split_between: [],
    include: true
  });

  // Results
  const [originalResult, setOriginalResult] = useState({ balances: {}, transactions: [], chaos: 0 });
  const [simulatedResult, setSimulatedResult] = useState({ balances: {}, transactions: [], chaos: 0 });

  useEffect(() => {
    const expenses = JSON.parse(localStorage.getItem('debtEaseExpenses') || '[]');
    setRealExpenses(expenses);
    
    // Extract unique participants
    const parts = new Set();
    expenses.forEach(ex => {
      parts.add(ex.paid_by);
      (ex.split_between || []).forEach(p => parts.add(p));
    });
    setParticipants(Array.from(parts).sort());

    // Calc original
    const origB = computeNetBalancesFromExpenses(expenses);
    const origS = greedyOptimize(origB);
    setOriginalResult({
      balances: origB,
      transactions: origS.transactions,
      chaos: calculateChaos(origB, origS.transactions)
    });
  }, []);

  const calculateChaos = (balances, transactions) => {
    const totalVol = Object.values(balances).reduce((s, v) => s + Math.abs(v), 0);
    return transactions.length + (totalVol / 1000);
  };

  const addTempExpense = () => {
    if (!newExp.paid_by || !newExp.amount || !newExp.split_between) {
      alert('Please fill all required fields');
      return;
    }

    // Parse comma separated string into array
    const splitArr = typeof newExp.split_between === 'string' 
      ? newExp.split_between.split(',').map(s => s.trim()).filter(s => s.length > 0)
      : newExp.split_between;

    if (splitArr.length === 0) {
      alert('Please specify participants to split with');
      return;
    }

    const updatedTemp = [...tempExpenses, { ...newExp, split_between: splitArr, id: Date.now() }];
    setTempExpenses(updatedTemp);
    runSimulation(updatedTemp);
    // Reset form
    setNewExp({ ...newExp, amount: '', split_between: '' });
  };

  const runSimulation = (tempList) => {
    const includedTemp = tempList.filter(ex => ex.include);
    const combined = [...realExpenses, ...includedTemp];
    
    const simB = computeNetBalancesFromExpenses(combined);
    const simS = greedyOptimize(simB);
    
    setSimulatedResult({
      balances: simB,
      transactions: simS.transactions,
      chaos: calculateChaos(simB, simS.transactions)
    });
  };

  const toggleTemp = (id) => {
    const updated = tempExpenses.map(ex => ex.id === id ? { ...ex, include: !ex.include } : ex);
    setTempExpenses(updated);
    runSimulation(updated);
  };

  const resetAll = () => {
    setTempExpenses([]);
    const origB = computeNetBalancesFromExpenses(realExpenses);
    const origS = greedyOptimize(origB);
    setSimulatedResult({
      balances: origB,
      transactions: origS.transactions,
      chaos: calculateChaos(origB, origS.transactions)
    });
  };

  const getReasoning = () => {
    const diff = simulatedResult.transactions.length - originalResult.transactions.length;
    const chaosDiff = (simulatedResult.chaos - originalResult.chaos).toFixed(2);
    
    let text = "";
    if (diff < 0) text = `Great! This simulation reduces the total number of payments by ${Math.abs(diff)}. `;
    else if (diff > 0) text = `Adding these expenses increases the complexity by ${diff} additional transactions. `;
    else text = "Transaction count remains stable. ";

    if (chaosDiff > 0) text += `The overall 'Chaos Score' increased by ${chaosDiff} units due to higher debt volume.`;
    else if (chaosDiff < 0) text += `Remarkably, the 'Chaos Score' dropped by ${Math.abs(chaosDiff)} units.`;
    
    return text;
  };

  const fmt = (v) => formatFromBase(v, { minimumFractionDigits: 2 });

  return (
    <>
      <Topbar />
      <section className="page-section active">
        <div className="dashboard-layout">
          <Sidebar onSignOut={onSignOut} />
          
          <div className="main-panel">
            <div className="dashboard-hero">
              <div className="hero-header">
                <div>
                  <span className="info-badge">🧪 Reality Testing</span>
                  <h2>What-If Simulator</h2>
                  <p>Model hypothetical expenses to see how they impact your group's current balances.</p>
                </div>
                <button className="button-secondary" onClick={resetAll}>Reset Simulation</button>
              </div>
            </div>

            <div className="dashboard-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
              {/* Left Column: Form and Temp List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                <div className="feature-card">
                  <h3 style={{ marginBottom: '1.5rem' }}>Add Hypothetical Expense</h3>
                  <div className="add-expense-form" style={{ display: 'grid', gap: '1rem' }}>
                    <div className="form-group">
                      <label>Paid By</label>
                      <input 
                        type="text" 
                        placeholder="Type name here..."
                        value={newExp.paid_by} 
                        onChange={e => setNewExp({...newExp, paid_by: e.target.value})}
                        style={{ width: '100%', padding: '12px', borderRadius: '10px', background: 'var(--background)', color: 'white', border: '1px solid var(--border)' }}
                      />
                    </div>

                    <div className="form-group">
                      <label>Amount (₹)</label>
                      <input 
                        type="number" 
                        placeholder="0.00"
                        value={newExp.amount}
                        onChange={e => setNewExp({...newExp, amount: e.target.value})}
                        style={{ width: '100%', padding: '12px', borderRadius: '10px', background: 'var(--background)', color: 'white', border: '1px solid var(--border)' }}
                      />
                    </div>

                    <div className="form-group">
                      <label>Split Between (Comma separated names)</label>
                      <input 
                        type="text" 
                        placeholder="e.g. Alice, Bob, Rahul"
                        value={Array.isArray(newExp.split_between) ? newExp.split_between.join(', ') : newExp.split_between}
                        onChange={e => {
                          const val = e.target.value;
                          setNewExp({...newExp, split_between: val});
                        }}
                        style={{ width: '100%', padding: '12px', borderRadius: '10px', background: 'var(--background)', color: 'white', border: '1px solid var(--border)' }}
                      />
                    </div>

                    <button className="button-primary" onClick={addTempExpense} style={{ marginTop: '10px' }}>Add to Simulation</button>
                  </div>
                </div>

                <div className="feature-card">
                  <h3 style={{ marginBottom: '1rem' }}>Simulation Queue</h3>
                  {tempExpenses.length === 0 ? (
                    <p style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>No hypothetical expenses added yet.</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {tempExpenses.map(ex => (
                        <div key={ex.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', border: '1px solid var(--border)' }}>
                          <div>
                            <div style={{ fontWeight: 600 }}>{ex.paid_by} paid {formatFromBase(ex.amount)}</div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>Split: {ex.split_between.join(', ')}</div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <label style={{ fontSize: '0.8rem' }}>Include:</label>
                            <input 
                              type="checkbox" 
                              checked={ex.include} 
                              onChange={() => toggleTemp(ex.id)}
                            />
                            <button className="nb-clear-btn" onClick={() => {
                              const updated = tempExpenses.filter(e => e.id !== ex.id);
                              setTempExpenses(updated);
                              runSimulation(updated);
                            }}>✕</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column: Comparison Result */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                   {/* Original Card */}
                   <div className="feature-card" style={{ border: '1px solid var(--border)' }}>
                      <h4 style={{ color: 'var(--muted)', marginBottom: '1rem' }}>CURRENT REALITY</h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ fontSize: '1.5rem', fontWeight: 800 }}>{originalResult.transactions.length} <span style={{ fontSize: '0.8rem', opacity: 0.6 }}>Transfers</span></div>
                        <div style={{ fontSize: '0.9rem' }}>Chaos Score: {originalResult.chaos.toFixed(2)}</div>
                        <hr style={{ border: 0, borderTop: '1px solid var(--border)', margin: '10px 0' }} />
                        {Object.entries(originalResult.balances).slice(0, 4).map(([name, bal]) => (
                          <div key={name} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                            <span>{name}</span>
                            <span style={{ color: bal > 0 ? '#10b981' : '#f87171' }}>{fmt(bal)}</span>
                          </div>
                        ))}
                      </div>
                   </div>

                   {/* Simulated Card */}
                   <div className="feature-card" style={{ border: '1px solid #7c3aed', background: 'rgba(124, 58, 237, 0.05)' }}>
                      <h4 style={{ color: '#c4b5fd', marginBottom: '1rem' }}>SIMULATED REALITY</h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#c4b5fd' }}>{simulatedResult.transactions.length} <span style={{ fontSize: '0.8rem', opacity: 0.6 }}>Transfers</span></div>
                        <div style={{ fontSize: '0.9rem' }}>Chaos Score: {simulatedResult.chaos.toFixed(2)}</div>
                        <hr style={{ border: 0, borderTop: '1px solid rgba(124,58,237,0.3)', margin: '10px 0' }} />
                        {Object.entries(simulatedResult.balances).slice(0, 4).map(([name, bal]) => (
                          <div key={name} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                            <span>{name}</span>
                            <span style={{ color: bal > 0 ? '#10b981' : '#f87171' }}>{fmt(bal)}</span>
                          </div>
                        ))}
                      </div>
                   </div>
                </div>

                <div className="feature-card" style={{ borderLeft: '4px solid #7c3aed' }}>
                  <h3 style={{ marginBottom: '1rem' }}>Decision reasoning & Insight</h3>
                  <p style={{ lineHeight: 1.6, color: '#c4b5fd' }}>
                    {getReasoning()}
                  </p>
                  <div style={{ marginTop: '1.5rem', padding: '15px', background: 'rgba(124, 58, 237, 0.1)', borderRadius: '10px', fontSize: '0.9rem' }}>
                    <strong>💡 Simulation Tip:</strong> Large simulated expenses paid by a "Debtor" often simplify the group debt by canceling out their previous obligations!
                  </div>
                </div>

                <div className="feature-card">
                  <h3 style={{ marginBottom: '1rem' }}>Impact on Settlement Count</h3>
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: '2rem', height: '120px', paddingBottom: '20px', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                      <div style={{ width: '40px', background: 'var(--muted)', height: `${(originalResult.transactions.length / 10) * 100}%`, minHeight: '10px', borderRadius: '4px 4px 0 0' }} />
                      <span style={{ fontSize: '0.75rem' }}>Current</span>
                    </div>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                      <div style={{ width: '40px', background: '#7c3aed', height: `${(simulatedResult.transactions.length / 10) * 100}%`, minHeight: '10px', borderRadius: '4px 4px 0 0' }} />
                      <span style={{ fontSize: '0.75rem' }}>Simulated</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

export default WhatIf;

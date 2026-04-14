import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import AppTour from '../components/AppTour';
import { useCurrency } from '../utils/CurrencyContext';

function Dashboard({ user, onSignOut }) {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    participants: 0,
    totalBalance: 0,
    transactions: 0
  });
  const { formatFromBase } = useCurrency();

  const [balances, setBalances] = useState({});
  const [settlements, setSettlements] = useState({ transactions: [] });
  const [loading, setLoading] = useState(true);

  // Derived user name
  const name = user ? user.split('@')[0] : 'User';

  useEffect(() => {
    async function loadData() {
      try {
        // Pull raw expenses directly from local browser storage unconditionally
        const rawExpenses = JSON.parse(localStorage.getItem('debtEaseExpenses') || '[]');
        const response = await fetch('/api/optimize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ expenses: rawExpenses })
        });
        const result = await response.json();

        const balancesData = result.balances;
        const transactions = result.transactions;

        const participants = Object.keys(balancesData).length;
        const totalBalance = Object.values(balancesData).reduce((sum, val) => sum + Math.abs(val), 0) / 2;

        setStats({
          participants,
          totalBalance,
          transactions: transactions.length,
          currentUserBalance: balancesData[name] || 0
        });

        setBalances(balancesData);
        setSettlements({ transactions });
      } catch (error) {
        console.warn('Unable to load summary stats', error);
      } finally {
        setLoading(false);
      }
    }

    loadData();

    // Basic realtime sync: listen for other tabs saving expenses via BroadcastChannel
    let channel;
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      channel = new BroadcastChannel('debtEase-expenses');
      channel.onmessage = (event) => {
        if (event.data && event.data.type === 'expenses-updated') {
          loadData();
        }
      };
    }

    return () => {
      if (channel) channel.close();
    };
  }, []);

  const renderTopBalances = () => {
    const sorted = Object.entries(balances).sort((a, b) => b[1] - a[1]);
    return sorted.slice(0, 5).map(([person, amount], i) => (
      <div className="graph-item" key={i}>
        <div>
          <strong>{person}</strong>
          <span> balance</span>
        </div>
        <div className="graph-amount">{formatFromBase(Math.round(Math.abs(amount)))}</div>
      </div>
    ));
  };

  const renderTopSettlements = () => {
    if (!settlements.transactions) return null;
    return settlements.transactions.slice(0, 5).map((txn, i) => (
      <div className="graph-item" key={i}>
        <div>
          <strong>{txn.source}</strong>
          <span> → {txn.target}</span>
        </div>
        <div className="graph-amount">{formatFromBase(Math.round(txn.amount))}</div>
      </div>
    ));
  };

  return (
    <section className="page-section active">
      <AppTour />
      <div className="dashboard-layout">
        <Sidebar onSignOut={onSignOut} />

        <div className="main-panel">
          <div className="dashboard-hero">
            <div className="hero-header">
              <div>
                <span className="info-badge">Settlement dashboard</span>
                <h2>Hello, {name}</h2>
                <p>Your latest expense data and settlement summary are ready.</p>
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  id="tour-add-receipt"
                  className="profile-button"
                  style={{ background: 'var(--accent)', color: 'white', border: 'none' }}
                  onClick={() => navigate('/vault?mode=wizard')}
                >
                  <span style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>+</span>
                  <span>Add Receipt</span>
                </button>
                <button className="profile-button">
                  <span className="profile-avatar">{name.charAt(0).toUpperCase()}</span>
                  <span>My profile</span>
                </button>
              </div>
            </div>
          </div>

          <div className="dashboard-grid">
            <div className="dashboard-left-column">
              <div className="feature-card" id="tour-stats">
                <h3>Balance summary</h3>
                <p style={{ color: 'var(--muted)' }}>Your latest group balance totals and settlement count appear below.</p>
                <div className="stat-grid">
                  <div className="stat-card">
                    <h3>Participants</h3>
                    <strong>{loading ? '...' : stats.participants}</strong>
                  </div>
                  <div className="stat-card">
                    <h3>Optimized settlements</h3>
                    <strong>{loading ? '...' : stats.transactions}</strong>
                  </div>
                  <div className="stat-card">
                    <h3>Absolute total (approx)</h3>
                    <strong>{loading ? '...' : formatFromBase(Math.round(stats.totalBalance))}</strong>
                  </div>
                </div>
              </div>

              <div className="feature-card">
                <h3>Major solution features</h3>
                <p style={{ color: 'var(--muted)' }}>DebtEase transforms raw shared expenses into an optimized settlement plan, with clear participant insights and before/after visualization.</p>
                <div className="feature-grid">
                  <div className="feature-box">
                    <strong>Net balance analysis</strong>
                    <p>Automatically calculate how much each person owes or is owed across group expenses.</p>
                  </div>
                  <div className="feature-box">
                    <strong>Minimum transfers</strong>
                    <p>Reduce the settlement load with a compact transfer plan that uses fewer transactions.</p>
                  </div>
                  <div className="feature-box">
                    <strong>Before/after comparison</strong>
                    <p>Compare the chaotic original splits with the cleaned-up settlement flow.</p>
                  </div>
                </div>
              </div>


              <div className="action-card">
                <h3>Settlement overview</h3>
                <p style={{ color: 'var(--muted)' }}>DebtEase calculates the minimum transfers needed to close shared balances. Use this panel to review totals and continue with payouts.</p>
                <div className="action-list">
                  <div className="action-item"><strong>Review transaction plan</strong><span>{stats.transactions} optimized transfers</span></div>
                  <div className="action-item"><strong>Monitor balances</strong><span>{stats.participants} participants, owed vs owes</span></div>
                  <div className="action-item"><strong>Confirm payouts</strong><span>Use email verification for safe sign in</span></div>
                </div>
              </div>
            </div>

            <div className="dashboard-right-column">
              <div className="graph-card" id="tour-graph">
                <h3>Before vs after</h3>
                <p style={{ color: 'var(--muted)' }}>Compare the raw expense obligations with the optimized settlement plan generated by DebtEase.</p>
                <div className="graph-comparison">
                  <div className="graph-block">
                    <h4>Top Net Balances</h4>
                    {loading ? <p style={{ color: 'var(--muted)' }}>Loading...</p> : renderTopBalances()}
                    <p className="graph-summary" style={{ color: 'var(--muted)', marginTop: '12px' }}>
                      Displaying top 5 earners in the group.
                    </p>
                  </div>
                  <div className="graph-block">
                    <h4>Top Optimised Transfers</h4>
                    {loading ? <p style={{ color: 'var(--muted)' }}>Loading...</p> : renderTopSettlements()}
                    <p className="graph-summary" style={{ color: 'var(--muted)', marginTop: '12px' }}>
                      {stats.transactions ? `Displaying top 5 of ${stats.transactions} total transfers.` : 'No transactions found.'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="activity-card">
                <h3>Activity snapshot</h3>
                <div className="activity-list">
                  <div className="activity-item"><strong>Verified account</strong><span>Today</span></div>
                  <div className="activity-item"><strong>Last sign in</strong><span>Just now</span></div>
                  <div className="activity-item"><strong>Data from</strong><span>Local Storage Engine</span></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default Dashboard;

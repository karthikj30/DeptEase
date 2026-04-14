import React, { useState, useEffect, useCallback } from 'react';
import Sidebar from '../components/Sidebar';
import Topbar from '../components/Topbar';
import { useCurrency } from '../utils/CurrencyContext';

function SettlementPlan({ onSignOut }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showLog, setShowLog] = useState(false);
  const [mode, setMode] = useState('base'); // 'base' | 'whatif'
  const [activeNudgeIndex, setActiveNudgeIndex] = useState(0);
  const { formatFromBase } = useCurrency();

  const loadPlan = useCallback(async () => {
    try {
      const rawExpenses = JSON.parse(localStorage.getItem('debtEaseExpenses') || '[]');
      const res = await fetch('/api/optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expenses: rawExpenses }),
      });
      if (!res.ok) throw new Error('Backend error');
      const result = await res.json();
      setData(result);
    } catch (err) {
      console.error('Failed to load settlement plan', err);
      // Fallback to empty data to avoid crash
      setData({ transactions: [], stats: {}, steps: [] });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPlan();

    // Re-fetch plan when new expenses are added elsewhere
    let channel;
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      channel = new BroadcastChannel('debtEase-expenses');
      channel.onmessage = (event) => {
        if (event.data && event.data.type === 'expenses-updated') {
          loadPlan();
        }
      };
    }

    return () => {
      if (channel) channel.close();
    };
  }, [loadPlan]);

  const getInitials = (name) => {
    if (!name || typeof name !== 'string') return '?';
    return name.split(' ').filter(Boolean).map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const { transactions = [], stats = {}, steps = [] } = data || {};
  const hasData = transactions.length > 0;

  // Compute nudges safely
  const nudges = hasData
    ? [
        'Close the largest balance first so the settlement feels lighter and easier to finish.',
        mode === 'base'
          ? 'Base plan is the action view. Use it to complete real transfers instead of rethinking the graph.'
          : 'What-if mode is for comparison only. Switch back to the base plan when you are ready to settle.',
        'Mark a transfer as done as soon as it is paid. Small confirmations keep the whole plan trustworthy.',
        (stats && stats.reduction_pct > 0)
          ? `Your optimization removed ${stats.reduction_pct}% of the original transfer noise. That is the right behavior to repeat.`
          : 'Add more expenses or refresh the plan to see the behavior nudges adapt to the latest balances.',
      ]
    : [
        'No open settlement yet. Add an expense to unlock the behavior-based nudges for this group.',
      ];

  useEffect(() => {
    setActiveNudgeIndex(0);
  }, [mode, hasData]);

  useEffect(() => {
    if (nudges.length <= 1) return undefined;
    const timer = window.setInterval(() => {
      setActiveNudgeIndex((current) => (current + 1) % nudges.length);
    }, 7000);
    return () => window.clearInterval(timer);
  }, [nudges.length]);

  if (loading) {
    return (
      <div className="page-wrapper">
        <Topbar />
        <section className="page-section active">
          <div className="dashboard-layout">
            <Sidebar onSignOut={onSignOut} />
            <div className="main-panel">
               <div className="nb-skeleton-card" style={{ height: '300px', marginBottom: '20px' }} />
               <div className="nb-skeleton-card" style={{ height: '100px', marginBottom: '10px' }} />
               <div className="nb-skeleton-card" style={{ height: '100px' }} />
            </div>
          </div>
        </section>
      </div>
    );
  }

  // Generate effective transactions
  const effectiveTransactions = mode === 'base' 
    ? (transactions || []) 
    : (data?.before_graph?.links?.map(l => ({
        source: l.source,
        target: l.target,
        amount: l.value
      })) || transactions || []);

  const chaosBefore = (stats && stats.original_tx_count) || 0;
  const chaosAfter = (stats && stats.optimized_tx_count) || 0;
  const chaosReduction = (stats && stats.reduction_pct) || 0;

  return (
    <div className="page-wrapper">
      <Topbar />
      <section className="page-section active">
        <div className="dashboard-layout">
          <Sidebar onSignOut={onSignOut} />

          <div className="main-panel">
            {/* ── Page Header ── */}
            <div className="dashboard-hero sp-hero">
              <div className="hero-header">
                <div>
                  <span className="info-badge">🤝 Optimized Settlement Plan</span>
                  <h2 style={{ margin: '10px 0 6px' }}>Clear All Debts</h2>
                  <p>Our greedy algorithm has minimized your payments. Follow this plan to settle everyone's balances.</p>
                </div>
              </div>

              {/* Stats Comparison */}
              <div className="sp-comparison-grid">
                <div className="sp-card">
                  <span className="sp-card-title">Original Transactions</span>
                  <div className="sp-card-val">{chaosBefore}</div>
                  <span className="sp-badge sp-badge-before">Before Optimization</span>
                </div>
                <div className="sp-card">
                  <span className="sp-card-title">Minimized Total</span>
                  <div className="sp-card-val">{chaosAfter}</div>
                  <span className="sp-badge sp-badge-after">After Optimization</span>
                </div>
                <div className="sp-card">
                  <span className="sp-card-title">Total Effort Saved</span>
                  <div className="sp-card-val">{chaosReduction}%</div>
                  <span className="sp-badge sp-badge-saved">✨ Transaction reduction</span>
                </div>
              </div>

              {hasData && (
                <div className="sp-whatif-toggle">
                  <div>
                    <span className="info-badge">What If | Chaos Score</span>
                    <p style={{ marginTop: '6px', color: 'var(--muted)' }}>
                      Your <strong>Chaos Score</strong> drops from <strong>{chaosBefore}</strong> implied
                      obligations down to <strong>{chaosAfter}</strong> real transfers
                      ({chaosReduction}% reduction).
                    </p>
                  </div>
                  <div className="sp-whatif-controls">
                    <button
                      className={`pill-button${mode === 'base' ? ' pill-active' : ''}`}
                      onClick={() => setMode('base')}
                    >
                      Base plan
                    </button>
                    <button
                      className={`pill-button${mode === 'whatif' ? ' pill-active' : ''}`}
                      onClick={() => setMode('whatif')}
                    >
                      What If view
                    </button>
                  </div>
                </div>
              )}

              <div className="sp-nudge-ticker" aria-live="polite">
                <div className="sp-nudge-meta">
                  <span className="sp-nudge-label">Behavior nudges</span>
                  <span className="sp-nudge-count">Reminder {activeNudgeIndex + 1}/{nudges.length}</span>
                </div>
                <div className="sp-track-outer">
                   <div className="sp-nudge-card" key={activeNudgeIndex}>
                      {nudges[activeNudgeIndex]}
                   </div>
                </div>
              </div>
            </div>

            {/* ── Settlement List ── */}
            <div className="feature-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <h3 style={{ margin: 0 }}>
                  {mode === 'base' ? 'Payment Checklist (Optimized)' : 'Raw Obligations (What If View)'}
                </h3>
                {hasData && (
                  <span style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>
                    {effectiveTransactions.length} settlement{effectiveTransactions.length !== 1 ? 's' : ''}
                  </span>
                )}
              </div>

              {!hasData ? (
                <div className="nb-empty">
                  <div className="nb-empty-icon">🎉</div>
                  <div className="nb-empty-title">All Settled!</div>
                  <div className="nb-empty-sub">No outstanding debts found. Your group is perfectly balanced.</div>
                </div>
              ) : (
                <div className="sp-plan-container">
                  {effectiveTransactions.map((tx, i) => (
                    <div key={i} className="sp-item-card" style={{ animationDelay: `${i * 80}ms` }}>
                      <div className="sp-person">
                        <div className="sp-avatar">{getInitials(tx?.source)}</div>
                        <div className="sp-name">
                          <div style={{ fontSize: '0.75rem', color: 'var(--muted)', fontWeight: 400 }}>Payer</div>
                          {tx?.source || 'Unknown'}
                        </div>
                      </div>

                      <div className="sp-arrow-box">
                        <div className="sp-amt">{formatFromBase ? formatFromBase(tx?.amount || 0) : `₹${tx?.amount}`}</div>
                        <svg className="sp-arrow-svg" viewBox="0 0 100 10">
                           <path d="M0 5 L95 5 M90 0 L100 5 L90 10" fill="none" stroke="currentColor" strokeWidth="2" />
                        </svg>
                      </div>

                      <div className="sp-person">
                        <div className="sp-avatar" style={{ borderStyle: 'dashed' }}>{getInitials(tx?.target)}</div>
                        <div className="sp-name">
                          <div style={{ fontSize: '0.75rem', color: 'var(--muted)', fontWeight: 400 }}>Recipient</div>
                          {tx?.target || 'Unknown'}
                        </div>
                      </div>

                      <div style={{ marginLeft: 'auto' }}>
                        <button className="sp-action-btn" onClick={() => alert(`Log settlement for ${tx?.source} pays ${tx?.target}?`)}>
                          Settle Now
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {hasData && steps && steps.length > 0 && (
                 <div className="sp-breakdown-toggle">
                    <button className="sp-breakdown-btn" onClick={() => setShowLog(!showLog)}>
                       {showLog ? '▲ Hide' : '▼ Show'} Algorithm Breakdown
                    </button>
                    {showLog && (
                       <div className="sp-breakdown-content">
                          {steps.map(s => (
                             <div key={s.id} className="sp-step">
                                <span className="sp-step-id">#{s.id}</span>
                                {s.text}
                             </div>
                          ))}
                       </div>
                    )}
                 </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

export default SettlementPlan;

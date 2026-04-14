import React, { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import Topbar from '../components/Topbar';
import { useCurrency } from '../utils/CurrencyContext';

function NetBalances({ onSignOut }) {
  const { formatFromBase } = useCurrency();
  const [netTable, setNetTable]     = useState([]);
  const [loading, setLoading]       = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder]   = useState('high-to-low');
  const [filterTab, setFilterTab]   = useState('all');
  const [animateCards, setAnimateCards] = useState(false);
  const [summary, setSummary]       = useState({ receivable: 0, payable: 0, settlementsNeeded: 0 });
  const [error, setError]           = useState(null);

  useEffect(() => {
    async function loadData() {
      try {
        const rawExpenses = JSON.parse(localStorage.getItem('debtEaseExpenses') || '[]');

        // Try dedicated endpoint first, fall back to /api/optimize
        let result;
        try {
          const res = await fetch('/api/net-balances', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ expenses: rawExpenses }),
          });
          if (!res.ok) throw new Error('net-balances unavailable');
          result = await res.json();
        } catch {
          const res = await fetch('/api/optimize', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ expenses: rawExpenses }),
          });
          result = await res.json();
        }

        const bData = result.balances || {};
        const table = Object.entries(bData)
          .map(([name, bal]) => ({
            name,
            balance: bal,
            absBalance: Math.abs(bal),
            status: bal > 0.01 ? 'creditor' : bal < -0.01 ? 'debtor' : 'settled',
          }))
          .filter(x => x.status !== 'settled')
          .sort((a, b) => b.absBalance - a.absBalance);

        setNetTable(table);

        const rec = table.filter(t => t.status === 'creditor').reduce((s, t) => s + t.balance, 0);
        const pay = table.filter(t => t.status === 'debtor').reduce((s, t) => s + Math.abs(t.balance), 0);

        setSummary({
          receivable: rec,
          payable: pay,
          settlementsNeeded: result.transactions ? result.transactions.length : 0,
        });

        setTimeout(() => setAnimateCards(true), 80);
      } catch (err) {
        console.error('Failed to load net balances', err);
        setError('Could not load balance data. Make sure the backend is running.');
      } finally {
        setLoading(false);
      }
    }
    loadData();

    // Realtime updates from other tabs when expenses are added
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

  /* ─── derived values ─── */
  const maxBalance   = Math.max(...netTable.map(t => t.absBalance), 1);
  const creditorCount = netTable.filter(t => t.status === 'creditor').length;
  const debtorCount   = netTable.filter(t => t.status === 'debtor').length;

  const processedData = netTable
    .filter(item => filterTab === 'all' || item.status === filterTab)
    .filter(item => item.name.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => {
      if (sortOrder === 'high-to-low') return b.absBalance - a.absBalance;
      if (sortOrder === 'low-to-high') return a.absBalance - b.absBalance;
      if (sortOrder === 'az') return a.name.localeCompare(b.name);
      if (sortOrder === 'za') return b.name.localeCompare(a.name);
      return 0;
    });

  const getInitials = name =>
    name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  const fmt = n => formatFromBase(n, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  /* ─── render ─── */
  return (
    <>
      <Topbar />
      <section className="page-section active">
        <div className="dashboard-layout">
          <Sidebar onSignOut={onSignOut} />

          <div className="main-panel">

            {/* ── Page Header ── */}
            <div className="dashboard-hero" style={{ marginBottom: 0 }}>
              <div className="hero-header">
                <div>
                  <span className="info-badge">⚖️ Live Settlement Data</span>
                  <h2 style={{ margin: '10px 0 6px' }}>Net Balances</h2>
                  <p>Real-time balance analysis — who owes and who is owed across all shared expenses.</p>
                </div>
                {!loading && (
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexShrink: 0 }}>
                    <div className="nb-stat-pill nb-pill-green">
                      <span className="nb-pill-num">{creditorCount}</span> Creditors
                    </div>
                    <div className="nb-stat-pill nb-pill-red">
                      <span className="nb-pill-num">{debtorCount}</span> Debtors
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* ── Summary Cards ── */}
            <div className="nb-summary-grid">
              {loading ? (
                [1, 2, 3].map(i => <div key={i} className="nb-summary-skeleton" />)
              ) : (
                <>
                  <div className="nb-summary-card nb-card-green">
                    <div className="nb-summary-icon-wrap nb-icon-green">📥</div>
                    <div className="nb-summary-body">
                      <div className="nb-summary-label">Total Receivable</div>
                      <div className="nb-summary-value nb-val-green">{fmt(summary.receivable)}</div>
                      <div className="nb-summary-sub">{creditorCount} {creditorCount === 1 ? 'person' : 'people'} are owed money</div>
                    </div>
                  </div>

                  <div className="nb-summary-card nb-card-red">
                    <div className="nb-summary-icon-wrap nb-icon-red">📤</div>
                    <div className="nb-summary-body">
                      <div className="nb-summary-label">Total Payable</div>
                      <div className="nb-summary-value nb-val-red">{fmt(summary.payable)}</div>
                      <div className="nb-summary-sub">{debtorCount} {debtorCount === 1 ? 'person' : 'people'} owe money</div>
                    </div>
                  </div>

                  <div className="nb-summary-card nb-card-blue">
                    <div className="nb-summary-icon-wrap nb-icon-blue">🔄</div>
                    <div className="nb-summary-body">
                      <div className="nb-summary-label">Settlements Needed</div>
                      <div className="nb-summary-value nb-val-blue" style={{ fontSize: '2rem' }}>
                        {summary.settlementsNeeded}
                      </div>
                      <div className="nb-summary-sub">Optimised transactions to clear all debts</div>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* ── Search + Sort + Filter controls ── */}
            <div className="feature-card nb-controls-card">
              <div className="nb-controls-row">
                {/* Search */}
                <div className="nb-search-wrap">
                  <svg className="nb-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
                  </svg>
                  <input
                    id="nb-search-input"
                    type="text"
                    className="nb-search-input"
                    placeholder="Search by name…"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                  />
                  {searchQuery && (
                    <button className="nb-clear-btn" onClick={() => setSearchQuery('')} aria-label="Clear search">✕</button>
                  )}
                </div>

                {/* Sort */}
                <div className="nb-sort-group">
                  <span className="nb-sort-label">Sort:</span>
                  {[
                    { value: 'high-to-low', label: '↓ High' },
                    { value: 'low-to-high', label: '↑ Low' },
                    { value: 'az',          label: 'A→Z' },
                    { value: 'za',          label: 'Z→A' },
                  ].map(opt => (
                    <button
                      key={opt.value}
                      id={`nb-sort-${opt.value}`}
                      className={`nb-sort-btn${sortOrder === opt.value ? ' active' : ''}`}
                      onClick={() => setSortOrder(opt.value)}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Filter tabs */}
              <div className="nb-filter-row">
                {[
                  { val: 'all',      label: `All`,        count: netTable.length },
                  { val: 'creditor', label: `Creditors`,  count: creditorCount },
                  { val: 'debtor',   label: `Debtors`,    count: debtorCount },
                ].map(tab => (
                  <button
                    key={tab.val}
                    id={`nb-tab-${tab.val}`}
                    className={`nb-tab${filterTab === tab.val ? ' active' : ''}`}
                    onClick={() => setFilterTab(tab.val)}
                  >
                    {tab.label}
                    <span className={`nb-tab-count${filterTab === tab.val ? ' active-count' : ''}`}>
                      {tab.count}
                    </span>
                  </button>
                ))}
                <span className="nb-results-info">
                  {!loading && `${processedData.length} result${processedData.length !== 1 ? 's' : ''}`}
                </span>
              </div>
            </div>

            {/* ── Balance Card Grid ── */}
            <div className="feature-card">
              <h3 style={{ margin: '0 0 20px' }}>Balance Breakdown</h3>

              {error && (
                <div className="nb-error-box">{error}</div>
              )}

              {loading ? (
                /* Skeleton loader */
                <div className="nb-cards-grid">
                  {[1, 2, 3, 4, 5, 6].map(i => (
                    <div key={i} className="nb-skeleton-card">
                      <div style={{ display: 'flex', gap: '14px', alignItems: 'center', marginBottom: '16px' }}>
                        <div className="nb-skel nb-skel-avatar" />
                        <div style={{ flex: 1, display: 'grid', gap: '8px' }}>
                          <div className="nb-skel" style={{ width: '60%', height: '14px', borderRadius: '6px' }} />
                          <div className="nb-skel" style={{ width: '40%', height: '12px', borderRadius: '6px' }} />
                        </div>
                        <div className="nb-skel" style={{ width: '80px', height: '22px', borderRadius: '8px' }} />
                      </div>
                      <div className="nb-skel" style={{ width: '100%', height: '6px', borderRadius: '4px' }} />
                    </div>
                  ))}
                </div>
              ) : processedData.length === 0 ? (
                /* Empty state */
                <div className="nb-empty">
                  <div className="nb-empty-icon">🔍</div>
                  <div className="nb-empty-title">No results found</div>
                  <div className="nb-empty-sub">Try adjusting your search or switching the filter tab.</div>
                  <button
                    className="button-secondary"
                    style={{ marginTop: '18px' }}
                    onClick={() => { setSearchQuery(''); setFilterTab('all'); }}
                  >
                    Clear all filters
                  </button>
                </div>
              ) : (
                /* ── The balance cards ── */
                <div className="nb-cards-grid">
                  {processedData.map((item, i) => (
                    <div
                      key={item.name}
                      className={`nb-balance-card nb-card-${item.status}${animateCards ? ' nb-card-visible' : ''}`}
                      style={{ animationDelay: `${i * 45}ms` }}
                    >
                      {/* Card top row */}
                      <div className="nb-card-header">
                        <div className={`nb-avatar nb-avatar-${item.status}`}>
                          {getInitials(item.name)}
                        </div>
                        <div className="nb-card-name-block">
                          <div className="nb-person-name">{item.name}</div>
                          <span className={`nb-status-badge nb-badge-${item.status}`}>
                            {item.status === 'creditor' ? '↑ Creditor' : '↓ Debtor'}
                          </span>
                        </div>
                        <div className={`nb-card-amount nb-amount-${item.status}`}>
                          <span className="nb-amount-sign">{item.status === 'creditor' ? '+' : '−'}</span>
                          ₹{fmt(item.absBalance)}
                        </div>
                      </div>

                      {/* Progress bar */}
                      <div className="nb-bar-track">
                        <div
                          className={`nb-bar-fill nb-fill-${item.status}`}
                          style={{ width: `${Math.max((item.absBalance / maxBalance) * 100, 4)}%` }}
                        />
                      </div>

                      {/* Card footer */}
                      <div className="nb-card-footer">
                        <span className="nb-footer-label">Net Amount</span>
                        <span className={`nb-footer-action nb-footer-${item.status}`}>
                          {item.status === 'creditor' ? '→ To receive' : '→ To pay'}&nbsp;
                          ₹{fmt(item.absBalance)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        </div>
      </section>
    </>
  );
}

export default NetBalances;

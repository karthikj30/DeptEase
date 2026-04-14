import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Sidebar from '../components/Sidebar';
import Topbar from '../components/Topbar';
import { useCurrency } from '../utils/CurrencyContext';

function SettlementTracker({ onSignOut }) {
  const { formatFromBase } = useCurrency();
  const [settlements, setSettlements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [paidIds, setPaidIds] = useState(() => {
    return JSON.parse(localStorage.getItem('debtEasePaidSettlements') || '[]');
  });

  // Feature: Payment Simulation State
  const [payingTx, setPayingTx] = useState(null); // The tx currently in the payment flow
  const [paymentMethod, setPaymentMethod] = useState('upi'); // 'upi' | 'card' | 'netbank'
  const [paymentStep, setPaymentStep] = useState('choice'); // 'choice' | 'processing' | 'success'

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const rawExpenses = JSON.parse(localStorage.getItem('debtEaseExpenses') || '[]');
      const res = await fetch('/api/optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expenses: rawExpenses }),
      });
      const result = await res.json();
      
      const transactions = (result.transactions || []).map((t, idx) => ({
        ...t,
        id: `tx_${t.source}_${t.target}_${t.amount}_${idx}`
      }));
      setSettlements(transactions);
    } catch (err) {
      console.error('Failed to load tracker data', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    let channel;
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      channel = new BroadcastChannel('debtEase-expenses');
      channel.onmessage = (event) => {
        if (event.data && event.data.type === 'expenses-updated') {
          loadData();
        }
      };
    }
    return () => { if (channel) channel.close(); };
  }, [loadData]);

  useEffect(() => {
    localStorage.setItem('debtEasePaidSettlements', JSON.stringify(paidIds));
  }, [paidIds]);

  const togglePaid = (id) => {
    setPaidIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const processSimulatedPayment = () => {
    setPaymentStep('processing');
    setTimeout(() => {
        setPaymentStep('success');
        // Actually mark it as paid after success
        if (payingTx && !paidIds.includes(payingTx.id)) {
            togglePaid(payingTx.id);
        }
        setTimeout(() => {
            setPayingTx(null);
            setPaymentStep('choice');
        }, 1500);
    }, 2000);
  };

  const statistics = useMemo(() => {
    const total = settlements.reduce((acc, s) => acc + (s.amount || 0), 0);
    const completed = settlements
      .filter(s => paidIds.includes(s.id))
      .reduce((acc, s) => acc + (s.amount || 0), 0);
    
    const countTotal = settlements.length;
    const countCompleted = settlements.filter(s => paidIds.includes(s.id)).length;
    const progress = countTotal > 0 ? (countCompleted / countTotal) * 100 : 0;

    return { 
      total, 
      completed, 
      pending: total - completed, 
      countTotal, 
      countCompleted, 
      progress 
    };
  }, [settlements, paidIds]);

  const getInitials = (name) => {
    if (!name || typeof name !== 'string') return '?';
    return name.split(' ').filter(Boolean).map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <>
      <Topbar />
      <section className="page-section active">
        <div className="dashboard-layout">
          <Sidebar onSignOut={onSignOut} />
          
          <div className="main-panel">
            <div className="dashboard-hero sp-hero">
              <div className="hero-header">
                <div>
                  <span className="info-badge">✅ Execution Tracker</span>
                  <h2 style={{ margin: '10px 0 6px' }}>Settlement Progress</h2>
                  <p>Check off payments manually or use **Pay Now** to settle instantly via simulated gateway.</p>
                </div>
              </div>

              <div className="sp-comparison-grid">
                <div className="sp-card">
                  <span className="sp-card-title">Pending Amount</span>
                  <div className="sp-card-val" style={{ color: '#f87171' }}>{formatFromBase(statistics.pending)}</div>
                  <span className="sp-badge sp-badge-before">{statistics.countTotal - statistics.countCompleted} Transfers left</span>
                </div>
                <div className="sp-card">
                  <span className="sp-card-title">Completed</span>
                  <div className="sp-card-val" style={{ color: '#10b981' }}>{formatFromBase(statistics.completed)}</div>
                  <span className="sp-badge sp-badge-after">{statistics.countCompleted} Transfers done</span>
                </div>
                <div className="sp-card">
                  <span className="sp-card-title">Total Progress</span>
                  <div className="sp-card-val">{Math.round(statistics.progress)}%</div>
                  <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', marginTop: '8px' }}>
                     <div style={{ width: `${statistics.progress}%`, height: '100%', background: 'var(--accent)', borderRadius: '2px', transition: 'width 0.4s ease' }} />
                  </div>
                </div>
              </div>
            </div>

            <div className="dashboard-grid">
              <div className="feature-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                  <h3 style={{ margin: 0 }}>Active Payment Checklist</h3>
                  <button className="button-secondary" onClick={() => setPaidIds([])} style={{ fontSize: '0.8rem', padding: '6px 12px', width: 'auto' }}>Reset All Status</button>
                </div>

                {loading ? (
                  <div className="nb-skeleton-card" style={{ height: '200px' }} />
                ) : settlements.length === 0 ? (
                  <div className="nb-empty">
                    <div className="nb-empty-icon">🎉</div>
                    <div className="nb-empty-title">Nothing to track!</div>
                    <div className="nb-empty-sub">Add some expenses to generate a settlement plan.</div>
                  </div>
                ) : (
                  <div className="sp-plan-container">
                    {settlements.map((tx, i) => {
                      const isPaid = paidIds.includes(tx.id);
                      return (
                        <div key={tx.id} className={`sp-item-card ${isPaid ? 'completed-tx' : ''}`} style={{ 
                          opacity: isPaid ? 0.5 : 1,
                          transition: 'all 0.3s ease',
                          border: isPaid ? '1px solid var(--border)' : '1px solid rgba(124, 58, 237, 0.2)',
                          background: isPaid ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.05)'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            <input 
                              type="checkbox" 
                              checked={isPaid}
                              onChange={() => togglePaid(tx.id)}
                              style={{ width: '20px', height: '20px', cursor: 'pointer', borderRadius: '4px' }}
                            />
                            <div className="sp-person" style={{ filter: isPaid ? 'grayscale(1)' : 'none' }}>
                              <div className="sp-avatar">{getInitials(tx.source)}</div>
                              <div className="sp-name">
                                <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>Who Pays</div>
                                {tx.source}
                              </div>
                            </div>
                          </div>

                          <div className="sp-arrow-box" style={{ opacity: isPaid ? 0.3 : 1 }}>
                            <div className="sp-amt">{formatFromBase(tx.amount)}</div>
                            <svg className="sp-arrow-svg" viewBox="0 0 100 10">
                               <path d="M0 5 L95 5 M90 0 L100 5 L90 10" fill="none" stroke="currentColor" strokeWidth="2" />
                            </svg>
                          </div>

                          <div className="sp-person" style={{ filter: isPaid ? 'grayscale(1)' : 'none' }}>
                            <div className="sp-avatar" style={{ borderStyle: 'dashed' }}>{getInitials(tx.target)}</div>
                            <div className="sp-name">
                              <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>To Receive</div>
                              {tx.target}
                            </div>
                          </div>

                          <div style={{ marginLeft: 'auto', textAlign: 'right', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                             {!isPaid && (
                               <button 
                                className="button-primary" 
                                style={{ padding: '8px 16px', borderRadius: '10px', fontSize: '0.85rem', width: 'auto'}}
                                onClick={() => setPayingTx(tx)}
                               >
                                Pay Now
                               </button>
                             )}
                             {isPaid ? (
                               <span style={{ fontSize: '0.8rem', color: '#10b981', fontWeight: 600 }}>✅ PAID</span>
                             ) : (
                               <span style={{ fontSize: '0.8rem', color: '#f87171', fontWeight: 600 }}>🕒 PENDING</span>
                             )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Simulated Payment Portal (Modal) ── */}
      {payingTx && (
        <div className="payment-modal-overlay">
            <div className="payment-modal-container animate-fade-in">
                {paymentStep === 'choice' && (
                    <>
                        <div className="pm-header">
                            <div>
                                <h3>Complete Payment</h3>
                                <p style={{ fontSize: '0.9rem', color: 'var(--muted)' }}>Settle <strong>{formatFromBase(payingTx.amount)}</strong> to <strong>{payingTx.target}</strong></p>
                            </div>
                            <button className="nb-clear-btn" onClick={() => setPayingTx(null)}>✕</button>
                        </div>
                        
                        <div className="pm-tabs">
                            <button className={paymentMethod === 'upi' ? 'pm-tab active' : 'pm-tab'} onClick={() => setPaymentMethod('upi')}>UPI</button>
                            <button className={paymentMethod === 'card' ? 'pm-tab active' : 'pm-tab'} onClick={() => setPaymentMethod('card')}>Card</button>
                            <button className={paymentMethod === 'netbank' ? 'pm-tab active' : 'pm-tab'} onClick={() => setPaymentMethod('netbank')}>Net Banking</button>
                        </div>

                        <div className="pm-content">
                            {paymentMethod === 'upi' && (
                                <div style={{ textAlign: 'center', padding: '20px 0' }}>
                                    <div style={{ 
                                        width: '180px', height: '180px', background: '#fff', padding: '10px', borderRadius: '12px', margin: '0 auto', 
                                        display: 'flex', justifyContent: 'center', alignItems: 'center', border: '4px solid #7c3aed'
                                    }}>
                                        <img 
                                            src={require('../upi_qr_mockup.png')} 
                                            alt="UPI QR" 
                                            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                                        />
                                    </div>
                                    <p style={{ marginTop: '1.5rem', fontSize: '0.95rem' }}>Scan QR using any UPI app to pay</p>
                                    <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'center', gap: '10px', opacity: 0.6 }}>
                                        <span>GPay</span> • <span>PhonePe</span> • <span>Paytm</span>
                                    </div>
                                </div>
                            )}

                            {paymentMethod === 'card' && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '10px 0' }}>
                                    <div style={{ 
                                        height: '160px', background: 'linear-gradient(135deg, #7c3aed, #3b82f6)', borderRadius: '16px', 
                                        padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', color: '#fff'
                                    }}>
                                        <div style={{ fontSize: '1.2rem', fontWeight: 600, letterSpacing: '2px' }}>**** **** **** 4242</div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                            <div>
                                                <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', opacity: 0.8 }}>Card Holder</div>
                                                <div style={{ fontSize: '0.9rem' }}>RAJAT SHARMA</div>
                                            </div>
                                            <div style={{ textAlign: 'right' }}>
                                                <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', opacity: 0.8 }}>Expires</div>
                                                <div style={{ fontSize: '0.9rem' }}>09/27</div>
                                            </div>
                                        </div>
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                        <input type="text" placeholder="CVV" style={{ padding: '12px', background: 'var(--background)', border: '1px solid var(--border)', borderRadius: '8px', color: 'white' }} defaultValue="***" />
                                        <input type="text" placeholder="Expiry" style={{ padding: '12px', background: 'var(--background)', border: '1px solid var(--border)', borderRadius: '8px', color: 'white' }} defaultValue="09/27" />
                                    </div>
                                </div>
                            )}

                            {paymentMethod === 'netbank' && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '10px 0' }}>
                                    {['HDFC Bank', 'ICICI Bank', 'SBI Bank', 'Axis Bank'].map(bank => (
                                        <button key={bank} style={{ 
                                            width: '100%', padding: '12px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', 
                                            borderRadius: '8px', color: 'white', textAlign: 'left', display: 'flex', justifyContent: 'space-between'
                                        }}>
                                            {bank}
                                            <span style={{ opacity: 0.4 }}>→</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        <button className="button-primary" style={{ width: '100%', marginTop: 'auto', padding: '16px', borderRadius: '14px' }} onClick={processSimulatedPayment}>
                            Confirm & Pay {formatFromBase(payingTx.amount)}
                        </button>
                    </>
                )}

                {paymentStep === 'processing' && (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '2rem' }}>
                        <div className="nb-loading-spinner" style={{ width: '60px', height: '60px' }} />
                        <div style={{ textAlign: 'center' }}>
                            <h3 style={{ marginBottom: '8px' }}>Verifying with Bank...</h3>
                            <p style={{ color: 'var(--muted)' }}>Securing your transaction securely</p>
                        </div>
                    </div>
                )}

                {paymentStep === 'success' && (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '1.5rem', animation: 'scaleUp 0.4s ease-out' }}>
                        <div style={{ width: '80px', height: '80px', background: '#10b981', borderRadius: '50%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="20 6 9 17 4 12" />
                            </svg>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                            <h2 style={{ color: '#10b981', marginBottom: '8px' }}>Payment Successful!</h2>
                            <p style={{ color: 'var(--muted)' }}>The recipient has been notified.</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
      )}

      <style>{`
        .completed-tx {
          text-decoration: none;
        }
        input[type="checkbox"]:checked {
          accent-color: #10b981;
        }
        .payment-modal-overlay {
            position: fixed;
            inset: 0;
            background: rgba(0,0,0,0.8);
            backdrop-filter: blur(8px);
            z-index: 1000;
            display: grid;
            place-items: center;
            padding: 20px;
        }
        .payment-modal-container {
            width: 100%;
            max-width: 480px;
            background: var(--surface);
            border: 1px solid var(--border);
            border-radius: 32px;
            padding: 32px;
            height: 580px;
            display: flex;
            flex-direction: column;
            box-shadow: 0 40px 100px rgba(0,0,0,0.5);
            position: relative;
        }
        .pm-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 24px;
        }
        .pm-tabs {
            display: grid;
            grid-template-columns: 1fr 1fr 1fr;
            background: rgba(255,255,255,0.05);
            padding: 4px;
            border-radius: 12px;
            margin-bottom: 24px;
        }
        .pm-tab {
            background: none;
            border: none;
            color: var(--muted);
            padding: 10px;
            border-radius: 8px;
            font-size: 0.85rem;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
        }
        .pm-tab.active {
            background: #7c3aed;
            color: white;
            box-shadow: 0 4px 12px rgba(124, 58, 237, 0.3);
        }
        .pm-content {
            flex: 1;
            margin-bottom: 24px;
        }
        @keyframes scaleUp {
            from { transform: scale(0.8); opacity: 0; }
            to { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </>
  );
}

export default SettlementTracker;

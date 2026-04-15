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

    // Simulate network delay for verification
    setTimeout(() => {
      setPaymentStep('success');

      // Trigger a notification if possible
      console.log("Tracker: Attempting notification. Permission:", Notification.permission);
      if (window.Notification && Notification.permission === "granted") {
        new Notification("Payment Successful! ✅", {
          body: `You have successfully settled the payment to ${payingTx.target}.`,
        });
      } else if (window.Notification && Notification.permission === "denied") {
        console.warn("Tracker: System notification blocked by browser settings.");
      } else {
        console.log("Tracker: Notification permission not yet granted.");
      }

      // Actually mark it as paid after success
      if (payingTx && !paidIds.includes(payingTx.id)) {
        togglePaid(payingTx.id);
      }

      // Return to list after viewing success (slightly longer to allow reading)
      setTimeout(() => {
        setPayingTx(null);
        setPaymentStep('choice');
      }, 3500);
    }, 2800);
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
                            {isPaid ? (
                              <span style={{ fontSize: '0.8rem', color: '#10b981', fontWeight: 600 }}>✅ PAID</span>
                            ) : (
                              <button
                                className="button-primary"
                                style={{ padding: '8px 16px', borderRadius: '10px', fontSize: '0.85rem', width: 'auto' }}
                                onClick={() => {
                                  setPayingTx(tx);
                                  setPaymentStep('choice');
                                }}
                              >
                                Pay Now
                              </button>
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

      {/* ── Simulated Payment Portal (Premium Modal) ── */}
      {payingTx && (
        <div className="payment-modal-overlay">
          <div className="payment-modal-container animate-fade-up">
            {paymentStep === 'choice' && (
              <div className="animate-fade-up">
                <div className="pm-header">
                  <div>
                    <h3 style={{ fontSize: '1.4rem', marginBottom: '4px' }}>Select Payment Method</h3>
                    <p style={{ fontSize: '0.9rem', color: 'var(--muted)' }}>Settle <strong>{formatFromBase(payingTx.amount)}</strong> to <strong>{payingTx.target}</strong></p>
                  </div>
                  <button className="nb-clear-btn" onClick={() => setPayingTx(null)} style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer', color: 'white' }}>✕</button>
                </div>

                <div className="pm-methods-grid">
                  <div className="pm-method-card" onClick={() => { setPaymentMethod('upi'); setPaymentStep('details'); }}>
                    <div className="pm-method-icon">📱</div>
                    <div className="pm-method-info">
                      <strong>UPI</strong>
                      <span>GPay, PhonePe, Paytm</span>
                    </div>
                    <div className="pm-method-arrow">→</div>
                  </div>
                  <div className="pm-method-card" onClick={() => { setPaymentMethod('card'); setPaymentStep('details'); }}>
                    <div className="pm-method-icon">💳</div>
                    <div className="pm-method-info">
                      <strong>Credit / Debit Card</strong>
                      <span>Visa, Mastercard, RuPay</span>
                    </div>
                    <div className="pm-method-arrow">→</div>
                  </div>
                  <div className="pm-method-card" onClick={() => { setPaymentMethod('netbank'); setPaymentStep('details'); }}>
                    <div className="pm-method-icon">🏦</div>
                    <div className="pm-method-info">
                      <strong>Net Banking</strong>
                      <span>HDFC, ICICI, SBI, Axis</span>
                    </div>
                    <div className="pm-method-arrow">→</div>
                  </div>
                </div>
              </div>
            )}

            {paymentStep === 'details' && (
              <>
                <div className="pm-header">
                  <div>
                    <button
                      onClick={() => setPaymentStep('choice')}
                      style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', padding: 0, marginBottom: '8px', fontSize: '0.9rem', fontWeight: 600 }}
                    >
                      ← Back
                    </button>
                    <h3 style={{ fontSize: '1.4rem', marginBottom: '4px' }}>
                      {paymentMethod === 'upi' ? 'UPI Payment' : paymentMethod === 'card' ? 'Card Details' : 'Select Bank'}
                    </h3>
                    <p style={{ fontSize: '0.9rem', color: 'var(--muted)' }}>Amount to pay: <strong>{formatFromBase(payingTx.amount)}</strong></p>
                  </div>
                  <button className="nb-clear-btn" onClick={() => setPayingTx(null)} style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer', color: 'white' }}>✕</button>
                </div>

                <div className="pm-content">
                  {paymentMethod === 'upi' && (
                    <div className="animate-fade-up" style={{ textAlign: 'center', padding: '10px 0' }}>
                      <p style={{ color: 'var(--muted)', fontSize: '0.9rem', marginBottom: '20px' }}>Scan the QR code below using any UPI app to complete your transaction securely.</p>
                      <div style={{
                        width: '200px', height: '200px', background: '#fff', padding: '12px', borderRadius: '24px', margin: '0 auto',
                        display: 'flex', justifyContent: 'center', alignItems: 'center', border: '8px solid rgba(124, 58, 237, 0.1)',
                        boxShadow: '0 20px 40px rgba(0,0,0,0.2)'
                      }}>
                        <img
                          src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=upi://pay?pa=debt.ease@upi&pn=DebtEase&am=${payingTx.amount / 100}&cu=INR`}
                          alt="UPI QR"
                          style={{ width: '100%', height: '100%', borderRadius: '12px' }}
                        />
                      </div>
                      <p style={{ marginTop: '1.5rem', fontSize: '1rem', fontWeight: 500 }}>Settle Instantly</p>
                    </div>
                  )}

                  {paymentMethod === 'card' && (
                    <div className="animate-fade-up" style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
                      <p style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>Enter your card information. Your secure payment is processed via encrypted gateway.</p>
                      <div className="premium-card-visual" style={{
                        height: '170px', background: 'linear-gradient(135deg, #7c3aed, #3b82f6, #9333ea)', borderRadius: '20px',
                        padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', color: '#fff',
                        boxShadow: '0 15px 30px rgba(124, 58, 237, 0.3)', position: 'relative', overflow: 'hidden'
                      }}>
                        <div style={{ position: 'absolute', top: '-20px', right: '-20px', width: '120px', height: '120px', background: 'rgba(255,255,255,0.1)', borderRadius: '50%' }} />
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div style={{ width: '45px', height: '35px', background: 'rgba(255,255,255,0.2)', borderRadius: '6px' }} />
                          <span style={{ fontWeight: 800, fontSize: '1.2rem', fontStyle: 'italic' }}>VISA</span>
                        </div>
                        <div style={{ fontSize: '1.3rem', fontWeight: 600, letterSpacing: '3px', textShadow: '0 2px 4px rgba(0,0,0,0.2)' }}>**** **** **** 4242</div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <div>
                            <div style={{ fontSize: '0.6rem', textTransform: 'uppercase', opacity: 0.7, letterSpacing: '1px' }}>Card Holder</div>
                            <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>{payingTx.source.toUpperCase()}</div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '0.6rem', textTransform: 'uppercase', opacity: 0.7, letterSpacing: '1px' }}>Expires</div>
                            <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>09/27</div>
                          </div>
                        </div>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '1rem' }}>
                        <div className="input-group">
                          <input type="text" placeholder="Card Number" style={{ padding: '14px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', borderRadius: '12px', color: 'white' }} defaultValue="4242 4242 4242 4242" />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                          <input type="text" placeholder="MM/YY" style={{ padding: '14px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', borderRadius: '12px', color: 'white' }} defaultValue="09/27" />
                          <input type="password" placeholder="CVV" style={{ padding: '14px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', borderRadius: '12px', color: 'white' }} defaultValue="***" />
                        </div>
                      </div>
                    </div>
                  )}

                  {paymentMethod === 'netbank' && (
                    <div className="animate-fade-up" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <p style={{ color: 'var(--muted)', fontSize: '0.9rem', marginBottom: '10px' }}>Choose your primary bank account for a fast and secure direct transfer.</p>
                      {['HDFC Bank', 'ICICI Bank', 'SBI Bank', 'Axis Bank'].map((bank, i) => (
                        <button key={bank} style={{
                          width: '100%', padding: '14px 20px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)',
                          borderRadius: '14px', color: 'white', textAlign: 'left', display: 'flex', justifyContent: 'space-between',
                          alignItems: 'center', cursor: 'pointer', transition: 'all 0.2s', animationDelay: `${i * 0.1}s`
                        }} className="animate-fade-up">
                          <span style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <span style={{ width: '32px', height: '32px', background: 'rgba(255,255,255,0.1)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem' }}>🏦</span>
                            {bank}
                          </span>
                          <span style={{ opacity: 0.4 }}>→</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <button className="button-primary" style={{
                  width: '100%', marginTop: 'auto', padding: '18px', borderRadius: '18px',
                  fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px'
                }} onClick={processSimulatedPayment}>
                  Confirm & Pay {formatFromBase(payingTx.amount)}
                </button>
              </>
            )}

            {paymentStep === 'processing' && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '2rem' }}>
                <div style={{ position: 'relative', width: '80px', height: '80px' }}>
                  <div className="nb-loading-spinner" style={{ width: '80px', height: '80px', border: '4px solid rgba(124, 58, 237, 0.1)', borderTopColor: '#7c3aed' }} />
                  <div className="loading-ring" style={{ position: 'absolute', inset: -10, borderRadius: '50%' }} />
                </div>
                <div style={{ textAlign: 'center' }}>
                  <h3 style={{ marginBottom: '10px', fontSize: '1.5rem' }}>Verifying Transaction</h3>
                  <p style={{ color: 'var(--muted)', maxWidth: '280px', lineHeigh: 1.6 }}>Communicating with your bank via secure gateway...</p>
                </div>
              </div>
            )}

            {paymentStep === 'success' && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '1.5rem' }}>
                <div className="animate-success" style={{ width: '100px', height: '100px', background: '#10b981', borderRadius: '50%', display: 'flex', justifyContent: 'center', alignItems: 'center', boxShadow: '0 20px 40px rgba(16, 185, 129, 0.3)' }}>
                  <svg width="50" height="50" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <h2 style={{ color: '#10b981', marginBottom: '12px', fontSize: '2rem' }}>Settled!</h2>
                  <p style={{ color: 'var(--muted)', fontSize: '1.1rem' }}>Recipient has been notified of the payment.</p>
                  <div style={{ marginTop: '24px', padding: '12px 20px', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '12px', color: '#34d399', fontSize: '0.9rem', fontWeight: 600 }}>
                    Transaction ID: DE-{Math.random().toString(36).substr(2, 9).toUpperCase()}
                  </div>
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
        .pm-methods-grid {
            display: grid;
            gap: 16px;
        }
        .pm-method-card {
            background: rgba(255,255,255,0.03);
            border: 1px solid var(--border);
            border-radius: 20px;
            padding: 20px;
            display: flex;
            align-items: center;
            gap: 18px;
            cursor: pointer;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .pm-method-card:hover {
            background: rgba(124, 58, 237, 0.08);
            border-color: var(--accent);
            transform: translateY(-2px);
            box-shadow: 0 10px 30px rgba(0,0,0,0.2);
        }
        .pm-method-icon {
            width: 54px;
            height: 54px;
            background: rgba(255,255,255,0.05);
            border-radius: 14px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 1.6rem;
        }
        .pm-method-card:hover .pm-method-icon {
            background: var(--accent);
            color: white;
        }
        .pm-method-info {
            flex: 1;
        }
        .pm-method-info strong {
            display: block;
            font-size: 1.1rem;
            margin-bottom: 2px;
        }
        .pm-method-info span {
            font-size: 0.82rem;
            color: var(--muted);
        }
        .pm-method-arrow {
            opacity: 0.2;
            font-size: 1.2rem;
            transition: all 0.3s;
        }
        .pm-method-card:hover .pm-method-arrow {
            opacity: 1;
            transform: translateX(4px);
            color: var(--accent);
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

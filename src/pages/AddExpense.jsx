import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Topbar from '../components/Topbar';
import { parseExpenseVoice } from '../utils/VoiceProcessor';
import { useCurrency } from '../utils/CurrencyContext';

/* ─── Category definitions ─── */
const CATEGORIES = [
  { id: 'food',      label: 'Food & Dining',   icon: '🍽️',  color: '#f59e0b' },
  { id: 'travel',    label: 'Travel',           icon: '✈️',  color: '#3b82f6' },
  { id: 'stay',      label: 'Stay / Hotel',     icon: '🏨',  color: '#8b5cf6' },
  { id: 'shopping',  label: 'Shopping',         icon: '🛍️',  color: '#ec4899' },
  { id: 'utilities', label: 'Utilities',        icon: '💡',  color: '#10b981' },
  { id: 'transport', label: 'Transport',        icon: '🚗',  color: '#06b6d4' },
  { id: 'entertainment', label: 'Entertainment',icon: '🎬',  color: '#f43f5e' },
  { id: 'other',     label: 'Other',            icon: '📦',  color: '#94a3b8' },
];

/* ─── Sample group members extracted from existing expenses ─── */
function extractKnownMembers() {
  try {
    const expenses = JSON.parse(localStorage.getItem('debtEaseExpenses') || '[]');
    const members = new Set();
    expenses.forEach(e => {
      if (e.paid_by) members.add(e.paid_by);
      (e.split_between || []).forEach(p => members.add(p));
    });
    return [...members].sort();
  } catch { return []; }
}

function AddExpense({ onSignOut }) {
  const navigate = useNavigate();

  /* ─── Form state ─── */
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [paidBy, setPaidBy] = useState('');
  const [category, setCategory] = useState('food');
  const [sharedAmong, setSharedAmong] = useState([]);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [newMember, setNewMember] = useState('');

  /* ─── Uneven Split State ─── */
  const [splitMode, setSplitMode] = useState('equal'); // 'equal', 'exact', 'percent'
  const [customSplits, setCustomSplits] = useState({}); // { name: val }

  /* ─── UI state ─── */
  const [knownMembers, setKnownMembers] = useState([]);
  const [toast, setToast] = useState({ msg: '', type: 'success' });
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [step, setStep] = useState(1); // 1=details, 2=split
  const [recentExpenses, setRecentExpenses] = useState([]);
  const [showRecent, setShowRecent] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [voiceInsight, setVoiceInsight] = useState(null);
  const amountRef = useRef(null);
  const recognitionRef = useRef(null);
  const membersRef = useRef([]);
  const { symbol, toBaseAmount, formatFromBase } = useCurrency();

  /* ─── Load known members + recent expenses on mount ─── */
  useEffect(() => {
    const members = extractKnownMembers();
    setKnownMembers(members);
    membersRef.current = members;
    try {
      const all = JSON.parse(localStorage.getItem('debtEaseExpenses') || '[]');
      setRecentExpenses(all.slice(-5).reverse());
    } catch {}

    // Initialize Speech Recognition
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'en-IN'; // Good for Hinglish

      recognitionRef.current.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        handleVoiceInput(transcript);
        setIsListening(false);
      };

      recognitionRef.current.onerror = (event) => {
        setIsListening(false);
        if (event.error === 'not-allowed') {
          showToast('Microphone access denied. Please allow mic permissions in your browser.', 'error');
        } else {
          showToast(`Speech recognition stopped: ${event.error || 'unknown error'}`, 'error');
        }
      };

      recognitionRef.current.onend = () => setIsListening(false);
    }
  }, []);

  const handleVoiceInput = (text) => {
    const parsed = parseExpenseVoice(text, membersRef.current);
    if (parsed.description) setDescription(parsed.description);
    if (parsed.amount)      setAmount(parsed.amount.toString());
    if (parsed.payer)       setPaidBy(parsed.payer);
    
    if (parsed.participants.length > 0) {
      setSharedAmong(prev => {
        const next = new Set([...prev, ...parsed.participants]);
        return [...next].sort();
      });
    }

    if (parsed.description || parsed.amount) {
      setVoiceInsight({
        description: parsed.description,
        amount: parsed.amount,
        payer: parsed.payer,
        participants: parsed.participants
      });
      
      // Text-to-Speech Feedback
      if (window.speechSynthesis) {
        const msg = new SpeechSynthesisUtterance(
          `Detected ${parsed.amount || ''} rupees for ${parsed.description || 'expense'} ${parsed.participants.length ? 'with ' + parsed.participants.join(' and ') : ''}`
        );
        msg.rate = 1;
        window.speechSynthesis.speak(msg);
      }
    }

    if (parsed.shouldSubmit) {
      showToast('Voice command: Executing Save...');
      setTimeout(() => {
        const btn = document.getElementById(step === 1 ? 'ae-next-btn' : 'ae-save-btn');
        if (btn) btn.click();
      }, 1200); // Slightly longer delay to allow user to hear/see insight
    } else {
      showToast(`Voice parsed successfully!`);
    }
  };

  const startListening = () => {
    if (!recognitionRef.current) {
      showToast('Speech recognition not supported in this browser', 'error');
      return;
    }
    setIsListening(true);
    recognitionRef.current.start();
  };

  /* ─── Toast helper ─── */
  const [hasBackup, setHasBackup] = useState(!!localStorage.getItem('debtEaseExpenses_backup'));

  useEffect(() => {
    // Sync backup state if changed elsewhere
    const checkBackup = () => setHasBackup(!!localStorage.getItem('debtEaseExpenses_backup'));
    window.addEventListener('storage', checkBackup);
    return () => window.removeEventListener('storage', checkBackup);
  }, []);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast({ msg: '', type: 'success' }), 3200);
  };

  /* ─── Validation ─── */
  const validate = () => {
    const errs = {};
    if (!description.trim())          errs.description = 'Description is required';
    if (!amount || parseFloat(amount) <= 0) errs.amount = 'Enter a valid amount';
    if (!paidBy.trim())               errs.paidBy = 'Select or enter who paid';
    if (sharedAmong.length === 0)     errs.sharedAmong = 'Select at least one participant';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  /* ─── Toggle participant ─── */
  const toggleParticipant = (name) => {
    setSharedAmong(prev => {
      const isRemoving = prev.includes(name);
      const next = isRemoving ? prev.filter(p => p !== name) : [...prev, name];
      
      // Update custom splits if removing
      if (isRemoving) {
        setCustomSplits(curr => {
          const { [name]: _, ...rest } = curr;
          return rest;
        });
      } else if (splitMode !== 'equal') {
        setCustomSplits(curr => ({ ...curr, [name]: 0 }));
      }
      
      return next;
    });
    if (errors.sharedAmong) setErrors(e => ({ ...e, sharedAmong: null }));
  };

  /* ─── Add custom member ─── */
  const addCustomMember = () => {
    const name = newMember.trim();
    if (!name) return;
    if (!knownMembers.includes(name)) {
      const next = [...knownMembers, name].sort();
      setKnownMembers(next);
      membersRef.current = next;
    }
    if (!sharedAmong.includes(name))  setSharedAmong(prev => [...prev, name]);
    setNewMember('');
  };

  /* ─── Select / deselect all ─── */
  const toggleAll = () => {
    if (sharedAmong.length === knownMembers.length) {
      setSharedAmong([]);
      setCustomSplits({});
    } else {
      setSharedAmong([...knownMembers]);
      if (splitMode === 'exact') {
        const amt = parseFloat(amount || 0);
        const each = (amt / knownMembers.length).toFixed(2);
        const map = {};
        knownMembers.forEach(m => map[m] = each);
        setCustomSplits(map);
      } else if (splitMode === 'percent') {
        const each = (100 / knownMembers.length).toFixed(1);
        const map = {};
        knownMembers.forEach(m => map[m] = each);
        setCustomSplits(map);
      }
    }
  };

  /* ─── Handle Split Mode Change ─── */
  const handleSplitModeChange = (mode) => {
    setSplitMode(mode);
    if (mode === 'equal') return;

    const amt = parseFloat(amount || 0);
    const map = {};
    if (mode === 'exact') {
      const each = (amt / (sharedAmong.length || 1)).toFixed(2);
      sharedAmong.forEach(m => map[m] = each);
    } else {
      const each = (100 / (sharedAmong.length || 1)).toFixed(1);
      sharedAmong.forEach(m => map[m] = each);
    }
    setCustomSplits(map);
  };

  /* ─── Computed Discrepancy ─── */
  const totalAllocated = Object.values(customSplits).reduce((s, v) => s + parseFloat(v || 0), 0);
  const discrepancy = splitMode === 'exact' 
    ? parseFloat(amount || 0) - totalAllocated
    : 100 - totalAllocated;
  const isBalanced = Math.abs(discrepancy) < 0.01;

  /* ─── Per-person split preview (based on display amount) ─── */
  const numericAmount = parseFloat(amount || 0);
  const splitAmount = sharedAmong.length > 0 && numericAmount > 0
    ? (numericAmount / sharedAmong.length).toFixed(2)
    : null;

  /* ─── Save expense ─── */
  const handleSave = async () => {
    if (!validate()) {
      showToast('Please fix the highlighted fields', 'error');
      return;
    }

    setSaving(true);

    const splitList = [...sharedAmong];
    if (!splitList.includes(paidBy.trim())) splitList.push(paidBy.trim());

    const baseAmount = toBaseAmount(amount);

    const expense = {
      id: Date.now().toString(),
      description: description.trim(),
      amount: baseAmount,
      paid_by: paidBy.trim(),
      split_between: splitList,
      split_mode: splitMode,
      split_details: splitMode === 'equal' ? {} : customSplits,
      category,
      date,
      notes: notes.trim(),
      created_at: new Date().toISOString(),
    };

    /* Save to localStorage */
    const existing = JSON.parse(localStorage.getItem('debtEaseExpenses') || '[]');
    existing.push(expense);
    localStorage.setItem('debtEaseExpenses', JSON.stringify(existing));

    /* ─── Sync with backend ─── */
    try {
      await fetch('/api/add-expense', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expense }),
      });
    } catch {
      /* Backend sync optional — localStorage is source of truth */
    }

    /* Trigger backend recalculation so dashboard reflects new data */
    try {
      await fetch('/api/optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expenses: existing }),
      });
    } catch {}

    // Notify other tabs / windows so dashboards refresh in real time
    try {
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        const channel = new BroadcastChannel('debtEase-expenses');
        channel.postMessage({ type: 'expenses-updated' });
        channel.close();
      }
    } catch {}

    setSaving(false);
    showToast(`✅ "${expense.description}" added successfully!`);

    /* Reset form after short delay, then redirect */
    setTimeout(() => navigate('/dashboard'), 1400);
  };

  /* ─── Load sample data ─── */
  const loadSamples = () => {
    const samples = [
  { id: '1', description: 'Dinner at Spice Garden', amount: toBaseAmount(1200), paid_by: 'Arjun', split_between: ['Arjun', 'Priya', 'Rahul'], category: 'food', date: '2026-04-10' },
  { id: '2', description: 'Cab to Airport', amount: toBaseAmount(450), paid_by: 'Priya', split_between: ['Priya', 'Rahul'], category: 'transport', date: '2026-04-11' },
  { id: '3', description: 'Hotel Stay (3 nights)', amount: toBaseAmount(8400), paid_by: 'Rahul', split_between: ['Arjun', 'Priya', 'Rahul'], category: 'stay', date: '2026-04-12' },
  { id: '4', description: 'Theme Park Tickets', amount: toBaseAmount(2700), paid_by: 'Arjun', split_between: ['Arjun', 'Priya', 'Rahul'], category: 'entertainment', date: '2026-04-13' },
  { id: '5', description: 'Groceries & Snacks', amount: toBaseAmount(320), paid_by: 'Priya', split_between: ['Arjun', 'Priya'], category: 'shopping', date: '2026-04-13' },
    ];
    // Backup existing data if any, so user doesn't lose current work
    const existing = localStorage.getItem('debtEaseExpenses');
    if (existing && !existing.includes('Spice Garden')) {
      localStorage.setItem('debtEaseExpenses_backup', existing);
    }

    localStorage.setItem('debtEaseExpenses', JSON.stringify(samples));
    setHasBackup(!!localStorage.getItem('debtEaseExpenses_backup'));
    showToast('Sample data loaded! Redirecting…');
    setTimeout(() => navigate('/dashboard'), 1400);
  };

  /* ─── Restore backup ─── */
  const handleRestoreBackup = () => {
    const backup = localStorage.getItem('debtEaseExpenses_backup');
    if (!backup) {
      showToast('No previous data found to restore', 'error');
      return;
    }
    localStorage.setItem('debtEaseExpenses', backup);
    localStorage.removeItem('debtEaseExpenses_backup');
    setHasBackup(false);
    showToast('Previous data restored! Redirecting…');
    setTimeout(() => navigate('/dashboard'), 1400);
  };

  /* ─── Clear all ─── */
  const handleClearAll = () => {
    if (!window.confirm('Delete ALL saved expenses? This cannot be undone.')) return;
    localStorage.removeItem('debtEaseExpenses');
    showToast('All expenses cleared', 'error');
    setRecentExpenses([]);
    setKnownMembers([]);
  };

  const catObj = CATEGORIES.find(c => c.id === category) || CATEGORIES[0];

  /* ══════════════════════════════════════════
     RENDER
  ══════════════════════════════════════════ */
  return (
    <>
      <Topbar />
      <section className="page-section active">
        <div className="dashboard-layout">
          <Sidebar onSignOut={onSignOut} />

          <div className="main-panel">

            {/* ── Page Header ── */}
            <div className="dashboard-hero ae-hero">
              <div className="hero-header">
                <div>
                  <span className="info-badge">💸 New Transaction</span>
                  <h2 style={{ margin: '10px 0 6px' }}>Add Expense</h2>
                  <p>Record a group transaction. Balances update instantly across the dashboard.</p>
                </div>
                <div className="ae-header-actions">
                  <button
                    className="ae-recent-btn"
                    onClick={() => setShowRecent(v => !v)}
                    title="View recent expenses"
                  >
                    🕐 Recent ({recentExpenses.length})
                  </button>
                </div>
              </div>

              {/* Recent expenses panel */}
              {showRecent && (
                <div className="ae-recent-panel">
                  <div className="ae-recent-title">Recent Expenses</div>
                  {recentExpenses.length === 0
                    ? <p className="ae-muted">No expenses recorded yet.</p>
                    : recentExpenses.map(e => {
                        const cat = CATEGORIES.find(c => c.id === e.category) || CATEGORIES[7];
                        return (
                          <div key={e.id} className="ae-recent-item">
                            <span className="ae-recent-icon">{cat.icon}</span>
                            <div className="ae-recent-info">
                              <strong>{e.description}</strong>
                              <span className="ae-muted">{e.paid_by} · {e.date || '—'}</span>
                            </div>
                            <div className="ae-recent-amt">{formatFromBase(e.amount)}</div>
                          </div>
                        );
                      })
                  }
                </div>
              )}
            </div>

            {/* ── Step indicator ── */}
            <div className="ae-steps">
              {['Expense Details', 'Split & Confirm'].map((label, i) => (
                <React.Fragment key={i}>
                  <button
                    className={`ae-step-item${step === i + 1 ? ' active' : step > i + 1 ? ' done' : ''}`}
                    onClick={() => setStep(i + 1)}
                  >
                    <span className="ae-step-num">{step > i + 1 ? '✓' : i + 1}</span>
                    <span className="ae-step-label">{label}</span>
                  </button>
                  {i < 1 && <div className={`ae-step-line${step > 1 ? ' done' : ''}`} />}
                </React.Fragment>
              ))}
            </div>

            <div className="ae-form-layout">

              {/* ══ STEP 1 — Expense details ══ */}
              {step === 1 && (
                <div className="ae-card ae-card-main">
                  {/* Voice Insight Display */}
                  {voiceInsight && (
                    <div className="ae-voice-insight fade-in">
                      <div className="ae-insight-header">
                        <span className="ae-insight-tag">Voice Insight</span>
                        <button className="ae-insight-close" onClick={() => setVoiceInsight(null)}>✕</button>
                      </div>
                      <div className="ae-insight-grid">
                        <div className="ae-insight-item">
                          <label>Amount</label>
                          <strong>{voiceInsight.amount ? `${symbol}${voiceInsight.amount}` : '—'}</strong>
                        </div>
                        <div className="ae-insight-item">
                          <label>Description</label>
                          <strong>{voiceInsight.description || '—'}</strong>
                        </div>
                        <div className="ae-insight-item">
                          <label>Participants</label>
                          <strong>{voiceInsight.participants.length > 0 ? voiceInsight.participants.join(', ') : 'Everyone'}</strong>
                        </div>
                      </div>
                    </div>
                  )}

                  <h3 className="ae-section-title">Expense Details</h3>

                  {/* Description */}
                  <div className={`ae-field${errors.description ? ' ae-field-error' : ''}`}>
                    <label className="ae-label">
                      <span className="ae-label-icon">📝</span> Description
                    </label>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
                      <div style={{ flex: 1 }}>
                        <input
                          id="ae-description"
                          className="ae-input"
                          type="text"
                          placeholder="e.g. Dinner at Spice Garden"
                          value={description}
                          onChange={e => { setDescription(e.target.value); setErrors(v => ({ ...v, description: null })); }}
                        />
                      </div>
                      <button 
                        id="tour-voice"
                        className={`ae-mic-btn ${isListening ? 'listening' : ''}`}
                        onClick={startListening}
                        type="button"
                        title="Voice Entry"
                      >
                        {isListening ? '⏺' : '🎤'}
                      </button>
                    </div>
                    {isListening && <p className="ae-voice-status">Listening... Speak now (Say "Save" or "Theek hai" at the end to auto-submit)</p>}
                    {!isListening && !description && <p className="ae-muted-hint" style={{fontSize:'0.75rem', marginTop:'4px'}}>🎤 Try: "Dinner 500 rupees with Priya and Rahul save"</p>}
                    {errors.description && <span className="ae-err">{errors.description}</span>}
                  </div>

                  {/* Amount */}
                  <div className={`ae-field${errors.amount ? ' ae-field-error' : ''}`}>
                    <label className="ae-label">
                      <span className="ae-label-icon">💰</span> Total Amount
                    </label>
                    <div className="ae-amount-wrap">
                      <span className="ae-currency">{symbol}</span>
                      <input
                        id="ae-amount"
                        ref={amountRef}
                        className="ae-input ae-amount-input"
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        value={amount}
                        onChange={e => { setAmount(e.target.value); setErrors(v => ({ ...v, amount: null })); }}
                      />
                    </div>
                    {errors.amount && <span className="ae-err">{errors.amount}</span>}
                  </div>

                  {/* Paid By */}
                  <div className={`ae-field${errors.paidBy ? ' ae-field-error' : ''}`}>
                    <label className="ae-label">
                      <span className="ae-label-icon">👤</span> Paid By
                    </label>
                    {knownMembers.length > 0 ? (
                      <div className="ae-paid-by-row">
                        <select
                          id="ae-paidby-select"
                          className="ae-select"
                          value={paidBy}
                          onChange={e => { setPaidBy(e.target.value); setErrors(v => ({ ...v, paidBy: null })); }}
                        >
                          <option value="">— Select person —</option>
                          {knownMembers.map(m => (
                            <option key={m} value={m}>{m}</option>
                          ))}
                          <option value="__custom__">+ Add new person…</option>
                        </select>
                        {paidBy === '__custom__' && (
                          <input
                            className="ae-input"
                            type="text"
                            placeholder="Enter name"
                            autoFocus
                            onBlur={e => {
                              const name = e.target.value.trim();
                              if (name) {
                                if (!knownMembers.includes(name)) setKnownMembers(prev => [...prev, name]);
                                setPaidBy(name);
                              }
                            }}
                          />
                        )}
                      </div>
                    ) : (
                      <input
                        id="ae-paidby-input"
                        className="ae-input"
                        type="text"
                        placeholder="e.g. Alice"
                        value={paidBy}
                        onChange={e => { setPaidBy(e.target.value); setErrors(v => ({ ...v, paidBy: null })); }}
                      />
                    )}
                    {errors.paidBy && <span className="ae-err">{errors.paidBy}</span>}
                  </div>

                  {/* Category */}
                  <div className="ae-field">
                    <label className="ae-label">
                      <span className="ae-label-icon">🏷️</span> Category
                    </label>
                    <div className="ae-category-grid">
                      {CATEGORIES.map(cat => (
                        <button
                          key={cat.id}
                          id={`ae-cat-${cat.id}`}
                          className={`ae-cat-btn${category === cat.id ? ' active' : ''}`}
                          style={category === cat.id ? { borderColor: cat.color, background: `${cat.color}18`, color: cat.color } : {}}
                          onClick={() => setCategory(cat.id)}
                          type="button"
                        >
                          <span className="ae-cat-icon">{cat.icon}</span>
                          <span className="ae-cat-label">{cat.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Date */}
                  <div className="ae-field">
                    <label className="ae-label">
                      <span className="ae-label-icon">📅</span> Date
                    </label>
                    <input
                      id="ae-date"
                      className="ae-input"
                      type="date"
                      value={date}
                      onChange={e => setDate(e.target.value)}
                    />
                  </div>

                  {/* Notes */}
                  <div className="ae-field">
                    <label className="ae-label">
                      <span className="ae-label-icon">🗒️</span> Notes <span className="ae-optional">(optional)</span>
                    </label>
                    <textarea
                      id="ae-notes"
                      className="ae-input ae-textarea"
                      placeholder="Any extra details about this expense…"
                      value={notes}
                      rows={3}
                      onChange={e => setNotes(e.target.value)}
                    />
                  </div>

                  <button
                    id="ae-next-btn"
                    className="button-primary ae-full-btn"
                    onClick={() => {
                      const errs = {};
                      if (!description.trim()) errs.description = 'Description is required';
                      if (!amount || parseFloat(amount) <= 0) errs.amount = 'Enter a valid amount';
                      if (!paidBy.trim()) errs.paidBy = 'Select or enter who paid';
                      setErrors(errs);
                      if (Object.keys(errs).length === 0) setStep(2);
                    }}
                  >
                    Continue to Split &rarr;
                  </button>
                </div>
              )}

              {/* ══ STEP 2 — Split ══ */}
              {step === 2 && (
                <div className="ae-card ae-card-main">
                  <h3 className="ae-section-title">Split Among Participants</h3>

                  {/* Expense summary bar */}
                  <div className="ae-summary-bar">
                      <div className="ae-summary-item">
                      <span className="ae-summary-label">Expense</span>
                      <strong>{description || '—'}</strong>
                    </div>
                    <div className="ae-summary-item">
                      <span className="ae-summary-label">Amount</span>
                      <strong className="ae-summary-amount">
                        {symbol}{parseFloat(amount || 0).toLocaleString()}
                      </strong>
                    </div>
                      <div className="ae-summary-item">
                      <span className="ae-summary-label">Paid by</span>
                      <strong>{paidBy || '—'}</strong>
                    </div>
                    <div className="ae-summary-item">
                      <span className="ae-summary-label">Category</span>
                      <strong>{catObj.icon} {catObj.label}</strong>
                    </div>
                  </div>

                  {/* Member selection */}
                  <div className={`ae-field${errors.sharedAmong ? ' ae-field-error' : ''}`}>
                    <div className="ae-split-header">
                      <label className="ae-label">
                        <span className="ae-label-icon">👥</span> Shared Among
                      </label>
                      <button
                        className="ae-toggle-all"
                        onClick={toggleAll}
                        type="button"
                      >
                        {sharedAmong.length === knownMembers.length ? 'Deselect All' : 'Select All'}
                      </button>
                    </div>

                    {/* Split Type Toggles */}
                    <div className="ae-split-tabs">
                      {[
                        { id: 'equal',   label: 'Equal',   icon: '⚖️' },
                        { id: 'exact',   label: 'Exact',   icon: '🔢' },
                        { id: 'percent', label: 'Percent', icon: '％' }
                      ].map(m => (
                        <button 
                          key={m.id}
                          className={`ae-split-tab${splitMode === m.id ? ' active' : ''}`}
                          onClick={() => handleSplitModeChange(m.id)}
                        >
                          {m.icon} {m.label}
                        </button>
                      ))}
                    </div>

                    {knownMembers.length === 0 ? (
                      <p className="ae-muted" style={{ marginBottom: '10px' }}>
                        No known members yet — add participants below.
                      </p>
                    ) : (
                      <div className="ae-member-grid">
                        {knownMembers.map(m => {
                          const selected = sharedAmong.includes(m);
                          const isPayer = m === paidBy;
                          return (
                            <div key={m} className={`ae-member-row-wrapper${selected ? ' active' : ''}`}>
                              <button
                                id={`ae-member-${m.replace(/\s+/g, '-')}`}
                                className={`ae-member-btn${selected ? ' selected' : ''}`}
                                onClick={() => toggleParticipant(m)}
                                type="button"
                              >
                                <div className={`ae-member-avatar${selected ? ' sel-avatar' : ''}`}>
                                  {m.charAt(0).toUpperCase()}
                                </div>
                                <span className="ae-member-name">{m}</span>
                                {isPayer && <span className="ae-payer-tag">Paid</span>}
                                {selected && <span className="ae-check">✓</span>}
                              </button>

                              {selected && splitMode !== 'equal' && (
                                <div className="ae-share-input-wrap">
                                  <input 
                                    className="ae-share-input"
                                    type="number"
                                    step={splitMode === 'exact' ? '0.01' : '0.1'}
                                    value={customSplits[m] || ''}
                                    placeholder={splitMode === 'exact' ? '0.00' : '0'}
                                    onChange={e => setCustomSplits(curr => ({ ...curr, [m]: e.target.value }))}
                                  />
                                  <span className="ae-share-unit">{splitMode === 'exact' ? '₹' : '%'}</span>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {errors.sharedAmong && <span className="ae-err">{errors.sharedAmong}</span>}

                    {/* Discrepancy Bar */}
                    {splitMode !== 'equal' && sharedAmong.length > 0 && (
                      <div className={`ae-discrepancy ${isBalanced ? 'ae-dis-success' : 'ae-dis-error'}`}>
                        <div className="ae-dis-label">
                          <span>{isBalanced ? '✅ Perfectly balanced' : '⚠️ Unbalanced split'}</span>
                        </div>
                        <div className="ae-dis-val">
                          {isBalanced ? '' : `${discrepancy > 0 ? 'Remaining' : 'Over by'}: ${splitMode === 'exact' ? '₹' : ''}${Math.abs(discrepancy).toFixed(2)}${splitMode === 'percent' ? '%' : ''}`}
                        </div>
                      </div>
                    )}

                    {/* Add new member inline */}
                    <div className="ae-add-member-row">
                      <input
                        id="ae-new-member"
                        className="ae-input ae-add-member-input"
                        type="text"
                        placeholder="Add new member name…"
                        value={newMember}
                        onChange={e => setNewMember(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && addCustomMember()}
                      />
                      <button
                        className="ae-add-member-btn"
                        onClick={addCustomMember}
                        type="button"
                      >
                        + Add
                      </button>
                    </div>
                  </div>

                  {/* Split preview */}
                  {(splitMode === 'equal' && splitAmount) ? (
                    <div className="ae-split-preview">
                      <div className="ae-split-preview-title">📊 Equal Split Preview</div>
                      <div className="ae-split-grid">
                        {sharedAmong.map(m => (
                          <div key={m} className="ae-split-row">
                            <div className="ae-split-avatar">{m.charAt(0).toUpperCase()}</div>
                            <span className="ae-split-name">{m}</span>
                            <span className="ae-split-amt">{symbol}{splitAmount}</span>
                          </div>
                        ))}
                      </div>
                      <div className="ae-split-total">
                        <span>Total: {symbol}{parseFloat(amount || 0).toLocaleString()}</span>
                        <span>{sharedAmong.length} {sharedAmong.length === 1 ? 'person' : 'people'} · {symbol}{splitAmount} each</span>
                      </div>
                    </div>
                  ) : (splitMode !== 'equal' && sharedAmong.length > 0) ? (
                    <div className="ae-split-preview">
                      <div className="ae-split-preview-title">📊 Custom Split Overview</div>
                      <div className="ae-split-grid">
                        {sharedAmong.map(m => {
                              const share = splitMode === 'exact' 
                            ? parseFloat(customSplits[m] || 0)
                            : (parseFloat(customSplits[m] || 0) / 100) * parseFloat(amount || 0);
                          return (
                            <div key={m} className="ae-split-row">
                              <div className="ae-split-avatar">{m.charAt(0).toUpperCase()}</div>
                              <span className="ae-split-name">{m}</span>
                              <span className="ae-split-amt">{symbol}{share.toFixed(2)}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}

                  {/* Action buttons */}
                  <div className="ae-action-row">
                    <button
                      className="button-secondary ae-back-btn"
                      onClick={() => setStep(1)}
                    >
                      ← Back
                    </button>
                    <button
                      id="ae-save-btn"
                      className="button-primary ae-save-btn"
                      onClick={handleSave}
                      disabled={saving}
                    >
                      {saving ? (
                        <span className="ae-spinner">⟳ Saving…</span>
                      ) : '💾 Save Expense'}
                    </button>
                  </div>
                </div>
              )}

              {/* ── Side panel ── */}
              <div className="ae-side-panel">

                {/* Quick tips */}
                <div className="ae-card ae-tip-card">
                  <div className="ae-tip-title">💡 How it works</div>
                  <div className="ae-tip-item">
                    <span className="ae-tip-num">1</span>
                    <span>Fill in expense details — who paid and how much.</span>
                  </div>
                  <div className="ae-tip-item">
                    <span className="ae-tip-num">2</span>
                    <span>Select all participants who should split the cost.</span>
                  </div>
                  <div className="ae-tip-item">
                    <span className="ae-tip-num">3</span>
                    <span>Save — the dashboard and net balances update instantly.</span>
                  </div>
                </div>

                {/* Category display */}
                <div className="ae-card ae-cat-display" style={{ borderColor: `${catObj.color}40` }}>
                  <span className="ae-cat-big-icon">{catObj.icon}</span>
                  <div>
                    <div className="ae-muted" style={{ fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '2px' }}>Category</div>
                    <div style={{ fontWeight: 700, color: catObj.color }}>{catObj.label}</div>
                  </div>
                </div>

                {/* Utilities */}
                <div className="ae-card" id="tour-utilities">
                  <div className="ae-tip-title">🔧 Utilities</div>
                  <button className="ae-util-btn" onClick={loadSamples}>
                    📦 Load Sample Data
                  </button>
                  {hasBackup && (
                    <button className="ae-util-btn" style={{ background: 'var(--accent)', color: 'white' }} onClick={handleRestoreBackup}>
                      🔄 Restore Previous Data
                    </button>
                  )}
                  <button className="ae-util-btn ae-util-danger" onClick={handleClearAll}>
                    🗑️ Clear All Expenses
                  </button>
                </div>
              </div>

            </div>
          </div>
        </div>
      </section>

      {/* ── Toast ── */}
      <div className={`ae-toast${toast.msg ? ' ae-toast-show' : ''}${toast.type === 'error' ? ' ae-toast-error' : ''}`}>
        {toast.msg}
      </div>
    </>
  );
}

export default AddExpense;

import React, { useState, useRef, useEffect } from 'react';
import { saveFileLocally } from '../utils/vaultStore';

const OCR_API_KEY = 'K85761896588957';
const CATEGORIES = [
  { id: 'hotel', icon: '🏨', label: 'Hotel' },
  { id: 'food', icon: '🍽️', label: 'Food' },
  { id: 'games', icon: '🎮', label: 'Games' },
  { id: 'general', icon: '📦', label: 'General' },
];

function OCRPlusWizard({ onClose, onSuccess, knownMembers = [] }) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  
  /* Step 1 Form */
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('general');
  const [password, setPassword] = useState('');
  const [encrypt, setEncrypt] = useState(false);

  /* Step 2 OCR Data */
  const [ocrLines, setOcrLines] = useState([]);
  const [total, setTotal] = useState('');
  const [tax, setTax] = useState('');

  /* Step 3 People & Split */
  const [people, setPeople] = useState([{ name: 'Me', phone: '', share: 0, isPayer: true }]);
  const [splitMode, setSplitMode] = useState('equal'); // 'equal', 'custom'

  const fileRef = useRef(null);

  useEffect(() => {
    if (file) {
      const url = URL.createObjectURL(file);
      setPreview(url);
      return () => URL.revokeObjectURL(url);
    }
  }, [file]);

  const handleFileChange = (e) => {
    const f = e.target.files[0];
    if (f) {
      setFile(f);
      setTitle(f.name.split('.')[0]);
    }
  };

  const autoAnalyze = (lines) => {
    setAnalyzing(true);
    let detectedTotal = '';
    let detectedTax = '';
    const detectedMembers = new Set(['Me']);

    lines.forEach(line => {
      const up = line.toUpperCase();
      const numMatch = line.match(/(\d+\.\d{2})/) || line.match(/(\d+\.?\d*)/);

      // 1. Total detection
      if (up.includes('TOTAL') || up.includes('NET AMOUNT') || up.includes('DUE') || up.includes('BALANCE')) {
        if (numMatch && !detectedTotal) detectedTotal = numMatch[1];
      }

      // 2. Tax detection
      if (up.includes('TAX') || up.includes('GST') || up.includes('VAT') || up.includes('SGST') || up.includes('CGST')) {
        if (numMatch && !detectedTax) detectedTax = numMatch[1];
      }

      // 3. Member matching
      knownMembers.forEach(m => {
        if (line.toLowerCase().includes(m.toLowerCase())) {
          detectedMembers.add(m);
        }
      });
    });

    if (detectedTotal) setTotal(detectedTotal);
    if (detectedTax)   setTax(detectedTax);
    
    // Auto-populate people if matches found
    if (detectedMembers.size > 1) {
      setPeople([...detectedMembers].map(name => ({
        name,
        phone: '',
        share: 0,
        isPayer: name === 'Me'
      })));
    }

    setAnalyzing(false);
  };

  const runOCR = async () => {
    if (!file) return;
    setLoading(true);
    setStep(2);

    const fd = new FormData();
    fd.append('apikey', OCR_API_KEY);
    fd.append('file', file);
    fd.append('language', 'eng');
    fd.append('isOverlayRequired', 'false');

    try {
      const res = await fetch('https://api.ocr.space/parse/image', {
        method: 'POST',
        body: fd
      });
      const data = await res.json();
      
      if (data.ParsedResults && data.ParsedResults[0]) {
        const text = data.ParsedResults[0].ParsedText;
        const lines = text.split('\n').filter(l => l.trim().length > 0);
        setOcrLines(lines);
        autoAnalyze(lines);
      }
    } catch (err) {
      console.error("OCR Failed", err);
    } finally {
      setLoading(false);
    }
  };

  const addPerson = () => {
    setPeople([...people, { name: '', phone: '', share: 0, isPayer: false }]);
  };

  const removePerson = (idx) => {
    if (people.length > 1) setPeople(people.filter((_, i) => i !== idx));
  };

  const updatePerson = (idx, field, val) => {
    const next = [...people];
    next[idx][field] = val;
    setPeople(next);
  };

  const handleFinish = async () => {
    setLoading(true);
    try {
      /* 1. Calculate final shares */
      const numPeople = people.length;
      const taxPerPerson = parseFloat(tax || 0) / numPeople;
      const subtotal = parseFloat(total || 0) - parseFloat(tax || 0);
      
      const finalExpenses = people.map(p => {
        let personalTotal = 0;
        if (splitMode === 'equal') {
          personalTotal = (subtotal / numPeople) + taxPerPerson;
        } else {
          personalTotal = parseFloat(p.share || 0) + taxPerPerson;
        }
        return { ...p, finalAmount: personalTotal };
      });

      /* 2. Save to Vault (Locally + Server) */
      const opts = {
        title,
        description,
        category,
        password: encrypt ? password : null,
        participants: people.map(p => ({ name: p.name, phone: p.phone }))
      };

      const docMeta = await saveFileLocally(file, opts);

      /* 3. Sync to Backend */
      const sfd = new FormData();
      sfd.append('file', file);
      sfd.append('title', title);
      sfd.append('category', category);
      sfd.append('description', description);
      sfd.append('participants', JSON.stringify(people));
      sfd.append('is_encrypted', encrypt ? 'true' : 'false');

      await fetch('/api/upload', { method: 'POST', body: sfd });

      /* 4. Add Expense Entry */
      const payer = people.find(p => p.isPayer) || people[0];
      const expense = {
        id: Date.now().toString(),
        description: `Receipt: ${title}`,
        amount: parseFloat(total || 0),
        paid_by: payer.name || 'Me',
        split_between: people.map(p => p.name || 'Anonymous'),
        split_mode: splitMode === 'equal' ? 'equal' : 'exact',
        split_details: splitMode === 'equal' ? {} : Object.fromEntries(finalExpenses.map(p => [p.name, p.finalAmount])),
        category,
        date: new Date().toISOString().split('T')[0],
        receipt_id: docMeta.id
      };

      // Persistence: localStorage (Frontend Source of Truth)
      const existing = JSON.parse(localStorage.getItem('debtEaseExpenses') || '[]');
      existing.push(expense);
      localStorage.setItem('debtEaseExpenses', JSON.stringify(existing));

      // Persistence: Backend Sync
      await fetch('/api/add-expense', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expense })
      });

      // Recalculate settlements
      await fetch('/api/optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expenses: existing })
      });

      onSuccess();
    } catch (err) {
      console.error("Save failed", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="wiz-overlay">
      <div className="wiz-card">
        <div className="wiz-header">
          <h2 style={{margin:0}}>Receipt Vault Wizard</h2>
          <button className="vt-btn vt-btn-del" onClick={onClose} style={{ flex: 'none', padding: '10px 16px', fontSize: '1.2rem' }}>✕</button>
        </div>

        <div className="wiz-body">
          <div className="wiz-step-indicator">
            <div className={`wiz-step-dot ${step >= 1 ? 'active' : ''}`} />
            <div className={`wiz-step-dot ${step >= 2 ? 'active' : ''}`} />
            <div className={`wiz-step-dot ${step >= 3 ? 'active' : ''}`} />
          </div>

          {step === 1 && (
            <div className="wiz-step-content fade-in">
              <div className="wiz-field-group">
                <h3 className="ae-section-title">Step 1: Document Identity</h3>
                <p className="ae-muted">Upload your receipt and categorize it for the Vault.</p>
                
                <div className="ae-field">
                  <label className="ae-label">📄 Receipt File</label>
                  <div 
                    className="vt-drop-zone" 
                    onClick={() => fileRef.current.click()}
                    style={{ borderStyle: 'dashed', minHeight: '140px', padding: '24px' }}
                  >
                    {file ? (
                      <div style={{ textAlign: 'center' }}>
                        <div style={{fontSize: '2.5rem', marginBottom: '8px'}}>✅</div>
                        <strong style={{fontSize: '1.1rem'}}>{file.name}</strong>
                      </div>
                    ) : (
                      <div style={{textAlign:'center'}}>
                        <div style={{fontSize: '2.5rem', opacity: 0.5, marginBottom: '8px'}}>☁️</div>
                        <strong>Click or Drag to Upload Receipt</strong>
                      </div>
                    )}
                  </div>
                  <input type="file" ref={fileRef} hidden onChange={handleFileChange} accept="image/*,application/pdf" />
                </div>

                <div className="ae-field">
                  <label className="ae-label">📝 Title</label>
                  <input className="ae-input" value={title} onChange={e => setTitle(e.target.value)} placeholder="Hotel Bill, Starbucks, etc." />
                </div>

                <div className="ae-field">
                  <label className="ae-label">📂 Category Folder</label>
                  <div className="ae-category-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
                    {CATEGORIES.map(cat => (
                      <button 
                        key={cat.id} 
                        className={`ae-cat-btn ${category === cat.id ? 'active' : ''}`}
                        onClick={() => setCategory(cat.id)}
                        style={category === cat.id ? { borderColor: 'var(--accent)', background: 'var(--accent-soft)' } : {}}
                      >
                        <span className="ae-cat-icon">{cat.icon}</span>
                        <span className="ae-cat-label">{cat.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="ae-field" style={{ background: 'var(--surface)', padding: '24px', borderRadius: '24px', border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <div style={{display:'flex', gap: '12px', alignItems: 'center'}}>
                      <span style={{fontSize: '1.4rem'}}>🔐</span>
                      <div>
                        <label className="ae-label" style={{margin:0}}>Enable Zero-Knowledge Encryption</label>
                        <p className="ae-muted" style={{fontSize: '0.75rem', margin:0}}>Your server never sees your key.</p>
                      </div>
                    </div>
                    <input type="checkbox" checked={encrypt} onChange={e => setEncrypt(e.target.checked)} style={{transform: 'scale(1.5)', cursor: 'pointer'}} />
                  </div>
                  {encrypt && (
                    <input 
                      type="password" 
                      className="ae-input fade-in" 
                      placeholder="Enter Vault Password" 
                      value={password} 
                      onChange={e => setPassword(e.target.value)}
                      style={{ marginTop: '12px' }}
                    />
                  )}
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="wiz-step-content fade-in">
              <div className="wiz-field-group">
                <h3 className="ae-section-title">Step 2: OCR Data Extraction</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '32px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <label className="ae-label">🔍 Scan Results</label>
                    {loading ? (
                      <div className="nb-skeleton-pulse" style={{ height: '320px', borderRadius: '24px', background: 'var(--surface)' }} />
                    ) : (
                      <div style={{ 
                        maxHeight: '400px', 
                        overflowY: 'auto', 
                        border: '1px solid var(--border)', 
                        borderRadius: '24px', 
                        padding: '20px',
                        background: 'rgba(0,0,0,0.2)'
                      }}>
                        {ocrLines.length === 0 ? <p className="ae-muted">No text detected yet.</p> : (
                          ocrLines.map((line, i) => (
                            <div key={i} className="ocr-result-line" onClick={() => {
                              const numMatch = line.match(/(\d+\.\d{2})/) || line.match(/(\d+\.?\d*)/);
                              if (numMatch) setTotal(numMatch[0]);
                            }}>
                              {line}
                            </div>
                          ))
                        )}
                      </div>
                    )}
                    <p className="ae-muted" style={{fontSize: '0.85rem'}}>💡 <strong>Pro Tip:</strong> Click any line containing a price to auto-fill the Total Amount.</p>
                  </div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    <div className="ae-field">
                      <label className="ae-label">💰 Correct Total Amount</label>
                      <div className="ae-amount-wrap">
                        <span className="ae-currency">₹</span>
                        <input className="ae-input ae-amount-input" type="number" value={total} onChange={e => setTotal(e.target.value)} style={{fontSize:'1.4rem'}} />
                      </div>
                    </div>
                    <div className="ae-field">
                      <label className="ae-label">🏷️ Tax / GST (Included)</label>
                      <div className="ae-amount-wrap">
                        <span className="ae-currency">₹</span>
                        <input className="ae-input ae-amount-input" type="number" value={tax} onChange={e => setTax(e.target.value)} placeholder="0.00" />
                      </div>
                    </div>
                    <div className="ae-field">
                      <label className="ae-label">🖼️ Receipt Preview</label>
                      {preview && <img src={preview} style={{ width: '100%', borderRadius: '20px', border: '1px solid var(--border)', boxShadow: 'var(--shadow)' }} alt="Receipt" />}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="wiz-step-content fade-in">
              <div className="wiz-field-group">
                <h3 className="ae-section-title">Step 3: People & Splits</h3>
                <p className="ae-muted" style={{marginBottom:0}}>Add participants and define who paid. Taxes are split equally by default.</p>
                
                <div className="ae-split-tabs">
                  <button className={`ae-split-tab ${splitMode === 'equal' ? 'active' : ''}`} onClick={() => setSplitMode('equal')}>⚖️ Split Equally</button>
                  <button className={`ae-split-tab ${splitMode === 'custom' ? 'active' : ''}`} onClick={() => setSplitMode('custom')}>🔢 Custom Share</button>
                </div>

                <div className="wiz-member-grid">
                  {people.map((p, i) => (
                    <div key={i} className={`wiz-member-row ${p.isPayer ? 'is-payer' : ''}`}>
                      <input 
                        className="ae-input" 
                        placeholder="Person name" 
                        value={p.name} 
                        onChange={e => updatePerson(i, 'name', e.target.value)} 
                        style={{ background: 'transparent', border: 'none', padding: '8px 0', fontSize: '1rem', fontWeight: 600 }}
                      />
                      <input 
                        className="ae-input" 
                        placeholder="Phone (optional)" 
                        value={p.phone} 
                        onChange={e => updatePerson(i, 'phone', e.target.value)} 
                        style={{ background: 'transparent', border: 'none', padding: '8px 0', fontSize: '0.9rem' }}
                      />
                      
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        {splitMode === 'custom' && (
                          <div className="ae-share-input-wrap" style={{width: '90px'}}>
                            <input className="ae-share-input" type="number" value={p.share} onChange={e => updatePerson(i, 'share', e.target.value)} />
                            <span className="ae-share-unit">₹</span>
                          </div>
                        )}
                        <button 
                          className={`wiz-payer-toggle ${p.isPayer ? 'active' : ''}`}
                          onClick={() => {
                            const next = people.map((pp, ii) => ({ ...pp, isPayer: ii === i }));
                            setPeople(next);
                          }}
                          type="button"
                        >
                          {p.isPayer ? '💰 Paid' : '⬜ Paid?'}
                        </button>
                      </div>

                      <button className="vt-btn vt-btn-del" onClick={() => removePerson(i)} style={{padding: '8px'}}>✕</button>
                    </div>
                  ))}
                </div>

                <div style={{ display: 'flex', gap: '12px' }}>
                  <button className="ae-add-member-btn" style={{ flex: 1 }} onClick={addPerson}>+ Add Custom Person</button>
                  {knownMembers.length > 0 && (
                    <select 
                      className="ae-select" 
                      style={{ flex: 1, borderRadius: '18px' }}
                      onChange={e => {
                        if (e.target.value) {
                          setPeople([...people, { name: e.target.value, phone: '', share: 0, isPayer: false }]);
                          e.target.value = '';
                        }
                      }}
                    >
                      <option value="">👤 Add Known Member...</option>
                      {knownMembers.filter(km => !people.some(p => p.name === km)).map(km => (
                        <option key={km} value={km}>{km}</option>
                      ))}
                    </select>
                  )}
                </div>

                <div className="ae-summary-bar" style={{ marginTop: '12px', background: 'var(--surface)', padding: '24px', borderRadius: '24px' }}>
                  <div className="ae-summary-item">
                    <span className="ae-summary-label">Subtotal</span>
                    <strong style={{fontSize: '1.2rem'}}>₹{(parseFloat(total || 0) - parseFloat(tax || 0)).toFixed(2)}</strong>
                  </div>
                  <div className="ae-summary-item" style={{ borderLeft: '1px solid var(--border)', paddingLeft: '24px' }}>
                    <span className="ae-summary-label">Tax (Equal)</span>
                    <strong style={{fontSize: '1.2rem'}}>₹{parseFloat(tax || 0).toFixed(2)}</strong>
                  </div>
                  <div className="ae-summary-item" style={{ borderLeft: '1px solid var(--border)', paddingLeft: '24px' }}>
                    <span className="ae-summary-label">Total Amount</span>
                    <strong className="ae-summary-amount" style={{fontSize: '1.6rem'}}>₹{parseFloat(total || 0).toLocaleString()}</strong>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="wiz-footer">
          <button className="button-secondary" disabled={step === 1} onClick={() => setStep(step - 1)}>← Back</button>
          
          {step === 1 && <button className="button-primary" disabled={!file} onClick={runOCR}>Run OCR Scanner →</button>}
          {step === 2 && <button className="button-primary" disabled={!total} onClick={() => setStep(3)}>Set Split →</button>}
          {step === 3 && (
            <button className="button-primary" disabled={loading} onClick={handleFinish}>
              {loading ? 'Processing...' : '💾 Save & Sync Vault'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default OCRPlusWizard;

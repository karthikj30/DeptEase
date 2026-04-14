import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import Sidebar from '../components/Sidebar';
import Topbar from '../components/Topbar';
import { useCurrency } from '../utils/CurrencyContext';

function Visualizer({ onSignOut }) {
  const { formatFromBase } = useCurrency();
  const [balances, setBalances] = useState({});
  const [graphData, setGraphData] = useState({ nodes: [], links: [] });
  const [graphCache, setGraphCache] = useState({ before: { nodes: [], links: [] }, after: { nodes: [], links: [] } });
  const [steps, setSteps] = useState([]);
  const [activeStep, setActiveStep] = useState(0);
  const [mode, setMode] = useState('before'); // 'before' or 'after'
  const [loading, setLoading] = useState(true);

  // Feature 1: Animation State
  const [isCollapsing, setIsCollapsing] = useState(false);
  const [collapseOpacity, setCollapseOpacity] = useState(1);
  const [statusMessage, setStatusMessage] = useState('Raw expense web');

  // Feature 2: Interactive State
  const [selectedPerson, setSelectedPerson] = useState(null);
  const [rawExpenses, setRawExpenses] = useState([]);
  
  const fgRef = useRef();

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const expenses = JSON.parse(localStorage.getItem('debtEaseExpenses') || '[]');
      setRawExpenses(expenses);

      const response = await fetch('/api/optimize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ expenses })
      });
      const result = await response.json();
      
      setBalances(result.balances || {});
      const beforeG = result.before_graph || { nodes: [], links: [] };
      setSteps(result.steps || []);
      
      const nodes = new Set();
      (result.transactions || []).forEach(e => { nodes.add(e.source); nodes.add(e.target); });
      const optimizedG = {
          nodes: Array.from(nodes).map(id => ({ id })),
          links: (result.transactions || []).map(e => ({ source: e.source, target: e.target, value: e.amount }))
      };

      const newCache = { before: beforeG, after: optimizedG };
      setGraphCache(newCache);
      
      if (mode === 'before') {
          setGraphData(beforeG);
          setActiveStep(0);
          setStatusMessage('Raw expense web');
      } else {
          setGraphData(optimizedG);
          setActiveStep(result.steps?.length || 0);
          setStatusMessage(`Optimized (≤${(result.balances ? Object.keys(result.balances).length : 2) - 1} transactions)`);
      }
    } catch (err) {
      console.error('Failed to load visualizer data', err);
    } finally {
      setLoading(false);
    }
  }, [mode]);

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
    return () => {
      if (channel) channel.close();
    };
  }, [loadData]);

  const switchMode = (newMode) => {
    setMode(newMode);
    if (newMode === 'before') {
        setGraphData(graphCache.before);
        setActiveStep(0);
        setStatusMessage('Raw expense web');
    } else {
        setGraphData(graphCache.after);
        setActiveStep(steps.length);
        setStatusMessage(`Optimized (≤${Object.keys(balances).length - 1} transactions)`);
    }
  };

  // ── FEATURE 1: ANIMATED COLLAPSE ──
  const animateCollapse = async () => {
    if (isCollapsing) return;
    
    // 1. Ensure we start at 'before'
    switchMode('before');
    setIsCollapsing(true);
    setStatusMessage('Collapsing...');
    setCollapseOpacity(1);

    // 2. Fade out edges NOT in the optimized set
    // Using simple interval to simulate D3 transition on Canvas
    const duration = 700;
    const frames = 20;
    const interval = duration / frames;
    
    for (let i = frames; i >= 0; i--) {
      await new Promise(r => setTimeout(r, interval));
      setCollapseOpacity(i / frames);
    }

    // 3. Re-render only optimized edges
    setTimeout(() => {
      switchMode('after');
      setIsCollapsing(false);
      setCollapseOpacity(1);
    }, 200);
  };

  // ── FEATURE 2: INSPECTOR CALCULATIONS ──
  const inspectorData = useMemo(() => {
    if (!selectedPerson) return null;
    const bal = balances[selectedPerson] || 0;
    const status = bal > 0.01 ? 'creditor' : bal < -0.01 ? 'debtor' : 'settled';
    
    // Relationships in CURRENT mode
    const owedTo = graphData.links.filter(l => (l.source === selectedPerson || l.source?.id === selectedPerson));
    const owesMe = graphData.links.filter(l => (l.target === selectedPerson || l.target?.id === selectedPerson));

    // Top 3 raw expenses
    const personalExpenses = rawExpenses
      .filter(ex => ex.paid_by === selectedPerson || ex.split_between?.includes(selectedPerson))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 3);

    return { bal, status, owedTo, owesMe, personalExpenses };
  }, [selectedPerson, balances, graphData, rawExpenses]);

  return (
    <>
      <div className="page-wrapper">
      <Topbar />
      <section className="page-section active">
        <div className="dashboard-layout">
          <Sidebar onSignOut={onSignOut} />
          
          <div className="main-panel">
            <div style={{ padding: '1rem 2rem 1rem 0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <h2>Algorithm Visualizer</h2>
                        <p style={{ color: 'var(--muted)' }}>Interactive debt simulation & greedy optimization mapping.</p>
                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <button 
                            className="button-secondary"
                            onClick={animateCollapse}
                            disabled={isCollapsing}
                            style={{ padding: '8px 16px', fontSize: '0.9rem', width: 'auto', borderStyle: 'dashed'}}
                        >✨ Animate Collapse</button>
                        <button 
                            className={`pill-button ${mode === 'before' ? 'pill-active' : ''}`}
                            onClick={() => switchMode('before')}
                            style={{ padding: '8px 16px', fontSize: '0.9rem', width: 'auto'}}
                        >Before</button>
                        <button 
                            className={`pill-button ${mode === 'after' ? 'pill-active' : ''}`}
                            onClick={() => switchMode('after')}
                            style={{ padding: '8px 16px', fontSize: '0.9rem', width: 'auto'}}
                        >After</button>
                    </div>
                </div>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '2rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                {/* Force Graph Container */}
                <div style={{ 
                    background: 'var(--surface)', border: '1px solid var(--border)', 
                    borderRadius: '24px', overflow: 'hidden', height: '520px', display: 'flex', justifyContent: 'center', alignItems: 'center', position: 'relative'
                }}>
                  {!loading && graphData.nodes && graphData.nodes.length > 0 ? (
                    <ForceGraph2D
                      ref={fgRef}
                      width={800}
                      height={520}
                      graphData={graphData}
                      nodeLabel="id"
                      onNodeClick={(node) => setSelectedPerson(node.id)}
                      nodeAutoColorBy="id"
                      nodeCanvasObject={(node, ctx, globalScale) => {
                        const label = node.id;
                        const isSelected = selectedPerson === node.id;
                        const fontSize = (isSelected ? 16 : 12)/globalScale;
                        ctx.font = `${isSelected ? 'bold' : 'normal'} ${fontSize}px Sans-Serif`;
                        const textWidth = ctx.measureText(label).width;
                        const bckgDimensions = [textWidth, fontSize].map(n => n + fontSize * 0.4);

                        if (isSelected) {
                            ctx.beginPath();
                            ctx.arc(node.x, node.y, 14/globalScale, 0, 2 * Math.PI, false);
                            ctx.fillStyle = 'rgba(124, 58, 237, 0.3)';
                            ctx.fill();
                            ctx.strokeStyle = '#7c3aed';
                            ctx.lineWidth = 1.5/globalScale;
                            ctx.stroke();
                        }

                        ctx.fillStyle = isSelected ? 'rgba(124, 58, 237, 0.9)' : 'rgba(0, 0, 0, 0.7)';
                        ctx.fillRect(node.x - bckgDimensions[0] / 2, node.y - bckgDimensions[1] / 2, ...bckgDimensions);

                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'middle';
                        ctx.fillStyle = isSelected ? '#fff' : (node.color || '#fff');
                        ctx.fillText(label, node.x, node.y);
                      }}
                      linkColor={(link) => {
                          if (isCollapsing) {
                              // Check if this link survives optimization
                              const existsInAfter = graphCache.after.links.some(al => 
                                (al.source === link.source.id && al.target === link.target.id) || 
                                (al.source?.id === link.source.id && al.target?.id === link.target.id)
                              );
                              return existsInAfter ? 'rgba(255,255,255,0.4)' : `rgba(255,255,255,${0.3 * collapseOpacity})`;
                          }
                          return 'rgba(255,255,255,0.3)';
                      }}
                      linkDirectionalParticles={mode === 'after' ? 2 : 1}
                      linkDirectionalParticleSpeed={d => (d.value || 1) * 0.0001}
                    />
                  ) : loading ? (
                    <div className="nb-skeleton-card" style={{ width: '100%', height: '100%' }} />
                  ) : (
                    <div className="nb-empty">
                      <div className="nb-empty-icon">📊</div>
                      <div className="nb-empty-title">No Graph Data</div>
                      <div className="nb-empty-sub">Add some expenses to see the debt visualization.</div>
                    </div>
                  )}
                  <div style={{ position: 'absolute', bottom: '1.2rem', left: '1.2rem', background: 'rgba(12, 12, 12, 0.8)', padding: '8px 16px', borderRadius: '12px', fontSize: '0.85rem', fontWeight: 600, border: '1px solid var(--border)' }}>
                      {statusMessage}
                  </div>
                </div>

                {/* FEATURE 2: INSPECTOR PANEL (Inlined below or using side layout) */}
                {selectedPerson && inspectorData && (
                    <div className="feature-card animate-fade-in" style={{ animation: 'fadeUp 0.4s ease-out' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div>
                                <h3 style={{ margin: 0 }}>{selectedPerson}</h3>
                                <div style={{ marginTop: '8px' }}>
                                    <span className={`nb-status-badge nb-badge-${inspectorData.status}`}>
                                        {inspectorData.status.charAt(0).toUpperCase() + inspectorData.status.slice(1)}
                                    </span>
                                    <span style={{ marginLeft: '12px', fontWeight: 600, color: inspectorData.bal > 0 ? '#10b981' : '#f87171' }}>
                                        {formatFromBase(inspectorData.bal)}
                                    </span>
                                </div>
                            </div>
                            <button className="nb-clear-btn" onClick={() => setSelectedPerson(null)}>✕ Close</button>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginTop: '24px' }}>
                            <div>
                                <h4 style={{ fontSize: '0.85rem', color: 'var(--muted)', textTransform: 'uppercase', marginBottom: '12px' }}>Relationships (Current View)</h4>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    {inspectorData.owedTo.length === 0 && inspectorData.owesMe.length === 0 && <p style={{ fontSize: '0.9rem', opacity: 0.6 }}>No active transfers.</p>}
                                    {inspectorData.owedTo.map((l, i) => (
                                        <div key={i} style={{ fontSize: '0.92rem', padding: '10px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px' }}>
                                            Owes <strong>{(l.target?.id || l.target)}</strong>: <span style={{ color: '#f87171' }}>{formatFromBase(l.value || l.amount)}</span>
                                        </div>
                                    ))}
                                    {inspectorData.owesMe.map((l, i) => (
                                        <div key={i} style={{ fontSize: '0.92rem', padding: '10px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px' }}>
                                            Owed by <strong>{(l.source?.id || l.source)}</strong>: <span style={{ color: '#10b981' }}>{formatFromBase(l.value || l.amount)}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <h4 style={{ fontSize: '0.85rem', color: 'var(--muted)', textTransform: 'uppercase', marginBottom: '12px' }}>Top 3 Largest Raw Expenses</h4>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    {inspectorData.personalExpenses.length === 0 && <p style={{ fontSize: '0.9rem', opacity: 0.6 }}>No personal expenses found.</p>}
                                    {inspectorData.personalExpenses.map((ex, i) => (
                                        <div key={i} style={{ fontSize: '0.92rem', padding: '10px', border: '1px solid var(--border)', borderRadius: '8px' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                <strong>{ex.description || ex.category}</strong>
                                                <span>{formatFromBase(ex.amount)}</span>
                                            </div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: '4px' }}>
                                                Paid by {ex.paid_by} • {ex.date}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
              </div>

              {/* Explainer Panel */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div className="feature-card" style={{ flex: 1, overflowY: 'auto' }}>
                    <h3 style={{ marginBottom: '1rem' }}>Step-by-Step Optimization</h3>
                    {steps.length > 0 ? (
                      steps.slice(0, activeStep === 0 ? 1 : activeStep).map((step, idx) => (
                        <div key={idx} style={{ 
                            padding: '12px', 
                            marginBottom: '10px', 
                            background: 'var(--background)', 
                            borderRadius: '12px',
                            borderLeft: step.type === 'success' ? '4px solid #10b981' : step.type === 'info' ? '4px solid #3b82f6' : '4px solid #c4b5fd',
                            fontSize: '0.88rem',
                            animation: 'fadeUp 0.3s ease-out'
                        }}>
                            {step.text}
                        </div>
                      ))
                    ) : (
                      <p style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>Waiting for expenses to analyze...</p>
                    )}
                    
                    {mode === 'before' && steps.length > 0 && !isCollapsing && (
                        <button 
                            className="button-primary" 
                            style={{ width: '100%', marginTop: '1rem', borderRadius: '12px' }}
                            onClick={() => switchMode('after')}
                        >Execute Optimization View</button>
                    )}
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>
      </div>
    </>
  );
}

export default Visualizer;

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Sidebar from '../components/Sidebar';
import Topbar from '../components/Topbar';
import { saveFileLocally, getMeta, deleteFileLocally, getBlobUrl } from '../utils/vaultStore';
import OCRPlusWizard from '../components/OCRPlusWizard';

/* ─── Helpers ─── */
const ACCEPTED_EXTS = ['.pdf', '.jpg', '.jpeg', '.png', '.gif', '.webp'];

function isImageType(fileType) {
  return ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes((fileType || '').toLowerCase());
}

function formatSize(bytes) {
  if (!bytes) return '—';
  if (bytes < 1024)        return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(str) {
  if (!str) return '—';
  return new Date(str).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function getExt(name) {
  return (name || '').split('.').pop().toLowerCase();
}

/* ─── Extract known members from expenses ─── */
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

/* ─── Local Image Component ─── */
function LocalImageThumbnail({ stored_name, alt, password }) {
  const [src, setSrc] = useState(null);
  useEffect(() => {
    let url;
    getBlobUrl(stored_name, password).then(u => {
      url = u;
      setSrc(u);
    });
    return () => { if (url) URL.revokeObjectURL(url); };
  }, [stored_name, password]);

  if (!src) return <div className="vt-skeleton-card" style={{height:'100%'}} />;
  return <img src={src} alt={alt} className="vt-doc-img" />;
}

/* ─── Component ─── */
function Vault({ onSignOut }) {
  const [documents, setDocuments] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [dragOver,  setDragOver]  = useState(false);
  const [staged,    setStaged]    = useState([]);   // { id, file, preview }
  const [uploading, setUploading] = useState(false);
  const [progress,  setProgress]  = useState({});   // { id: 0-100 }
  const [toast,     setToast]     = useState({ msg: '', type: 'success' });
  const [search,    setSearch]    = useState('');
  const [typeFilter,setTypeFilter]= useState('all');
  const [previewUrl,setPreviewUrl]= useState(null);
  const [wizardOpen,setWizardOpen]= useState(false);
  const [vaultPassword,setVaultPassword]= useState(sessionStorage.getItem('debtEaseVaultKey') || '');
  const [folder,setFolder]        = useState('all');

  const fileInputRef = useRef(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('mode') === 'wizard') {
      setWizardOpen(true);
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  /* ─── toast ─── */
  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast({ msg: '', type: 'success' }), 3200);
  };

  /* ─── fetch documents list (remote + local) ─── */
  const fetchDocuments = useCallback(async () => {
    let remoteDocs = [];
    try {
      const res = await fetch('/api/documents');
      if (res.ok) {
        const data = await res.json();
        remoteDocs = data.documents || [];
      }
    } catch { /* backend offline */ }

    const localDocs = getMeta().map(d => ({ ...d, isLocal: true }));
    
    // Merge and deduplicate by title or original_name (ignore extension case)
    const seenNames = new Set();
    const merged = [];

    const addDoc = (d, isLocal) => {
      const uniqueKey = (d.title || d.original_name || '').toLowerCase();
      if (!seenNames.has(uniqueKey)) {
        seenNames.add(uniqueKey);
        merged.push({ ...d, isLocal });
      }
    };

    // Add remote docs first
    remoteDocs.forEach(d => addDoc(d, false));

    // Add local docs only if they aren't on server
    localDocs.forEach(d => addDoc(d, true));

    // Sort by date descending
    merged.sort((a, b) => new Date(b.upload_date) - new Date(a.upload_date));
    
    setDocuments(merged);
    setLoading(false);
  }, []);

  useEffect(() => { fetchDocuments(); }, [fetchDocuments]);

  /* ─── stage files from picker / drop ─── */
  const stageFiles = useCallback((fileList) => {
    const valid = Array.from(fileList).filter(f => {
      const ext = '.' + f.name.split('.').pop().toLowerCase();
      return ACCEPTED_EXTS.includes(ext);
    });
    if (!valid.length) { showToast('Only PDF and image files are accepted', 'error'); return; }

    setStaged(prev => [
      ...prev,
      ...valid.map(f => ({
        id:      Math.random().toString(36).slice(2),
        file:    f,
        preview: f.type.startsWith('image/') ? URL.createObjectURL(f) : null,
      })),
    ]);
  }, []);

  /* ─── drag handlers ─── */
  const onDrop      = useCallback((e) => { e.preventDefault(); setDragOver(false); stageFiles(e.dataTransfer.files); }, [stageFiles]);
  const onDragOver  = (e) => { e.preventDefault(); setDragOver(true); };
  const onDragLeave = ()  => setDragOver(false);

  /* ─── remove from queue ─── */
  const removeStaged = (id) => {
    setStaged(prev => {
      const item = prev.find(x => x.id === id);
      if (item?.preview) URL.revokeObjectURL(item.preview);
      return prev.filter(x => x.id !== id);
    });
  };

  /* ─── upload all staged files ─── */
  const uploadAll = async () => {
    if (!staged.length || uploading) return;
    setUploading(true);
    let successCount = 0;

    for (const item of staged) {
      setProgress(p => ({ ...p, [item.id]: 5 }));
      try {
        const fd = new FormData();
        fd.append('file', item.file);

        // Try server upload first
        const tick = setInterval(() =>
          setProgress(p => ({ ...p, [item.id]: Math.min((p[item.id] || 5) + 12, 80) })), 100);

        let res;
        try {
          res = await fetch('/api/upload', { method: 'POST', body: fd });
        } catch (e) {
          console.warn("Backend upload failed, falling back to local:", e);
        }

        clearInterval(tick);

        if (res && res.ok) {
          setProgress(p => ({ ...p, [item.id]: 100 }));
          successCount++;
        } else {
          // FALLBACK: Save locally to IndexedDB
          console.log("Saving locally as fallback...");
          await saveFileLocally(item.file);
          setProgress(p => ({ ...p, [item.id]: 100 }));
          successCount++;
        }
      } catch (err) {
        console.error("Upload error:", err);
        showToast(`Failed to save ${item.file.name}`, 'error');
      }
    }

    await new Promise(r => setTimeout(r, 600)); // wait for progress bars to finish
    setStaged([]);
    setProgress({});
    setUploading(false);
    await fetchDocuments();
    if (successCount) showToast(`✅ ${successCount} file${successCount > 1 ? 's' : ''} added to the Vault!`);
  };

  /* ─── delete document ─── */
  const deleteDoc = async (doc) => {
    if (!window.confirm(`Delete "${doc.original_name}"? This cannot be undone.`)) return;
    try {
      if (doc.isLocal) {
        await deleteFileLocally(doc.stored_name);
        setDocuments(prev => prev.filter(d => d.stored_name !== doc.stored_name));
        showToast(`"${doc.original_name}" deleted (local)`);
      } else {
        const res = await fetch(`/api/documents/${encodeURIComponent(doc.stored_name)}`, { method: 'DELETE' });
        if (res.ok) {
          setDocuments(prev => prev.filter(d => d.id !== doc.id));
          showToast(`"${doc.original_name}" deleted (server)`);
        } else {
          showToast('Server delete failed', 'error');
        }
      }
    } catch { showToast('Delete failed', 'error'); }
  };

  /* ─── preview helper for local/remote ─── */
  const handlePreview = async (doc) => {
    if (!isImageType(doc.file_type)) {
      const url = doc.isLocal ? await getBlobUrl(doc.stored_name) : `/api/download/${encodeURIComponent(doc.stored_name)}`;
      window.open(url, '_blank');
      return;
    }
    
    if (doc.isLocal) {
      const url = await getBlobUrl(doc.stored_name, vaultPassword);
      if (!url && doc.is_encrypted) {
        showToast('Vault Key required or incorrect', 'error');
        return;
      }
      setPreviewUrl(url);
    } else {
      setPreviewUrl(`/api/download/${encodeURIComponent(doc.stored_name)}`);
    }
  };

  const handleDownload = async (e, doc) => {
    if (!doc.isLocal) return; // let server handle default link
    e.preventDefault();
    const url = await getBlobUrl(doc.stored_name);
    const a = document.createElement('a');
    a.href = url;
    a.download = doc.original_name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  /* ─── derived ─── */
  const pdfCount = documents.filter(d => d.file_type === 'pdf').length;
  const imgCount = documents.filter(d => isImageType(d.file_type)).length;

  const filtered = documents
    .filter(d => {
      if (typeFilter === 'pdf')   return d.file_type === 'pdf';
      if (typeFilter === 'image') return isImageType(d.file_type);
      return true;
    })
    .filter(d => folder === 'all' || d.category === folder)
    .filter(d => d.original_name.toLowerCase().includes(search.toLowerCase()) || (d.title && d.title.toLowerCase().includes(search.toLowerCase())));

  /* ══════════════════════════════════════════ */
  return (
    <>
      {wizardOpen && (
        <OCRPlusWizard 
          onClose={() => setWizardOpen(false)} 
          knownMembers={extractKnownMembers()}
          onSuccess={() => {
            setWizardOpen(false);
            showToast('Receipt processed and synced successfully!');
            fetchDocs(); 
          }} 
        />
      )}

      <Topbar />
      <section className="page-section active">
        <div className="dashboard-layout">
          <Sidebar onSignOut={onSignOut} />

          <div className="main-panel">

            {/* ── Page Header ── */}
            <div className="dashboard-hero" style={{ marginBottom: 0 }}>
              <div className="hero-header">
                <div>
                  <span className="info-badge">🔒 Secure Storage</span>
                  <h2 style={{ margin: '10px 0 6px' }}>Documents Vault</h2>
                  <p>Upload and manage receipts, bills, invoices and trip-related proofs securely.</p>
                </div>
                {!loading && (
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <div className="nb-stat-pill nb-pill-red">
                      <span className="nb-pill-num">{pdfCount}</span> PDFs
                    </div>
                    <div className="nb-stat-pill nb-pill-green">
                      <span className="nb-pill-num">{imgCount}</span> Images
                    </div>
                    <div className="nb-stat-pill" style={{ background: 'rgba(124,58,237,0.14)', color: '#c4b5fd', borderColor: 'rgba(124,58,237,0.3)' }}>
                      <span className="nb-pill-num">{documents.length}</span> Total
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* ── Drop Zone ── */}
            <div
              className={`vt-drop-zone${dragOver ? ' vt-dragging' : ''}`}
              onDrop={onDrop}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.gif,.webp"
                multiple
                style={{ display: 'none' }}
                onChange={e => { stageFiles(e.target.files); e.target.value = ''; }}
              />
              <div className={`vt-drop-icon${dragOver ? ' vt-icon-bounce' : ' vt-icon-pulse'}`}>
                {dragOver ? '📂' : '☁️'}
              </div>
              <div className="vt-drop-title">{dragOver ? 'Release to add files' : 'Drag & drop files here'}</div>
              <div className="vt-drop-sub">or click anywhere in this area to browse</div>
              <button
                className="vt-browse-btn"
                onClick={e => { e.stopPropagation(); fileInputRef.current?.click(); }}
                type="button"
              >
                📁 Browse Files
              </button>
              <div className="vt-drop-formats">
                <span>PDF</span><span>JPG</span><span>PNG</span><span>GIF</span><span>WEBP</span>
              </div>
            </div>

            {/* ── Staged Queue ── */}
            {staged.length > 0 && (
              <div className="vt-staged-card">
                <div className="vt-staged-header">
                  <span className="vt-staged-title">
                    📋 Ready to upload — {staged.length} file{staged.length > 1 ? 's' : ''} queued
                  </span>
                  <button
                    id="vt-upload-btn"
                    className="vt-upload-btn"
                    onClick={uploadAll}
                    disabled={uploading}
                  >
                    {uploading ? '⟳ Uploading…' : `⬆ Upload All`}
                  </button>
                </div>
                <div className="vt-staged-list">
                  {staged.map(item => (
                    <div key={item.id} className="vt-staged-item">
                      <div className="vt-staged-thumb-wrap">
                        {item.preview
                          ? <img src={item.preview} className="vt-staged-thumb" alt="" />
                          : <div className="vt-staged-file-icon">📄</div>}
                      </div>
                      <div className="vt-staged-info">
                        <div className="vt-staged-name">{item.file.name}</div>
                        <div className="vt-staged-size">{formatSize(item.file.size)}</div>
                        {progress[item.id] !== undefined && (
                          <div className="vt-prog-track">
                            <div
                              className="vt-prog-fill"
                              style={{ width: `${progress[item.id]}%` }}
                            />
                          </div>
                        )}
                      </div>
                      {!uploading && (
                        <button className="vt-remove-staged" onClick={() => removeStaged(item.id)}>✕</button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Vault Documents ── */}
            <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: '24px' }}>
              {/* Folder Sidebar */}
              <div className="vt-folders-sidebar">
                <button className={`vt-folder-item ${folder === 'all' ? 'active' : ''}`} onClick={() => setFolder('all')}>
                  <span className="vt-folder-icon">📂</span> All Docs
                </button>
                <div className="vt-folder-sep">Categories</div>
                {[
                  { id: 'hotel', icon: '🏨', label: 'Hotel' },
                  { id: 'food', icon: '🍽️', label: 'Food' },
                  { id: 'games', icon: '🎮', label: 'Games' },
                  { id: 'general', icon: '📦', label: 'General' },
                ].map(cat => (
                  <button 
                    key={cat.id} 
                    className={`vt-folder-item ${folder === cat.id ? 'active' : ''}`}
                    onClick={() => setFolder(cat.id)}
                  >
                    <span className="vt-folder-icon">{cat.icon}</span> {cat.label}
                  </button>
                ))}

                <div className="vt-folder-sep">Security</div>
                <div style={{ padding: '0 10px 10px' }}>
                  <input 
                    type="password" 
                    className="ae-input" 
                    placeholder="Enter Vault Key" 
                    value={vaultPassword}
                    onChange={e => {
                      setVaultPassword(e.target.value);
                      sessionStorage.setItem('debtEaseVaultKey', e.target.value);
                    }}
                    style={{ fontSize: '0.8rem', padding: '10px' }}
                  />
                  <p className="ae-muted" style={{ fontSize: '0.65rem', marginTop: '6px' }}>🔑 Required for encrypted docs.</p>
                </div>
              </div>

              {/* Main Documents Area */}
              <div className="feature-card" style={{ margin: 0, minHeight: '500px' }}>
                {/* Controls bar */}
                <div className="vt-docs-bar">
                  <h3 style={{ margin: 0 }}>Docs in {folder === 'all' ? 'Vault' : folder.charAt(0).toUpperCase() + folder.slice(1)}</h3>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <div className="nb-search-wrap" style={{ maxWidth: '240px' }}>
                      <svg className="nb-search-icon" width="15" height="15" viewBox="0 0 24 24" fill="none"
                        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                      </svg>
                      <input
                        className="nb-search-input"
                        type="text"
                        placeholder="Search files…"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        style={{ padding: '8px 14px 8px 38px' }}
                      />
                    </div>
                    <div className="vt-type-tabs">
                      {[
                        { val: 'all',   label: `All (${documents.length})` },
                        { val: 'pdf',   label: `PDFs (${pdfCount})` },
                        { val: 'image', label: `Images (${imgCount})` },
                      ].map(t => (
                        <button
                          key={t.val}
                          className={`nb-tab${typeFilter === t.val ? ' active' : ''}`}
                          style={{ padding: '6px 14px' }}
                          onClick={() => setTypeFilter(t.val)}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Content */}
                {loading ? (
                  <div className="vt-skeleton-grid">
                    {[1,2,3,4,5,6].map(i => <div key={i} className="vt-skeleton-card" />)}
                  </div>
                ) : filtered.length === 0 ? (
                  <div className="nb-empty">
                    <div className="nb-empty-icon">{documents.length === 0 ? '🗂️' : '🔍'}</div>
                    <div className="nb-empty-title">
                      {documents.length === 0 ? 'Vault is empty' : 'No files match'}
                    </div>
                    <div className="nb-empty-sub">
                      {documents.length === 0
                        ? 'Upload receipts, invoices or bills using the drop zone above.'
                        : 'Try adjusting your search or filter.'}
                    </div>
                    {documents.length === 0 && (
                      <button
                        className="button-primary"
                        style={{ marginTop: '16px', padding: '10px 24px', fontSize: '0.9rem' }}
                        onClick={() => setWizardOpen(true)}
                      >
                        🚀 Launch OCR Wizard
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="vt-docs-grid">
                    {filtered.map(doc => {
                      const isImg = isImageType(doc.file_type);
                      const ext   = (doc.file_type || getExt(doc.original_name)).toUpperCase();
                      const dlUrl = doc.isLocal ? '#' : `/api/download/${encodeURIComponent(doc.stored_name)}`;

                      return (
                        <div key={doc.stored_name} className="vt-doc-card">
                          {/* Preview area */}
                          <div
                            className={`vt-doc-preview${isImg ? ' vt-prev-img' : ' vt-prev-pdf'}`}
                            onClick={() => handlePreview(doc)}
                            style={isImg ? { cursor: 'zoom-in' } : {}}
                          >
                            {isImg
                              ? (
                                  doc.isLocal 
                                  ? <LocalImageThumbnail stored_name={doc.stored_name} alt={doc.original_name} password={vaultPassword} />
                                  : <img src={dlUrl} alt={doc.original_name} className="vt-doc-img" />
                                )
                              : (
                                <div className="vt-pdf-placeholder">
                                  <span className="vt-pdf-big-icon">📄</span>
                                  <span className="vt-pdf-ext-badge">{ext}</span>
                                </div>
                              )}
                            {isImg && (
                              <div className="vt-img-overlay">
                                <span>🔍 Click to preview</span>
                              </div>
                            )}
                            {doc.is_encrypted && (
                              <div className="vt-enc-badge">🔒 Encrypted</div>
                            )}
                          </div>

                          {/* Info */}
                          <div className="vt-doc-body">
                            <div className="vt-doc-name" title={doc.title || doc.original_name}>
                              {doc.title || doc.original_name}
                              {doc.isLocal && <span style={{fontSize:'10px', marginLeft:'5px', opacity:0.6}}>(Local)</span>}
                            </div>
                            <div className="vt-doc-meta" style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span className={`vt-ext-badge${isImg ? ' vt-ext-img' : ' vt-ext-pdf'}`}>{ext}</span>
                              <span className="vt-folder-tag">{doc.category || 'general'}</span>
                            </div>
                            <div className="vt-doc-date">📅 {formatDate(doc.upload_date)}</div>
                          </div>

                          {/* Actions */}
                          <div className="vt-doc-actions">
                            <button
                              className="vt-btn vt-btn-preview"
                              onClick={() => handlePreview(doc)}
                              title="Open / Preview"
                            >
                              {isImg ? '👁 Preview' : '👁 Open'}
                            </button>
                            <a
                              href={dlUrl}
                              download={doc.original_name}
                              className="vt-btn vt-btn-dl"
                              onClick={(e) => handleDownload(e, doc)}
                              title="Download"
                            >
                              ⬇ Download
                            </a>
                            <button
                              className="vt-btn vt-btn-del"
                              onClick={() => deleteDoc(doc)}
                              title="Delete"
                            >
                              🗑 Delete
                            </button>
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

      {/* ── Lightbox preview ── */}
      {previewUrl && (
        <div className="vt-lightbox" onClick={() => {
          if (previewUrl.startsWith('blob:')) URL.revokeObjectURL(previewUrl);
          setPreviewUrl(null);
        }}>
          <div className="vt-lightbox-inner" onClick={e => e.stopPropagation()}>
            <button className="vt-lightbox-close" onClick={() => {
               if (previewUrl.startsWith('blob:')) URL.revokeObjectURL(previewUrl);
               setPreviewUrl(null);
            }}>✕</button>
            <img src={previewUrl} className="vt-lightbox-img" alt="preview" />
          </div>
        </div>
      )}

      {/* ── Toast ── */}
      <div className={`ae-toast${toast.msg ? ' ae-toast-show' : ''}${toast.type === 'error' ? ' ae-toast-error' : ''}`}>
        {toast.msg}
      </div>
    </>
  );
}

export default Vault;

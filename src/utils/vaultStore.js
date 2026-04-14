/**
 * vaultStore.js
 * Local document vault using IndexedDB for binaries + localStorage for metadata.
 * Works fully offline — no backend required.
 */

const DB_NAME   = 'debtease_vault_db';
const DB_VER    = 1;
const STORE     = 'files';
const META_KEY  = 'debtEaseVaultMeta';

/* ─── Encryption System (Web Crypto API) ─── */
const ENCRYPT_ALGO = 'AES-GCM';
const KEY_ALGO = 'PBKDF2';

async function deriveKey(password, salt) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw', enc.encode(password), { name: KEY_ALGO }, false, ['deriveKey']
  );
  return await crypto.subtle.deriveKey(
    { name: KEY_ALGO, salt: enc.encode(salt), iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    { name: ENCRYPT_ALGO, length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function encryptFile(file, password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt);
  
  const buffer = await file.arrayBuffer();
  const encryptedContent = await crypto.subtle.encrypt(
    { name: ENCRYPT_ALGO, iv },
    key,
    buffer
  );

  return {
    encryptedBuffer: encryptedContent,
    salt: btoa(String.fromCharCode(...salt)),
    iv: btoa(String.fromCharCode(...iv))
  };
}

export async function decryptFile(encryptedBuffer, password, saltStr, ivStr) {
  const salt = new Uint8Array(atob(saltStr).split('').map(c => c.charCodeAt(0)));
  const iv = new Uint8Array(atob(ivStr).split('').map(c => c.charCodeAt(0)));
  const key = await deriveKey(password, salt);

  return await crypto.subtle.decrypt(
    { name: ENCRYPT_ALGO, iv },
    key,
    encryptedBuffer
  );
}

/* ── open / create IndexedDB ── */
function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VER);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'stored_name' });
      }
    };
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror   = (e) => reject(e.target.error);
  });
}

/* ── metadata helpers (localStorage) ── */
export function getMeta() {
  try { return JSON.parse(localStorage.getItem(META_KEY) || '[]'); }
  catch { return []; }
}
function setMeta(meta) {
  localStorage.setItem(META_KEY, JSON.stringify(meta));
}

/* ── save a File to IndexedDB and return its metadata ── */
export async function saveFileLocally(file, options = {}) {
  const { password, category, title, description, participants } = options;
  let buffer = await file.arrayBuffer();
  let encryption = null;

  if (password) {
    const result = await encryptFile(file, password);
    buffer = result.encryptedBuffer;
    encryption = { salt: result.salt, iv: result.iv };
  }

  const now  = new Date();
  const ts   = now.toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
  const rand = Math.random().toString(36).slice(2, 8);
  const safe = file.name.replace(/[^\w.\-]/g, '_');
  const stored_name = `${ts}_${rand}_${safe}`;
  const ext  = file.name.includes('.') ? file.name.split('.').pop().toLowerCase() : 'bin';

  const entry = {
    id:            (typeof crypto !== 'undefined' && crypto.randomUUID)
                     ? crypto.randomUUID()
                     : rand + Date.now(),
    original_name: file.name,
    stored_name,
    file_type:     ext,
    mime_type:     file.type || 'application/octet-stream',
    file_size:     file.size,
    upload_date:   now.toISOString(),
    source:        'local',
    category:      category || 'general',
    title:         title || file.name,
    description:   description || '',
    participants:  participants || [],
    is_encrypted:  !!password,
    encryption,      // salt and iv
    buffer,           // stored in IndexedDB only
  };

  /* write binary to IndexedDB */
  const db = await openDB();
  await new Promise((res, rej) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(entry);
    tx.oncomplete = res;
    tx.onerror    = (e) => rej(e.target.error);
  });

  /* write metadata (no buffer) to localStorage */
  const { buffer: _buf, ...meta } = entry;
  setMeta([...getMeta(), meta]);

  return meta;
}

/* ── create a blob URL from IndexedDB for a stored file ── */
export async function getBlobUrl(stored_name, password = null) {
  const db = await openDB();
  return new Promise((resolve) => {
    const tx  = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(stored_name);
    req.onsuccess = async (e) => {
      const doc = e.target.result;
      if (!doc) { resolve(null); return; }
      
      let finalBuffer = doc.buffer;
      if (doc.is_encrypted && doc.encryption) {
        if (!password) {
          console.warn("Document is encrypted but no password provided");
          resolve(null);
          return;
        }
        try {
          finalBuffer = await decryptFile(doc.buffer, password, doc.encryption.salt, doc.encryption.iv);
        } catch (err) {
          console.error("Decryption failed:", err);
          resolve(null);
          return;
        }
      }
      
      const blob = new Blob([finalBuffer], { type: doc.mime_type });
      resolve(URL.createObjectURL(blob));
    };
    req.onerror = () => resolve(null);
  });
}

/* ── delete a document from IndexedDB + localStorage ── */
export async function deleteFileLocally(stored_name) {
  const db = await openDB();
  await new Promise((res, rej) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(stored_name);
    tx.oncomplete = res;
    tx.onerror    = (e) => rej(e.target.error);
  });
  setMeta(getMeta().filter(d => d.stored_name !== stored_name));
}

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import '../style.css';

// Configure locally in frontend/.env and on Vercel as VITE_API_BASE.
const API_BASE = (import.meta.env.VITE_API_BASE || 'http://localhost:5000/api').replace(/\/$/, '');
const FIELDS = [
  { name: 'title', label: 'Book title', type: 'text', required: true },
  { name: 'author', label: 'Author', type: 'text', required: true },
  { name: 'genre', label: 'Genre', type: 'text', required: true },
  { name: 'copies', label: 'Copies', type: 'number', required: true },
];

async function api(path, options = {}) {
  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(options.headers || {}) },
    });
  } catch (error) {
    throw new Error(`Cannot reach the API at ${API_BASE}. Check VITE_API_BASE and backend CORS settings.`);
  }
  let body = {};
  try { body = await response.json(); } catch { /* Some errors may not return JSON. */ }
  if (!response.ok) throw new Error(body.error || `Request failed (HTTP ${response.status}).`);
  return body;
}

function App() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [apiStatus, setApiStatus] = useState('Connecting');
  const [query, setQuery] = useState('');
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ title: '', author: '', genre: '', copies: '' });
  const [formError, setFormError] = useState('');
  const [toast, setToast] = useState('');
  const [saving, setSaving] = useState(false);

  const notify = useCallback((message) => {
    setToast(message);
    window.setTimeout(() => setToast(''), 3000);
  }, []);

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api('/books');
      setItems(Array.isArray(result.data) ? result.data : []);
      setApiStatus('API connected');
    } catch (error) {
      setItems([]);
      setApiStatus('API unavailable');
      notify(error.message);
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => { loadItems(); }, [loadItems]);

  const filteredItems = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return items;
    return items.filter(item => [item.title, item.author, item.genre, item.copies]
      .some(value => String(value ?? '').toLowerCase().includes(needle)));
  }, [items, query]);

  function openEditor(item = null) {
    setEditingId(item?._id || null);
    setForm(item ? {
      title: item.title ?? '', author: item.author ?? '', genre: item.genre ?? '', copies: String(item.copies ?? ''),
    } : { title: '', author: '', genre: '', copies: '' });
    setFormError('');
    setEditorOpen(true);
  }

  function closeEditor() {
    if (saving) return;
    setEditorOpen(false);
    setEditingId(null);
    setFormError('');
  }

  useEffect(() => {
    if (!editorOpen) return undefined;
    function onKeyDown(event) { if (event.key === 'Escape' && !saving) closeEditor(); }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [editorOpen, saving]);

  async function saveItem(event) {
    event.preventDefault();
    setSaving(true);
    setFormError('');
    const payload = {
      title: form.title.trim(), author: form.author.trim(), genre: form.genre.trim(), copies: Number(form.copies),
    };
    if (!payload.title || !payload.author || !payload.genre || form.copies === '' || !Number.isFinite(payload.copies) || payload.copies < 0) {
      setFormError('Fill in every field. Copies must be a non-negative number.');
      setSaving(false);
      return;
    }
    try {
      const path = `/books${editingId ? `/${encodeURIComponent(editingId)}` : ''}`;
      await api(path, { method: editingId ? 'PUT' : 'POST', body: JSON.stringify(payload) });
      setEditorOpen(false);
      notify(editingId ? 'Book updated successfully.' : 'Book created successfully.');
      setEditingId(null);
      await loadItems();
    } catch (error) {
      setFormError(error.message);
    } finally {
      setSaving(false);
    }
  }

  async function removeItem(item) {
    if (!window.confirm(`Delete “${item.title}”? This cannot be undone.`)) return;
    try {
      await api(`/books/${encodeURIComponent(item._id)}`, { method: 'DELETE' });
      notify('Book deleted.');
      await loadItems();
    } catch (error) { notify(error.message); }
  }

  return <>
    <header className="topbar">
      <a className="brand" href="#" aria-label="BookNest home"><span className="brand-icon">▤</span><span>BookNest</span></a>
      <span className="top-label">Library desk <i /> LIVE WORKSPACE</span>
      <div className={`api-status ${apiStatus === 'API connected' ? 'connected' : apiStatus === 'API unavailable' ? 'disconnected' : ''}`}><span /><b>{apiStatus}</b></div>
    </header>

    <main className="page">
      <section className="hero">
        <div className="hero-copy">
          <p className="overline">A LITTLE ORDER GOES A LONG WAY</p>
          <h1>Your shelves, neatly in order.</h1>
          <p className="hero-description">A calm space to keep your library moving. A simple catalogue for the books readers return to.</p>
          <div className="hero-actions"><button className="primary-button" type="button" onClick={() => openEditor()}><span>＋</span> Add book</button><span className="helper">Create · View · Edit · Delete</span></div>
        </div>
        <div className="hero-art" aria-hidden="true"><div className="art-orbit orbit-one" /><div className="art-orbit orbit-two" /><div className="art-card"><span className="art-symbol">▤</span><span className="art-lines" /><span className="art-lines short" /></div><span className="art-spark spark-one">✳</span><span className="art-spark spark-two">✦</span></div>
      </section>

      <section className="overview"><div className="overview-label"><span className="small-icon">▤</span><span>Titles in catalogue</span></div><strong>{items.length}</strong><span className="overview-note">{items.length === 1 ? '1 saved record' : `${items.length} saved records`}</span></section>

      <section className="records-section">
        <div className="section-top"><div><p className="overline">YOUR COLLECTION</p><h2>Books</h2><p className="section-description">A tidy list, ready whenever you need it.</p></div><label className="search"><span>⌕</span><input type="search" placeholder="Find a book…" aria-label="Search books" value={query} onChange={event => setQuery(event.target.value)} /></label></div>
        <div className="record-list">
          {loading ? <div className="loading">Loading your records…</div> : filteredItems.length === 0 ? <div className="empty-state"><strong>{items.length ? 'No matches found' : 'A fresh start'}</strong><p>{items.length ? 'Try a different search.' : 'Add your first record using the button above.'}</p></div> : filteredItems.map((item, index) => <article className="record-row" key={item._id}>
            <span className="row-number">{String(index + 1).padStart(2, '0')}</span>
            <div className="record-main"><div className="record-title">{item.title}</div><div className="record-subtitle">{item.author}</div></div>
            <div className="record-detail">Genre: {item.genre}</div><div className="record-quantity">Copies: {item.copies}</div>
            <div className="row-actions"><button className="action-button" type="button" onClick={() => openEditor(item)}>Edit</button><button className="action-button delete" type="button" onClick={() => removeItem(item)}>Delete</button></div>
          </article>)}
        </div>
        <div className="list-footer"><span>{loading ? 'Loading records' : `${filteredItems.length} of ${items.length} books`}</span><button className="text-button" type="button" onClick={loadItems}>↻ Refresh list</button></div>
      </section>
      <footer><span>BookNest</span><span>Simple records, less busywork.</span></footer>
    </main>

    {editorOpen && <div className="modal-layer" onMouseDown={event => { if (event.target === event.currentTarget) closeEditor(); }}>
      <section className="editor" role="dialog" aria-modal="true" aria-labelledby="editorTitle">
        <div className="editor-head"><div><p className="overline">{editingId ? 'EDIT ENTRY' : 'NEW ENTRY'}</p><h2 id="editorTitle">{editingId ? 'Edit book' : 'Add book'}</h2></div><button className="close-button" type="button" aria-label="Close" onClick={closeEditor}>×</button></div>
        <form onSubmit={saveItem}><div className="form-fields">{FIELDS.map((field, index) => <div className={`field ${FIELDS.length % 2 && index === FIELDS.length - 1 ? 'full' : ''}`} key={field.name}><label htmlFor={`input-${field.name}`}>{field.label}</label><input id={`input-${field.name}`} name={field.name} type={field.type} min={field.type === 'number' ? '0' : undefined} step={field.type === 'number' ? 'any' : undefined} required value={form[field.name]} onChange={event => setForm(current => ({ ...current, [field.name]: event.target.value }))} /></div>)}</div>{formError && <p className="form-error" role="alert">{formError}</p>}<div className="editor-actions"><button className="cancel-button" type="button" onClick={closeEditor} disabled={saving}>Cancel</button><button className="primary-button" type="submit" disabled={saving}>{saving ? 'Saving…' : editingId ? 'Save changes' : 'Save book'}</button></div></form>
      </section>
    </div>}
    <div className={`toast ${toast ? 'show' : ''}`} role="status" aria-live="polite">{toast}</div>
  </>;
}

createRoot(document.getElementById('root')).render(<App />);

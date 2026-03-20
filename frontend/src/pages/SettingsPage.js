import { useState, useEffect } from 'react';
import Page from '../components/Page';
import { parseJsonResponse } from '../utils/api';
import { API_BASE } from '../config';

export default function SettingsPage() {
  const [session, setSession] = useState({ connected: false, qr: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [categories, setCategories] = useState([]);
  const [newCategory, setNewCategory] = useState('');
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [categoriesError, setCategoriesError] = useState(null);
  const [logoutLoading, setLogoutLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const fetchSession = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/whatsapp/session`);
        const data = await parseJsonResponse(res);
        if (!cancelled) {
          setSession({
            connected: data.connected,
            qr: data.qr || null,
            account: data.account || null
          });
          setError(data.error || null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || 'Failed to load WhatsApp session');
          setSession({ connected: false, qr: null, account: null });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchSession();
    const interval = setInterval(fetchSession, 2500);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const fetchCategories = async () => {
    setCategoriesError(null);
    try {
      const res = await fetch(`${API_BASE}/api/categories`);
      const data = await parseJsonResponse(res);
      if (res.ok) setCategories(Array.isArray(data) ? data : []);
      else setCategoriesError(data.error || 'Failed to load categories');
    } catch (err) {
      setCategoriesError(err.message || 'Failed to load categories');
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const handleLogout = async () => {
    setLogoutLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/whatsapp/logout`, { method: 'POST' });
      const data = await parseJsonResponse(res);
      if (res.ok) {
        setSession({ connected: false, qr: null, account: null });
        setError(null);
      } else {
        setError(data.error || 'Logout failed');
      }
    } catch (err) {
      setError(err.message || 'Logout failed');
    } finally {
      setLogoutLoading(false);
    }
  };

  const handleAddCategory = async (e) => {
    e.preventDefault();
    const name = newCategory.trim();
    if (!name) return;
    setCategoriesLoading(true);
    setCategoriesError(null);
    try {
      const res = await fetch(`${API_BASE}/api/categories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
      });
      const data = await parseJsonResponse(res);
      if (res.ok) {
        setCategories(Array.isArray(data) ? data : [...categories, name]);
        setNewCategory('');
      } else {
        setCategoriesError(data.error || 'Failed to add category');
      }
    } catch (err) {
      setCategoriesError(err.message || 'Failed to add category');
    } finally {
      setCategoriesLoading(false);
    }
  };

  return (
    <Page topAlign>
      <h1 className="page-title mb-2">Settings</h1>
      <p className="page-desc mb-4">Configure your preferences and account.</p>

      <div className="card card-app text-start">
        <div className="card-body p-4">
          <p className="section-head mb-3">WhatsApp</p>

          {loading && !session.qr && !session.connected && (
            <p className="small text-muted mb-0">Starting WhatsApp Web…</p>
          )}

          {error && !session.qr && !session.connected && (
            <div className="alert alert-app py-2 px-3 mb-3">
              {error}
            </div>
          )}

          {session.connected ? (
            <div>
              <p className="page-desc small mb-3">
                Your WhatsApp account is linked. You can send messages from the Messages page.
              </p>
              <div className="d-flex align-items-center gap-2 text-success mb-3">
                <span className="small fw-medium">Connected</span>
              </div>
              {session.account && (
                <div className="border rounded p-3 bg-light bg-opacity-50">
                  <p className="small text-muted text-uppercase mb-2">Account</p>
                  {session.account.name && (
                    <p className="small mb-1">
                      <span className="text-muted">Name</span>
                      <span className="ms-2 fw-medium">{session.account.name}</span>
                    </p>
                  )}
                  {session.account.number && (
                    <p className="small mb-1">
                      <span className="text-muted">Number</span>
                      <span className="ms-2 fw-medium">{session.account.number}</span>
                    </p>
                  )}
                  {session.account.platform && (
                    <p className="small mb-0">
                      <span className="text-muted">Platform</span>
                      <span className="ms-2">{session.account.platform}</span>
                    </p>
                  )}
                </div>
              )}
              <button
                type="button"
                className="btn btn-outline-danger btn-sm mt-3"
                onClick={handleLogout}
                disabled={logoutLoading}
              >
                {logoutLoading ? 'Logging out…' : 'Logout'}
              </button>
            </div>
          ) : (
            <div>
              <p className="page-desc small mb-3">
                Link WhatsApp Web to this app. Open WhatsApp on your phone, go to Linked Devices and scan the QR code below.
              </p>
              {session.qr ? (
                <div>
                  <img
                    src={session.qr}
                    alt="WhatsApp QR code"
                    className="rounded"
                    style={{ maxWidth: 280, height: 'auto' }}
                  />
                  <p className="small text-muted mt-2 mb-0">Scan with WhatsApp → Linked Devices</p>
                </div>
              ) : (
                !loading && !error && <p className="small text-muted mb-0">Waiting for QR code…</p>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="card card-app text-start mt-4">
        <div className="card-body p-4">
          <p className="section-head mb-3">Categories</p>
          <p className="page-desc small mb-3">
            Add categories to organize your leads and searches.
          </p>
          <form onSubmit={handleAddCategory} className="d-flex flex-column flex-md-row gap-2 mb-3">
            <input
              type="text"
              className="form-control flex-grow-1"
              placeholder="Category name"
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              disabled={categoriesLoading}
              aria-label="New category name"
            />
            <button type="submit" className="btn btn-primary text-nowrap" disabled={categoriesLoading}>
              {categoriesLoading ? 'Adding…' : 'Add'}
            </button>
          </form>
          {categoriesError && (
            <div className="alert alert-app py-2 px-3 mb-3">
              {categoriesError}
            </div>
          )}
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead>
                <tr>
                  <th className="text-muted small text-uppercase">#</th>
                  <th className="text-muted small text-uppercase">Category</th>
                </tr>
              </thead>
              <tbody>
                {categories.length === 0 && (
                  <tr>
                    <td colSpan={2} className="text-muted small">
                      No categories yet. Add one above.
                    </td>
                  </tr>
                )}
                {categories.map((cat, i) => (
                  <tr key={i}>
                    <td className="text-muted small">{i + 1}</td>
                    <td>{cat}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Page>
  );
}

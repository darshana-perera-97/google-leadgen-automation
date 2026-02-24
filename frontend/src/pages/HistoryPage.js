import { useState, useEffect } from 'react';
import Page from '../components/Page';
import { parseJsonResponse } from '../utils/api';
import { API_BASE } from '../config';

function formatTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    dateStyle: 'short',
    timeStyle: 'short'
  });
}

export default function HistoryPage() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_BASE}/api/history`)
      .then((res) => parseJsonResponse(res))
      .then((data) => {
        if (!cancelled && Array.isArray(data)) setHistory(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Failed to load history');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  return (
    <Page topAlign>
      <h1 className="page-title mb-2">History</h1>
      <p className="page-desc mb-4">Search phrases and when you searched.</p>

      {error && (
        <div className="alert alert-app py-2 px-3 mb-3">
          {error}
        </div>
      )}

      {loading ? (
        <p className="small text-muted">Loading history…</p>
      ) : (
        <div className="card card-app">
          <div className="card-body p-4">
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0">
                <thead>
                  <tr>
                    <th className="text-muted small text-uppercase">#</th>
                    <th className="text-muted small text-uppercase">Search phrase</th>
                    <th className="text-muted small text-uppercase">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {history.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="text-muted small">
                        No search history yet. Searches from the Home page will appear here.
                      </td>
                    </tr>
                  ) : (
                    history.map((entry, i) => (
                      <tr key={i}>
                        <td className="text-muted small">{i + 1}</td>
                        <td>{entry.query || '—'}</td>
                        <td className="small text-muted">{formatTime(entry.timestamp)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </Page>
  );
}

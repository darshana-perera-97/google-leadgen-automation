import { useState, useEffect } from 'react';
import Page from '../components/Page';
import { parseJsonResponse } from '../utils/api';
import { API_BASE } from '../config';

const PER_PAGE = 10;

export default function LeadsPage() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(leads.length / PER_PAGE));
  const start = (currentPage - 1) * PER_PAGE;
  const end = start + PER_PAGE;
  const pageLeads = leads.slice(start, end);

  useEffect(() => {
    setCurrentPage(1);
  }, [leads.length]);

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_BASE}/api/leads`)
      .then((res) => parseJsonResponse(res))
      .then((data) => {
        if (!cancelled && Array.isArray(data)) setLeads(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Failed to load leads');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  return (
    <Page topAlign>
      <h1 className="page-title mb-2">Leads</h1>
      <p className="page-desc mb-4">View and manage your leads here.</p>

      {error && (
        <div className="alert alert-app py-2 px-3 mb-3">
          {error}
        </div>
      )}

      {loading ? (
        <p className="small text-muted">Loading leads…</p>
      ) : (
        <div className="card card-app">
          <div className="card-body p-4">
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0">
                <thead>
                  <tr>
                    <th className="text-muted small text-uppercase">Name</th>
                    <th className="text-muted small text-uppercase">WhatsApp number</th>
                    <th className="text-muted small text-uppercase">Category</th>
                    <th className="text-muted small text-uppercase">Search phrase</th>
                  </tr>
                </thead>
                <tbody>
                  {leads.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="text-muted small">
                        No leads yet. Save results from the Home search to add leads.
                      </td>
                    </tr>
                  ) : (
                    pageLeads.map((lead, i) => (
                      <tr key={start + i}>
                        <td>{lead.name || '—'}</td>
                        <td>
                          {lead.whatsappnumber ? (
                            <a href={`tel:${lead.whatsappnumber.replace(/\s/g, '')}`} className="text-decoration-none">
                              {lead.whatsappnumber}
                            </a>
                          ) : (
                            <span className="text-muted">—</span>
                          )}
                        </td>
                        <td>{lead.category && typeof lead.category === 'object' ? lead.category.name : lead.category || '—'}</td>
                        <td className="small text-muted">{lead.searchPhrase || '—'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {leads.length > 0 && (
              <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 px-4 pb-4 pt-2">
                <p className="small text-muted mb-0">
                  Showing {start + 1}–{end} of {leads.length}
                </p>
                <nav aria-label="Leads pagination">
                  <ul className="pagination pagination-sm mb-0">
                    <li className={`page-item ${currentPage <= 1 ? 'disabled' : ''}`}>
                      <button
                        type="button"
                        className="page-link"
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        disabled={currentPage <= 1}
                        aria-label="Previous"
                      >
                        Previous
                      </button>
                    </li>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                      <li key={p} className={`page-item ${p === currentPage ? 'active' : ''}`}>
                        <button
                          type="button"
                          className="page-link"
                          onClick={() => setCurrentPage(p)}
                        >
                          {p}
                        </button>
                      </li>
                    ))}
                    <li className={`page-item ${currentPage >= totalPages ? 'disabled' : ''}`}>
                      <button
                        type="button"
                        className="page-link"
                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                        disabled={currentPage >= totalPages}
                        aria-label="Next"
                      >
                        Next
                      </button>
                    </li>
                  </ul>
                </nav>
              </div>
            )}
          </div>
        </div>
      )}
    </Page>
  );
}

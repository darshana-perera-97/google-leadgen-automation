import { useState, useEffect } from 'react';
import { parseJsonResponse } from '../utils/api';
import { API_BASE } from '../config';

const CARD_KEYS = [
  { title: 'Leads', key: 'leads' },
  { title: 'Searches', key: 'searches' },
  { title: 'Campaigns', key: 'campaigns' },
  { title: 'Messages', key: 'messages' },
];

// ISO 2-letter country codes for Serper API gl parameter
const COUNTRIES = [
  { code: '', name: 'Any country' },
  { code: 'us', name: 'United States' },
  { code: 'uk', name: 'United Kingdom' },
  { code: 'in', name: 'India' },
  { code: 'ca', name: 'Canada' },
  { code: 'au', name: 'Australia' },
  { code: 'de', name: 'Germany' },
  { code: 'fr', name: 'France' },
  { code: 'es', name: 'Spain' },
  { code: 'it', name: 'Italy' },
  { code: 'nl', name: 'Netherlands' },
  { code: 'br', name: 'Brazil' },
  { code: 'mx', name: 'Mexico' },
  { code: 'za', name: 'South Africa' },
  { code: 'ng', name: 'Nigeria' },
  { code: 'ke', name: 'Kenya' },
  { code: 'ae', name: 'United Arab Emirates' },
  { code: 'sg', name: 'Singapore' },
  { code: 'my', name: 'Malaysia' },
  { code: 'ph', name: 'Philippines' },
  { code: 'pk', name: 'Pakistan' },
  { code: 'bd', name: 'Bangladesh' },
  { code: 'zw', name: 'Zimbabwe' },
  { code: 'lk', name: 'Sri Lanka' },
  { code: 'gh', name: 'Ghana' },
  { code: 'eg', name: 'Egypt' },
  { code: 'sa', name: 'Saudi Arabia' },
  { code: 'tr', name: 'Turkey' },
  { code: 'pl', name: 'Poland' },
  { code: 'jp', name: 'Japan' },
  { code: 'kr', name: 'South Korea' },
  { code: 'cn', name: 'China' },
  { code: 'ru', name: 'Russia' },
];

function getContactDisplay(item) {
  const phone = item.phone || item.phoneNumber || item.tel || item.telephone;
  if (phone) return { label: 'Contact', value: phone };
  const attrs = item.attributes;
  if (attrs && typeof attrs === 'object') {
    const phoneKeys = ['Phone', 'Sales', 'Contact', 'Telephone', 'Tel', 'Phone number'];
    for (const key of phoneKeys) {
      if (attrs[key]) return { label: key, value: attrs[key] };
    }
    const first = Object.entries(attrs)[0];
    if (first) return { label: first[0], value: first[1] };
  }
  return null;
}

export default function HomePage() {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedCountry, setSelectedCountry] = useState('lk');
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveMessage, setSaveMessage] = useState(null);
  const [cards, setCards] = useState({ leads: 0, searches: 0, campaigns: 0, messages: 0 });
  const [queueStatus, setQueueStatus] = useState({ length: 0, loading: true });

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_BASE}/api/dashboard`)
      .then((res) => parseJsonResponse(res))
      .then((data) => {
        if (!cancelled) {
          if (data.lastSearchResults) setResult(data.lastSearchResults);
          if (data.cards && typeof data.cards === 'object') setCards((c) => ({ ...c, ...data.cards }));
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_BASE}/api/categories`)
      .then((res) => parseJsonResponse(res))
      .then((data) => {
        if (!cancelled && Array.isArray(data)) setCategories(data);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const fetchQueueStatus = () => {
    fetch(`${API_BASE}/api/queue`)
      .then((res) => parseJsonResponse(res))
      .then((data) => {
        setQueueStatus((prev) => ({ ...prev, length: data.length ?? 0, loading: false }));
      })
      .catch(() => setQueueStatus((prev) => ({ ...prev, loading: false })));
  };

  useEffect(() => {
    fetchQueueStatus();
    const interval = setInterval(fetchQueueStatus, 15000);
    return () => clearInterval(interval);
  }, []);

  const handleSaveResults = async () => {
    if (!result || !result.organic || result.organic.length === 0) return;
    setSaveMessage(null);
    setSaveLoading(true);
    try {
      const countryName = selectedCountry ? COUNTRIES.find((c) => c.code === selectedCountry)?.name : null;
      const searchPhraseWithCountry = countryName ? `${query} (${countryName})` : query;

      const rows = result.organic.map((item) => {
        const contact = getContactDisplay(item);
        return {
          name: item.title || 'No title',
          whatsappnumber: contact ? contact.value : '',
          category: selectedCategory || ''
        };
      });
      const res = await fetch(`${API_BASE}/api/leads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rows,
          category: selectedCategory || '',
          searchPhrase: searchPhraseWithCountry
        })
      });
      const data = await parseJsonResponse(res);
      if (res.ok) {
        const msg = data.skipped
          ? `Saved ${data.saved} lead(s). ${data.skipped} duplicate(s) skipped.`
          : `Saved ${data.saved} lead(s).`;
        setSaveMessage(msg);
        const dashRes = await fetch(`${API_BASE}/api/dashboard`);
        const dash = await parseJsonResponse(dashRes);
        if (dash.cards && typeof dash.cards === 'object') setCards((c) => ({ ...c, ...dash.cards }));
      } else {
        setSaveMessage(data.error || 'Failed to save');
      }
    } catch (err) {
      setSaveMessage(err.message || 'Failed to save');
    } finally {
      setSaveLoading(false);
    }
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    setError(null);
    setResult(null);
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ q, gl: selectedCountry || undefined })
      });
      const data = await parseJsonResponse(res);
      if (!res.ok) throw new Error(data.error || data.message || 'Search failed');
      setResult(data);
      try {
        await fetch(`${API_BASE}/api/history`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: q })
        });
      } catch (_) {}
      const dashRes = await fetch(`${API_BASE}/api/dashboard`);
      const dash = await parseJsonResponse(dashRes);
      if (dash.cards && typeof dash.cards === 'object') setCards((c) => ({ ...c, ...dash.cards }));
    } catch (err) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container py-4 py-md-5">
      <div className="row mb-4">
        <div className="col">
          <h1 className="page-title">Home</h1>
          <p className="page-desc mb-0">Welcome to the lead generation app.</p>
        </div>
      </div>
      <div className="row g-3 mb-5">
        {CARD_KEYS.map(({ title, key }) => (
          <div key={key} className="col-6 col-md-3">
            <div className="card card-app h-100">
              <div className="card-body text-center py-4">
                <p className="stat-label mb-1">{title}</p>
                <p className="stat-value mb-0">{cards[key] ?? 0}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="row g-3 mb-5">
        <div className="col-12">
          <div className="card card-app">
            <div className="card-body py-3 px-4">
              <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
                <div>
                  <p className="stat-label mb-0">Task completion</p>
                  <p className="small text-muted mb-0 mt-1">
                    {queueStatus.loading ? (
                      'Loading…'
                    ) : queueStatus.length === 0 ? (
                      'No messages in queue. All caught up!'
                    ) : (
                      <> <strong>{queueStatus.length}</strong> message{queueStatus.length !== 1 ? 's' : ''} pending in queue </>
                    )}
                  </p>
                </div>
                {!queueStatus.loading && queueStatus.length > 0 && (
                  <span className="badge bg-warning text-dark">Sending (1 min delay per contact)</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="row justify-content-center">
        <div className="col-12 col-lg-7">
          <div className="card card-app">
            <div className="card-body p-4">
              <p className="section-head mb-3">Search</p>
              <div className="row g-3 mb-3">
                {categories.length > 0 && (
                  <div className="col-12 col-md-6">
                    <label htmlFor="home-category" className="form-label small text-muted mb-1">
                      Category (optional)
                    </label>
                    <select
                      id="home-category"
                      className="form-select form-select-sm"
                      value={selectedCategory}
                      onChange={(e) => {
                        const val = e.target.value;
                        setSelectedCategory(val);
                        if (val) setQuery(val);
                      }}
                      aria-label="Select a saved category"
                    >
                      <option value="">Select a saved category</option>
                      {categories.map((cat) => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="col-12 col-md-6">
                  <label htmlFor="home-country" className="form-label small text-muted mb-1">
                    Country (optional)
                  </label>
                  <select
                    id="home-country"
                    className="form-select form-select-sm"
                    value={selectedCountry}
                    onChange={(e) => setSelectedCountry(e.target.value)}
                    aria-label="Select country for search"
                  >
                    {COUNTRIES.map((c) => (
                      <option key={c.code || 'any'} value={c.code}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <form onSubmit={handleSearch} className="search-block d-flex flex-column flex-md-row gap-2">
                <input
                  type="text"
                  className="form-control flex-grow-1"
                  placeholder="e.g. saloons in Chilw"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  disabled={loading}
                  aria-label="Search query"
                />
                <button type="submit" className="btn btn-primary text-nowrap" disabled={loading}>
                  {loading ? 'Searching…' : 'Search'}
                </button>
              </form>
              {error && (
                <div className="alert alert-app mt-3 mb-0 py-2 px-3" role="alert">
                  {error}
                </div>
              )}
              {result && (
                <p className="result-meta mt-3 mb-0 pt-3">
                  Found <strong>{result.totalResults}</strong> results across <strong>{result.totalPages}</strong> page{result.totalPages !== 1 ? 's' : ''}.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {result && (
        <div className="row mt-4">
          <div className="col-12">
            <h2 className="page-title mb-3">Search results</h2>

            {result.knowledgeGraph && (
              <div className="card card-app mb-4">
                <div className="card-body p-4">
                  <div className="row align-items-start">
                    <div className="col-md-8">
                      <h3 className="h5 mb-2">{result.knowledgeGraph.title}</h3>
                      {result.knowledgeGraph.description && (
                        <p className="small text-muted mb-2">{result.knowledgeGraph.description}</p>
                      )}
                      {result.knowledgeGraph.website && (
                        <a href={result.knowledgeGraph.website} target="_blank" rel="noopener noreferrer" className="small">
                          {result.knowledgeGraph.website}
                        </a>
                      )}
                    </div>
                    {result.knowledgeGraph.imageUrl && (
                      <div className="col-md-4 mt-2 mt-md-0 text-md-end">
                        <img src={result.knowledgeGraph.imageUrl} alt="" className="rounded img-fluid" style={{ maxHeight: 120 }} />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {result.organic && result.organic.length > 0 && (
              <div className="card card-app mb-4">
                <div className="card-body p-4">
                  <div className="d-flex justify-content-between align-items-center mb-3">
                    <h3 className="h6 text-muted mb-0">Results</h3>
                    <button
                      type="button"
                      className="btn btn-sm btn-primary"
                      onClick={handleSaveResults}
                      disabled={saveLoading}
                    >
                      {saveLoading ? 'Saving…' : 'Save'}
                    </button>
                  </div>
                  {saveMessage && (
                    <p className="small mb-2 text-muted">{saveMessage}</p>
                  )}
                  <div className="table-responsive">
                    <table className="table table-hover align-middle mb-0">
                      <thead>
                        <tr>
                          <th className="text-muted small text-uppercase">Name</th>
                          <th className="text-muted small text-uppercase">Contact number</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.organic.map((item, i) => {
                          const contact = getContactDisplay(item);
                          return (
                            <tr key={i}>
                              <td>
                                <a
                                  href={item.link}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-decoration-none text-dark fw-medium"
                                >
                                  {item.title || 'No title'}
                                </a>
                                {item.snippet && <div className="small text-muted mt-1">{item.snippet}</div>}
                              </td>
                              <td>
                                {contact ? (
                                  <a href={`tel:${contact.value.replace(/\s/g, '')}`} className="text-decoration-none">
                                    {contact.value}
                                  </a>
                                ) : (
                                  <span className="text-muted">—</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {result.peopleAlsoAsk && result.peopleAlsoAsk.length > 0 && (
              <div className="card card-app mb-4">
                <div className="card-body p-4">
                  <h3 className="h6 text-muted mb-3">People also ask</h3>
                  {result.peopleAlsoAsk.map((item, i) => (
                    <div key={i} className="mb-3">
                      <p className="small fw-medium mb-1">{item.question}</p>
                      <p className="small text-muted mb-1">{item.snippet}</p>
                      {item.link && (
                        <a href={item.link} target="_blank" rel="noopener noreferrer" className="small">{item.link}</a>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {result.relatedSearches && result.relatedSearches.length > 0 && (
              <div className="card card-app">
                <div className="card-body p-4">
                  <h3 className="h6 text-muted mb-2">Related searches</h3>
                  <div className="d-flex flex-wrap gap-2">
                    {result.relatedSearches.map((r, i) => (
                      <span key={i} className="badge bg-light text-dark border">{r.query}</span>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

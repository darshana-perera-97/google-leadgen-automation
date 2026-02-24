import { useState, useEffect, useMemo } from 'react';
import Page from '../components/Page';
import { parseJsonResponse } from '../utils/api';
import { API_BASE } from '../config';

export default function MessagesPage() {
  const [campaigns, setCampaigns] = useState([]);
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCampaignId, setSelectedCampaignId] = useState('');
  const [selectedPhrases, setSelectedPhrases] = useState([]);

  // Unique search phrases from leads with count: [{ phrase, count }]
  const searchResultsWithCounts = useMemo(() => {
    if (!Array.isArray(leads) || leads.length === 0) return [];
    const byPhrase = {};
    leads.forEach((lead) => {
      const phrase = typeof lead.searchPhrase === 'string'
        ? lead.searchPhrase.trim()
        : (lead.searchPhrase && typeof lead.searchPhrase.name === 'string' ? lead.searchPhrase.name.trim() : '');
      if (!phrase) return;
      byPhrase[phrase] = (byPhrase[phrase] || 0) + 1;
    });
    return Object.entries(byPhrase)
      .map(([phrase, count]) => ({ phrase, count }))
      .sort((a, b) => a.phrase.localeCompare(b.phrase));
  }, [leads]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      fetch(`${API_BASE}/api/campaigns`).then((res) => parseJsonResponse(res)),
      fetch(`${API_BASE}/api/leads`).then((res) => parseJsonResponse(res))
    ])
      .then(([campaignsData, leadsData]) => {
        if (!cancelled) {
          if (Array.isArray(campaignsData)) setCampaigns(campaignsData);
          if (Array.isArray(leadsData)) setLeads(leadsData);
        }
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const togglePhrase = (phrase) => {
    setSelectedPhrases((prev) =>
      prev.includes(phrase) ? prev.filter((p) => p !== phrase) : [...prev, phrase]
    );
  };

  const canSend = selectedCampaignId && selectedPhrases.length > 0;
  const [sendLoading, setSendLoading] = useState(false);
  const [sendMessage, setSendMessage] = useState(null);

  const handleSendNow = async () => {
    if (!canSend) return;
    setSendMessage(null);
    setSendLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/messages/queue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaignId: selectedCampaignId, phrases: selectedPhrases })
      });
      const data = await parseJsonResponse(res);
      if (res.ok) {
        setSendMessage(data.message || `${data.queued} message(s) queued. Sending via WhatsApp with 1 min delay per contact.`);
      } else {
        setSendMessage(data.error || 'Failed to queue messages');
      }
    } catch (err) {
      setSendMessage(err.message || 'Failed to queue messages');
    } finally {
      setSendLoading(false);
    }
  };

  return (
    <Page topAlign>
      <h1 className="page-title mb-2">Messages</h1>
      <p className="page-desc mb-4">View and manage your messages here.</p>

      {loading ? (
        <p className="small text-muted">Loading…</p>
      ) : (
        <>
          <div className="d-flex justify-content-end align-items-center gap-2 mb-3">
            {sendMessage && (
              <span className="small text-muted">{sendMessage}</span>
            )}
            <button
              type="button"
              className="btn btn-primary"
              disabled={!canSend || sendLoading}
              onClick={handleSendNow}
            >
              {sendLoading ? 'Queuing…' : 'Send Now'}
            </button>
          </div>
        <div className="row g-4">
          <div className="col-12 col-lg-6">
            <label className="form-label small text-muted mb-2 d-block">Campaign (select one)</label>
            {campaigns.length === 0 ? (
              <p className="small text-muted mb-0">No campaigns yet. Add one from the Campaigns page.</p>
            ) : (
              <div className="table-responsive border rounded">
                <table className="table table-hover align-middle mb-0">
                  <thead className="table-light">
                    <tr>
                      <th style={{ width: 48 }} className="text-center">Select</th>
                      <th>Campaign</th>
                    </tr>
                  </thead>
                  <tbody>
                    {campaigns.map((c) => (
                      <tr
                        key={c.id}
                        role="button"
                        tabIndex={0}
                        className={selectedCampaignId === String(c.id) ? 'table-active' : ''}
                        onClick={() => setSelectedCampaignId(String(c.id))}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedCampaignId(String(c.id)); } }}
                      >
                        <td className="text-center">
                          <input
                            type="radio"
                            name="campaign"
                            className="form-check-input"
                            checked={selectedCampaignId === String(c.id)}
                            onChange={() => setSelectedCampaignId(String(c.id))}
                            aria-label={`Select ${c.name}`}
                          />
                        </td>
                        <td>{c.name}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          <div className="col-12 col-lg-6">
            <label className="form-label small text-muted mb-2 d-block">Search phrases (select one or more)</label>
            {searchResultsWithCounts.length === 0 ? (
              <p className="small text-muted mb-0">No saved search results. Save leads from the Home search first.</p>
            ) : (
              <div className="table-responsive border rounded" style={{ maxHeight: 320, overflowY: 'auto' }}>
                <table className="table table-hover align-middle mb-0">
                  <thead className="table-light sticky-top">
                    <tr>
                      <th style={{ width: 48 }} className="text-center">Select</th>
                      <th>Search phrase</th>
                      <th className="text-end">Leads</th>
                    </tr>
                  </thead>
                  <tbody>
                    {searchResultsWithCounts.map(({ phrase, count }) => (
                      <tr
                        key={phrase}
                        role="button"
                        tabIndex={0}
                        className={selectedPhrases.includes(phrase) ? 'table-active' : ''}
                        onClick={() => togglePhrase(phrase)}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); togglePhrase(phrase); } }}
                      >
                        <td className="text-center">
                          <input
                            type="checkbox"
                            className="form-check-input"
                            checked={selectedPhrases.includes(phrase)}
                            onChange={() => togglePhrase(phrase)}
                            onClick={(e) => e.stopPropagation()}
                            aria-label={`Select ${phrase}`}
                          />
                        </td>
                        <td>{phrase}</td>
                        <td className="text-end">{count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
        </>
      )}
    </Page>
  );
}

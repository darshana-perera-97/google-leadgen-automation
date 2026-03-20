import { useState, useEffect } from 'react';
import Page from '../components/Page';
import { parseJsonResponse } from '../utils/api';
import { API_BASE } from '../config';

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newMessages, setNewMessages] = useState(['']);
  const [newImage, setNewImage] = useState(null);
  const [addLoading, setAddLoading] = useState(false);
  const [saveMessage, setSaveMessage] = useState(null);
  const [campaignActionLoadingId, setCampaignActionLoadingId] = useState(null);

  const [analyticsOpen, setAnalyticsOpen] = useState(false);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsError, setAnalyticsError] = useState(null);
  const [analyticsData, setAnalyticsData] = useState(null);
  const [analyticsCampaign, setAnalyticsCampaign] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_BASE}/api/campaigns`)
      .then((res) => parseJsonResponse(res))
      .then((data) => {
        if (!cancelled && Array.isArray(data)) setCampaigns(data);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => setNewImage(reader.result);
    reader.readAsDataURL(file);
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    setAddLoading(true);
    try {
      let imageFilename = null;
      if (newImage) {
        try {
          const res = await fetch(`${API_BASE}/api/images`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image: newImage })
          });
          const data = await parseJsonResponse(res);
          if (res.ok && data.filename) imageFilename = data.filename;
        } catch (err) {
          console.warn('Image upload failed:', err.message);
          // Continue without image so campaign can still be added
        }
      }
      const res = await fetch(`${API_BASE}/api/campaigns`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          messages: newMessages.filter((m) => m.trim()).map((m) => m.trim()),
          image: imageFilename
        })
      });
      const data = await parseJsonResponse(res);
      if (res.ok && data) {
        setCampaigns((prev) => [...prev, data]);
        setSaveMessage(null);
      } else {
        setSaveMessage(data?.error || 'Failed to add campaign');
        return;
      }
      setNewName('');
      setNewMessages(['']);
      setNewImage(null);
      setShowModal(false);
    } catch (err) {
      setSaveMessage(err.message || 'Failed to add campaign');
      return;
    } finally {
      setAddLoading(false);
    }
  };

  const handleClose = () => {
    setShowModal(false);
    setSaveMessage(null);
    setNewName('');
    setNewMessages(['']);
    setNewImage(null);
  };

  const addMessageRow = () => setNewMessages((prev) => [...prev, '']);
  const removeMessageRow = (index) => setNewMessages((prev) => prev.filter((_, i) => i !== index));
  const setMessageAt = (index, value) => setNewMessages((prev) => prev.map((m, i) => (i === index ? value : m)));

  const handleCloseAnalytics = () => {
    setAnalyticsOpen(false);
    setAnalyticsLoading(false);
    setAnalyticsError(null);
    setAnalyticsData(null);
    setAnalyticsCampaign(null);
  };

  const handleOpenAnalytics = async (campaign) => {
    const statusSafe = campaign?.status || 'active';
    setAnalyticsCampaign({ ...campaign, status: statusSafe });
    setAnalyticsOpen(true);
    setAnalyticsLoading(true);
    setAnalyticsError(null);
    setAnalyticsData(null);
    try {
      const res = await fetch(`${API_BASE}/api/campaigns/${campaign.id}/analytics`);
      const data = await parseJsonResponse(res);
      if (!res.ok) throw new Error(data?.error || data?.message || 'Failed to load analytics');
      setAnalyticsData(data);
    } catch (err) {
      setAnalyticsError(err.message || 'Failed to load analytics');
    } finally {
      setAnalyticsLoading(false);
    }
  };

  const handlePauseContinue = async (campaign, e) => {
    if (e) e.stopPropagation();
    if (!campaign?.id) return;
    const currentStatus = campaign.status || 'active';
    const endpoint = currentStatus === 'paused' ? 'continue' : 'pause';
    setCampaignActionLoadingId(campaign.id);
    try {
      const res = await fetch(`${API_BASE}/api/campaigns/${campaign.id}/${endpoint}`, { method: 'POST' });
      const data = await parseJsonResponse(res);
      if (!res.ok) throw new Error(data?.error || data?.message || 'Update failed');
      setCampaigns((prev) => prev.map((c) => (String(c.id) === String(campaign.id) ? data : c)));
      if (analyticsCampaign && String(analyticsCampaign.id) === String(campaign.id)) {
        // Refresh analytics data after status change.
        setAnalyticsData(null);
        setAnalyticsError(null);
        handleOpenAnalytics(data);
      }
    } catch (err) {
      setAnalyticsError(err.message || 'Failed to update campaign');
    } finally {
      setCampaignActionLoadingId(null);
    }
  };

  const handleDeleteCampaign = async (campaign, e) => {
    if (e) e.stopPropagation();
    if (!campaign?.id) return;
    if (!window.confirm(`Delete campaign "${campaign.name}"? This will also remove it from the sending queue.`)) return;
    setCampaignActionLoadingId(campaign.id);
    try {
      const res = await fetch(`${API_BASE}/api/campaigns/${campaign.id}`, { method: 'DELETE' });
      const data = await parseJsonResponse(res);
      if (!res.ok) throw new Error(data?.error || data?.message || 'Delete failed');
      setCampaigns((prev) => prev.filter((c) => String(c.id) !== String(campaign.id)));
      if (analyticsCampaign && String(analyticsCampaign.id) === String(campaign.id)) {
        handleCloseAnalytics();
      }
    } catch (err) {
      setAnalyticsError(err.message || 'Failed to delete campaign');
    } finally {
      setCampaignActionLoadingId(null);
    }
  };

  return (
    <Page topAlign>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h1 className="page-title mb-2">Campaigns</h1>
          <p className="page-desc mb-0">Create and manage your campaigns.</p>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => { setSaveMessage(null); setShowModal(true); }}
        >
          Add Campaign
        </button>
      </div>

      {loading ? (
        <p className="small text-muted">Loading campaigns…</p>
      ) : (
      <div className="row g-3">
        {campaigns.length === 0 ? (
          <div className="col-12">
            <div className="card card-app">
              <div className="card-body text-center py-5 text-muted small">
                No campaigns yet. Click &quot;Add Campaign&quot; to create one.
              </div>
            </div>
          </div>
        ) : (
          campaigns.map((campaign) => (
            <div key={campaign.id} className="col-6 col-md-3">
              <div
                className="card card-app h-100"
                role="button"
                tabIndex={0}
                onClick={() => handleOpenAnalytics(campaign)}
                onKeyDown={(ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); handleOpenAnalytics(campaign); } }}
              >
                {campaign.image ? (
                  <img
                    src={`${API_BASE}/api/images/${campaign.image}`}
                    alt={campaign.name || 'Campaign'}
                    className="card-img-top rounded-top"
                    style={{ height: 140, objectFit: 'cover', backgroundColor: '#f0f0f0' }}
                    onError={(e) => { e.target.style.display = 'none'; }}
                  />
                ) : null}
                <div className="card-body">
                  <div className="d-flex align-items-start justify-content-between gap-2 mb-2">
                    <h3 className="h6 mb-0">{campaign.name}</h3>
                    <div className="d-flex flex-column align-items-end gap-1">
                      <div className="d-flex gap-1">
                        {(campaign.status || 'active') === 'paused' ? (
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-success"
                            onClick={(e) => handlePauseContinue(campaign, e)}
                            disabled={campaignActionLoadingId === campaign.id}
                          >
                            {campaignActionLoadingId === campaign.id ? '…' : 'Continue'}
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-warning"
                            onClick={(e) => handlePauseContinue(campaign, e)}
                            disabled={campaignActionLoadingId === campaign.id}
                          >
                            {campaignActionLoadingId === campaign.id ? '…' : 'Pause'}
                          </button>
                        )}
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-danger"
                          onClick={(e) => handleDeleteCampaign(campaign, e)}
                          disabled={campaignActionLoadingId === campaign.id}
                        >
                          {campaignActionLoadingId === campaign.id ? '…' : 'Delete'}
                        </button>
                      </div>
                      {(campaign.status || 'active') === 'paused' && (
                        <span className="badge bg-secondary">Paused</span>
                      )}
                    </div>
                  </div>
                  {campaign.messages && campaign.messages.length > 0 ? (
                    <ul className="small text-muted mb-0 ps-3">
                      {campaign.messages.map((msg, i) => (
                        <li key={i}>{msg}</li>
                      ))}
                    </ul>
                  ) : campaign.description ? (
                    <p className="small text-muted mb-0">{campaign.description}</p>
                  ) : null}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
      )}

      <div
        className={`modal fade ${showModal ? 'show' : ''}`}
        style={{ display: showModal ? 'block' : 'none', zIndex: 1100 }}
        tabIndex={-1}
        aria-labelledby="addCampaignModalLabel"
        aria-hidden={!showModal}
      >
        {showModal && (
          <div
            className="modal-backdrop fade show"
            style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1099 }}
            aria-hidden
          />
        )}
        <div className="modal-dialog modal-dialog-centered" style={{ zIndex: 1101 }}>
          <div className="modal-content card-app border-0 bg-white">
            <div className="modal-header border-0 pb-0">
              <h2 className="modal-title h6" id="addCampaignModalLabel">
                Add Campaign
              </h2>
              <button
                type="button"
                className="btn-close"
                aria-label="Close"
                onClick={handleClose}
              />
            </div>
            <form onSubmit={handleAdd}>
              <div className="modal-body pt-2">
                {saveMessage && (
                  <div className="alert alert-danger py-2 px-3 mb-3 small">{saveMessage}</div>
                )}
                <div className="mb-3">
                  <label htmlFor="campaign-name" className="form-label small text-muted">
                    Name
                  </label>
                  <input
                    id="campaign-name"
                    type="text"
                    className="form-control"
                    placeholder="Campaign name"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    required
                  />
                </div>
                <div className="mb-3">
                  <div className="d-flex align-items-center justify-content-between mb-1">
                    <label className="form-label small text-muted mb-0">Messages</label>
                    <button type="button" className="btn btn-sm btn-outline-primary" onClick={addMessageRow}>
                      Add message
                    </button>
                  </div>
                  {newMessages.map((msg, index) => (
                    <div key={index} className="input-group input-group-sm mb-2">
                      <input
                        type="text"
                        className="form-control"
                        placeholder={`Message ${index + 1}`}
                        value={msg}
                        onChange={(e) => setMessageAt(index, e.target.value)}
                        aria-label={`Message ${index + 1}`}
                      />
                      {newMessages.length > 1 && (
                        <button
                          type="button"
                          className="btn btn-outline-secondary"
                          aria-label="Remove message"
                          onClick={() => removeMessageRow(index)}
                        >
                          ×
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <div className="mb-0">
                  <label className="form-label small text-muted">
                    Image (optional)
                  </label>
                  <input
                    type="file"
                    className="form-control form-control-sm"
                    accept="image/*"
                    onChange={handleImageChange}
                    aria-label="Upload image"
                  />
                  {newImage && (
                    <div className="mt-2 d-flex align-items-center gap-2">
                      <img src={newImage} alt="Preview" className="rounded" style={{ maxHeight: 80, maxWidth: 120, objectFit: 'cover' }} />
                      <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setNewImage(null)}>
                        Remove
                      </button>
                    </div>
                  )}
                </div>
              </div>
              <div className="modal-footer border-0 pt-0">
                <button type="button" className="btn btn-outline-secondary" onClick={handleClose}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={addLoading}>
                  {addLoading ? 'Adding…' : 'Add'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      <div
        className={`modal fade ${analyticsOpen ? 'show' : ''}`}
        style={{ display: analyticsOpen ? 'block' : 'none', zIndex: 1200 }}
        tabIndex={-1}
        aria-labelledby="campaignAnalyticsModalLabel"
        aria-hidden={!analyticsOpen}
      >
        {analyticsOpen && (
          <div
            className="modal-backdrop fade show"
            style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1199 }}
            aria-hidden
          />
        )}
        <div className="modal-dialog modal-dialog-centered" style={{ zIndex: 1201 }}>
          <div className="modal-content card-app border-0 bg-white">
            <div className="modal-header border-0 pb-0">
              <h2 className="modal-title h6" id="campaignAnalyticsModalLabel">
                Campaign analytics
              </h2>
              <button
                type="button"
                className="btn-close"
                aria-label="Close"
                onClick={handleCloseAnalytics}
              />
            </div>

            <div className="modal-body pt-2">
              {analyticsLoading && (
                <p className="small text-muted mb-0">Loading…</p>
              )}
              {!analyticsLoading && analyticsError && (
                <div className="alert alert-danger py-2 px-3 mb-0">
                  {analyticsError}
                </div>
              )}
              {!analyticsLoading && !analyticsError && analyticsData && (
                <>
                  <p className="small text-muted mb-2">
                    Campaign: <span className="fw-medium">{analyticsData.campaign?.name}</span>
                  </p>
                  <div className="table-responsive">
                    <table className="table table-sm mb-0">
                      <tbody>
                        <tr>
                          <th className="text-muted small">Status</th>
                          <td>{analyticsData.campaign?.status || 'active'}</td>
                        </tr>
                        <tr>
                          <th className="text-muted small">Pending (queue)</th>
                          <td>{analyticsData.pending}</td>
                        </tr>
                        <tr>
                          <th className="text-muted small">Total queued</th>
                          <td>{analyticsData.totalQueued}</td>
                        </tr>
                        <tr>
                          <th className="text-muted small">Total sent</th>
                          <td>{analyticsData.totalSent}</td>
                        </tr>
                        <tr>
                          <th className="text-muted small">Completion</th>
                          <td>{analyticsData.percentage}%</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </>
              )}
              {!analyticsLoading && !analyticsError && !analyticsData && (
                <p className="small text-muted mb-0">No analytics data available.</p>
              )}
            </div>

            <div className="modal-footer border-0 pt-0">
              <button type="button" className="btn btn-outline-secondary" onClick={handleCloseAnalytics}>
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </Page>
  );
}

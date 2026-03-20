import { useState, useEffect, useMemo } from 'react';
import Page from '../components/Page';
import { parseJsonResponse } from '../utils/api';
import { API_BASE } from '../config';

export default function RunningCampaignsPage() {
  const [queue, setQueue] = useState({ length: 0, items: [], stats: { totalQueued: {}, totalSent: {} } });
  const [loading, setLoading] = useState(true);
  const [campaignMeta, setCampaignMeta] = useState([]);
  const [campaignActionLoadingId, setCampaignActionLoadingId] = useState(null);

  const refreshQueue = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/queue`);
      const data = await parseJsonResponse(res);
      if (data && Array.isArray(data.items)) {
        setQueue({
          length: data.length ?? data.items.length,
          items: data.items,
          stats: data.stats || { totalQueued: {}, totalSent: {} }
        });
      }
    } catch {
      // ignore
    }
  };

  const refreshCampaignMeta = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/campaigns`);
      const data = await parseJsonResponse(res);
      if (Array.isArray(data)) setCampaignMeta(data);
    } catch {
      // ignore
    }
  };

  const allCampaigns = useMemo(() => {
    const items = Array.isArray(queue.items) ? queue.items : [];
    const stats = queue.stats || { totalQueued: {}, totalSent: {} };
    const pendingByCampaign = {};
    items.forEach((item) => {
      const name = item.campaign?.name || 'Unknown';
      pendingByCampaign[name] = (pendingByCampaign[name] || 0) + 1;
    });
    const campaignNames = new Set([
      ...Object.keys(pendingByCampaign),
      ...Object.keys(stats.totalQueued || {}),
      ...Object.keys(stats.totalSent || {})
    ]);
    return Array.from(campaignNames)
      .map((name) => {
        const totalQueued = (stats.totalQueued || {})[name] || 0;
        const totalSent = (stats.totalSent || {})[name] || 0;
        const pending = pendingByCampaign[name] || 0;
        const percentage = totalQueued > 0
          ? Math.round((totalSent / totalQueued) * 100)
          : (totalSent > 0 ? 100 : 0);
        const meta = campaignMeta.find((c) => String(c.name) === String(name));
        const status = meta?.status || 'active';
        const campaignId = meta?.id;

        const isRunning = pending > 0;
        return { name, campaignId, status, totalQueued, totalSent, pending, percentage, isRunning };
      })
      .filter((c) => c.totalQueued > 0 || c.totalSent > 0)
      .sort((a, b) => {
        if (a.isRunning !== b.isRunning) return a.isRunning ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
  }, [queue.items, queue.stats]);

  const runningCampaigns = allCampaigns.filter((c) => c.isRunning);
  const completedCampaigns = allCampaigns.filter((c) => !c.isRunning);

  const updateQueue = (data) => {
    if (data && Array.isArray(data.items)) {
      setQueue({
        length: data.length ?? data.items.length,
        items: data.items,
        stats: data.stats || { totalQueued: {}, totalSent: {} }
      });
    }
  };

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch(`${API_BASE}/api/queue`).then((res) => parseJsonResponse(res)),
      fetch(`${API_BASE}/api/campaigns`).then((res) => parseJsonResponse(res))
    ])
      .then(([queueData, campaignsData]) => {
        if (!cancelled) {
          updateQueue(queueData);
          if (Array.isArray(campaignsData)) setCampaignMeta(campaignsData);
        }
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      refreshQueue();
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const handlePauseContinue = async (campaign, e) => {
    if (e) e.stopPropagation();
    if (!campaign?.campaignId) return;
    setCampaignActionLoadingId(campaign.campaignId);
    try {
      const endpoint = campaign.status === 'paused' ? 'continue' : 'pause';
      const res = await fetch(`${API_BASE}/api/campaigns/${campaign.campaignId}/${endpoint}`, { method: 'POST' });
      const data = await parseJsonResponse(res);
      if (!res.ok) throw new Error(data?.error || data?.message || 'Update failed');
      await refreshCampaignMeta();
      await refreshQueue();
    } catch {
      // ignore
    } finally {
      setCampaignActionLoadingId(null);
    }
  };

  const CampaignTable = ({ campaigns, statusBadge }) => (
    <table className="table table-hover align-middle mb-0">
      <thead className="table-light">
        <tr>
          <th className="text-muted small text-uppercase">Campaign</th>
          <th className="text-muted small text-uppercase text-end">Sent</th>
          <th className="text-muted small text-uppercase text-end">Total</th>
          <th className="text-muted small text-uppercase text-end">Pending</th>
          <th className="text-muted small text-uppercase text-end">%</th>
          <th className="text-muted small text-uppercase text-end">Actions</th>
          <th className="text-muted small text-uppercase text-end">Status</th>
        </tr>
      </thead>
      <tbody>
        {campaigns.map(({ name, campaignId, status, totalSent, totalQueued, pending, percentage }) => (
          <tr key={campaignId || name}>
            <td className="fw-medium">{name}</td>
            <td className="text-end">{totalSent}</td>
            <td className="text-end">{totalQueued}</td>
            <td className="text-end">{pending}</td>
            <td className="text-end">{percentage}%</td>
            <td className="text-end">
              {campaignId && (
                <button
                  type="button"
                  className={`btn btn-sm ${status === 'paused' ? 'btn-outline-success' : 'btn-outline-warning'}`}
                  onClick={(e) => handlePauseContinue({ campaignId, status }, e)}
                  disabled={campaignActionLoadingId === campaignId}
                >
                  {campaignActionLoadingId === campaignId ? '…' : status === 'paused' ? 'Continue' : 'Pause'}
                </button>
              )}
            </td>
            <td className="text-end">{statusBadge}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  return (
    <Page topAlign>
      <h1 className="page-title mb-2">Running campaigns</h1>
      <p className="page-desc mb-4">Campaigns being sent and completed via WhatsApp.</p>

      {loading ? (
        <p className="small text-muted">Loading…</p>
      ) : allCampaigns.length === 0 ? (
        <div className="card card-app">
          <div className="card-body p-4 text-center">
            <p className="small text-muted mb-0">No campaigns yet. Queue messages from the Messages page.</p>
          </div>
        </div>
      ) : (
        <>
          {runningCampaigns.length > 0 && (
            <div className="card card-app mb-4">
              <div className="card-body p-4">
                <p className="section-head mb-3">Sending</p>
                <div className="table-responsive">
                  <CampaignTable
                    campaigns={runningCampaigns}
                    statusBadge={<span className="badge bg-warning text-dark">Sending</span>}
                  />
                </div>
              </div>
            </div>
          )}
          {completedCampaigns.length > 0 && (
            <div className="card card-app mb-4">
              <div className="card-body p-4">
                <p className="section-head mb-3">Completed</p>
                <div className="table-responsive">
                  <CampaignTable
                    campaigns={completedCampaigns}
                    statusBadge={<span className="badge bg-success">Completed</span>}
                  />
                </div>
              </div>
            </div>
          )}
          <p className="small text-muted mb-0">
            {queue.length > 0 && (
              <>Total: <strong>{queue.length}</strong> message{queue.length !== 1 ? 's' : ''} in queue. </>
            )}
            Auto-refreshes every 5 seconds.
          </p>
        </>
      )}
    </Page>
  );
}

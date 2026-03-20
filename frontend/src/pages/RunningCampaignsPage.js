import { useState, useEffect, useMemo } from 'react';
import Page from '../components/Page';
import { parseJsonResponse } from '../utils/api';
import { API_BASE } from '../config';

export default function RunningCampaignsPage() {
  const [queue, setQueue] = useState({ length: 0, items: [], stats: { totalQueued: {}, totalSent: {} } });
  const [loading, setLoading] = useState(true);
  const [campaignMeta, setCampaignMeta] = useState([]);
  const [whatsappSession, setWhatsappSession] = useState({ connected: false, qr: null, account: null });
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

  const refreshWhatsappSession = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/whatsapp/session`);
      const data = await parseJsonResponse(res);
      setWhatsappSession({
        connected: !!data.connected,
        qr: data.qr || null,
        account: data.account || null
      });
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

        const isPaused = status === 'paused';
        const isPending = pending > 0;
        const isConnected = whatsappSession.connected === true;
        const canSendNow = isConnected && !isPaused && isPending;
        const isWaiting = !isPaused && !isConnected && isPending;

        const rowBadge = isPaused ? (
          <span className="badge bg-secondary">Paused</span>
        ) : isWaiting ? (
          <span className="badge bg-secondary">Waiting</span>
        ) : canSendNow ? (
          <span className="badge bg-warning text-dark">Sending</span>
        ) : (
          <span className="badge bg-success">Completed</span>
        );

        return {
          name,
          campaignId,
          status,
          totalQueued,
          totalSent,
          pending,
          percentage,
          canSendNow,
          isWaiting,
          isPaused,
          rowBadge
        };
      })
      .filter((c) => c.totalQueued > 0 || c.totalSent > 0)
      .sort((a, b) => {
        // Sending/Waiting/Paused first, then Completed.
        const rankA = a.canSendNow ? 0 : (a.isWaiting ? 1 : (a.isPaused ? 2 : 3));
        const rankB = b.canSendNow ? 0 : (b.isWaiting ? 1 : (b.isPaused ? 2 : 3));
        if (rankA !== rankB) return rankA - rankB;
        return a.name.localeCompare(b.name);
      });
  }, [queue.items, queue.stats, campaignMeta, whatsappSession.connected]);

  const sendingCampaigns = allCampaigns.filter((c) => c.canSendNow);
  const pausedCampaigns = allCampaigns.filter((c) => c.isPaused && c.pending > 0);
  const waitingCampaigns = allCampaigns.filter((c) => c.isWaiting && c.pending > 0);
  const completedCampaigns = allCampaigns.filter((c) => c.pending === 0 && c.totalSent > 0);

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
      refreshWhatsappSession();
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

  const CampaignTable = ({ campaigns }) => (
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
        {campaigns.map(({ name, campaignId, status, totalSent, totalQueued, pending, percentage, rowBadge }) => (
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
            <td className="text-end">{rowBadge}</td>
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
          {sendingCampaigns.length > 0 && (
            <div className="card card-app mb-4">
              <div className="card-body p-4">
                <p className="section-head mb-3">Sending</p>
                <div className="table-responsive">
                  <CampaignTable campaigns={sendingCampaigns} />
                </div>
              </div>
            </div>
          )}
          {pausedCampaigns.length > 0 && (
            <div className="card card-app mb-4">
              <div className="card-body p-4">
                <p className="section-head mb-3">Paused</p>
                <div className="table-responsive">
                  <CampaignTable campaigns={pausedCampaigns} />
                </div>
              </div>
            </div>
          )}
          {waitingCampaigns.length > 0 && (
            <div className="card card-app mb-4">
              <div className="card-body p-4">
                <p className="section-head mb-3">Waiting</p>
                <div className="table-responsive">
                  <CampaignTable campaigns={waitingCampaigns} />
                </div>
              </div>
            </div>
          )}
          {completedCampaigns.length > 0 && (
            <div className="card card-app mb-4">
              <div className="card-body p-4">
                <p className="section-head mb-3">Completed</p>
                <div className="table-responsive">
                  <CampaignTable campaigns={completedCampaigns} />
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

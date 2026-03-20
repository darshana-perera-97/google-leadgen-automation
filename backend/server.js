require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const app = express();
const PORT = process.env.PORT || 3434;

// Frontend build directory (optional: serve React app from backend)
const FRONTEND_BUILD = path.join(__dirname, '..', 'frontend', 'build');
const HAS_FRONTEND_BUILD = fs.existsSync(FRONTEND_BUILD);

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static('public'));

// Basic route (serve frontend index when build is present)
app.get('/', (req, res) => {
  if (HAS_FRONTEND_BUILD) {
    return res.sendFile(path.join(FRONTEND_BUILD, 'index.html'));
  }
  res.json({ message: 'Server is running!' });
});

// Health check route
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Categories (stored in ./data/categories.json)
const { readCategories, writeCategories } = require('./routes/categories');

// Leads (stored in ./data/leads.json)
const { readLeads, writeLeads, appendSavedBatch } = require('./routes/leads');

// Campaigns (stored in ./data/campaigns.json)
const { readCampaigns, writeCampaigns } = require('./routes/campaigns');

// Dashboard (last search + card stats in ./data/dashboard.json)
const { readDashboard, updateDashboard } = require('./routes/dashboard');

// Search history (stored in ./data/history.json)
const { readHistory, addHistoryEntry } = require('./routes/history');

app.get('/api/history', (req, res) => {
  try {
    const history = readHistory();
    res.json(history);
  } catch (err) {
    console.error('History read error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/history', (req, res) => {
  try {
    const { query } = req.body || {};
    addHistoryEntry(query);
    res.status(201).json(readHistory());
  } catch (err) {
    console.error('History write error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Images (Add Campaign popup and others stored in ./data/images/)
const { saveImage, getImagePath } = require('./routes/images');

app.post('/api/images', (req, res) => {
  try {
    const { image: dataUrl } = req.body || {};
    if (!dataUrl || typeof dataUrl !== 'string') {
      return res.status(400).json({ error: 'Image data required' });
    }
    const filename = saveImage(dataUrl);
    if (!filename) {
      return res.status(400).json({ error: 'Invalid image data' });
    }
    res.status(201).json({ filename });
  } catch (err) {
    console.error('Image save error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/images/:filename', (req, res) => {
  try {
    const filename = req.params.filename;
    const filePath = getImagePath(filename);
    if (!filePath) {
      return res.status(404).send('Not found');
    }
    res.sendFile(path.resolve(filePath));
  } catch (err) {
    res.status(500).send('Error');
  }
});

app.get('/api/dashboard', (req, res) => {
  try {
    const dashboard = readDashboard();
    dashboard.cards.leads = readLeads().length;
    dashboard.cards.campaigns = readCampaigns().length;
    res.json(dashboard);
  } catch (err) {
    console.error('Dashboard read error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/dashboard', (req, res) => {
  try {
    const { lastSearchResults, cards } = req.body || {};
    updateDashboard({
      ...(lastSearchResults !== undefined && { lastSearchResults }),
      ...(cards !== undefined && typeof cards === 'object' && { cards })
    });
    const dashboard = readDashboard();
    dashboard.cards.leads = readLeads().length;
    dashboard.cards.campaigns = readCampaigns().length;
    res.json(dashboard);
  } catch (err) {
    console.error('Dashboard write error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/leads', (req, res) => {
  try {
    const leads = readLeads();
    res.json(leads);
  } catch (err) {
    console.error('Leads read error:', err);
    res.status(500).json({ error: err.message });
  }
});

function normalizePhone(num) {
  return String(num || '').replace(/\D/g, '');
}

app.post('/api/leads', (req, res) => {
  try {
    const rows = req.body && (Array.isArray(req.body) ? req.body : req.body.rows || []);
    const category = (req.body && req.body.category) || '';
    const searchPhrase = (req.body && req.body.searchPhrase) != null ? String(req.body.searchPhrase).trim() : '';
    if (!rows.length) {
      return res.status(400).json({ error: 'No results to save' });
    }
    const existing = readLeads();
    const existingPhones = new Set(existing.map((l) => normalizePhone(l.whatsappnumber)).filter(Boolean));
    const built = rows.map((r) => {
      const catStr = String(r.category != null ? r.category : category).trim();
      return {
        name: String(r.name || '').trim(),
        whatsappnumber: String(r.whatsappnumber || r.contact || '').trim(),
        category: { name: catStr },
        searchPhrase: searchPhrase || (r.searchPhrase != null ? String(r.searchPhrase).trim() : ''),
        savedAt: new Date().toISOString()
      };
    });
    const toAdd = built.filter((r) => {
      const key = normalizePhone(r.whatsappnumber);
      if (!key) return true;
      if (existingPhones.has(key)) return false;
      existingPhones.add(key);
      return true;
    });
    const updated = existing.concat(toAdd);
    writeLeads(updated);

    const batchForJson = {
      savedAt: new Date().toISOString(),
      searchPhrase,
      category,
      leads: toAdd.map((l) => ({
        name: l.name,
        whatsappnumber: l.whatsappnumber,
        category: l.category && typeof l.category === 'object' ? l.category.name : l.category,
        searchPhrase: l.searchPhrase
      }))
    };
    try {
      appendSavedBatch(batchForJson);
    } catch (batchErr) {
      console.error('[Leads] Saved batches append error:', batchErr);
    }

    try {
      updateDashboard({ lastSearchPhrase: searchPhrase, lastCategory: category });
    } catch (dashboardErr) {
      console.error('[Leads] Dashboard update error:', dashboardErr);
    }
    res.status(201).json({ saved: toAdd.length, skipped: built.length - toAdd.length, total: updated.length });
  } catch (err) {
    console.error('Leads write error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/categories', (req, res) => {
  try {
    const categories = readCategories();
    res.json(categories);
  } catch (err) {
    console.error('Categories read error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/categories', (req, res) => {
  try {
    const name = req.body && (req.body.name ?? req.body.category);
    const value = typeof name === 'string' ? name.trim() : '';
    if (!value) {
      return res.status(400).json({ error: 'Category name is required' });
    }
    const categories = readCategories();
    if (categories.includes(value)) {
      return res.status(409).json({ error: 'Category already exists', categories });
    }
    categories.push(value);
    writeCategories(categories);
    res.status(201).json(categories);
  } catch (err) {
    console.error('Categories write error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/categories/:name', (req, res) => {
  try {
    const name = decodeURIComponent(req.params.name || '');
    if (!name) return res.status(400).json({ error: 'Category name is required' });
    const categories = readCategories().filter((c) => c !== name);
    writeCategories(categories);
    res.json(categories);
  } catch (err) {
    console.error('Categories delete error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/campaigns', (req, res) => {
  try {
    const campaigns = readCampaigns();
    res.json(campaigns);
  } catch (err) {
    console.error('Campaigns read error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/campaigns', (req, res) => {
  try {
    const { name, messages, image } = req.body || {};
    const nameStr = typeof name === 'string' ? name.trim() : '';
    if (!nameStr) {
      return res.status(400).json({ error: 'Campaign name is required' });
    }
    const campaigns = readCampaigns();
    const newCampaign = {
      id: Date.now(),
      name: nameStr,
      messages: Array.isArray(messages) ? messages.filter((m) => m != null).map((m) => String(m).trim()).filter(Boolean) : [],
      image: typeof image === 'string' ? image.trim() || null : null,
      createdAt: new Date().toISOString()
    };
    campaigns.push(newCampaign);
    writeCampaigns(campaigns);
    res.status(201).json(newCampaign);
  } catch (err) {
    console.error('Campaigns write error:', err);
    res.status(500).json({ error: err.message });
  }
});

// WhatsApp Web session (QR + connection status)
const { initClient, getSession, getClient, isConnected, sendCampaignToContact, logout } = require('./whatsapp-client');

// Message queue (./data/queue.json)
const { readQueue, addToQueue, removeFirstFromQueue, getQueueLength } = require('./routes/queue');
const { readStats, addQueued, addSent } = require('./routes/campaign-stats');

let queueProcessing = false;
let sentInBatch = 0;
let sentTotal = 0;

const ONE_MINUTE_MS = 60 * 1000;
const TEN_MINUTES_MS = 10 * 60 * 1000;
const THIRTY_MINUTES_MS = 30 * 60 * 1000;

function processQueue() {
  if (queueProcessing) return;
  const queue = readQueue();
  if (queue.length === 0) return;

  queueProcessing = true;
  initClient();

  function doNext() {
    const item = removeFirstFromQueue();
    if (!item) {
      queueProcessing = false;
      return;
    }

    if (!isConnected()) {
      addToQueue([item]);
      queueProcessing = false;
      console.warn('[Queue] WhatsApp not connected, re-queued item');
      return;
    }

    const { lead, campaign } = item;
    sendCampaignToContact(lead, campaign, getImagePath)
      .then(() => {
        sentInBatch++;
        sentTotal++;
        try {
          addSent(campaign?.name);
        } catch (e) {
          console.error('[Queue] Stats update error:', e.message);
        }
        console.log('[Queue] Sent to', lead.name || lead.whatsappnumber, '(', getQueueLength(), 'left )');
        const delayAfterSend = ONE_MINUTE_MS;
        if (sentTotal >= 100) {
          sentTotal = 0;
          sentInBatch = 0;
          console.log('[Queue] Break for 30 min (every 100 messages)');
          setTimeout(() => setTimeout(doNext, delayAfterSend), THIRTY_MINUTES_MS);
        } else if (sentInBatch >= 10) {
          sentInBatch = 0;
          console.log('[Queue] Break for 10 min (every 10 messages)');
          setTimeout(() => setTimeout(doNext, delayAfterSend), TEN_MINUTES_MS);
        } else {
          setTimeout(doNext, delayAfterSend);
        }
      })
      .catch((err) => {
        console.error('[Queue] Send error:', err.message);
        setTimeout(doNext, ONE_MINUTE_MS);
      });
  }

  doNext();
}

app.get('/api/whatsapp/session', (req, res) => {
  try {
    initClient();
    const session = getSession();
    res.json(session);
  } catch (err) {
    console.error('WhatsApp session error:', err);
    res.status(500).json({ connected: false, qr: null, error: err.message });
  }
});

app.post('/api/whatsapp/logout', async (req, res) => {
  try {
    await logout();
    res.json({ success: true, message: 'Logged out. Scan the new QR code to reconnect.' });
  } catch (err) {
    console.error('WhatsApp logout error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/queue', (req, res) => {
  try {
    const queue = readQueue();
    const stats = readStats();
    res.json({ length: queue.length, items: queue, stats });
  } catch (err) {
    console.error('Queue read error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/messages/queue', (req, res) => {
  try {
    const { campaignId, phrases } = req.body || {};
    if (!campaignId || !Array.isArray(phrases) || phrases.length === 0) {
      return res.status(400).json({ error: 'campaignId and phrases (array) are required' });
    }
    const campaigns = readCampaigns();
    const campaign = campaigns.find((c) => String(c.id) === String(campaignId));
    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }
    const phraseSet = new Set(phrases.map((p) => String(p).trim()).filter(Boolean));
    const allLeads = readLeads();
    const leadsToSend = allLeads.filter((lead) => {
      const searchP = typeof lead.searchPhrase === 'string' ? lead.searchPhrase.trim() : (lead.searchPhrase && lead.searchPhrase.name) ? String(lead.searchPhrase.name).trim() : '';
      const categoryP = lead.category ? (typeof lead.category === 'string' ? lead.category.trim() : (lead.category.name && String(lead.category.name).trim()) || '') : '';
      const matches = phraseSet.has(searchP) || (categoryP && phraseSet.has(categoryP));
      return matches && lead.whatsappnumber && String(lead.whatsappnumber).replace(/\D/g, '').length >= 10;
    });
    if (leadsToSend.length === 0) {
      return res.status(400).json({ error: 'No leads with WhatsApp numbers found for selected phrases' });
    }
    const campaignPayload = {
      name: campaign.name,
      messages: Array.isArray(campaign.messages) ? campaign.messages : [],
      image: campaign.image && String(campaign.image).trim() ? campaign.image.trim() : null
    };
    const items = leadsToSend.map((lead) => ({
      jobId: Date.now() + Math.random(),
      campaign: campaignPayload,
      lead: { name: lead.name, whatsappnumber: lead.whatsappnumber }
    }));
    addToQueue(items);
    try {
      addQueued(campaign.name, items.length);
    } catch (e) {
      console.error('[Queue] Stats add error:', e.message);
    }
    processQueue();
    res.status(201).json({ queued: items.length, message: 'Messages queued. Sending with 1 min per contact, 10 min break every 10 messages, 30 min break every 100 messages.' });
  } catch (err) {
    console.error('Queue add error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Search endpoint
app.post('/api/search', async (req, res) => {
  try {
    const { q, gl } = req.body;

    console.log('[Search] Request query:', q, gl ? `country: ${gl}` : '');

    if (!q) {
      return res.status(400).json({ error: 'Search query is required' });
    }

    const glParam = gl && typeof gl === 'string' && gl.trim().length === 2 ? gl.trim().toLowerCase() : null;

    const apiKey = process.env.SERPER_API_KEY;
    if (!apiKey) {
      console.error('[Search] SERPER_API_KEY is not set in .env');
      return res.status(500).json({ error: 'SERPER_API_KEY is not configured. Add it to your .env file.' });
    }

    const allOrganic = [];
    let knowledgeGraph = null;
    let peopleAlsoAsk = [];
    let relatedSearches = [];
    let searchParameters = null;
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      console.log('[Search] Fetching Serper API page', page, 'for query:', q);

      const requestBody = { q, page };
      if (glParam) requestBody.gl = glParam;

      const config = {
        method: 'post',
        maxBodyLength: Infinity,
        url: 'https://google.serper.dev/places',
        headers: {
          'X-API-KEY': apiKey,
          'Content-Type': 'application/json'
        },
        data: JSON.stringify(requestBody)
      };

      const response = await axios.request(config);
      const data = response.data;

      const responseKeys = Object.keys(data || {});
      console.log('[Search] Serper response keys:', responseKeys.join(', '));

      if (page === 1 && data.searchParameters) searchParameters = data.searchParameters;
      if (page === 1 && data.knowledgeGraph) knowledgeGraph = data.knowledgeGraph;
      if (page === 1 && data.peopleAlsoAsk && data.peopleAlsoAsk.length) peopleAlsoAsk = data.peopleAlsoAsk;
      if (page === 1 && data.relatedSearches && data.relatedSearches.length) relatedSearches = data.relatedSearches;

      const organic = data.organic || data.places || [];
      const organicLen = Array.isArray(organic) ? organic.length : 0;
      console.log('[Search] Page', page, 'organic/places count:', organicLen);

      if (organicLen === 0) {
        if (page === 1) {
          console.log('[Search] First page empty. Sample response (first 500 chars):', JSON.stringify(data).slice(0, 500));
        }
        hasMore = false;
        break;
      }

      allOrganic.push(...organic);
      if (page === 1 && organic.length > 0) {
        console.log('[Search] First item keys:', Object.keys(organic[0] || {}).join(', '));
      }
      page++;
    }

    console.log('[Search] Done. Total organic:', allOrganic.length, 'totalPages:', page - 1);

    const responseData = {
      searchParameters: searchParameters || { q, page: page - 1 },
      knowledgeGraph,
      organic: allOrganic,
      peopleAlsoAsk,
      relatedSearches,
      totalPages: page - 1,
      totalResults: allOrganic.length
    };

    try {
      const dashboard = readDashboard();
      updateDashboard({
        lastSearchResults: responseData,
        lastSearchPhrase: (req.body && req.body.q) != null ? String(req.body.q).trim() : dashboard.lastSearchPhrase,
        cards: { searches: (dashboard.cards.searches || 0) + 1 }
      });
    } catch (dashboardErr) {
      console.error('[Search] Dashboard save error:', dashboardErr);
    }

    res.json(responseData);
  } catch (error) {
    console.error('[Search] Error:', error.message);
    if (error.response) {
      console.error('[Search] Serper API status:', error.response.status, 'data:', JSON.stringify(error.response.data).slice(0, 300));
    }
    res.status(500).json({
      error: 'Failed to perform search',
      message: error.message
    });
  }
});

// Serve frontend build and SPA fallback so routes like /leads, /campaigns work on refresh
if (HAS_FRONTEND_BUILD) {
  app.use(express.static(FRONTEND_BUILD));
  app.get('*', (req, res) => {
    res.sendFile(path.join(FRONTEND_BUILD, 'index.html'));
  });
}

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
  if (HAS_FRONTEND_BUILD) {
    console.log('Serving frontend from ../frontend/build');
  }
});


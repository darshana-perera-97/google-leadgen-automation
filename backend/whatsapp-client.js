const { Client, LocalAuth } = require('whatsapp-web.js');
const QRCode = require('qrcode');
const qrcodeTerminal = require('qrcode-terminal');

let client = null;
let qrDataUrl = null;
let connected = false;

function getSession() {
  const session = { connected, qr: qrDataUrl, account: null };
  if (connected && client && client.info) {
    const wid = client.info.wid;
    const number = wid && typeof wid === 'object' && wid._serialized
      ? wid._serialized.replace('@c.us', '')
      : (wid && String(wid).replace('@c.us', '')) || null;
    session.account = {
      name: client.info.pushname || null,
      number: number || null,
      platform: client.info.platform || null
    };
  }
  return session;
}

function initClient() {
  if (client) return client;

  client = new Client({
    authStrategy: new LocalAuth({ dataPath: './.wwebjs_auth' }),
    authTimeoutMs: 900000,
    puppeteer: {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-software-rasterizer',
        '--disable-extensions',
        '--no-first-run',
        '--disable-features=site-per-process'
      ]
    }
  });

  client.on('qr', async (qr) => {
    try {
      qrDataUrl = await QRCode.toDataURL(qr, { width: 280, margin: 2 });
      connected = false;
      console.log('\n[WhatsApp] Scan this QR code with your phone (WhatsApp → Linked Devices):\n');
      qrcodeTerminal.generate(qr, { small: true });
      console.log('\n');
    } catch (err) {
      console.error('WhatsApp QR generation error:', err);
    }
  });

  client.on('ready', () => {
    qrDataUrl = null;
    connected = true;
    console.log('WhatsApp client is ready');
  });

  client.on('authenticated', () => {
    qrDataUrl = null;
  });

  client.on('auth_failure', (msg) => {
    console.error('WhatsApp auth failure:', msg);
    qrDataUrl = null;
    connected = false;
  });

  client.on('disconnected', (reason) => {
    connected = false;
    qrDataUrl = null;
    console.log('WhatsApp disconnected:', reason);
  });

  const shouldRetry = (msg) => {
    const m = String(msg || '').toLowerCase();
    return m.includes('auth timeout') || m.includes('frame was detached') || m.includes('frame got detached');
  };

  client.initialize().catch((err) => {
    console.error('WhatsApp init error:', err.message || err);
    if (err.message && shouldRetry(err.message)) {
      console.log('[WhatsApp] Retrying in 20s...');
      const oldClient = client;
      client = null;
      qrDataUrl = null;
      connected = false;
      try {
        if (oldClient && oldClient.destroy) oldClient.destroy();
      } catch (e) {
        // ignore
      }
      setTimeout(() => initClient(), 20000);
    }
  });

  return client;
}

function getClient() {
  return client;
}

function isConnected() {
  return connected === true && client != null;
}

async function logout() {
  if (client) {
    try {
      await client.logout();
    } catch (err) {
      console.error('WhatsApp logout error:', err.message);
    }
    client = null;
  }
  qrDataUrl = null;
  connected = false;
  initClient();
}

async function sendCampaignToContact(lead, campaign, imagePathResolver) {
  if (!client || !connected) throw new Error('WhatsApp not connected');
  const number = String(lead.whatsappnumber || '').replace(/\D/g, '');
  if (!number) throw new Error('No phone number');
  const chatId = `${number}@c.us`;

  const { MessageMedia } = require('whatsapp-web.js');

  // Send each text message
  const messages = Array.isArray(campaign.messages) ? campaign.messages : [];
  for (const text of messages) {
    if (text && String(text).trim()) {
      await client.sendMessage(chatId, String(text).trim());
    }
  }

  // Send image if present
  if (campaign.image && imagePathResolver) {
    const filePath = imagePathResolver(campaign.image);
    if (filePath) {
      const media = MessageMedia.fromFilePath(filePath);
      await client.sendMessage(chatId, media);
    }
  }
}

module.exports = { initClient, getSession, getClient, isConnected, sendCampaignToContact, logout };

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const FILE_PATH = path.join(DATA_DIR, 'campaign_stats.json');

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readStats() {
  ensureDir();
  if (!fs.existsSync(FILE_PATH)) {
    return { totalQueued: {}, totalSent: {} };
  }
  try {
    const raw = fs.readFileSync(FILE_PATH, 'utf8');
    const data = JSON.parse(raw);
    return {
      totalQueued: data.totalQueued || {},
      totalSent: data.totalSent || {}
    };
  } catch {
    return { totalQueued: {}, totalSent: {} };
  }
}

function writeStats(stats) {
  ensureDir();
  fs.writeFileSync(FILE_PATH, JSON.stringify(stats, null, 2), 'utf8');
}

function addQueued(campaignName, count) {
  const stats = readStats();
  const name = String(campaignName || '').trim() || 'Unknown';
  stats.totalQueued[name] = (stats.totalQueued[name] || 0) + count;
  writeStats(stats);
}

function addSent(campaignName) {
  const stats = readStats();
  const name = String(campaignName || '').trim() || 'Unknown';
  stats.totalSent[name] = (stats.totalSent[name] || 0) + 1;
  writeStats(stats);
}

module.exports = { readStats, addQueued, addSent };

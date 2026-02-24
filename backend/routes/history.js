const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const FILE_PATH = path.join(DATA_DIR, 'history.json');

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readHistory() {
  ensureDir();
  if (!fs.existsSync(FILE_PATH)) {
    return [];
  }
  try {
    const raw = fs.readFileSync(FILE_PATH, 'utf8');
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function writeHistory(history) {
  ensureDir();
  fs.writeFileSync(FILE_PATH, JSON.stringify(history, null, 2), 'utf8');
}

function addHistoryEntry(query) {
  const history = readHistory();
  const entry = {
    query: String(query || '').trim(),
    timestamp: new Date().toISOString()
  };
  if (entry.query) {
    history.unshift(entry);
    writeHistory(history);
  }
  return history;
}

module.exports = { readHistory, writeHistory, addHistoryEntry };

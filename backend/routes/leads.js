const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const FILE_PATH = path.join(DATA_DIR, 'leads.json');
const SAVED_BATCHES_PATH = path.join(DATA_DIR, 'saved_batches.json');

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readLeads() {
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

function writeLeads(leads) {
  ensureDir();
  fs.writeFileSync(FILE_PATH, JSON.stringify(leads, null, 2), 'utf8');
}

function appendSavedBatch(batch) {
  ensureDir();
  let batches = [];
  if (fs.existsSync(SAVED_BATCHES_PATH)) {
    try {
      const raw = fs.readFileSync(SAVED_BATCHES_PATH, 'utf8');
      const data = JSON.parse(raw);
      batches = Array.isArray(data) ? data : [];
    } catch {
      batches = [];
    }
  }
  batches.push(batch);
  fs.writeFileSync(SAVED_BATCHES_PATH, JSON.stringify(batches, null, 2), 'utf8');
}

module.exports = { readLeads, writeLeads, appendSavedBatch };

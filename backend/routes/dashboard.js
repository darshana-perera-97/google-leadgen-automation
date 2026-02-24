const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const FILE_PATH = path.join(DATA_DIR, 'dashboard.json');

const defaultCards = { leads: 0, searches: 0, campaigns: 0, messages: 0 };

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readDashboard() {
  ensureDir();
  if (!fs.existsSync(FILE_PATH)) {
    return { lastSearchResults: null, lastSearchPhrase: '', lastCategory: '', cards: { ...defaultCards } };
  }
  try {
    const raw = fs.readFileSync(FILE_PATH, 'utf8');
    const data = JSON.parse(raw);
    return {
      lastSearchResults: data.lastSearchResults ?? null,
      lastSearchPhrase: data.lastSearchPhrase != null ? String(data.lastSearchPhrase) : '',
      lastCategory: data.lastCategory != null ? String(data.lastCategory) : '',
      cards: { ...defaultCards, ...(data.cards || {}) }
    };
  } catch {
    return { lastSearchResults: null, lastSearchPhrase: '', lastCategory: '', cards: { ...defaultCards } };
  }
}

function writeDashboard(dashboard) {
  ensureDir();
  const out = {
    lastSearchResults: dashboard.lastSearchResults ?? null,
    lastSearchPhrase: dashboard.lastSearchPhrase != null ? String(dashboard.lastSearchPhrase) : '',
    lastCategory: dashboard.lastCategory != null ? String(dashboard.lastCategory) : '',
    cards: { ...defaultCards, ...(dashboard.cards || {}) }
  };
  fs.writeFileSync(FILE_PATH, JSON.stringify(out, null, 2), 'utf8');
}

function updateDashboard(updates) {
  const current = readDashboard();
  if (updates.lastSearchResults !== undefined) {
    current.lastSearchResults = updates.lastSearchResults;
  }
  if (updates.lastSearchPhrase !== undefined) {
    current.lastSearchPhrase = String(updates.lastSearchPhrase);
  }
  if (updates.lastCategory !== undefined) {
    current.lastCategory = String(updates.lastCategory);
  }
  if (updates.cards !== undefined && typeof updates.cards === 'object') {
    current.cards = { ...current.cards, ...updates.cards };
  }
  writeDashboard(current);
  return current;
}

module.exports = { readDashboard, writeDashboard, updateDashboard };

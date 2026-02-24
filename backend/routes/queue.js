const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const FILE_PATH = path.join(DATA_DIR, 'queue.json');

const DEFAULT_QUEUE = [];

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readQueue() {
  ensureDir();
  if (!fs.existsSync(FILE_PATH)) {
    return [...DEFAULT_QUEUE];
  }
  try {
    const raw = fs.readFileSync(FILE_PATH, 'utf8');
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch {
    return [...DEFAULT_QUEUE];
  }
}

function writeQueue(queue) {
  ensureDir();
  fs.writeFileSync(FILE_PATH, JSON.stringify(queue, null, 2), 'utf8');
}

function addToQueue(items) {
  const queue = readQueue();
  if (!Array.isArray(items)) return queue;
  items.forEach((item) => {
    if (item && item.lead && item.campaign) queue.push(item);
  });
  writeQueue(queue);
  return queue;
}

function removeFirstFromQueue() {
  const queue = readQueue();
  if (queue.length === 0) return null;
  const first = queue.shift();
  writeQueue(queue);
  return first;
}

function getQueueLength() {
  return readQueue().length;
}

module.exports = { readQueue, writeQueue, addToQueue, removeFirstFromQueue, getQueueLength };

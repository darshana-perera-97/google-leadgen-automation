const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
// Add Campaign popup images and other uploads are stored here (./backend/data/images)
const IMAGES_DIR = path.join(DATA_DIR, 'images');

const MIME_EXT = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp'
};

function ensureImagesDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(IMAGES_DIR)) {
    fs.mkdirSync(IMAGES_DIR, { recursive: true });
  }
}

function saveImage(dataUrl) {
  const match = dataUrl && dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  const mime = match[1];
  const base64 = match[2];
  const ext = MIME_EXT[mime] || '.png';
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}${ext}`;
  ensureImagesDir();
  const filePath = path.join(IMAGES_DIR, filename);
  fs.writeFileSync(filePath, Buffer.from(base64, 'base64'));
  return filename;
}

function getImagePath(filename) {
  if (!filename || filename.includes('..') || path.isAbsolute(filename)) {
    return null;
  }
  const filePath = path.join(IMAGES_DIR, filename);
  return fs.existsSync(filePath) ? filePath : null;
}

module.exports = { saveImage, getImagePath, IMAGES_DIR };

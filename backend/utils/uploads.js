import fs from 'fs';
import path from 'path';
import multer from 'multer';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export const BACKEND_DIR = path.join(__dirname, '..');
export const UPLOADS_DIR = path.join(BACKEND_DIR, 'uploads');

const ALLOWED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.pdf']);
const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
]);

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function sanitizeFileName(value) {
  return String(value || 'file')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80) || 'file';
}

function buildStorage(subfolder) {
  const destinationDir = path.join(UPLOADS_DIR, subfolder);
  ensureDir(destinationDir);

  return multer.diskStorage({
    destination(_req, _file, cb) {
      cb(null, destinationDir);
    },
    filename(_req, file, cb) {
      const originalExt = path.extname(file.originalname || '').toLowerCase();
      const ext = ALLOWED_EXTENSIONS.has(originalExt) ? originalExt : '.bin';
      const baseName = sanitizeFileName(path.basename(file.originalname || 'upload', originalExt));
      const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      cb(null, `${baseName}-${unique}${ext}`);
    },
  });
}

function fileFilter(_req, file, cb) {
  const ext = path.extname(file.originalname || '').toLowerCase();
  const mime = String(file.mimetype || '').toLowerCase();
  if (ALLOWED_EXTENSIONS.has(ext) && ALLOWED_MIME_TYPES.has(mime)) {
    cb(null, true);
    return;
  }
  cb(new Error('Only JPG, PNG, WEBP, or PDF files are allowed.'));
}

export function createUploader(subfolder, maxSizeMb = 8) {
  ensureDir(UPLOADS_DIR);
  return multer({
    storage: buildStorage(subfolder),
    fileFilter,
    limits: {
      fileSize: Number(maxSizeMb || 8) * 1024 * 1024,
    },
  });
}

export function toPublicUploadPath(subfolder, fileName) {
  return `/uploads/${subfolder}/${fileName}`;
}

export function resolveMediaUrl(req, storedPath) {
  if (!storedPath) return '';
  if (/^https?:\/\//i.test(storedPath)) return storedPath;
  const normalized = storedPath.startsWith('/') ? storedPath : `/${storedPath}`;
  const protocol = req.protocol || 'http';
  const host = req.get('host') || 'localhost:5000';
  return `${protocol}://${host}${normalized}`;
}

export function removeIfExists(filePath) {
  if (!filePath) return;
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch {
    // ignore cleanup failures
  }
}

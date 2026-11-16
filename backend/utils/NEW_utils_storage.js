/**
 * File storage for uploaded photos/videos.
 *
 *  - If CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET are set,
 *    files go to Cloudinary and the database stores the full https URL.
 *    (Survives redeploys — this is what you want in production.)
 *  - Otherwise files are written to backend/uploads/ and the database stores
 *    a relative "/uploads/..." path (handy for local development).
 */
const fs     = require('fs');
const path   = require('path');
const crypto = require('crypto');

const FOLDER_ROOT = 'jesi-cosmetic';

const useCloudinary = Boolean(
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET
);

let cloudinary = null;
if (useCloudinary) {
  cloudinary = require('cloudinary').v2;
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key:    process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });
}

function isCloudinaryUrl(url) {
  return typeof url === 'string' && /^https:\/\/res\.cloudinary\.com\//.test(url);
}

/**
 * Save one multer memory-storage file.
 * @param {{buffer:Buffer, originalname:string, mimetype:string}} file
 * @param {'products'|'reviews'} folder
 * @returns {Promise<string>} URL to store in the database
 */
async function saveFile(file, folder) {
  const isVideo = file.mimetype.startsWith('video/');

  if (useCloudinary) {
    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: `${FOLDER_ROOT}/${folder}`,
          resource_type: isVideo ? 'video' : 'image',
        },
        (err, result) => (err ? reject(err) : resolve(result.secure_url))
      );
      stream.end(file.buffer);
    });
  }

  const ext  = path.extname(file.originalname).toLowerCase();
  const name = `${crypto.randomBytes(16).toString('hex')}${ext}`;
  const dir  = path.join(__dirname, '..', 'uploads', folder);
  await fs.promises.mkdir(dir, { recursive: true });
  await fs.promises.writeFile(path.join(dir, name), file.buffer);
  return `/uploads/${folder}/${name}`;
}

/** Save many files; if any fails, remove the ones already saved and rethrow. */
async function saveFiles(files, folder) {
  const saved = [];
  try {
    for (const file of files) saved.push(await saveFile(file, folder));
    return saved;
  } catch (err) {
    await Promise.all(saved.map(removeFile));
    throw err;
  }
}

/** Best-effort delete of a stored file by the URL we saved. Never throws. */
async function removeFile(url) {
  try {
    if (!url) return;
    if (isCloudinaryUrl(url)) {
      if (!useCloudinary) return;
      // .../upload/[transforms/][v123/]jesi-cosmetic/products/abc.jpg
      const m = url.match(/\/(image|video)\/upload\/(?:[^/]+\/)*?(?:v\d+\/)?(jesi-cosmetic\/.+?)(?:\.[A-Za-z0-9]+)?$/);
      if (!m) return;
      await cloudinary.uploader.destroy(m[2], { resource_type: m[1], invalidate: true });
    } else if (url.startsWith('/uploads/')) {
      const file = path.join(__dirname, '..', url);
      const base = path.join(__dirname, '..', 'uploads');
      if (path.resolve(file).startsWith(base + path.sep)) {
        await fs.promises.unlink(file).catch(() => {});
      }
    }
  } catch (err) {
    console.error('removeFile failed:', err.message);
  }
}

module.exports = { saveFile, saveFiles, removeFile, useCloudinary, isCloudinaryUrl };

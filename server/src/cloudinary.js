const { v2: cloudinary } = require("cloudinary");

const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME;
const API_KEY = process.env.CLOUDINARY_API_KEY;
const API_SECRET = process.env.CLOUDINARY_API_SECRET;

const isConfigured = () => Boolean(CLOUD_NAME && API_KEY && API_SECRET);

if (isConfigured()) {
  cloudinary.config({ cloud_name: CLOUD_NAME, api_key: API_KEY, api_secret: API_SECRET, secure: true });
}

/** Everything we upload lands here, so the account stays tidy and assets are
 *  easy to find or purge by folder. */
const FOLDER = "khata/exercises";

/** Signs a *direct* upload: the browser or phone sends the file straight to
 *  Cloudinary, so a large clip never passes through the API (which on a free
 *  instance has little memory and a request size limit). The API secret stays
 *  here and is never sent to the client. */
function signUpload({ resourceType = "image" }) {
  const timestamp = Math.round(Date.now() / 1000);
  // Only the params Cloudinary signs — file, api_key, cloud_name and
  // resource_type are excluded by its own rules.
  const params = { timestamp, folder: FOLDER };
  const signature = cloudinary.utils.api_sign_request(params, API_SECRET);

  return {
    ...params,
    signature,
    api_key: API_KEY,
    cloud_name: CLOUD_NAME,
    resource_type: resourceType,
    upload_url: `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/${resourceType}/upload`,
  };
}

/** Best-effort removal — a failure here shouldn't block the database update,
 *  since an orphaned asset is a smaller problem than a broken save. */
async function destroyAsset(publicId, resourceType = "image") {
  if (!isConfigured() || !publicId) return;
  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: resourceType, invalidate: true });
  } catch (err) {
    console.warn(`Couldn't delete Cloudinary asset ${publicId}:`, err.message);
  }
}

module.exports = { isConfigured, signUpload, destroyAsset, FOLDER };

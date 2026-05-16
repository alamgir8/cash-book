import { v2 as cloudinary } from "cloudinary";

const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME;
const API_KEY = process.env.CLOUDINARY_API_KEY;
const API_SECRET = process.env.CLOUDINARY_API_SECRET;

if (!CLOUD_NAME || !API_KEY || !API_SECRET) {
  console.error(
    JSON.stringify({
      level: "error",
      event: "cloudinary_misconfigured",
      message:
        "Missing CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET. " +
        "Attachment uploads will fail with 'Must supply api_key'. " +
        "Set these env vars for the Production environment in Vercel and redeploy.",
      CLOUDINARY_CLOUD_NAME: CLOUD_NAME ? "set" : "MISSING",
      CLOUDINARY_API_KEY: API_KEY ? "set" : "MISSING",
      CLOUDINARY_API_SECRET: API_SECRET ? "set" : "MISSING",
      timestamp: new Date().toISOString(),
    }),
  );
} else {
  console.log(`[Cloudinary] Configured ✓ (cloud: ${CLOUD_NAME})`);
}

cloudinary.config({
  cloud_name: CLOUD_NAME,
  api_key: API_KEY,
  api_secret: API_SECRET,
  secure: true,
});

export { cloudinary };

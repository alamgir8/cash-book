import multer from "multer";
import { Readable } from "stream";
import sharp from "sharp";
import { cloudinary } from "../config/cloudinary.js";
import { Transaction } from "../models/Transaction.js";
import { checkOrgAccess } from "../utils/organization.js";

// ── Constants ──────────────────────────────────────────────────────────────
const MAX_RAW_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB – multer hard cap
const MAX_ATTACHMENTS_PER_TRANSACTION = 10;
// Limits applied to the locally-compressed buffer BEFORE any Cloudinary upload
const MAX_IMAGE_BYTES_AFTER_OPT = 1 * 1024 * 1024; // 1 MB
const MAX_PDF_BYTES_AFTER_OPT = 1.5 * 1024 * 1024; // 1.5 MB
const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/pdf",
]);

// ── Multer: store in memory, then stream to Cloudinary ────────────────────
export const uploadMiddleware = multer({
  storage: multer.memoryStorage(),
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME_TYPES.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        Object.assign(
          new Error(
            `File type "${file.mimetype}" is not allowed. Allowed: JPEG, PNG, WebP, HEIC, PDF`,
          ),
          { statusCode: 400 },
        ),
        false,
      );
    }
  },
  limits: {
    fileSize: MAX_RAW_FILE_SIZE_BYTES,
    files: MAX_ATTACHMENTS_PER_TRANSACTION,
  },
}).array("attachments", MAX_ATTACHMENTS_PER_TRANSACTION);

// ── Locally compress an image buffer with sharp ───────────────────────────
/**
 * Returns a compressed JPEG buffer.
 * Tries progressively lower quality until the result fits within maxBytes,
 * starting at quality 82 and stepping down to 40 in increments of 14.
 * If even quality 40 is still too large the buffer at that quality is returned
 * so the caller can decide whether to reject it.
 */
const optimizeImageBuffer = async (inputBuffer, maxBytes) => {
  const qualities = [82, 68, 55, 40];
  let best = null;
  for (const q of qualities) {
    const out = await sharp(inputBuffer)
      .rotate() // auto-orient from EXIF
      .jpeg({ quality: q, progressive: true, mozjpeg: true })
      .toBuffer();
    best = out;
    if (out.length <= maxBytes) return { buffer: out, fits: true };
  }
  return { buffer: best, fits: false };
};

// ── Stream a buffer to Cloudinary ─────────────────────────────────────────
const uploadBufferToCloudinary = (buffer, options) =>
  new Promise((resolve, reject) => {
    if (!process.env.CLOUDINARY_API_KEY) {
      return reject(
        Object.assign(
          new Error(
            "Cloudinary is not configured on this server. Set CLOUDINARY_CLOUD_NAME, " +
              "CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET environment variables.",
          ),
          { statusCode: 503 },
        ),
      );
    }
    const uploadStream = cloudinary.uploader.upload_stream(
      options,
      (err, result) => {
        if (err || !result)
          return reject(err ?? new Error("Cloudinary upload failed"));
        resolve(result);
      },
    );
    const readable = new Readable();
    readable.push(buffer);
    readable.push(null);
    readable.pipe(uploadStream);
  });

// ── Derive a thumbnail URL from a Cloudinary public_id ───────────────────
const makeThumbnailUrl = (publicId, isPdf) => {
  if (isPdf) return null; // PDF thumbnails need paid plan or separate handling
  return cloudinary.url(publicId, {
    width: 300,
    height: 300,
    crop: "fill",
    quality: "auto",
    fetch_format: "auto",
    secure: true,
  });
};

// ── POST /api/transactions/:transactionId/attachments ─────────────────────
export const uploadAttachments = async (req, res, next) => {
  try {
    const { transactionId } = req.params;

    const transaction = await Transaction.findById(transactionId);
    if (!transaction || transaction.is_deleted) {
      return res.status(404).json({ message: "Transaction not found" });
    }

    if (transaction.organization) {
      const access = await checkOrgAccess(
        req.user.id,
        transaction.organization,
        "edit_transactions",
      );
      if (!access.hasAccess)
        return res.status(403).json({ message: access.error });
    } else if (transaction.admin.toString() !== req.user.id) {
      return res.status(403).json({ message: "Access denied" });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: "No files uploaded" });
    }

    const currentCount = transaction.attachments?.length ?? 0;
    if (currentCount + req.files.length > MAX_ATTACHMENTS_PER_TRANSACTION) {
      return res.status(400).json({
        message: `Cannot exceed ${MAX_ATTACHMENTS_PER_TRANSACTION} attachments. Current: ${currentCount}`,
      });
    }

    // Upload all files to Cloudinary in parallel
    const uploaded = await Promise.all(
      req.files.map(async (file) => {
        const isPdf = file.mimetype === "application/pdf";

        // ── Step 1: compress locally (images only) & validate size ───────
        let uploadBuffer = file.buffer;
        const sizeLimit = isPdf
          ? MAX_PDF_BYTES_AFTER_OPT
          : MAX_IMAGE_BYTES_AFTER_OPT;
        const limitLabel = isPdf ? "1.5 MB" : "1 MB";

        if (isPdf) {
          // PDFs can't be compressed — check raw size
          if (file.buffer.length > sizeLimit) {
            throw Object.assign(
              new Error(
                `"${file.originalname}" is ${(file.buffer.length / 1024 / 1024).toFixed(2)} MB, which exceeds the ${limitLabel} PDF limit.`,
              ),
              { statusCode: 422 },
            );
          }
        } else {
          // Compress the image with sharp
          const { buffer: compressed, fits } = await optimizeImageBuffer(
            file.buffer,
            sizeLimit,
          );
          if (!fits) {
            throw Object.assign(
              new Error(
                `"${file.originalname}" is still ${(compressed.length / 1024 / 1024).toFixed(2)} MB after optimization, which exceeds the ${limitLabel} image limit. Please use a smaller image.`,
              ),
              { statusCode: 422 },
            );
          }
          uploadBuffer = compressed;
        }

        // ── Step 2: upload the validated buffer to Cloudinary ─────────────
        const result = await uploadBufferToCloudinary(uploadBuffer, {
          folder: `cash-book/transactions/${transactionId}`,
          resource_type: isPdf ? "raw" : "image",
          use_filename: true,
          unique_filename: true,
          tags: [`txn_${transactionId}`, `admin_${req.user.id}`],
        });

        return {
          url: result.secure_url,
          thumbnail_url: makeThumbnailUrl(result.public_id, isPdf),
          file_name: file.originalname,
          file_size: uploadBuffer.length,
          mime_type: isPdf ? file.mimetype : "image/jpeg",
          storage_key: result.public_id,
          uploaded_at: new Date(),
        };
      }),
    );

    transaction.attachments = [...(transaction.attachments ?? []), ...uploaded];
    await transaction.save();

    res.status(201).json({
      message: `${uploaded.length} attachment(s) uploaded`,
      attachments: transaction.attachments,
    });
  } catch (error) {
    next(error);
  }
};

// ── DELETE /api/transactions/:transactionId/attachments/:encodedKey ────────
export const deleteAttachment = async (req, res, next) => {
  try {
    const { transactionId } = req.params;
    // Express wildcard stores the rest of the path in params[0]
    const storageKey = decodeURIComponent(
      req.params[0] || req.params.storageKey || "",
    );

    const transaction = await Transaction.findById(transactionId);
    if (!transaction || transaction.is_deleted) {
      return res.status(404).json({ message: "Transaction not found" });
    }

    if (transaction.organization) {
      const access = await checkOrgAccess(
        req.user.id,
        transaction.organization,
        "edit_transactions",
      );
      if (!access.hasAccess)
        return res.status(403).json({ message: access.error });
    } else if (transaction.admin.toString() !== req.user.id) {
      return res.status(403).json({ message: "Access denied" });
    }

    const targetIndex = (transaction.attachments ?? []).findIndex(
      (a) => a.storage_key === storageKey,
    );
    if (targetIndex === -1) {
      return res.status(404).json({ message: "Attachment not found" });
    }

    const [removed] = transaction.attachments.splice(targetIndex, 1);
    await transaction.save();

    // Best-effort Cloudinary deletion
    const isPdf = removed.mime_type === "application/pdf";
    cloudinary.uploader
      .destroy(removed.storage_key, {
        resource_type: isPdf ? "raw" : "image",
        invalidate: true,
      })
      .catch((err) =>
        console.warn(
          `[Cloudinary] Could not delete ${removed.storage_key}:`,
          err?.message,
        ),
      );

    res.json({
      message: "Attachment removed",
      attachments: transaction.attachments,
    });
  } catch (error) {
    next(error);
  }
};

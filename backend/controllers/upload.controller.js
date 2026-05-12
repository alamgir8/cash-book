import multer from "multer";
import { Readable } from "stream";
import { cloudinary } from "../config/cloudinary.js";
import { Transaction } from "../models/Transaction.js";
import { checkOrgAccess } from "../utils/organization.js";

// ── Constants ──────────────────────────────────────────────────────────────
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
const MAX_ATTACHMENTS_PER_TRANSACTION = 10;
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
    fileSize: MAX_FILE_SIZE_BYTES,
    files: MAX_ATTACHMENTS_PER_TRANSACTION,
  },
}).array("attachments", MAX_ATTACHMENTS_PER_TRANSACTION);

// ── Stream a buffer to Cloudinary ─────────────────────────────────────────
const uploadBufferToCloudinary = (buffer, options) =>
  new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(options, (err, result) => {
      if (err || !result) return reject(err ?? new Error("Cloudinary upload failed"));
      resolve(result);
    });
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
      if (!access.hasAccess) return res.status(403).json({ message: access.error });
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
        const result = await uploadBufferToCloudinary(file.buffer, {
          folder: `cash-book/transactions/${transactionId}`,
          resource_type: isPdf ? "raw" : "image",
          format: isPdf ? undefined : "webp",
          quality: "auto",
          use_filename: true,
          unique_filename: true,
          tags: [`txn_${transactionId}`, `admin_${req.user.id}`],
        });

        return {
          url: result.secure_url,
          thumbnail_url: makeThumbnailUrl(result.public_id, isPdf),
          file_name: file.originalname,
          file_size: file.size,
          mime_type: file.mimetype,
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
    const storageKey = decodeURIComponent(req.params.storageKey);

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
      if (!access.hasAccess) return res.status(403).json({ message: access.error });
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
        console.warn(`[Cloudinary] Could not delete ${removed.storage_key}:`, err?.message),
      );

    res.json({ message: "Attachment removed", attachments: transaction.attachments });
  } catch (error) {
    next(error);
  }
};

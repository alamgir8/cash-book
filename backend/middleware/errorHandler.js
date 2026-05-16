const isProduction = process.env.NODE_ENV === "production";

// Set DEBUG_ERRORS=true on Vercel to get full error details in API responses
// even in production (useful while actively debugging — remove when stable).
const debugErrors = process.env.DEBUG_ERRORS === "true";

export const notFoundHandler = (req, res, next) => {
  res.status(404).json({
    message: "Resource not found",
  });
};

export const errorHandler = (err, req, res, next) => {
  const status = err.statusCode || err.status || 500;

  // Always log the full error with stack trace — visible in Vercel Function Logs
  console.error(
    JSON.stringify({
      level: "error",
      message: err.message,
      name: err.name,
      code: err.code,
      status,
      url: req.originalUrl,
      method: req.method,
      timestamp: new Date().toISOString(),
      stack: err.stack,
      // Include mongoose / validation details if present
      ...(err.errors ? { validationErrors: err.errors } : {}),
      ...(err.keyValue ? { keyValue: err.keyValue } : {}),
    }),
  );

  // Mongoose validation errors
  if (err.name === "ValidationError") {
    const errors = Object.values(err.errors || {}).map((e) => ({
      path: e.path,
      message: e.message,
    }));
    return res.status(400).json({
      message: "Validation failed",
      errors,
    });
  }

  // Mongoose CastError (invalid ObjectId)
  if (err.name === "CastError") {
    return res.status(400).json({
      message: `Invalid ${err.path}: ${err.value}`,
    });
  }

  // Duplicate key error
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || "field";
    return res.status(409).json({
      message: `Duplicate value for ${field}`,
    });
  }

  // Multer / file-size errors
  if (err.code === "LIMIT_FILE_SIZE") {
    return res
      .status(413)
      .json({ message: "File too large. Maximum size is 10 MB." });
  }
  if (err.code === "LIMIT_FILE_COUNT") {
    return res
      .status(400)
      .json({ message: "Too many files uploaded at once." });
  }
  if (err.code === "LIMIT_UNEXPECTED_FILE") {
    return res.status(400).json({ message: `Unexpected field: ${err.field}` });
  }

  // In production expose the real message unless it's a 500 (internal),
  // unless DEBUG_ERRORS is enabled — then always expose full details.
  const exposeDetails = !isProduction || debugErrors;

  const message = exposeDetails
    ? err.message || "Internal server error"
    : status >= 500
      ? "Internal server error"
      : err.message || "Internal server error";

  res.status(status).json({
    message,
    ...(exposeDetails && err.errors ? { errors: err.errors } : {}),
    ...(exposeDetails && status >= 500 ? { stack: err.stack } : {}),
  });
};

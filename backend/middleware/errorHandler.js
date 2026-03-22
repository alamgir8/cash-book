const isProduction = process.env.NODE_ENV === "production";

export const notFoundHandler = (req, res, next) => {
  res.status(404).json({
    message: "Resource not found",
  });
};

export const errorHandler = (err, req, res, next) => {
  // Log the full error in all environments for debugging
  if (!isProduction) {
    console.error(err);
  } else {
    // In production, log structured error (no stack trace to stdout)
    console.error(
      JSON.stringify({
        error: err.message,
        url: req.originalUrl,
        method: req.method,
        status: err.statusCode || 500,
        timestamp: new Date().toISOString(),
      }),
    );
  }

  const status = err.statusCode || 500;

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

  // In production, sanitize internal 500 errors — never leak internals
  const message =
    status >= 500 && isProduction
      ? "Internal server error"
      : err.message || "Internal server error";

  res.status(status).json({
    message,
    ...(err.errors && !isProduction ? { errors: err.errors } : {}),
  });
};

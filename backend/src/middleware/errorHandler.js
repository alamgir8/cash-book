export const notFoundHandler = (req, res, next) => {
  res.status(404).json({
    message: 'Resource not found'
  });
};

export const errorHandler = (err, req, res, next) => {
  console.error(err);
  const status = err.statusCode || 500;
  res.status(status).json({
    message: err.message || 'Internal server error',
    ...(err.errors ? { errors: err.errors } : {})
  });
};

/**
 * Wraps an async Express route handler so that any thrown error or rejected
 * promise is forwarded to next() — required in Express 4 which does not do
 * this automatically.
 */
export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

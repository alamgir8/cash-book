/**
 * Zod request validator.
 * Express 5 makes `req.query` a getter-only property — never assign to it
 * directly or every validated route (including /auth/login) returns 400
 * "Validation failed: Cannot set property query...".
 */
const assignQuery = (req, nextQuery) => {
  try {
    req.query = nextQuery;
  } catch {
    Object.defineProperty(req, "query", {
      value: nextQuery,
      writable: true,
      configurable: true,
      enumerable: true,
    });
  }
};

export const validate = (schema) => (req, res, next) => {
  try {
    const data = {
      body: req.body,
      params: req.params,
      query: req.query,
    };
    const parseResult = schema.parse(data);
    req.body = parseResult.body ?? {};
    if (parseResult.params) {
      req.params = parseResult.params;
    }
    // Keep unknown query keys (e.g. organization). Zod object schemas strip
    // them by default, which forced personal-scope filters and empty org data.
    assignQuery(req, { ...req.query, ...(parseResult.query ?? {}) });
    return next();
  } catch (error) {
    const formatted =
      error.errors?.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })) ?? [{ message: error.message }];
    return res.status(400).json({
      message: "Validation failed",
      errors: formatted,
    });
  }
};

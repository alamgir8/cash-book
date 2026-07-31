export const validate = (schema) => (req, res, next) => {
  try {
    const data = {
      body: req.body,
      params: req.params,
      query: req.query,
    };
    const parseResult = schema.parse(data);
    req.body = parseResult.body ?? {};
    req.params = parseResult.params ?? {};
    // Keep unknown query keys (e.g. organization). Zod object schemas strip
    // them by default, which forced personal-scope filters and empty org data.
    req.query = { ...req.query, ...(parseResult.query ?? {}) };
    return next();
  } catch (error) {
    const formatted = error.errors?.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
    })) ?? [{ message: error.message }];
    return res.status(400).json({
      message: "Validation failed",
      errors: formatted,
    });
  }
};

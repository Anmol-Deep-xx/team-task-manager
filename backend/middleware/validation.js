const { validationResult } = require("express-validator");
const { ValidationError } = require("../utils/errors");

function validateRequest(req, _res, next) {
  const result = validationResult(req);
  if (!result.isEmpty()) {
    const errors = result.array().map((err) => ({
      field: err.path,
      message: err.msg,
    }));
    return next(new ValidationError("Validation failed", errors));
  }
  return next();
}

module.exports = {
  validateRequest,
};

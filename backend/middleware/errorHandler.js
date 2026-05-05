const logger = require("../utils/logger");
const { errorResponse } = require("../utils/response");

function notFoundHandler(req, _res, next) {
  const error = new Error(`Route not found: ${req.originalUrl}`);
  error.statusCode = 404;
  next(error);
}

function errorHandler(err, req, res, _next) {
  const statusCode = err.statusCode || 500;
  const message = statusCode === 500 ? "Internal server error" : err.message;

  logger.error(`${req.method} ${req.originalUrl} - ${err.message}`);

  return errorResponse(res, message, statusCode, err.errors || []);
}

module.exports = {
  notFoundHandler,
  errorHandler,
};

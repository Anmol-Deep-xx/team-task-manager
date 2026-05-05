function successResponse(res, message, data = null, statusCode = 200) {
  return res.status(statusCode).json({
    success: true,
    message,
    statusCode,
    data,
  });
}

function errorResponse(res, message, statusCode = 500, errors = []) {
  return res.status(statusCode).json({
    success: false,
    message,
    statusCode,
    data: null,
    errors,
  });
}

function paginationResponse(res, message, items, pagination, statusCode = 200) {
  return res.status(statusCode).json({
    success: true,
    message,
    statusCode,
    data: {
      items,
      pagination,
    },
  });
}

module.exports = {
  successResponse,
  errorResponse,
  paginationResponse,
};

const { verifyToken } = require("../utils/jwt");
const { UnauthorizedError, ForbiddenError } = require("../utils/errors");

function authenticate(req, _res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return next(new UnauthorizedError("Authentication token missing"));
  }

  const token = authHeader.split(" ")[1];
  try {
    const payload = verifyToken(token);
    req.user = payload;
    return next();
  } catch (error) {
    return next(new UnauthorizedError("Invalid or expired token"));
  }
}

function authorizeRoles(...roles) {
  return (req, _res, next) => {
    if (!req.user) {
      return next(new UnauthorizedError("Authentication required"));
    }
    if (!roles.includes(req.user.role)) {
      return next(
        new ForbiddenError("You do not have permission for this action"),
      );
    }
    return next();
  };
}

module.exports = {
  authenticate,
  authorizeRoles,
};

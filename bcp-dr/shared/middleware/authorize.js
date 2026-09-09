const { UnauthorizedError, ForbiddenError } = require('../errors');

function authorize(...allowedRoles) {
  const roles = allowedRoles.flat();

  return function authorizeMiddleware(req, res, next) {
    if (!req.user || !req.user.userId) {
      return next(new UnauthorizedError('Authentication required'));
    }

    if (!req.user.role || !roles.includes(req.user.role)) {
      return next(new ForbiddenError('You do not have permission to perform this action'));
    }

    return next();
  };
}

module.exports = { authorize };

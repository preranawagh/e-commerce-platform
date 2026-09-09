const jwt = require('jsonwebtoken');
const { UnauthorizedError } = require('../errors');
const { ROLE_VALUES } = require('../roles');

function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return next(new UnauthorizedError('Authorization bearer token is required'));
  }

  if (!process.env.JWT_SECRET) {
    return next(new UnauthorizedError('Invalid or expired token'));
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (!payload || !payload.userId || !ROLE_VALUES.includes(payload.role)) {
      return next(new UnauthorizedError('Invalid token payload'));
    }
    req.user = {
      userId: payload.userId,
      role: payload.role
    };
    req.token = token;
    return next();
  } catch (error) {
    return next(new UnauthorizedError('Invalid or expired token'));
  }
}

module.exports = { authenticate };

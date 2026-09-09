const crypto = require('crypto');
const { authenticate } = require('./authenticate');
const { authorize } = require('./authorize');
const { ROLES } = require('../roles');
const { UnauthorizedError } = require('../errors');

function tokensMatch(provided, expected) {
  if (!provided || !expected) {
    return false;
  }

  const providedBuffer = Buffer.from(String(provided));
  const expectedBuffer = Buffer.from(String(expected));
  if (providedBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(providedBuffer, expectedBuffer);
}

function allowInternalOrAdmin(req, res, next) {
  const expected = process.env.INTERNAL_SERVICE_TOKEN;
  const provided = req.headers['x-internal-token'];

  if (tokensMatch(provided, expected)) {
    req.internalService = true;
    return next();
  }

  return authenticate(req, res, (error) => {
    if (error) {
      if (!provided) {
        return next(new UnauthorizedError('Authentication required'));
      }
      return next(error);
    }
    return authorize(ROLES.ADMIN)(req, res, next);
  });
}

module.exports = { allowInternalOrAdmin, tokensMatch };

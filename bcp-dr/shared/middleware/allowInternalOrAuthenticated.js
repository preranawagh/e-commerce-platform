const { authenticate } = require('./authenticate');
const { tokensMatch } = require('./allowInternalOrAdmin');

function allowInternalOrAuthenticated(req, res, next) {
  const expected = process.env.INTERNAL_SERVICE_TOKEN;
  const provided = req.headers['x-internal-token'];

  if (tokensMatch(provided, expected)) {
    req.internalService = true;
    req.user = { internalService: true };
    return next();
  }

  return authenticate(req, res, (error) => {
    if (error) {
      return next(error);
    }
    return next();
  });
}

module.exports = { allowInternalOrAuthenticated };

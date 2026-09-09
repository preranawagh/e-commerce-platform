const { NotFoundError } = require('../errors');

function notFound(req, res, next) {
  next(new NotFoundError(`Cannot ${req.method} ${req.originalUrl}`));
}

module.exports = { notFound };

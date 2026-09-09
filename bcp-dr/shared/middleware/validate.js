const { validationResult } = require('express-validator');
const { ValidationAppError } = require('../errors');

function validate(req, res, next) {
  const errors = validationResult(req);
  if (errors.isEmpty()) {
    return next();
  }

  const details = errors.array().map((item) => ({
    field: item.path,
    message: item.msg
  }));

  return next(new ValidationAppError('Validation failed', details));
}

module.exports = { validate };

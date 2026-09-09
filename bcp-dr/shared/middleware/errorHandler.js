const { AppError } = require('../errors');

function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  if (err.name === 'SequelizeValidationError' || err.name === 'SequelizeUniqueConstraintError') {
    const details = (err.errors || []).map((item) => ({
      field: item.path,
      message: item.message
    }));
    const message = err.name === 'SequelizeUniqueConstraintError'
      ? 'A record with this value already exists'
      : 'Validation failed';
    return res.status(err.name === 'SequelizeUniqueConstraintError' ? 409 : 400).json({
      success: false,
      error: { message, details }
    });
  }

  if (err.name === 'SequelizeDatabaseError') {
    const message = process.env.NODE_ENV === 'production'
      ? 'A database error occurred'
      : err.message;
    return res.status(500).json({
      success: false,
      error: { message }
    });
  }

  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      error: { message: 'Invalid or expired token' }
    });
  }

  const statusCode = err instanceof AppError ? err.statusCode : 500;
  const exposeDetails = err instanceof AppError && err.details;
  const message = statusCode >= 500 && process.env.NODE_ENV === 'production'
    ? 'Internal server error'
    : err.message || 'Internal server error';

  const payload = {
    success: false,
    error: { message }
  };

  if (exposeDetails) {
    payload.error.details = err.details;
  }

  if (process.env.NODE_ENV !== 'production' && !(err instanceof AppError)) {
    payload.error.details = err.stack;
  }

  return res.status(statusCode).json(payload);
}

module.exports = { errorHandler };

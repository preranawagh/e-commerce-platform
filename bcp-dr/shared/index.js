const errors = require('./errors');
const { sendSuccess } = require('./response');
const { asyncHandler } = require('./asyncHandler');
const { createServiceClient, authHeader } = require('./httpClient');
const { loadEnv } = require('./loadEnv');
const { createSequelize } = require('./createSequelize');
const { createApp } = require('./createApp');
const { errorHandler } = require('./middleware/errorHandler');
const { notFound } = require('./middleware/notFound');
const { authenticate } = require('./middleware/authenticate');
const { authorize } = require('./middleware/authorize');
const { allowInternalOrAdmin } = require('./middleware/allowInternalOrAdmin');
const { allowInternalOrAuthenticated } = require('./middleware/allowInternalOrAuthenticated');
const { validate } = require('./middleware/validate');
const { ROLES, ROLE_VALUES, isAdmin } = require('./roles');

module.exports = {
  ...errors,
  sendSuccess,
  asyncHandler,
  createServiceClient,
  authHeader,
  loadEnv,
  createSequelize,
  createApp,
  errorHandler,
  notFound,
  authenticate,
  authorize,
  allowInternalOrAdmin,
  allowInternalOrAuthenticated,
  validate,
  ROLES,
  ROLE_VALUES,
  isAdmin
};

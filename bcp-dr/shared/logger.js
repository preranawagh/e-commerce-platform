const pino = require('pino');
const { getRequestId } = require('./requestContext');

// Cloud Logging reads `severity` and `message`; keep pino's `level` for local tools.
const SEVERITY = {
  trace: 'DEBUG',
  debug: 'DEBUG',
  info: 'INFO',
  warn: 'WARNING',
  error: 'ERROR',
  fatal: 'CRITICAL'
};

function defaultLevel() {
  return process.env.NODE_ENV === 'test' ? 'silent' : 'info';
}

const logger = pino({
  level: process.env.LOG_LEVEL || defaultLevel(),
  messageKey: 'message',
  timestamp: pino.stdTimeFunctions.isoTime,
  formatters: {
    level: (label) => ({ level: label, severity: SEVERITY[label] || 'DEFAULT' })
  },
  mixin() {
    const requestId = getRequestId();
    return requestId ? { requestId } : {};
  }
});

// Called once per service after its .env has been loaded.
function configureLogger(serviceName) {
  logger.level = process.env.LOG_LEVEL || defaultLevel();
  if (serviceName) {
    logger.setBindings({ service: serviceName });
  }
  return logger;
}

module.exports = { logger, configureLogger };

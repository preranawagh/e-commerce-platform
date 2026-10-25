const { randomUUID } = require('crypto');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const pinoHttp = require('pino-http');
const { logger, configureLogger } = require('./logger');
const { runWithRequestContext } = require('./requestContext');
const { registerHealthRoutes } = require('./health');

const REQUEST_ID_PATTERN = /^[A-Za-z0-9._-]{1,128}$/;
const PROBE_PATHS = new Set(['/health', '/ready']);

function requestIdFrom(req) {
  const incoming = req.headers['x-request-id'];
  return typeof incoming === 'string' && REQUEST_ID_PATTERN.test(incoming) ? incoming : randomUUID();
}

function createApp({ serviceName, readinessChecks } = {}) {
  configureLogger(serviceName);

  const app = express();
  const allowedOrigin = process.env.CORS_ORIGIN || 'http://localhost:5173';

  app.use(pinoHttp({
    logger,
    genReqId: (req, res) => {
      const id = requestIdFrom(req);
      res.setHeader('X-Request-Id', id);
      return id;
    },
    autoLogging: { ignore: (req) => PROBE_PATHS.has(req.url) },
    customLogLevel: (req, res) => {
      if (res.statusCode >= 500) return 'error';
      if (res.statusCode >= 400) return 'warn';
      return 'info';
    },
    redact: ['req.headers.authorization', 'req.headers["x-internal-token"]', 'req.headers.cookie']
  }));
  app.use((req, res, next) => runWithRequestContext({ requestId: req.id }, next));

  app.use(helmet());
  app.use(cors({
    origin: allowedOrigin.split(',').map((value) => value.trim()),
    exposedHeaders: ['X-Request-Id']
  }));
  app.use(express.json({ limit: '100kb' }));

  registerHealthRoutes(app, { serviceName, readinessChecks });

  return app;
}

module.exports = { createApp };

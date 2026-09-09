const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

function createApp() {
  const app = express();
  const allowedOrigin = process.env.CORS_ORIGIN || 'http://localhost:5173';

  app.use(helmet());
  app.use(cors({ origin: allowedOrigin.split(',').map((value) => value.trim()) }));
  app.use(express.json({ limit: '100kb' }));

  app.get('/health', (req, res) => {
    res.json({ success: true, data: { status: 'ok' } });
  });

  return app;
}

module.exports = { createApp };

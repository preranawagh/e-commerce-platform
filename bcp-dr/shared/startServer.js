const { logger } = require('./logger');

// Starts the HTTP server and installs graceful shutdown.
//
// On SIGTERM/SIGINT the service: marks itself not ready (/ready → 503), stops
// accepting new connections, lets in-flight requests finish, closes the
// database pool and exits 0. If that takes longer than SHUTDOWN_TIMEOUT_MS it
// exits 1. Keep the timeout below Kubernetes' terminationGracePeriodSeconds.
async function startServer({ app, port, serviceName, sequelize }) {
  const shutdownTimeoutMs = Number(process.env.SHUTDOWN_TIMEOUT_MS || 10000);

  await sequelize.authenticate();

  const server = await new Promise((resolve, reject) => {
    const listening = app.listen(port, () => resolve(listening));
    listening.on('error', reject);
  });
  logger.info({ port: server.address().port }, `${serviceName} listening`);

  let shuttingDown = false;
  function shutdown(signal) {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    app.locals.shuttingDown = true;
    logger.info({ signal }, 'Shutdown started');

    const forceExit = setTimeout(() => {
      logger.error({ timeoutMs: shutdownTimeoutMs }, 'Shutdown timed out; forcing exit');
      process.exit(1);
    }, shutdownTimeoutMs);
    forceExit.unref();

    server.close(async (closeError) => {
      if (closeError) {
        logger.error({ err: closeError }, 'Error while closing HTTP server');
      }
      try {
        await sequelize.close();
      } catch (dbError) {
        logger.error({ err: dbError }, 'Error while closing database pool');
      }
      clearTimeout(forceExit);
      logger.info('Shutdown complete');
      process.exit(closeError ? 1 : 0);
    });
    server.closeIdleConnections();
  }

  process.once('SIGTERM', () => shutdown('SIGTERM'));
  process.once('SIGINT', () => shutdown('SIGINT'));

  return server;
}

module.exports = { startServer };

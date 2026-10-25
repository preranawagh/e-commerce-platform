function withTimeout(promise, timeoutMs) {
  let timer;
  const timeout = new Promise((resolve, reject) => {
    timer = setTimeout(() => reject(new Error(`Check timed out after ${timeoutMs} ms`)), timeoutMs);
  });
  return Promise.race([Promise.resolve(promise), timeout]).finally(() => clearTimeout(timer));
}

async function runCheck(check, timeoutMs) {
  const started = Date.now();
  try {
    await withTimeout(check(), timeoutMs);
    return { status: 'ok', latencyMs: Date.now() - started };
  } catch (error) {
    const result = { status: 'error', latencyMs: Date.now() - started };
    if (process.env.NODE_ENV !== 'production') {
      // Connection failures often arrive as an AggregateError with an empty message.
      result.error = error.message || error.parent?.code || error.original?.code || error.name;
    }
    return result;
  }
}

// GET /health — liveness: the process is up and serving HTTP. No dependencies.
// GET /ready  — readiness: every dependency check passes and the service is not
//               shutting down. Returns 503 otherwise so load balancers and
//               Kubernetes stop routing traffic here.
function registerHealthRoutes(app, { serviceName, readinessChecks = {} } = {}) {
  app.get('/health', (req, res) => {
    res.json({ success: true, data: { status: 'ok', service: serviceName } });
  });

  app.get('/ready', async (req, res) => {
    if (app.locals.shuttingDown) {
      return res.status(503).json({
        success: false,
        error: { message: 'Service is shutting down', details: { status: 'shutting_down', service: serviceName } }
      });
    }

    const timeoutMs = Number(process.env.READY_CHECK_TIMEOUT_MS || 2000);
    const names = Object.keys(readinessChecks);
    const results = await Promise.all(names.map((name) => runCheck(readinessChecks[name], timeoutMs)));
    const checks = Object.fromEntries(names.map((name, index) => [name, results[index]]));
    const ready = results.every((result) => result.status === 'ok');

    if (!ready) {
      return res.status(503).json({
        success: false,
        error: { message: 'Service is not ready', details: { status: 'not_ready', service: serviceName, checks } }
      });
    }
    return res.json({ success: true, data: { status: 'ready', service: serviceName, checks } });
  });
}

module.exports = { registerHealthRoutes };

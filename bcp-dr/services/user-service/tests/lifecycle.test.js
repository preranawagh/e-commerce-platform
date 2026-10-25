const request = require('supertest');
const { startServer } = require('@cloudresilience/shared');
const app = require('../src/app');
const { sequelize } = require('../src/models');

// Health, readiness, request ids and graceful shutdown come from the shared
// library and behave the same in every service; they are tested here once.
describe('Service lifecycle', () => {
  afterAll(async () => {
    await sequelize.close();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    app.locals.shuttingDown = false;
  });

  it('reports liveness on /health without touching the database', async () => {
    const authenticate = jest.spyOn(sequelize, 'authenticate');

    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual({ status: 'ok', service: 'user-service' });
    expect(authenticate).not.toHaveBeenCalled();
  });

  it('reports ready when the database check passes', async () => {
    const response = await request(app).get('/ready');

    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe('ready');
    expect(response.body.data.checks.database.status).toBe('ok');
  });

  it('returns 503 from /ready when the database is unreachable', async () => {
    jest.spyOn(sequelize, 'authenticate').mockRejectedValue(new Error('connect ECONNREFUSED'));

    const response = await request(app).get('/ready');

    expect(response.status).toBe(503);
    expect(response.body.success).toBe(false);
    expect(response.body.error.details.checks.database.status).toBe('error');
  });

  it('returns 503 from /ready when the database check hangs past the timeout', async () => {
    process.env.READY_CHECK_TIMEOUT_MS = '50';
    jest.spyOn(sequelize, 'authenticate').mockReturnValue(new Promise(() => {}));

    try {
      const response = await request(app).get('/ready');
      expect(response.status).toBe(503);
      expect(response.body.error.details.checks.database.error).toMatch(/timed out/);
    } finally {
      delete process.env.READY_CHECK_TIMEOUT_MS;
    }
  });

  it('returns 503 from /ready while shutting down', async () => {
    app.locals.shuttingDown = true;

    const response = await request(app).get('/ready');

    expect(response.status).toBe(503);
    expect(response.body.error.details.status).toBe('shutting_down');
  });

  it('generates an X-Request-Id when the caller does not send one', async () => {
    const response = await request(app).get('/health');

    expect(response.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('echoes a valid incoming X-Request-Id and replaces an invalid one', async () => {
    const echoed = await request(app).get('/health').set('X-Request-Id', 'drill-42.run_1');
    expect(echoed.headers['x-request-id']).toBe('drill-42.run_1');

    const replaced = await request(app).get('/health').set('X-Request-Id', 'bad id "injected"');
    expect(replaced.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);

    const tooLong = await request(app).get('/health').set('X-Request-Id', 'x'.repeat(200));
    expect(tooLong.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('shuts down gracefully on SIGTERM: not ready, closes the pool, exits 0', async () => {
    const exit = jest.spyOn(process, 'exit').mockImplementation(() => {});
    const close = jest.spyOn(sequelize, 'close').mockResolvedValue();

    const server = await startServer({ app, port: 0, serviceName: 'user-service', sequelize });
    const { port } = server.address();
    expect((await request(`http://127.0.0.1:${port}`).get('/ready')).status).toBe(200);

    process.emit('SIGTERM');
    expect(app.locals.shuttingDown).toBe(true);

    await new Promise((resolve) => server.on('close', resolve));
    await new Promise((resolve) => setImmediate(resolve));

    expect(close).toHaveBeenCalled();
    expect(exit).toHaveBeenCalledWith(0);
  });
});

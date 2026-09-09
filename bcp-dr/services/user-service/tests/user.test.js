const request = require('supertest');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const app = require('../src/app');
const { sequelize, User } = require('../src/models');

describe('User Service', () => {
  beforeAll(async () => {
    await sequelize.sync({ force: true });
  });

  afterAll(async () => {
    await sequelize.close();
  });

  const userPayload = {
    name: 'Prerana',
    email: 'prerana@example.com',
    password: 'password123'
  };

  it('registers a new user as CUSTOMER and returns a token without the password', async () => {
    const response = await request(app).post('/api/users/register').send(userPayload);

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.email).toBe('prerana@example.com');
    expect(response.body.data.role).toBe('CUSTOMER');
    expect(response.body.data.token).toBeDefined();
    expect(response.body.data.password).toBeUndefined();

    const payload = jwt.decode(response.body.data.token);
    expect(payload.userId).toBeDefined();
    expect(payload.role).toBe('CUSTOMER');
    expect(payload.password).toBeUndefined();
  });

  it('stores a bcrypt hash instead of the plaintext password', async () => {
    const created = await request(app).post('/api/users/register').send({
      name: 'Hash Check',
      email: 'hashcheck@example.com',
      password: 'password123'
    });

    const user = await User.findByPk(created.body.data.id);
    expect(user.password).not.toBe('password123');
    expect(user.password.startsWith('$2')).toBe(true);
    expect(await bcrypt.compare('password123', user.password)).toBe(true);
  });

  it('ignores a client-supplied ADMIN role during registration', async () => {
    const response = await request(app).post('/api/users/register').send({
      name: 'Hacker',
      email: 'hacker@example.com',
      password: 'password123',
      role: 'ADMIN'
    });

    expect(response.status).toBe(201);
    expect(response.body.data.role).toBe('CUSTOMER');
    expect(jwt.decode(response.body.data.token).role).toBe('CUSTOMER');
  });

  it('rejects a duplicate email', async () => {
    const response = await request(app).post('/api/users/register').send(userPayload);

    expect(response.status).toBe(409);
    expect(response.body.success).toBe(false);
    expect(response.body.error.message).toMatch(/already registered/i);
  });

  it('rejects invalid registration input', async () => {
    const response = await request(app).post('/api/users/register').send({
      name: '',
      email: 'not-an-email',
      password: 'short'
    });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  it('logs in with valid credentials and returns the role', async () => {
    const response = await request(app).post('/api/users/login').send({
      email: userPayload.email,
      password: userPayload.password
    });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.token).toBeDefined();
    expect(response.body.data.name).toBe('Prerana');
    expect(response.body.data.role).toBe('CUSTOMER');
    expect(response.body.data.password).toBeUndefined();
  });

  it('uses the database role even if the login body includes ADMIN', async () => {
    const response = await request(app).post('/api/users/login').send({
      email: userPayload.email,
      password: userPayload.password,
      role: 'ADMIN'
    });

    expect(response.status).toBe(200);
    expect(response.body.data.role).toBe('CUSTOMER');
    expect(jwt.decode(response.body.data.token).role).toBe('CUSTOMER');
  });

  it('rejects an invalid password', async () => {
    const response = await request(app).post('/api/users/login').send({
      email: userPayload.email,
      password: 'wrong-password'
    });

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
    expect(response.body.error.message).toMatch(/invalid email or password/i);
  });

  it('returns the authenticated user profile including role', async () => {
    const login = await request(app).post('/api/users/login').send({
      email: userPayload.email,
      password: userPayload.password
    });

    const response = await request(app)
      .get('/api/users/profile')
      .set('Authorization', `Bearer ${login.body.data.token}`);

    expect(response.status).toBe(200);
    expect(response.body.data.email).toBe('prerana@example.com');
    expect(response.body.data.role).toBe('CUSTOMER');
    expect(response.body.data.password).toBeUndefined();
  });

  it('rejects profile access without a token', async () => {
    const response = await request(app).get('/api/users/profile');
    expect(response.status).toBe(401);
  });

  it('rejects a token that omits role', async () => {
    const token = jwt.sign({ userId: 1 }, process.env.JWT_SECRET);
    const response = await request(app)
      .get('/api/users/profile')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(401);
  });

  it('sets Helmet and CORS headers', async () => {
    const response = await request(app)
      .get('/health')
      .set('Origin', 'http://localhost:5173');

    expect(response.status).toBe(200);
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['access-control-allow-origin']).toBe('http://localhost:5173');
  });

  it('lists ADMIN users for internal callers and hides passwords', async () => {
    const denied = await request(app).get('/api/users/admins');
    expect(denied.status).toBe(401);

    const response = await request(app)
      .get('/api/users/admins')
      .set('X-Internal-Token', process.env.INTERNAL_SERVICE_TOKEN);

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body.data)).toBe(true);
    expect(response.body.data.every((user) => !user.password)).toBe(true);
  });
});

const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../src/app');
const { sequelize } = require('../src/models');

describe('Notification Service', () => {
  const ownerToken = jwt.sign({ userId: 7, role: 'CUSTOMER' }, process.env.JWT_SECRET);
  const otherToken = jwt.sign({ userId: 8, role: 'CUSTOMER' }, process.env.JWT_SECRET);

  beforeAll(async () => {
    await sequelize.sync({ force: true });
  });

  afterAll(async () => {
    await sequelize.close();
  });

  it('rejects listing notifications without a token', async () => {
    const response = await request(app).get('/api/notifications/user/7');
    expect(response.status).toBe(401);
  });

  it('stores a notification for the authenticated user', async () => {
    const response = await request(app)
      .post('/api/notifications')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        userId: 7,
        type: 'ORDER_CREATED',
        message: 'Order #1 was created successfully.'
      });

    expect(response.status).toBe(201);
    expect(response.body.data.type).toBe('ORDER_CREATED');
    expect(response.body.data.status).toBe('UNREAD');
  });

  it('lists notifications for the authenticated user', async () => {
    const response = await request(app)
      .get('/api/notifications/user/7')
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].message).toMatch(/Order #1/);
  });

  it('prevents a CUSTOMER from viewing another user\'s notifications', async () => {
    const response = await request(app)
      .get('/api/notifications/user/7')
      .set('Authorization', `Bearer ${otherToken}`);

    expect(response.status).toBe(403);
  });

  it('prevents a CUSTOMER from creating a notification for another user', async () => {
    const response = await request(app)
      .post('/api/notifications')
      .set('Authorization', `Bearer ${otherToken}`)
      .send({
        userId: 7,
        type: 'ORDER_CREATED',
        message: 'Should not be allowed'
      });

    expect(response.status).toBe(403);
  });

  it('marks a notification as read', async () => {
    const created = await request(app)
      .post('/api/notifications')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        userId: 7,
        type: 'ORDER_CANCELLED',
        message: 'Order #2 was cancelled.'
      });

    const response = await request(app)
      .post(`/api/notifications/${created.body.data.id}/read`)
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe('READ');
  });

  it('prevents a CUSTOMER from marking another user\'s notification as read', async () => {
    const listed = await request(app)
      .get('/api/notifications/user/7')
      .set('Authorization', `Bearer ${ownerToken}`);

    const response = await request(app)
      .post(`/api/notifications/${listed.body.data[0].id}/read`)
      .set('Authorization', `Bearer ${otherToken}`);

    expect(response.status).toBe(403);
  });

  it('lets an ADMIN list another user\'s notifications', async () => {
    const adminToken = jwt.sign({ userId: 1, role: 'ADMIN' }, process.env.JWT_SECRET);
    const response = await request(app)
      .get('/api/notifications/user/7')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data.length).toBeGreaterThan(0);
  });

  it('lets the Order Service create a notification for another user with the internal token', async () => {
    const response = await request(app)
      .post('/api/notifications')
      .set('X-Internal-Token', process.env.INTERNAL_SERVICE_TOKEN)
      .send({
        userId: 1,
        type: 'ORDER_CREATED',
        message: 'User 7 placed order #9.'
      });

    expect(response.status).toBe(201);
    expect(response.body.data.userId).toBe(1);
    expect(response.body.data.status).toBe('UNREAD');
  });
});

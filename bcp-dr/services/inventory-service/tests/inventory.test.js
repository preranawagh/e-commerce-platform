const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../src/app');
const { sequelize } = require('../src/models');

describe('Inventory Service', () => {
  const adminToken = jwt.sign({ userId: 1, role: 'ADMIN' }, process.env.JWT_SECRET);
  const customerToken = jwt.sign({ userId: 2, role: 'CUSTOMER' }, process.env.JWT_SECRET);
  const internalHeaders = { 'X-Internal-Token': process.env.INTERNAL_SERVICE_TOKEN };

  beforeAll(async () => {
    await sequelize.sync({ force: true });
  });

  afterAll(async () => {
    await sequelize.close();
  });

  it('rejects inventory creation by a CUSTOMER', async () => {
    const response = await request(app)
      .post('/api/inventory')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ productId: 1, quantity: 10 });

    expect(response.status).toBe(403);
  });

  it('allows an ADMIN to create an inventory record', async () => {
    const response = await request(app)
      .post('/api/inventory')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ productId: 1, quantity: 10 });

    expect(response.status).toBe(201);
    expect(response.body.data.quantity).toBe(10);
    expect(response.body.data.reservedQuantity).toBe(0);
    expect(response.body.data.availableQuantity).toBe(10);
  });

  it('rejects direct reserve calls from a CUSTOMER', async () => {
    const response = await request(app)
      .post('/api/inventory/reserve')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ productId: 1, quantity: 1 });

    expect(response.status).toBe(403);
  });

  it('rejects direct release calls from a CUSTOMER', async () => {
    const response = await request(app)
      .post('/api/inventory/release')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ productId: 1, quantity: 1 });

    expect(response.status).toBe(403);
  });

  it('reserves inventory when called with the internal service token', async () => {
    const response = await request(app)
      .post('/api/inventory/reserve')
      .set(internalHeaders)
      .send({ productId: 1, quantity: 4 });

    expect(response.status).toBe(200);
    expect(response.body.data.reservedQuantity).toBe(4);
    expect(response.body.data.availableQuantity).toBe(6);
  });

  it('rejects a reserve request when stock is insufficient', async () => {
    const response = await request(app)
      .post('/api/inventory/reserve')
      .set(internalHeaders)
      .send({ productId: 1, quantity: 20 });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.error.message).toMatch(/insufficient inventory/i);
  });

  it('releases reserved inventory when called with the internal service token', async () => {
    const response = await request(app)
      .post('/api/inventory/release')
      .set(internalHeaders)
      .send({ productId: 1, quantity: 2 });

    expect(response.status).toBe(200);
    expect(response.body.data.reservedQuantity).toBe(2);
    expect(response.body.data.availableQuantity).toBe(8);
  });

  it('rejects inventory updates by a CUSTOMER', async () => {
    const response = await request(app)
      .put('/api/inventory/1')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ quantity: 99 });

    expect(response.status).toBe(403);
  });

  it('allows an ADMIN to update on-hand quantity', async () => {
    const response = await request(app)
      .put('/api/inventory/1')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ quantity: 15 });

    expect(response.status).toBe(200);
    expect(response.body.data.quantity).toBe(15);
    expect(response.body.data.availableQuantity).toBe(13);
  });
});

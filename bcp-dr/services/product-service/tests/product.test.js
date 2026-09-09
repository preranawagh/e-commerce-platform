const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../src/app');
const { sequelize } = require('../src/models');

describe('Product Service', () => {
  const adminToken = jwt.sign({ userId: 1, role: 'ADMIN' }, process.env.JWT_SECRET);
  const customerToken = jwt.sign({ userId: 2, role: 'CUSTOMER' }, process.env.JWT_SECRET);
  let productId;

  const productPayload = {
    name: 'Wireless Mouse',
    description: 'A simple wireless mouse',
    price: 799.5,
    sku: 'SKU-MOUSE-001'
  };

  beforeAll(async () => {
    await sequelize.sync({ force: true });
  });

  afterAll(async () => {
    await sequelize.close();
  });

  it('rejects product creation without a token', async () => {
    const response = await request(app)
      .post('/api/products')
      .send(productPayload);

    expect(response.status).toBe(401);
  });

  it('rejects product creation by a CUSTOMER', async () => {
    const response = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${customerToken}`)
      .send(productPayload);

    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);
  });

  it('allows an ADMIN to create a product', async () => {
    const response = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(productPayload);

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.name).toBe('Wireless Mouse');
    expect(response.body.data.price).toBe(799.5);
    productId = response.body.data.id;
  });

  it('retrieves a product by id', async () => {
    const response = await request(app).get(`/api/products/${productId}`);

    expect(response.status).toBe(200);
    expect(response.body.data.sku).toBe('SKU-MOUSE-001');
  });

  it('rejects product updates by a CUSTOMER', async () => {
    const response = await request(app)
      .put(`/api/products/${productId}`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        name: 'Hacked Mouse',
        description: 'Should not work',
        price: 1,
        sku: 'SKU-MOUSE-001'
      });

    expect(response.status).toBe(403);
  });

  it('allows an ADMIN to update a product', async () => {
    const response = await request(app)
      .put(`/api/products/${productId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Wireless Mouse Pro',
        description: 'Updated description',
        price: 899,
        sku: 'SKU-MOUSE-001'
      });

    expect(response.status).toBe(200);
    expect(response.body.data.name).toBe('Wireless Mouse Pro');
    expect(response.body.data.price).toBe(899);
  });

  it('rejects product deletion by a CUSTOMER', async () => {
    const response = await request(app)
      .delete(`/api/products/${productId}`)
      .set('Authorization', `Bearer ${customerToken}`);

    expect(response.status).toBe(403);
  });

  it('allows an ADMIN to delete a product', async () => {
    const created = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Temporary Cable',
        description: 'To be deleted',
        price: 99,
        sku: 'SKU-TEMP-001'
      });

    const response = await request(app)
      .delete(`/api/products/${created.body.data.id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data.id).toBe(created.body.data.id);
  });
});

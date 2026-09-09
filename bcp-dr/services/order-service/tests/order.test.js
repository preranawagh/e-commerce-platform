const request = require('supertest');
const jwt = require('jsonwebtoken');
const { NotFoundError, ValidationAppError } = require('@cloudresilience/shared');

jest.mock('../src/clients/serviceClients', () => ({
  fetchProduct: jest.fn(),
  fetchUser: jest.fn(),
  listAdmins: jest.fn(),
  reserveStock: jest.fn(),
  releaseStock: jest.fn(),
  notifyUser: jest.fn()
}));

const clients = require('../src/clients/serviceClients');
const app = require('../src/app');
const { sequelize, Order, OrderItem } = require('../src/models');

describe('Order Service', () => {
  const customerToken = jwt.sign({ userId: 3, role: 'CUSTOMER' }, process.env.JWT_SECRET);
  const otherCustomerToken = jwt.sign({ userId: 9, role: 'CUSTOMER' }, process.env.JWT_SECRET);
  const adminToken = jwt.sign({ userId: 1, role: 'ADMIN' }, process.env.JWT_SECRET);
  let orderId;

  beforeAll(async () => {
    await sequelize.sync({ force: true });
  });

  afterAll(async () => {
    await sequelize.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    clients.notifyUser.mockResolvedValue({ id: 1 });
    clients.listAdmins.mockResolvedValue([{ id: 1, name: 'Admin User' }]);
    clients.fetchUser.mockImplementation(async (id) => ({ id, name: `User ${id}` }));
  });

  it('rejects listing orders without a token', async () => {
    const response = await request(app).get('/api/orders');
    expect(response.status).toBe(401);
  });

  it('creates an order after reserving inventory', async () => {
    clients.fetchProduct.mockResolvedValue({ id: 11, name: 'HDMI Cable', price: 299 });
    clients.reserveStock.mockResolvedValue({ productId: 11, reservedQuantity: 2 });

    const response = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ items: [{ productId: 11, quantity: 2 }] });

    expect(response.status).toBe(201);
    expect(response.body.data.status).toBe('CONFIRMED');
    expect(response.body.data.totalAmount).toBe(598);
    expect(response.body.data.items).toHaveLength(1);
    expect(clients.reserveStock).toHaveBeenCalledWith(11, 2);
    expect(clients.notifyUser).toHaveBeenCalledWith(expect.objectContaining({
      userId: 3,
      type: 'ORDER_CREATED'
    }));
    expect(clients.notifyUser).toHaveBeenCalledWith(expect.objectContaining({
      userId: 1,
      type: 'ORDER_CREATED',
      message: expect.stringMatching(/User 3 placed order/)
    }));
    orderId = response.body.data.id;
  });

  it('lets a CUSTOMER list only their own orders', async () => {
    await Order.create({ userId: 9, status: 'CONFIRMED', totalAmount: 50 });

    const response = await request(app)
      .get('/api/orders')
      .set('Authorization', `Bearer ${customerToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data.every((order) => order.userId === 3)).toBe(true);
  });

  it('rejects an order for an invalid product', async () => {
    clients.fetchProduct.mockRejectedValue(new NotFoundError('Product not found'));

    const response = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ items: [{ productId: 999, quantity: 1 }] });

    expect(response.status).toBe(404);
    expect(response.body.success).toBe(false);
    expect(clients.reserveStock).not.toHaveBeenCalled();
  });

  it('rejects an order when inventory is insufficient', async () => {
    clients.fetchProduct.mockResolvedValue({ id: 12, name: 'Desk Lamp', price: 899 });
    clients.reserveStock.mockRejectedValue(new ValidationAppError('Insufficient inventory'));

    const response = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ items: [{ productId: 12, quantity: 50 }] });

    expect(response.status).toBe(400);
    expect(response.body.error.message).toMatch(/insufficient inventory/i);
  });

  it('retrieves an order by id for the owner', async () => {
    const response = await request(app)
      .get(`/api/orders/${orderId}`)
      .set('Authorization', `Bearer ${customerToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data.id).toBe(orderId);
    expect(response.body.data.items[0].productId).toBe(11);
  });

  it('prevents a CUSTOMER from accessing another user\'s order', async () => {
    const response = await request(app)
      .get(`/api/orders/${orderId}`)
      .set('Authorization', `Bearer ${otherCustomerToken}`);

    expect(response.status).toBe(403);
  });

  it('prevents a CUSTOMER from cancelling another user\'s order', async () => {
    const response = await request(app)
      .post(`/api/orders/${orderId}/cancel`)
      .set('Authorization', `Bearer ${otherCustomerToken}`);

    expect(response.status).toBe(403);
    expect(clients.releaseStock).not.toHaveBeenCalled();
  });

  it('lets an ADMIN view all orders', async () => {
    const response = await request(app)
      .get('/api/orders')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data.length).toBeGreaterThanOrEqual(2);
  });

  it('lets an ADMIN cancel another user\'s order', async () => {
    const otherOrder = await Order.create({ userId: 9, status: 'CONFIRMED', totalAmount: 50 });
    await OrderItem.create({
      orderId: otherOrder.id,
      productId: 11,
      quantity: 1,
      unitPrice: 50
    });
    clients.releaseStock.mockResolvedValue({ productId: 11, reservedQuantity: 0 });

    const response = await request(app)
      .post(`/api/orders/${otherOrder.id}/cancel`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe('CANCELLED');
    expect(clients.releaseStock).toHaveBeenCalled();
    expect(clients.notifyUser).toHaveBeenCalledWith(expect.objectContaining({
      userId: 9,
      type: 'ORDER_CANCELLED'
    }));
    expect(clients.notifyUser).toHaveBeenCalledWith(expect.objectContaining({
      userId: 1,
      type: 'ORDER_CANCELLED',
      message: expect.stringMatching(/User 1 cancelled order/)
    }));
  });

  it('cancels an order and releases inventory once', async () => {
    clients.releaseStock.mockResolvedValue({ productId: 11, reservedQuantity: 0 });

    const response = await request(app)
      .post(`/api/orders/${orderId}/cancel`)
      .set('Authorization', `Bearer ${customerToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe('CANCELLED');
    expect(clients.releaseStock).toHaveBeenCalledWith(11, 2);

    const retry = await request(app)
      .post(`/api/orders/${orderId}/cancel`)
      .set('Authorization', `Bearer ${customerToken}`);

    expect(retry.status).toBe(400);
    expect(retry.body.error.message).toMatch(/already cancelled/i);
  });
});

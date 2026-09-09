const { createServiceClient } = require('@cloudresilience/shared');
const config = require('../config');

function getClients() {
  return {
    userClient: createServiceClient(config.userServiceUrl),
    productClient: createServiceClient(config.productServiceUrl),
    inventoryClient: createServiceClient(config.inventoryServiceUrl),
    notificationClient: createServiceClient(config.notificationServiceUrl)
  };
}

function internalHeaders() {
  return { 'X-Internal-Token': process.env.INTERNAL_SERVICE_TOKEN };
}

async function fetchProduct(productId) {
  const { productClient } = getClients();
  const response = await productClient.get(`/api/products/${productId}`);
  return response.data.data;
}

async function fetchUser(userId) {
  const { userClient } = getClients();
  const response = await userClient.get(`/api/users/${userId}`, {
    headers: internalHeaders()
  });
  return response.data.data;
}

async function listAdmins() {
  const { userClient } = getClients();
  const response = await userClient.get('/api/users/admins', {
    headers: internalHeaders()
  });
  return response.data.data;
}

async function reserveStock(productId, quantity) {
  const { inventoryClient } = getClients();
  const response = await inventoryClient.post(
    '/api/inventory/reserve',
    { productId, quantity },
    { headers: internalHeaders() }
  );
  return response.data.data;
}

async function releaseStock(productId, quantity) {
  const { inventoryClient } = getClients();
  const response = await inventoryClient.post(
    '/api/inventory/release',
    { productId, quantity },
    { headers: internalHeaders() }
  );
  return response.data.data;
}

async function notifyUser(payload) {
  const { notificationClient } = getClients();
  const response = await notificationClient.post('/api/notifications', payload, {
    headers: internalHeaders()
  });
  return response.data.data;
}

module.exports = {
  getClients,
  fetchProduct,
  fetchUser,
  listAdmins,
  reserveStock,
  releaseStock,
  notifyUser
};

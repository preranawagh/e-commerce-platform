module.exports = {
  port: Number(process.env.PORT || process.env.ORDER_SERVICE_PORT || 3004),
  userServiceUrl: process.env.USER_SERVICE_URL || 'http://localhost:3001',
  productServiceUrl: process.env.PRODUCT_SERVICE_URL || 'http://localhost:3002',
  inventoryServiceUrl: process.env.INVENTORY_SERVICE_URL || 'http://localhost:3003',
  notificationServiceUrl: process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3005'
};

'use strict';

const bcrypt = require('bcryptjs');

module.exports = {
  async up(queryInterface) {
    const now = new Date();
    const password = await bcrypt.hash('Password123!', 10);

    await queryInterface.bulkInsert('users', [
      { name: 'Admin User', email: 'admin@example.com', password, role: 'ADMIN', createdAt: now, updatedAt: now },
      { name: 'Alice Student', email: 'alice@example.com', password, role: 'CUSTOMER', createdAt: now, updatedAt: now },
      { name: 'Bob Student', email: 'bob@example.com', password, role: 'CUSTOMER', createdAt: now, updatedAt: now },
      { name: 'Carol Student', email: 'carol@example.com', password, role: 'CUSTOMER', createdAt: now, updatedAt: now },
      { name: 'Dave Student', email: 'dave@example.com', password, role: 'CUSTOMER', createdAt: now, updatedAt: now },
      { name: 'Eve Student', email: 'eve@example.com', password, role: 'CUSTOMER', createdAt: now, updatedAt: now }
    ]);

    const [users] = await queryInterface.sequelize.query('SELECT id, email FROM users ORDER BY id ASC');
    const userByEmail = Object.fromEntries(users.map((user) => [user.email, user.id]));

    await queryInterface.bulkInsert('products', [
      { name: 'Wireless Mouse', description: 'Compact 2.4GHz wireless mouse for everyday use.', price: 799.00, sku: 'SKU-MOUSE-001', createdAt: now, updatedAt: now },
      { name: 'Mechanical Keyboard', description: 'Tactile mechanical keyboard with backlight.', price: 3499.00, sku: 'SKU-KEY-001', createdAt: now, updatedAt: now },
      { name: 'USB-C Hub', description: '6-in-1 USB-C hub with HDMI and card reader.', price: 1499.00, sku: 'SKU-HUB-001', createdAt: now, updatedAt: now },
      { name: 'Laptop Stand', description: 'Aluminum laptop stand with adjustable height.', price: 1299.00, sku: 'SKU-STAND-001', createdAt: now, updatedAt: now },
      { name: 'Noise-Cancel Headphones', description: 'Over-ear headphones with active noise cancellation.', price: 4999.00, sku: 'SKU-HP-001', createdAt: now, updatedAt: now },
      { name: 'Webcam 1080p', description: 'Full HD webcam for online classes and meetings.', price: 2499.00, sku: 'SKU-CAM-001', createdAt: now, updatedAt: now },
      { name: 'Desk Lamp', description: 'LED desk lamp with three brightness levels.', price: 899.00, sku: 'SKU-LAMP-001', createdAt: now, updatedAt: now },
      { name: 'Notebook Pack', description: 'Pack of three ruled notebooks.', price: 199.00, sku: 'SKU-NB-001', createdAt: now, updatedAt: now },
      { name: 'Water Bottle', description: 'Stainless steel 750ml water bottle.', price: 399.00, sku: 'SKU-BOT-001', createdAt: now, updatedAt: now },
      { name: 'HDMI Cable', description: '1.5 metre HDMI 2.0 cable.', price: 299.00, sku: 'SKU-HDMI-001', createdAt: now, updatedAt: now }
    ]);

    const [products] = await queryInterface.sequelize.query('SELECT id, sku FROM products ORDER BY id ASC');
    const productBySku = Object.fromEntries(products.map((product) => [product.sku, product.id]));

    await queryInterface.bulkInsert('inventory', [
      { productId: productBySku['SKU-MOUSE-001'], quantity: 80, reservedQuantity: 2, createdAt: now, updatedAt: now },
      { productId: productBySku['SKU-KEY-001'], quantity: 40, reservedQuantity: 1, createdAt: now, updatedAt: now },
      { productId: productBySku['SKU-HUB-001'], quantity: 60, reservedQuantity: 0, createdAt: now, updatedAt: now },
      { productId: productBySku['SKU-STAND-001'], quantity: 35, reservedQuantity: 0, createdAt: now, updatedAt: now },
      { productId: productBySku['SKU-HP-001'], quantity: 25, reservedQuantity: 1, createdAt: now, updatedAt: now },
      { productId: productBySku['SKU-CAM-001'], quantity: 45, reservedQuantity: 0, createdAt: now, updatedAt: now },
      { productId: productBySku['SKU-LAMP-001'], quantity: 70, reservedQuantity: 0, createdAt: now, updatedAt: now },
      { productId: productBySku['SKU-NB-001'], quantity: 200, reservedQuantity: 3, createdAt: now, updatedAt: now },
      { productId: productBySku['SKU-BOT-001'], quantity: 90, reservedQuantity: 0, createdAt: now, updatedAt: now },
      { productId: productBySku['SKU-HDMI-001'], quantity: 150, reservedQuantity: 0, createdAt: now, updatedAt: now }
    ]);

    await queryInterface.bulkInsert('orders', [
      { userId: userByEmail['alice@example.com'], status: 'CONFIRMED', totalAmount: 1598.00, createdAt: now, updatedAt: now },
      { userId: userByEmail['bob@example.com'], status: 'CONFIRMED', totalAmount: 8498.00, createdAt: now, updatedAt: now },
      { userId: userByEmail['alice@example.com'], status: 'CANCELLED', totalAmount: 199.00, createdAt: now, updatedAt: now }
    ]);

    const [orders] = await queryInterface.sequelize.query('SELECT id, "totalAmount" FROM orders ORDER BY id ASC');

    await queryInterface.bulkInsert('order_items', [
      { orderId: orders[0].id, productId: productBySku['SKU-MOUSE-001'], quantity: 2, unitPrice: 799.00 },
      { orderId: orders[1].id, productId: productBySku['SKU-KEY-001'], quantity: 1, unitPrice: 3499.00 },
      { orderId: orders[1].id, productId: productBySku['SKU-HP-001'], quantity: 1, unitPrice: 4999.00 },
      { orderId: orders[2].id, productId: productBySku['SKU-NB-001'], quantity: 1, unitPrice: 199.00 }
    ]);

    await queryInterface.bulkInsert('notifications', [
      {
        userId: userByEmail['alice@example.com'],
        type: 'ORDER_CREATED',
        message: `Order #${orders[0].id} was created successfully.`,
        status: 'UNREAD',
        createdAt: now
      },
      {
        userId: userByEmail['bob@example.com'],
        type: 'ORDER_CREATED',
        message: `Order #${orders[1].id} was created successfully.`,
        status: 'UNREAD',
        createdAt: now
      },
      {
        userId: userByEmail['alice@example.com'],
        type: 'ORDER_CANCELLED',
        message: `Order #${orders[2].id} was cancelled.`,
        status: 'UNREAD',
        createdAt: now
      },
      {
        userId: userByEmail['admin@example.com'],
        type: 'ORDER_CREATED',
        message: `Alice Student placed order #${orders[0].id}.`,
        status: 'UNREAD',
        createdAt: now
      },
      {
        userId: userByEmail['admin@example.com'],
        type: 'ORDER_CREATED',
        message: `Bob Student placed order #${orders[1].id}.`,
        status: 'UNREAD',
        createdAt: now
      },
      {
        userId: userByEmail['admin@example.com'],
        type: 'ORDER_CANCELLED',
        message: `Alice Student cancelled order #${orders[2].id}.`,
        status: 'UNREAD',
        createdAt: now
      }
    ]);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('notifications', null, {});
    await queryInterface.bulkDelete('order_items', null, {});
    await queryInterface.bulkDelete('orders', null, {});
    await queryInterface.bulkDelete('inventory', null, {});
    await queryInterface.bulkDelete('products', null, {});
    await queryInterface.bulkDelete('users', null, {});
  }
};

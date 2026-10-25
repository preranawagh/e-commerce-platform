'use strict';

const bcrypt = require('bcryptjs');

// Synthetic identity used by the BCDR business-transaction validator
// (scripts/e2e-business-flow.js). Validation orders are placed only by this
// user, only for this product, and are cancelled straight away, so real
// customer data and stock are never touched.
const PROBE_EMAIL = process.env.BCDR_PROBE_EMAIL || 'bcdr-probe@example.com';
const PROBE_SKU = 'SKU-BCDR-PROBE';
const PROBE_STOCK = 1000000;

module.exports = {
  async up(queryInterface) {
    const now = new Date();
    const password = await bcrypt.hash(process.env.BCDR_PROBE_PASSWORD || 'Password123!', 10);

    const [existingUsers] = await queryInterface.sequelize.query(
      'SELECT id FROM users WHERE email = :email',
      { replacements: { email: PROBE_EMAIL } }
    );
    if (existingUsers.length === 0) {
      await queryInterface.bulkInsert('users', [
        { name: 'BCDR Probe', email: PROBE_EMAIL, password, role: 'CUSTOMER', createdAt: now, updatedAt: now }
      ]);
    }

    const [existingProducts] = await queryInterface.sequelize.query(
      'SELECT id FROM products WHERE sku = :sku',
      { replacements: { sku: PROBE_SKU } }
    );
    if (existingProducts.length === 0) {
      await queryInterface.bulkInsert('products', [
        {
          name: 'BCDR Probe Item',
          description: 'Synthetic item used by CloudResilience recovery validation. Not for sale.',
          price: 1.00,
          sku: PROBE_SKU,
          createdAt: now,
          updatedAt: now
        }
      ]);
    }

    const [[product]] = await queryInterface.sequelize.query(
      'SELECT id FROM products WHERE sku = :sku',
      { replacements: { sku: PROBE_SKU } }
    );
    const [existingInventory] = await queryInterface.sequelize.query(
      'SELECT id FROM inventory WHERE "productId" = :productId',
      { replacements: { productId: product.id } }
    );
    if (existingInventory.length === 0) {
      await queryInterface.bulkInsert('inventory', [
        { productId: product.id, quantity: PROBE_STOCK, reservedQuantity: 0, createdAt: now, updatedAt: now }
      ]);
    }
  },

  async down(queryInterface) {
    const [[user]] = await queryInterface.sequelize.query(
      'SELECT id FROM users WHERE email = :email',
      { replacements: { email: PROBE_EMAIL } }
    );
    const [[product]] = await queryInterface.sequelize.query(
      'SELECT id FROM products WHERE sku = :sku',
      { replacements: { sku: PROBE_SKU } }
    );

    if (user) {
      await queryInterface.sequelize.query(
        'DELETE FROM order_items WHERE "orderId" IN (SELECT id FROM orders WHERE "userId" = :userId)',
        { replacements: { userId: user.id } }
      );
      await queryInterface.bulkDelete('orders', { userId: user.id });
      await queryInterface.bulkDelete('notifications', { userId: user.id });
      await queryInterface.bulkDelete('users', { id: user.id });
    }
    if (product) {
      await queryInterface.bulkDelete('order_items', { productId: product.id });
      await queryInterface.bulkDelete('inventory', { productId: product.id });
      await queryInterface.bulkDelete('products', { id: product.id });
    }
  }
};

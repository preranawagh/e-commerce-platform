const { createSequelize } = require('@cloudresilience/shared');
const defineOrder = require('./Order');
const defineOrderItem = require('./OrderItem');

const sequelize = createSequelize();
const Order = defineOrder(sequelize);
const OrderItem = defineOrderItem(sequelize);

Order.hasMany(OrderItem, { foreignKey: 'orderId', as: 'items' });
OrderItem.belongsTo(Order, { foreignKey: 'orderId', as: 'order' });

module.exports = { sequelize, Order, OrderItem };

const { createSequelize } = require('@cloudresilience/shared');
const defineInventory = require('./Inventory');

const sequelize = createSequelize();
const Inventory = defineInventory(sequelize);

module.exports = { sequelize, Inventory };

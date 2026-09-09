const { createSequelize } = require('@cloudresilience/shared');
const defineProduct = require('./Product');

const sequelize = createSequelize();
const Product = defineProduct(sequelize);

module.exports = { sequelize, Product };

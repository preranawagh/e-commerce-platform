const { createSequelize } = require('@cloudresilience/shared');
const defineUser = require('./User');

const sequelize = createSequelize();
const User = defineUser(sequelize);

module.exports = { sequelize, User };

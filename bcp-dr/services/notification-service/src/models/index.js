const { createSequelize } = require('@cloudresilience/shared');
const defineNotification = require('./Notification');

const sequelize = createSequelize();
const Notification = defineNotification(sequelize);

module.exports = { sequelize, Notification };

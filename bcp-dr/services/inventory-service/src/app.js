const { loadEnv } = require('@cloudresilience/shared');

loadEnv(__dirname + '/..');

const { createApp, errorHandler, notFound } = require('@cloudresilience/shared');
const inventoryRoutes = require('./routes/inventoryRoutes');
const { sequelize } = require('./models');

const app = createApp({
  serviceName: 'inventory-service',
  readinessChecks: { database: () => sequelize.authenticate() }
});
app.use('/api/inventory', inventoryRoutes);
app.use(notFound);
app.use(errorHandler);

module.exports = app;

const { loadEnv } = require('@cloudresilience/shared');

loadEnv(__dirname + '/..');

const { createApp, errorHandler, notFound } = require('@cloudresilience/shared');
const productRoutes = require('./routes/productRoutes');
const { sequelize } = require('./models');

const app = createApp({
  serviceName: 'product-service',
  readinessChecks: { database: () => sequelize.authenticate() }
});
app.use('/api/products', productRoutes);
app.use(notFound);
app.use(errorHandler);

module.exports = app;

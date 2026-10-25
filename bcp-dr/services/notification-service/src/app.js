const { loadEnv } = require('@cloudresilience/shared');

loadEnv(__dirname + '/..');

const { createApp, errorHandler, notFound } = require('@cloudresilience/shared');
const notificationRoutes = require('./routes/notificationRoutes');
const { sequelize } = require('./models');

const app = createApp({
  serviceName: 'notification-service',
  readinessChecks: { database: () => sequelize.authenticate() }
});
app.use('/api/notifications', notificationRoutes);
app.use(notFound);
app.use(errorHandler);

module.exports = app;

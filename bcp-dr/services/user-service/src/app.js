const { loadEnv } = require('@cloudresilience/shared');

loadEnv(__dirname + '/..');

const { createApp, errorHandler, notFound } = require('@cloudresilience/shared');
const userRoutes = require('./routes/userRoutes');
const { sequelize } = require('./models');

const app = createApp({
  serviceName: 'user-service',
  readinessChecks: { database: () => sequelize.authenticate() }
});
app.use('/api/users', userRoutes);
app.use(notFound);
app.use(errorHandler);

module.exports = app;

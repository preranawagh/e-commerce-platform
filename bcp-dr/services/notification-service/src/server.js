const { startServer, logger } = require('@cloudresilience/shared');
const app = require('./app');
const { sequelize } = require('./models');
const { port } = require('./config');

startServer({ app, port, serviceName: 'notification-service', sequelize }).catch((error) => {
  logger.fatal({ err: error }, 'Failed to start Notification Service');
  process.exit(1);
});

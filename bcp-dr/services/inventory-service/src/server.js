const { startServer, logger } = require('@cloudresilience/shared');
const app = require('./app');
const { sequelize } = require('./models');
const { port } = require('./config');

startServer({ app, port, serviceName: 'inventory-service', sequelize }).catch((error) => {
  logger.fatal({ err: error }, 'Failed to start Inventory Service');
  process.exit(1);
});

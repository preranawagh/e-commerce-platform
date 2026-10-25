const { startServer, logger } = require('@cloudresilience/shared');
const app = require('./app');
const { sequelize } = require('./models');
const { port } = require('./config');

startServer({ app, port, serviceName: 'product-service', sequelize }).catch((error) => {
  logger.fatal({ err: error }, 'Failed to start Product Service');
  process.exit(1);
});

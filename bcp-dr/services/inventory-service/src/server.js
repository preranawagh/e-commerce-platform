const app = require('./app');
const { sequelize } = require('./models');
const { port } = require('./config');

async function start() {
  await sequelize.authenticate();
  app.listen(port, () => {
    console.log(`Inventory Service listening on http://localhost:${port}`);
  });
}

start().catch((error) => {
  console.error('Failed to start Inventory Service:', error.message);
  process.exit(1);
});

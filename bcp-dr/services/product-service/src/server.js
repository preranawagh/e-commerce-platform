const app = require('./app');
const { sequelize } = require('./models');
const { port } = require('./config');

async function start() {
  await sequelize.authenticate();
  app.listen(port, () => {
    console.log(`Product Service listening on http://localhost:${port}`);
  });
}

start().catch((error) => {
  console.error('Failed to start Product Service:', error.message);
  process.exit(1);
});

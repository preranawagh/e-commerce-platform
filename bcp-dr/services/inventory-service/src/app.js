const { loadEnv } = require('@cloudresilience/shared');

loadEnv(__dirname + '/..');

const { createApp, errorHandler, notFound } = require('@cloudresilience/shared');
const inventoryRoutes = require('./routes/inventoryRoutes');

const app = createApp();
app.use('/api/inventory', inventoryRoutes);
app.use(notFound);
app.use(errorHandler);

module.exports = app;

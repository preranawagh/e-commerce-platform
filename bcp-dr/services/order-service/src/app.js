const { loadEnv } = require('@cloudresilience/shared');

loadEnv(__dirname + '/..');

const { createApp, errorHandler, notFound } = require('@cloudresilience/shared');
const orderRoutes = require('./routes/orderRoutes');

const app = createApp();
app.use('/api/orders', orderRoutes);
app.use(notFound);
app.use(errorHandler);

module.exports = app;

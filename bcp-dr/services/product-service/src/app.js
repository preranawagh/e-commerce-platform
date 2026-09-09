const { loadEnv } = require('@cloudresilience/shared');

loadEnv(__dirname + '/..');

const { createApp, errorHandler, notFound } = require('@cloudresilience/shared');
const productRoutes = require('./routes/productRoutes');

const app = createApp();
app.use('/api/products', productRoutes);
app.use(notFound);
app.use(errorHandler);

module.exports = app;

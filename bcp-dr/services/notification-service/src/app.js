const { loadEnv } = require('@cloudresilience/shared');

loadEnv(__dirname + '/..');

const { createApp, errorHandler, notFound } = require('@cloudresilience/shared');
const notificationRoutes = require('./routes/notificationRoutes');

const app = createApp();
app.use('/api/notifications', notificationRoutes);
app.use(notFound);
app.use(errorHandler);

module.exports = app;

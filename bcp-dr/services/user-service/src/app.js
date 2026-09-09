const { loadEnv } = require('@cloudresilience/shared');

loadEnv(__dirname + '/..');

const { createApp, errorHandler, notFound } = require('@cloudresilience/shared');
const userRoutes = require('./routes/userRoutes');

const app = createApp();
app.use('/api/users', userRoutes);
app.use(notFound);
app.use(errorHandler);

module.exports = app;

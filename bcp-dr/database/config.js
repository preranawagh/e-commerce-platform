const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const common = {
  username: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'change_me',
  database: process.env.DB_NAME || 'cloudresilience',
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 5432),
  dialect: 'postgres',
  seederStorage: 'sequelize'
};

module.exports = {
  development: common,
  test: common,
  production: common
};

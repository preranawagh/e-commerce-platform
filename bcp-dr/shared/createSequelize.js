const { Sequelize } = require('sequelize');
const { logger } = require('./logger');

// TLS for managed databases (e.g. Cloud SQL without the Auth Proxy).
function sslOptions() {
  if (process.env.DB_SSL !== 'true') {
    return {};
  }
  return {
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false'
      }
    }
  };
}

function createSequelize() {
  if (process.env.NODE_ENV === 'test') {
    return new Sequelize({
      dialect: 'sqlite',
      storage: ':memory:',
      logging: false,
      define: {
        freezeTableName: true
      }
    });
  }

  return new Sequelize(
    process.env.DB_NAME,
    process.env.DB_USER,
    process.env.DB_PASSWORD,
    {
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT || 5432),
      dialect: 'postgres',
      logging: process.env.DB_LOGGING === 'true' ? (sql) => logger.info({ sql }, 'SQL') : false,
      // Fail fast while the database is unavailable (e.g. during failover)
      // instead of holding requests for Sequelize's 60 s default.
      pool: {
        max: Number(process.env.DB_POOL_MAX || 5),
        acquire: Number(process.env.DB_POOL_ACQUIRE_MS || 10000),
        idle: 10000
      },
      ...sslOptions(),
      define: {
        freezeTableName: true
      }
    }
  );
}

module.exports = { createSequelize, sslOptions };

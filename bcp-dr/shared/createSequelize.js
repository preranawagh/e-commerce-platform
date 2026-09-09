const { Sequelize } = require('sequelize');

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
      logging: process.env.DB_LOGGING === 'true' ? console.log : false,
      define: {
        freezeTableName: true
      }
    }
  );
}

module.exports = { createSequelize };

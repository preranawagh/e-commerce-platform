const { DataTypes } = require('sequelize');

module.exports = (sequelize) => sequelize.define('Product', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  name: {
    type: DataTypes.STRING(180),
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  sku: {
    type: DataTypes.STRING(64),
    allowNull: false,
    unique: true
  }
}, {
  tableName: 'products',
  timestamps: true
});

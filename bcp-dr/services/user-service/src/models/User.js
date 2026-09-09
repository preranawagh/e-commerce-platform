const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const User = sequelize.define('User', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    name: {
      type: DataTypes.STRING(120),
      allowNull: false
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true
    },
    password: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    role: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'CUSTOMER',
      validate: {
        isIn: [['CUSTOMER', 'ADMIN']]
      }
    }
  }, {
    tableName: 'users',
    timestamps: true
  });

  User.prototype.toSafeJSON = function toSafeJSON() {
    const values = this.toJSON();
    delete values.password;
    return values;
  };

  return User;
};

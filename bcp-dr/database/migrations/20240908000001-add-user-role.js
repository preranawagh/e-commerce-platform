'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('users', 'role', {
      type: Sequelize.STRING(20),
      allowNull: false,
      defaultValue: 'CUSTOMER'
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('users', 'role');
  }
};

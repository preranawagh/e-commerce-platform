const ROLES = {
  CUSTOMER: 'CUSTOMER',
  ADMIN: 'ADMIN'
};

const ROLE_VALUES = Object.values(ROLES);

function isAdmin(role) {
  return role === ROLES.ADMIN;
}

module.exports = { ROLES, ROLE_VALUES, isAdmin };

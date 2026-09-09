function excludePassword(user) {
  if (!user) {
    return user;
  }
  const values = typeof user.toJSON === 'function' ? user.toJSON() : { ...user };
  delete values.password;
  return values;
}

module.exports = { excludePassword };

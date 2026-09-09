const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { ConflictError, UnauthorizedError, NotFoundError, ROLES } = require('@cloudresilience/shared');
const { User } = require('../models');
const { excludePassword } = require('../utils');

function signToken(user) {
  return jwt.sign(
    { userId: user.id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
  );
}

async function register({ name, email, password }) {
  const normalizedEmail = email.toLowerCase().trim();
  const existing = await User.findOne({ where: { email: normalizedEmail } });
  if (existing) {
    throw new ConflictError('Email is already registered');
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const user = await User.create({
    name: name.trim(),
    email: normalizedEmail,
    password: hashedPassword,
    role: ROLES.CUSTOMER
  });

  return {
    ...excludePassword(user),
    token: signToken(user)
  };
}

async function login({ email, password }) {
  const user = await User.findOne({ where: { email: email.toLowerCase().trim() } });
  if (!user) {
    throw new UnauthorizedError('Invalid email or password');
  }

  const matches = await bcrypt.compare(password, user.password);
  if (!matches) {
    throw new UnauthorizedError('Invalid email or password');
  }

  return {
    ...excludePassword(user),
    token: signToken(user)
  };
}

async function getProfile(userId) {
  const user = await User.findByPk(userId);
  if (!user) {
    throw new NotFoundError('User not found');
  }
  return excludePassword(user);
}

async function listAdmins() {
  const users = await User.findAll({
    where: { role: ROLES.ADMIN },
    order: [['id', 'ASC']]
  });
  return users.map(excludePassword);
}

async function getById(userId) {
  const user = await User.findByPk(userId);
  if (!user) {
    throw new NotFoundError('User not found');
  }
  return excludePassword(user);
}

module.exports = { register, login, getProfile, listAdmins, getById, signToken };

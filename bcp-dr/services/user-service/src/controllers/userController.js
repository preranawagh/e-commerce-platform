const { asyncHandler, sendSuccess } = require('@cloudresilience/shared');
const userService = require('../services/userService');

const register = asyncHandler(async (req, res) => {
  const data = await userService.register(req.body);
  return sendSuccess(res, data, 201);
});

const login = asyncHandler(async (req, res) => {
  const data = await userService.login(req.body);
  return sendSuccess(res, data);
});

const getProfile = asyncHandler(async (req, res) => {
  const data = await userService.getProfile(req.user.userId);
  return sendSuccess(res, data);
});

const listAdmins = asyncHandler(async (req, res) => {
  const data = await userService.listAdmins();
  return sendSuccess(res, data);
});

const getById = asyncHandler(async (req, res) => {
  const data = await userService.getById(Number(req.params.id));
  return sendSuccess(res, data);
});

module.exports = { register, login, getProfile, listAdmins, getById };

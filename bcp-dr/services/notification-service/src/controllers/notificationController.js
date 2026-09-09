const { asyncHandler, sendSuccess } = require('@cloudresilience/shared');
const notificationService = require('../services/notificationService');

const create = asyncHandler(async (req, res) => {
  const data = await notificationService.createNotification(req.body, req.user);
  return sendSuccess(res, data, 201);
});

const listForUser = asyncHandler(async (req, res) => {
  const data = await notificationService.listForUser(Number(req.params.userId), req.user);
  return sendSuccess(res, data);
});

const markAsRead = asyncHandler(async (req, res) => {
  const data = await notificationService.markAsRead(Number(req.params.id), req.user);
  return sendSuccess(res, data);
});

const markAllAsRead = asyncHandler(async (req, res) => {
  const data = await notificationService.markAllAsRead(Number(req.params.userId), req.user);
  return sendSuccess(res, data);
});

module.exports = { create, listForUser, markAsRead, markAllAsRead };

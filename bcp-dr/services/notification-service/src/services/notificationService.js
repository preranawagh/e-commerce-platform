const { ForbiddenError, NotFoundError, ROLES } = require('@cloudresilience/shared');
const { Notification } = require('../models');
const { ALLOWED_TYPES } = require('../utils');

function assertOwnNotifications(userId, requester) {
  if (requester.role !== ROLES.ADMIN && Number(userId) !== Number(requester.userId)) {
    throw new ForbiddenError('You can only view your own notifications');
  }
}

async function createNotification({ userId, type, message }, requester) {
  const isInternal = Boolean(requester?.internalService);
  if (!isInternal && requester.role !== ROLES.ADMIN && Number(userId) !== Number(requester.userId)) {
    throw new ForbiddenError('You can only create notifications for your own user');
  }

  const notification = await Notification.create({
    userId,
    type: ALLOWED_TYPES.includes(type) ? type : type,
    message: message.trim(),
    status: 'UNREAD'
  });
  return notification.toJSON();
}

async function listForUser(userId, requester) {
  assertOwnNotifications(userId, requester);

  const notifications = await Notification.findAll({
    where: { userId },
    order: [['createdAt', 'DESC']]
  });
  return notifications.map((item) => item.toJSON());
}

async function markAsRead(notificationId, requester) {
  const notification = await Notification.findByPk(notificationId);
  if (!notification) {
    throw new NotFoundError('Notification not found');
  }
  if (requester.role !== ROLES.ADMIN && notification.userId !== requester.userId) {
    throw new ForbiddenError('You can only update your own notifications');
  }

  notification.status = 'READ';
  await notification.save();
  return notification.toJSON();
}

async function markAllAsRead(userId, requester) {
  assertOwnNotifications(userId, requester);

  await Notification.update(
    { status: 'READ' },
    { where: { userId, status: 'UNREAD' } }
  );

  return listForUser(userId, requester);
}

module.exports = {
  createNotification,
  listForUser,
  markAsRead,
  markAllAsRead,
  ALLOWED_TYPES
};

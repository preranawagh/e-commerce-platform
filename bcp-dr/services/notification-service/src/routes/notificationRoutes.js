const express = require('express');
const { body, param } = require('express-validator');
const { authenticate, allowInternalOrAuthenticated, validate } = require('@cloudresilience/shared');
const notificationController = require('../controllers/notificationController');

const router = express.Router();

router.post(
  '/',
  allowInternalOrAuthenticated,
  [
    body('userId').isInt({ gt: 0 }).withMessage('userId must be a positive integer'),
    body('type').trim().notEmpty().withMessage('type is required').isIn(['ORDER_CREATED', 'ORDER_CANCELLED']),
    body('message').trim().notEmpty().withMessage('message is required')
  ],
  validate,
  notificationController.create
);

router.get(
  '/user/:userId',
  authenticate,
  [param('userId').isInt({ gt: 0 }).withMessage('userId must be a positive integer')],
  validate,
  notificationController.listForUser
);

router.post(
  '/user/:userId/read-all',
  authenticate,
  [param('userId').isInt({ gt: 0 }).withMessage('userId must be a positive integer')],
  validate,
  notificationController.markAllAsRead
);

router.post(
  '/:id/read',
  authenticate,
  [param('id').isInt({ gt: 0 }).withMessage('Notification id must be a positive integer')],
  validate,
  notificationController.markAsRead
);

module.exports = router;

const express = require('express');
const { body, param } = require('express-validator');
const { authenticate, validate } = require('@cloudresilience/shared');
const orderController = require('../controllers/orderController');

const router = express.Router();

router.use(authenticate);

router.post(
  '/',
  [
    body('items').isArray({ min: 1 }).withMessage('items must be a non-empty array'),
    body('items.*.productId').isInt({ gt: 0 }).withMessage('Each item needs a valid productId'),
    body('items.*.quantity').isInt({ gt: 0 }).withMessage('Each item quantity must be a positive integer')
  ],
  validate,
  orderController.create
);

router.get('/', orderController.list);

router.get(
  '/:id',
  [param('id').isInt({ gt: 0 }).withMessage('Order id must be a positive integer')],
  validate,
  orderController.getById
);

router.post(
  '/:id/cancel',
  [param('id').isInt({ gt: 0 }).withMessage('Order id must be a positive integer')],
  validate,
  orderController.cancel
);

module.exports = router;

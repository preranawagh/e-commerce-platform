const express = require('express');
const { body, param } = require('express-validator');
const { authenticate, authorize, allowInternalOrAdmin, validate, ROLES } = require('@cloudresilience/shared');
const inventoryController = require('../controllers/inventoryController');

const router = express.Router();

const quantityBody = [
  body('productId').isInt({ gt: 0 }).withMessage('productId must be a positive integer'),
  body('quantity').isInt({ gt: 0 }).withMessage('quantity must be a positive integer')
];

router.get(
  '/:productId',
  [param('productId').isInt({ gt: 0 }).withMessage('productId must be a positive integer')],
  validate,
  inventoryController.getByProductId
);

router.post(
  '/',
  authenticate,
  authorize(ROLES.ADMIN),
  [
    body('productId').isInt({ gt: 0 }).withMessage('productId must be a positive integer'),
    body('quantity').isInt({ min: 0 }).withMessage('quantity must be a non-negative integer')
  ],
  validate,
  inventoryController.create
);

router.put(
  '/:productId',
  authenticate,
  authorize(ROLES.ADMIN),
  [
    param('productId').isInt({ gt: 0 }).withMessage('productId must be a positive integer'),
    body('quantity').isInt({ min: 0 }).withMessage('quantity must be a non-negative integer')
  ],
  validate,
  inventoryController.update
);

router.post('/reserve', allowInternalOrAdmin, quantityBody, validate, inventoryController.reserve);
router.post('/release', allowInternalOrAdmin, quantityBody, validate, inventoryController.release);

module.exports = router;

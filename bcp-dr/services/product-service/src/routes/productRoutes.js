const express = require('express');
const { body, param } = require('express-validator');
const { authenticate, authorize, validate, ROLES } = require('@cloudresilience/shared');
const productController = require('../controllers/productController');

const router = express.Router();

const productValidators = [
  body('name').trim().notEmpty().withMessage('Name is required').isLength({ max: 180 }),
  body('description').optional({ nullable: true }).isString(),
  body('price').isFloat({ gt: 0 }).withMessage('Price must be greater than 0'),
  body('sku').trim().notEmpty().withMessage('SKU is required').isLength({ max: 64 })
];

router.get('/', productController.list);
router.get(
  '/:id',
  [param('id').isInt({ gt: 0 }).withMessage('Product id must be a positive integer')],
  validate,
  productController.getById
);
router.post('/', authenticate, authorize(ROLES.ADMIN), productValidators, validate, productController.create);
router.put(
  '/:id',
  authenticate,
  authorize(ROLES.ADMIN),
  [param('id').isInt({ gt: 0 }).withMessage('Product id must be a positive integer')],
  productValidators,
  validate,
  productController.update
);
router.delete(
  '/:id',
  authenticate,
  authorize(ROLES.ADMIN),
  [param('id').isInt({ gt: 0 }).withMessage('Product id must be a positive integer')],
  validate,
  productController.remove
);

module.exports = router;

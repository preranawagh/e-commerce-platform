const express = require('express');
const { body, param } = require('express-validator');
const { authenticate, allowInternalOrAdmin, validate } = require('@cloudresilience/shared');
const userController = require('../controllers/userController');

const router = express.Router();

router.post(
  '/register',
  [
    body('name').trim().notEmpty().withMessage('Name is required').isLength({ max: 120 }),
    body('email').trim().isEmail().withMessage('A valid email is required'),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
  ],
  validate,
  userController.register
);

router.post(
  '/login',
  [
    body('email').trim().isEmail().withMessage('A valid email is required'),
    body('password').notEmpty().withMessage('Password is required')
  ],
  validate,
  userController.login
);

router.get('/profile', authenticate, userController.getProfile);
router.get('/admins', allowInternalOrAdmin, userController.listAdmins);
router.get(
  '/:id',
  allowInternalOrAdmin,
  [param('id').isInt({ gt: 0 }).withMessage('User id must be a positive integer')],
  validate,
  userController.getById
);

module.exports = router;

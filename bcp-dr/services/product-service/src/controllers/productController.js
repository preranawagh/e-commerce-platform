const { asyncHandler, sendSuccess } = require('@cloudresilience/shared');
const productService = require('../services/productService');

const list = asyncHandler(async (req, res) => {
  return sendSuccess(res, await productService.listProducts());
});

const getById = asyncHandler(async (req, res) => {
  return sendSuccess(res, await productService.getProduct(req.params.id));
});

const create = asyncHandler(async (req, res) => {
  return sendSuccess(res, await productService.createProduct(req.body), 201);
});

const update = asyncHandler(async (req, res) => {
  return sendSuccess(res, await productService.updateProduct(req.params.id, req.body));
});

const remove = asyncHandler(async (req, res) => {
  return sendSuccess(res, await productService.deleteProduct(req.params.id));
});

module.exports = { list, getById, create, update, remove };

const { asyncHandler, sendSuccess } = require('@cloudresilience/shared');
const inventoryService = require('../services/inventoryService');

const getByProductId = asyncHandler(async (req, res) => {
  return sendSuccess(res, await inventoryService.getByProductId(Number(req.params.productId)));
});

const create = asyncHandler(async (req, res) => {
  return sendSuccess(res, await inventoryService.createInventory(req.body), 201);
});

const update = asyncHandler(async (req, res) => {
  return sendSuccess(
    res,
    await inventoryService.updateQuantity(Number(req.params.productId), req.body.quantity)
  );
});

const reserve = asyncHandler(async (req, res) => {
  return sendSuccess(res, await inventoryService.reserve(req.body));
});

const release = asyncHandler(async (req, res) => {
  return sendSuccess(res, await inventoryService.release(req.body));
});

module.exports = { getByProductId, create, update, reserve, release };

const { asyncHandler, sendSuccess } = require('@cloudresilience/shared');
const orderService = require('../services/orderService');

const create = asyncHandler(async (req, res) => {
  const data = await orderService.createOrder(req.user, req.body.items);
  return sendSuccess(res, data, 201);
});

const list = asyncHandler(async (req, res) => {
  return sendSuccess(res, await orderService.listOrders(req.user));
});

const getById = asyncHandler(async (req, res) => {
  return sendSuccess(res, await orderService.getOrderById(Number(req.params.id), req.user));
});

const cancel = asyncHandler(async (req, res) => {
  return sendSuccess(
    res,
    await orderService.cancelOrder(Number(req.params.id), req.user)
  );
});

module.exports = { create, list, getById, cancel };

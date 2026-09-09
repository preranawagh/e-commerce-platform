const { ConflictError, NotFoundError, ValidationAppError } = require('@cloudresilience/shared');
const { Inventory, sequelize } = require('../models');
const { availableQuantity } = require('../utils');

function serialize(record) {
  const data = record.toJSON();
  return {
    ...data,
    availableQuantity: availableQuantity(data)
  };
}

async function getByProductId(productId) {
  const record = await Inventory.findOne({ where: { productId } });
  if (!record) {
    throw new NotFoundError('Inventory record not found for this product');
  }
  return serialize(record);
}

async function createInventory({ productId, quantity }) {
  const existing = await Inventory.findOne({ where: { productId } });
  if (existing) {
    throw new ConflictError('Inventory already exists for this product');
  }

  const record = await Inventory.create({
    productId,
    quantity,
    reservedQuantity: 0
  });
  return serialize(record);
}

async function updateQuantity(productId, quantity) {
  const record = await Inventory.findOne({ where: { productId } });
  if (!record) {
    throw new NotFoundError('Inventory record not found for this product');
  }
  if (quantity < record.reservedQuantity) {
    throw new ValidationAppError('On-hand quantity cannot be lower than currently reserved stock', {
      productId,
      quantity,
      reservedQuantity: record.reservedQuantity
    });
  }

  record.quantity = quantity;
  await record.save();
  return serialize(record);
}

async function reserve({ productId, quantity }) {
  return sequelize.transaction(async (transaction) => {
    const record = await Inventory.findOne({
      where: { productId },
      lock: transaction.LOCK.UPDATE,
      transaction
    });

    if (!record) {
      throw new NotFoundError('Inventory record not found for this product');
    }

    const available = record.quantity - record.reservedQuantity;
    if (available < quantity) {
      throw new ValidationAppError('Insufficient inventory', {
        productId,
        requested: quantity,
        available
      });
    }

    record.reservedQuantity += quantity;
    await record.save({ transaction });
    return serialize(record);
  });
}

async function release({ productId, quantity }) {
  return sequelize.transaction(async (transaction) => {
    const record = await Inventory.findOne({
      where: { productId },
      lock: transaction.LOCK.UPDATE,
      transaction
    });

    if (!record) {
      throw new NotFoundError('Inventory record not found for this product');
    }

    if (record.reservedQuantity < quantity) {
      throw new ValidationAppError('Cannot release more stock than is currently reserved', {
        productId,
        requested: quantity,
        reservedQuantity: record.reservedQuantity
      });
    }

    record.reservedQuantity -= quantity;
    await record.save({ transaction });
    return serialize(record);
  });
}

module.exports = {
  getByProductId,
  createInventory,
  updateQuantity,
  reserve,
  release
};

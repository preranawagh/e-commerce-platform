function availableQuantity(record) {
  return record.quantity - record.reservedQuantity;
}

module.exports = { availableQuantity };

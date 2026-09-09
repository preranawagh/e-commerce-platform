function calculateTotal(items) {
  return items.reduce((sum, item) => sum + Number(item.unitPrice) * Number(item.quantity), 0);
}

module.exports = { calculateTotal };

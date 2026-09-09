function toNumberPrice(product) {
  const data = typeof product.toJSON === 'function' ? product.toJSON() : { ...product };
  return { ...data, price: Number(data.price) };
}

module.exports = { toNumberPrice };

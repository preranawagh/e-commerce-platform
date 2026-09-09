const { ConflictError, NotFoundError } = require('@cloudresilience/shared');
const { Product } = require('../models');
const { toNumberPrice } = require('../utils');

function serialize(product) {
  return toNumberPrice(product);
}

async function listProducts() {
  const products = await Product.findAll({ order: [['id', 'ASC']] });
  return products.map(serialize);
}

async function getProduct(id) {
  const product = await Product.findByPk(id);
  if (!product) {
    throw new NotFoundError('Product not found');
  }
  return serialize(product);
}

async function createProduct(payload) {
  const existing = await Product.findOne({ where: { sku: payload.sku.trim() } });
  if (existing) {
    throw new ConflictError('A product with this SKU already exists');
  }

  const product = await Product.create({
    name: payload.name.trim(),
    description: payload.description ? payload.description.trim() : null,
    price: payload.price,
    sku: payload.sku.trim()
  });
  return serialize(product);
}

async function updateProduct(id, payload) {
  const product = await Product.findByPk(id);
  if (!product) {
    throw new NotFoundError('Product not found');
  }

  if (payload.sku && payload.sku.trim() !== product.sku) {
    const existing = await Product.findOne({ where: { sku: payload.sku.trim() } });
    if (existing) {
      throw new ConflictError('A product with this SKU already exists');
    }
  }

  await product.update({
    name: payload.name !== undefined ? payload.name.trim() : product.name,
    description: payload.description !== undefined ? payload.description.trim() : product.description,
    price: payload.price !== undefined ? payload.price : product.price,
    sku: payload.sku !== undefined ? payload.sku.trim() : product.sku
  });

  return serialize(product);
}

async function deleteProduct(id) {
  const product = await Product.findByPk(id);
  if (!product) {
    throw new NotFoundError('Product not found');
  }
  await product.destroy();
  return { id: Number(id) };
}

module.exports = {
  listProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct
};

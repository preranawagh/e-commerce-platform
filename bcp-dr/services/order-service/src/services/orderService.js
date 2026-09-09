const { NotFoundError, ForbiddenError, ValidationAppError, AppError, ROLES } = require('@cloudresilience/shared');
const { Order, OrderItem, sequelize } = require('../models');
const clients = require('../clients/serviceClients');
const { calculateTotal } = require('../utils');

const STATUS = {
  PENDING: 'PENDING',
  CONFIRMED: 'CONFIRMED',
  CANCELLED: 'CANCELLED'
};

function serialize(order) {
  const data = order.toJSON();
  return {
    ...data,
    totalAmount: Number(data.totalAmount),
    items: (data.items || []).map((item) => ({
      ...item,
      unitPrice: Number(item.unitPrice)
    }))
  };
}

function assertOrderAccess(order, user, action = 'access') {
  if (user.role === ROLES.ADMIN) {
    return;
  }
  if (order.userId !== user.userId) {
    throw new ForbiddenError(`You can only ${action} your own orders`);
  }
}

async function releaseReserved(items) {
  const failures = [];
  for (const item of items) {
    try {
      await clients.releaseStock(item.productId, item.quantity);
    } catch (error) {
      failures.push({ productId: item.productId, message: error.message });
    }
  }
  return failures;
}

async function notifyOrderEvent({ actor, ownerId, orderId, type }) {
  const actorId = actor?.userId;
  const owner = await clients.fetchUser(ownerId).catch(() => null);
  const actorProfile = Number(actorId) === Number(ownerId)
    ? owner
    : await clients.fetchUser(actorId).catch(() => null);
  const ownerName = owner?.name || `User #${ownerId}`;
  const actorName = actorProfile?.name || ownerName || `User #${actorId}`;

  const ownerMessage = type === 'ORDER_CREATED'
    ? `Order #${orderId} was created successfully.`
    : Number(actorId) === Number(ownerId)
      ? `Order #${orderId} was cancelled.`
      : `Order #${orderId} was cancelled by ${actorName}.`;
  const adminMessage = type === 'ORDER_CREATED'
    ? `${actorName} placed order #${orderId}.`
    : `${actorName} cancelled order #${orderId}.`;

  try {
    await clients.notifyUser({
      userId: ownerId,
      type,
      message: ownerMessage
    });
  } catch (error) {
    console.error('Failed to create owner notification:', error.message);
  }

  try {
    const admins = await clients.listAdmins();
    const adminList = Array.isArray(admins) ? admins : [];
    const seen = new Set();
    for (const admin of adminList) {
      const adminId = Number(admin.id);
      if (!adminId || adminId === Number(ownerId) || seen.has(adminId)) {
        continue;
      }
      seen.add(adminId);
      await clients.notifyUser({
        userId: adminId,
        type,
        message: adminMessage
      });
    }
  } catch (error) {
    console.error('Failed to create admin notifications:', error.message);
  }
}

async function createOrder(user, items) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new ValidationAppError('Order must contain at least one item');
  }

  const userId = user.userId;
  const detailedItems = [];
  for (const item of items) {
    const product = await clients.fetchProduct(item.productId);
    detailedItems.push({
      productId: product.id,
      quantity: item.quantity,
      unitPrice: Number(product.price)
    });
  }

  const totalAmount = calculateTotal(detailedItems);

  const reserved = [];
  try {
    for (const item of detailedItems) {
      await clients.reserveStock(item.productId, item.quantity);
      reserved.push(item);
    }
  } catch (error) {
    await releaseReserved(reserved);
    throw error;
  }

  let order;
  try {
    order = await sequelize.transaction(async (transaction) => {
      const created = await Order.create({
        userId,
        status: STATUS.CONFIRMED,
        totalAmount
      }, { transaction });

      await OrderItem.bulkCreate(
        detailedItems.map((item) => ({
          orderId: created.id,
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: item.unitPrice
        })),
        { transaction }
      );

      return created;
    });
  } catch (error) {
    await releaseReserved(reserved);
    throw error;
  }

  await notifyOrderEvent({
    actor: user,
    ownerId: userId,
    orderId: order.id,
    type: 'ORDER_CREATED'
  });

  return getOrderById(order.id, user);
}

async function listOrders(user) {
  const where = user.role === ROLES.ADMIN ? {} : { userId: user.userId };
  const orders = await Order.findAll({
    where,
    include: [{ model: OrderItem, as: 'items' }],
    order: [['id', 'DESC']]
  });
  return orders.map(serialize);
}

async function getOrderById(orderId, user) {
  const order = await Order.findByPk(orderId, {
    include: [{ model: OrderItem, as: 'items' }]
  });
  if (!order) {
    throw new NotFoundError('Order not found');
  }
  assertOrderAccess(order, user, 'access');
  return serialize(order);
}

async function cancelOrder(orderId, user) {
  const { order, items } = await sequelize.transaction(async (transaction) => {
    const found = await Order.findByPk(orderId, {
      lock: transaction.LOCK.UPDATE,
      transaction
    });

    if (!found) {
      throw new NotFoundError('Order not found');
    }
    if (user.role !== ROLES.ADMIN && found.userId !== user.userId) {
      throw new ForbiddenError('You can only cancel your own orders');
    }
    if (found.status === STATUS.CANCELLED) {
      throw new ValidationAppError('Order is already cancelled');
    }

    const items = await OrderItem.findAll({
      where: { orderId: found.id },
      transaction
    });

    await found.update({ status: STATUS.CANCELLED }, { transaction });
    return { order: found, items };
  });

  const releaseFailures = await releaseReserved(items);
  if (releaseFailures.length > 0) {
    throw new AppError(
      `Order #${order.id} was cancelled, but inventory release failed for one or more items. Do not retry cancellation; ask an administrator to correct reserved stock.`,
      502,
      releaseFailures
    );
  }

  await notifyOrderEvent({
    actor: user,
    ownerId: order.userId,
    orderId: order.id,
    type: 'ORDER_CANCELLED'
  });

  return getOrderById(order.id, user);
}

module.exports = {
  STATUS,
  createOrder,
  listOrders,
  getOrderById,
  cancelOrder
};

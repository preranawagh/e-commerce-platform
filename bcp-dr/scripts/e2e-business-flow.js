#!/usr/bin/env node
'use strict';

// End-to-end business transaction check against a running stack.
//
//   services ready → login → product → inventory (before) → create order
//   → inventory reserved → notification stored → cancel order → stock released
//
// Uses only the synthetic probe identity (bcdr-probe seeder), so customer data
// and real stock are never touched; the order it creates is always cancelled.
// This is the seed of the BCDR controller's Level-5 business validator, which
// will require runBusinessFlow() directly.
//
// Usage:  node scripts/e2e-business-flow.js [--json] [--skip-ready]
// Exit code 0 = PASS, 1 = FAIL.

const path = require('path');
const { randomUUID } = require('crypto');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const PROBE_SKU = 'SKU-BCDR-PROBE';
const SERVICES = ['users', 'products', 'inventory', 'orders', 'notifications'];

function defaultOptions() {
  return {
    urls: {
      users: process.env.USER_SERVICE_URL || 'http://localhost:3001',
      products: process.env.PRODUCT_SERVICE_URL || 'http://localhost:3002',
      inventory: process.env.INVENTORY_SERVICE_URL || 'http://localhost:3003',
      orders: process.env.ORDER_SERVICE_URL || 'http://localhost:3004',
      notifications: process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3005'
    },
    probeEmail: process.env.BCDR_PROBE_EMAIL || 'bcdr-probe@example.com',
    probePassword: process.env.BCDR_PROBE_PASSWORD || 'Password123!',
    requestTimeoutMs: Number(process.env.E2E_REQUEST_TIMEOUT_MS || 10000),
    checkReadiness: true
  };
}

class StepFailure extends Error {
  constructor(message, detail) {
    super(message);
    this.detail = detail;
  }
}

function createClient({ urls, requestTimeoutMs, runId }) {
  return async function call(service, method, urlPath, { token, body } = {}) {
    const headers = { 'Content-Type': 'application/json', 'X-Request-Id': `${runId}-${service}` };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    let response;
    try {
      response = await fetch(`${urls[service]}${urlPath}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(requestTimeoutMs)
      });
    } catch (error) {
      throw new StepFailure(`${method} ${service}${urlPath} unreachable: ${error.cause?.code || error.message}`);
    }
    const payload = await response.json().catch(() => null);
    return { status: response.status, payload };
  };
}

function expectOk(result, what) {
  if (result.status < 200 || result.status >= 300 || !result.payload?.success) {
    const message = result.payload?.error?.message || `HTTP ${result.status}`;
    throw new StepFailure(`${what} failed: ${message}`, { status: result.status });
  }
  return result.payload.data;
}

async function runBusinessFlow(overrides = {}) {
  const options = { ...defaultOptions(), ...overrides };
  const runId = `e2e-${randomUUID().slice(0, 8)}`;
  const call = createClient({ ...options, runId });
  const steps = [];
  const state = {};
  const startedAt = new Date();

  async function step(name, fn) {
    const started = Date.now();
    try {
      const detail = await fn();
      steps.push({ name, status: 'PASS', durationMs: Date.now() - started, ...(detail && { detail }) });
    } catch (error) {
      steps.push({
        name,
        status: 'FAIL',
        durationMs: Date.now() - started,
        error: error.message,
        ...(error.detail && { detail: error.detail })
      });
      throw error;
    }
  }

  async function availableStock() {
    const inventory = expectOk(
      await call('inventory', 'GET', `/api/inventory/${state.productId}`),
      'Inventory lookup'
    );
    return inventory.availableQuantity;
  }

  async function findNotification(type) {
    const notifications = expectOk(
      await call('notifications', 'GET', `/api/notifications/user/${state.userId}`, { token: state.token }),
      'Notification lookup'
    );
    const pattern = new RegExp(`#${state.orderId}\\b`);
    return notifications.find((item) => item.type === type && pattern.test(item.message));
  }

  try {
    if (options.checkReadiness) {
      await step('services_ready', async () => {
        const results = await Promise.all(SERVICES.map(async (service) => {
          const { status } = await call(service, 'GET', '/ready');
          return [service, status];
        }));
        const notReady = results.filter(([, status]) => status !== 200);
        if (notReady.length > 0) {
          throw new StepFailure(`Not ready: ${notReady.map(([s, status]) => `${s} (${status})`).join(', ')}`);
        }
        return { services: results.length };
      });
    }

    await step('login', async () => {
      const user = expectOk(
        await call('users', 'POST', '/api/users/login', {
          body: { email: options.probeEmail, password: options.probePassword }
        }),
        'Probe login'
      );
      state.token = user.token;
      state.userId = user.id;
      return { userId: user.id };
    });

    await step('get_product', async () => {
      const products = expectOk(await call('products', 'GET', '/api/products'), 'Product list');
      const product = products.find((item) => item.sku === PROBE_SKU);
      if (!product) {
        throw new StepFailure(`Probe product ${PROBE_SKU} not found (run npm run seed)`);
      }
      state.productId = product.id;
      return { productId: product.id };
    });

    await step('inventory_before', async () => {
      state.stockBefore = await availableStock();
      if (state.stockBefore < 1) {
        throw new StepFailure('Probe product is out of stock');
      }
      return { available: state.stockBefore };
    });

    await step('create_order', async () => {
      const order = expectOk(
        await call('orders', 'POST', '/api/orders', {
          token: state.token,
          body: { items: [{ productId: state.productId, quantity: 1 }] }
        }),
        'Order creation'
      );
      state.orderId = order.id;
      if (order.status !== 'CONFIRMED') {
        throw new StepFailure(`Order status is ${order.status}, expected CONFIRMED`, { orderId: order.id });
      }
      return { orderId: order.id };
    });

    await step('inventory_reserved', async () => {
      const after = await availableStock();
      if (after !== state.stockBefore - 1) {
        throw new StepFailure(`Available stock ${after}, expected ${state.stockBefore - 1}`);
      }
      return { available: after };
    });

    await step('notification_created', async () => {
      const notification = await findNotification('ORDER_CREATED');
      if (!notification) {
        throw new StepFailure(`No ORDER_CREATED notification for order #${state.orderId}`);
      }
      return { notificationId: notification.id };
    });

    await step('cancel_order', async () => {
      const order = expectOk(
        await call('orders', 'POST', `/api/orders/${state.orderId}/cancel`, { token: state.token }),
        'Order cancellation'
      );
      state.cancelled = true;
      if (order.status !== 'CANCELLED') {
        throw new StepFailure(`Order status is ${order.status}, expected CANCELLED`);
      }
      return { orderId: order.id };
    });

    await step('inventory_released', async () => {
      const after = await availableStock();
      if (after !== state.stockBefore) {
        throw new StepFailure(`Available stock ${after}, expected ${state.stockBefore} after cancel`);
      }
      return { available: after };
    });

    await step('notification_cancelled', async () => {
      const notification = await findNotification('ORDER_CANCELLED');
      if (!notification) {
        throw new StepFailure(`No ORDER_CANCELLED notification for order #${state.orderId}`);
      }
      return { notificationId: notification.id };
    });
  } catch {
    // The failing step is already recorded; fall through to cleanup.
  } finally {
    // Never leave probe stock reserved by a half-finished run.
    if (state.orderId && !state.cancelled) {
      const cleanup = await call('orders', 'POST', `/api/orders/${state.orderId}/cancel`, { token: state.token })
        .catch((error) => ({ status: 0, payload: { error: { message: error.message } } }));
      steps.push({
        name: 'cleanup_cancel_order',
        status: cleanup.status === 200 ? 'PASS' : 'FAIL',
        detail: { orderId: state.orderId, status: cleanup.status }
      });
    }
  }

  const failed = steps.find((s) => s.status === 'FAIL' && s.name !== 'cleanup_cancel_order');
  return {
    runId,
    status: failed ? 'FAIL' : 'PASS',
    failedStep: failed?.name || null,
    startedAt: startedAt.toISOString(),
    finishedAt: new Date().toISOString(),
    durationMs: Date.now() - startedAt.getTime(),
    steps
  };
}

function printHuman(result) {
  for (const s of result.steps) {
    const mark = s.status === 'PASS' ? 'PASS' : 'FAIL';
    const extra = s.error ? `  ${s.error}` : s.detail ? `  ${JSON.stringify(s.detail)}` : '';
    console.log(`${mark}  ${s.name.padEnd(24)} ${String(s.durationMs ?? '').padStart(5)} ms${extra}`);
  }
  console.log(`\n${result.status}  business flow (${result.durationMs} ms, run ${result.runId})`);
}

if (require.main === module) {
  const args = new Set(process.argv.slice(2));
  runBusinessFlow({ checkReadiness: !args.has('--skip-ready') })
    .then((result) => {
      if (args.has('--json')) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        printHuman(result);
      }
      // exitCode, not process.exit(): exiting while fetch sockets are still
      // closing can abort Node on Windows and lose the real exit status.
      process.exitCode = result.status === 'PASS' ? 0 : 1;
    })
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}

module.exports = { runBusinessFlow };

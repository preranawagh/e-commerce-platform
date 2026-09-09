const SERVICE_URLS = {
  users: import.meta.env.VITE_USER_SERVICE_URL || 'http://localhost:3001',
  products: import.meta.env.VITE_PRODUCT_SERVICE_URL || 'http://localhost:3002',
  inventory: import.meta.env.VITE_INVENTORY_SERVICE_URL || 'http://localhost:3003',
  orders: import.meta.env.VITE_ORDER_SERVICE_URL || 'http://localhost:3004',
  notifications: import.meta.env.VITE_NOTIFICATION_SERVICE_URL || 'http://localhost:3005'
};

function getToken() {
  return localStorage.getItem('token');
}

export async function apiRequest(service, path, options = {}) {
  const { method = 'GET', body, auth = true } = options;
  const headers = { 'Content-Type': 'application/json' };
  const token = getToken();

  if (auth && token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${SERVICE_URLS[service]}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!payload || payload.success === false) {
    const message = payload?.error?.message || `Request failed with status ${response.status}`;
    const error = new Error(message);
    error.status = response.status;
    error.details = payload?.error?.details;
    throw error;
  }

  return payload.data;
}

export const userApi = {
  register: (payload) => apiRequest('users', '/api/users/register', { method: 'POST', body: payload, auth: false }),
  login: (payload) => apiRequest('users', '/api/users/login', { method: 'POST', body: payload, auth: false }),
  profile: () => apiRequest('users', '/api/users/profile')
};

export const productApi = {
  list: () => apiRequest('products', '/api/products', { auth: false }),
  get: (id) => apiRequest('products', `/api/products/${id}`, { auth: false }),
  create: (payload) => apiRequest('products', '/api/products', { method: 'POST', body: payload }),
  update: (id, payload) => apiRequest('products', `/api/products/${id}`, { method: 'PUT', body: payload }),
  remove: (id) => apiRequest('products', `/api/products/${id}`, { method: 'DELETE' })
};

export const inventoryApi = {
  get: (productId) => apiRequest('inventory', `/api/inventory/${productId}`, { auth: false }),
  create: (payload) => apiRequest('inventory', '/api/inventory', { method: 'POST', body: payload }),
  update: (productId, payload) => apiRequest('inventory', `/api/inventory/${productId}`, { method: 'PUT', body: payload })
};

function emitNotificationsChanged() {
  window.dispatchEvent(new Event('notifications-changed'));
}

export const orderApi = {
  list: () => apiRequest('orders', '/api/orders'),
  get: (id) => apiRequest('orders', `/api/orders/${id}`),
  create: async (payload) => {
    const data = await apiRequest('orders', '/api/orders', { method: 'POST', body: payload });
    emitNotificationsChanged();
    return data;
  },
  cancel: async (id) => {
    const data = await apiRequest('orders', `/api/orders/${id}/cancel`, { method: 'POST' });
    emitNotificationsChanged();
    return data;
  }
};

export const notificationApi = {
  listForUser: (userId) => apiRequest('notifications', `/api/notifications/user/${userId}`),
  markAsRead: (id) => apiRequest('notifications', `/api/notifications/${id}/read`, { method: 'POST' }),
  markAllAsRead: (userId) => apiRequest('notifications', `/api/notifications/user/${userId}/read-all`, { method: 'POST' })
};

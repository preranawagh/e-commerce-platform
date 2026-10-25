const axios = require('axios');
const { ServiceCommunicationError } = require('./errors');
const { getRequestId } = require('./requestContext');

function createServiceClient(baseUrl, { timeout = 8000 } = {}) {
  if (!baseUrl) {
    throw new Error('Service base URL is required');
  }

  const client = axios.create({
    baseURL: baseUrl,
    timeout,
    headers: { 'Content-Type': 'application/json' }
  });

  // Forward the caller's request id so one order can be traced across services.
  client.interceptors.request.use((config) => {
    const requestId = getRequestId();
    if (requestId && !config.headers['X-Request-Id']) {
      config.headers['X-Request-Id'] = requestId;
    }
    return config;
  });

  client.interceptors.response.use(
    (response) => response,
    (error) => {
      const upstreamMessage = error.response?.data?.error?.message;
      const message = upstreamMessage || error.message || 'Upstream service request failed';
      const statusCode = error.response?.status || 502;
      throw new ServiceCommunicationError(message, statusCode, error.response?.data || null);
    }
  );

  return client;
}

function authHeader(token) {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

module.exports = { createServiceClient, authHeader };

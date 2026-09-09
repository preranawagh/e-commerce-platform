const axios = require('axios');
const { ServiceCommunicationError } = require('./errors');

function createServiceClient(baseUrl, { timeout = 8000 } = {}) {
  if (!baseUrl) {
    throw new Error('Service base URL is required');
  }

  const client = axios.create({
    baseURL: baseUrl,
    timeout,
    headers: { 'Content-Type': 'application/json' }
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

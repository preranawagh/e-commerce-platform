import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Local development: route /api/<service> to the services on their local ports,
// mirroring what nginx (container) and the Ingress (Kubernetes) do.
const apiRoutes = {
  '/api/users': 'http://localhost:3001',
  '/api/products': 'http://localhost:3002',
  '/api/inventory': 'http://localhost:3003',
  '/api/orders': 'http://localhost:3004',
  '/api/notifications': 'http://localhost:3005'
};

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: apiRoutes
  }
});

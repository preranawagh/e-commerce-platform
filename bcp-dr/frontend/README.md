# E-commerce Platform Frontend

React + Bootstrap + React Router client for the local e-commerce platform services.

- URL: http://localhost:5173

## Pages

- Login
- Register
- Dashboard
- Products and product details
- Product management
- Inventory
- Orders
- Create order
- Notifications

## Run locally

```bash
npm install
copy .env.example .env
npm run dev
```

Environment variables:

```
VITE_USER_SERVICE_URL=http://localhost:3001
VITE_PRODUCT_SERVICE_URL=http://localhost:3002
VITE_INVENTORY_SERVICE_URL=http://localhost:3003
VITE_ORDER_SERVICE_URL=http://localhost:3004
VITE_NOTIFICATION_SERVICE_URL=http://localhost:3005
```

The frontend talks to each service directly. There is no API gateway.

Protected pages require a JWT stored in `localStorage` after login or registration.

Role-aware UI:

- CUSTOMER: Dashboard, Products, Orders, Create Order, Notifications
- ADMIN: Dashboard, Products, Manage Products, Inventory, Orders, Notifications

`/products/manage` and `/inventory` are wrapped in `AdminRoute` and redirect customers to the dashboard. Backend authorization still applies.

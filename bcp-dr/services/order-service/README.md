# Order Service

Creates and cancels orders. This service calls Product, Inventory, and Notification services over HTTP.

- Port: `3004`
- Base URL: `http://localhost:3004`

## Run locally

```bash
npm install
copy .env.example .env
npm run dev
```

Required environment:

```
USER_SERVICE_URL=http://localhost:3001
PRODUCT_SERVICE_URL=http://localhost:3002
INVENTORY_SERVICE_URL=http://localhost:3003
NOTIFICATION_SERVICE_URL=http://localhost:3005
INTERNAL_SERVICE_TOKEN=change_me_internal
```

The Order Service sends `X-Internal-Token` when reserving or releasing stock and when creating notifications, so CUSTOMER JWTs cannot write admin inboxes or call Inventory reserve/release directly.

## Endpoints

All order endpoints require `Authorization: Bearer <token>`. The authenticated `userId` always comes from the JWT.

### POST /api/orders

```json
{
  "items": [
    { "productId": 1, "quantity": 2 }
  ]
}
```

Flow:

1. Authenticate the caller
2. Load each product from Product Service
3. Calculate `totalAmount`
4. Reserve stock through Inventory Service
5. Store the order and order items
6. Ask Notification Service to store `ORDER_CREATED` for the customer **and** every ADMIN
7. Return the order as `CONFIRMED`

If a later reserve fails, previously reserved items are released. There is no payment step.

### GET /api/orders

CUSTOMER: own orders only. ADMIN: all orders.

### GET /api/orders/:id

CUSTOMER: own order only (`403` otherwise). ADMIN: any order.

### POST /api/orders/:id/cancel

CUSTOMER: own order only. ADMIN: any customer's order. A cancellation notification is stored for the order owner and every ADMIN, naming which user the order belonged to. The status is changed to `CANCELLED` once, then inventory is released. A second cancel is rejected so reserved stock cannot be released twice. If inventory release fails after the status change, the API returns `502` with an explicit message.

Supported statuses: `PENDING`, `CONFIRMED`, `CANCELLED`. New successful orders are stored as `CONFIRMED`.

## Tests

```bash
npm test
```

HTTP calls to the other services are mocked.

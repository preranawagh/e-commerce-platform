# Inventory Service

Tracks on-hand quantity and reserved quantity for each product.

Available stock is `quantity - reservedQuantity`.

- Port: `3003`
- Base URL: `http://localhost:3003`

## Run locally

```bash
npm install
copy .env.example .env
npm run dev
```

`INTERNAL_SERVICE_TOKEN` must match the Order Service value.

## Endpoints

### GET /api/inventory/:productId

Public. Returns the inventory record, including `availableQuantity`. Customers may use this while browsing.

### POST /api/inventory

ADMIN only. Creates a record for a product.

```json
{
  "productId": 1,
  "quantity": 80
}
```

### PUT /api/inventory/:productId

ADMIN only. Sets on-hand `quantity`. It cannot be set below `reservedQuantity`.

```json
{
  "quantity": 100
}
```

### POST /api/inventory/reserve

Allowed for ADMIN JWTs or the Order Service `X-Internal-Token`. Ordinary CUSTOMER tokens receive `403`.

```json
{
  "productId": 1,
  "quantity": 2
}
```

Insufficient stock returns `400` with message `Insufficient inventory`.

### POST /api/inventory/release

Same authorization as reserve. Decreases `reservedQuantity`.

Reserve and release use a database transaction and a row lock so two overlapping orders cannot oversell the same local stock record.

## Tests

```bash
npm test
```

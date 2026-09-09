# Product Service

Simple product catalog. Read endpoints are public. Create, update, and delete require a JWT **and** the `ADMIN` role.

- Port: `3002`
- Base URL: `http://localhost:3002`

## Run locally

```bash
npm install
copy .env.example .env
npm run dev
```

## Endpoints

### GET /api/products

Returns every product.

### GET /api/products/:id

Returns one product or `404`.

### POST /api/products

ADMIN only.

```json
{
  "name": "Wireless Mouse",
  "description": "Compact wireless mouse",
  "price": 799,
  "sku": "SKU-MOUSE-001"
}
```

Success `201`. Duplicate SKU returns `409`. Price must be greater than 0.

### PUT /api/products/:id

ADMIN only. Same body as create.

### DELETE /api/products/:id

ADMIN only. May fail if other tables still reference the product.

## Tests

```bash
npm test
```

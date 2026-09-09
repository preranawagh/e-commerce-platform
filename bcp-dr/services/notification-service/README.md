# Notification Service

Stores order-related notifications in PostgreSQL. It does not send email or SMS.

- Port: `3005`
- Base URL: `http://localhost:3005`

## Run locally

```bash
npm install
copy .env.example .env
npm run dev
```

## Endpoints

Both roles can view and mark their own inboxes with a JWT. The Order Service may also create notifications with `X-Internal-Token` so an ADMIN receives a copy when a customer places or cancels an order. A CUSTOMER JWT may only create notifications for that customer.

### POST /api/notifications

```json
{
  "userId": 1,
  "type": "ORDER_CREATED",
  "message": "Order #1 was created successfully."
}
```

Allowed types: `ORDER_CREATED`, `ORDER_CANCELLED`.

New records are stored with status `UNREAD`.

### GET /api/notifications/user/:userId

Returns that user's notifications, newest first.

### POST /api/notifications/:id/read

Marks one notification as `READ`. Customers may only update their own.

### POST /api/notifications/user/:userId/read-all

Marks every unread notification for that user as `READ`.

## Tests

```bash
npm test
```

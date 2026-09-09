# User Service

Handles registration, login, and profile lookup. This is the only service that hashes passwords and issues JWT tokens.

- Port: `3001`
- Base URL: `http://localhost:3001`

## Run locally

```bash
npm install
copy .env.example .env
npm run dev
```

Required environment variables are listed in `.env.example`. `JWT_SECRET` must match the other services.

## Endpoints

### POST /api/users/register

```json
{
  "name": "Prerana",
  "email": "prerana@example.com",
  "password": "password123"
}
```

Success `201`:

```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "Prerana",
    "email": "prerana@example.com",
    "token": "<jwt>"
  }
}
```

The password is never returned. Duplicate emails return `409`. Registration always creates `role: "CUSTOMER"`. A client-supplied `role` field is ignored.

Login and profile also return `role`. JWT payload is `{ userId, role }`.

### POST /api/users/login

```json
{
  "email": "prerana@example.com",
  "password": "password123"
}
```

Invalid credentials return `401`.

### GET /api/users/profile

Header: `Authorization: Bearer <token>`

Returns the authenticated user without a password.

### GET /api/users/admins

Internal/admin only (`X-Internal-Token` or ADMIN JWT). Returns admin accounts without passwords so Order Service can notify them.

### GET /api/users/:id

Internal/admin only. Returns that user without a password.

## Tests

```bash
npm test
```

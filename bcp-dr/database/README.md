# Database

Local PostgreSQL schema for CloudResilience.

## Tables

- `users`
- `products`
- `inventory`
- `orders`
- `order_items`
- `notifications`

Foreign keys, unique constraints, and indexes are defined in `migrations/`.

## Commands

From the repository root, after copying `.env.example` to `.env`:

```bash
npm run migrate
npm run seed
```

Or both:

```bash
npm run db:setup
```

Create the empty database first:

```sql
CREATE DATABASE cloudresilience;
```

## Seed accounts

Password for every seeded user: `Password123!`

| Email | Role |
| --- | --- |
| admin@example.com | ADMIN |
| alice@example.com | CUSTOMER |
| bob@example.com | CUSTOMER |
| carol@example.com | CUSTOMER |
| dave@example.com | CUSTOMER |
| eve@example.com | CUSTOMER |

The seeder also creates 10 products, matching inventory rows, a few orders, and example notifications.

`users.role` is added by migration `20240908000001-add-user-role.js`. Do not edit the original create-users migration.

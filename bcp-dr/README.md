# CloudResilience

Local application foundation for a university minor project. A production-grade BCDR/resilience architecture on Google Cloud will be added later. This repository is the **application workload only**: a simple order-management system split into five backend services and a React frontend, now with basic RBAC.

This codebase is intended to run on a developer machine with Node.js and PostgreSQL. Infrastructure, containers, Google Cloud, Kubernetes, Terraform, CI/CD, backups, and disaster recovery are intentionally not included.

## Architecture

Five independently started Node/Express services plus a React client. There is no API gateway and no monolith. Security checks (JWT, RBAC, Helmet, CORS, validation) live in each service through the shared helper library; they do not combine the services into one process.

```text
                              React frontend :5173
                                        |
        +---------------+-------+-------+--------+----------------+
        |               |       |                |                |
        v               v       v                v                v
   User Service   Product Svc  Inventory Svc  Order Service  Notification
      :3001          :3002        :3003          :3004           :3005
                                                |  |
                         REST GET product  <----+  |
                         REST reserve/release <----+----> Inventory :3003
                         REST create notification -------> Notification :3005

        Each service owns its own models and listens on its own port.
        Local PostgreSQL holds the tables. Services do not query each
        other's tables; Order talks to Product, Inventory, and
        Notification over HTTP.
```

### Service relationships

- **User Service** (`:3001`) owns `users`. It hashes passwords and issues JWT tokens `{ userId, role }`. Other services validate the same local `JWT_SECRET`; they do not read the users table.
- **Product Service** (`:3002`) owns `products`. Writes are ADMIN-only. Order Service loads prices with `GET /api/products/:id`.
- **Inventory Service** (`:3003`) owns `inventory`. Customers may read availability. Creates/updates are ADMIN-only. Reserve/release are allowed for ADMIN or the Order Service via `X-Internal-Token`.
- **Order Service** (`:3004`) owns `orders` and `order_items`. It is the orchestrator: HTTP to Product, then Inventory reserve, then persist the order, then HTTP to Notification.
- **Notification Service** (`:3005`) owns `notifications`. CUSTOMER and ADMIN can both use it. A CUSTOMER can only read their own. An ADMIN can read their own inbox in the UI and, on the API, create or list notifications for any user (used when cancelling another customer's order).
- **Frontend** calls all five service URLs directly (`VITE_*_SERVICE_URL`). It does not proxy through Order Service.
- `@cloudresilience/shared` is a helper package (JWT, errors, Helmet/CORS bootstrap). It is not a sixth runtime service.
- Persistent state lives in PostgreSQL, not in local files.

## Local ports

| App | URL |
| --- | --- |
| Frontend | http://localhost:5173 |
| User Service | http://localhost:3001 |
| Product Service | http://localhost:3002 |
| Inventory Service | http://localhost:3003 |
| Order Service | http://localhost:3004 |
| Notification Service | http://localhost:3005 |

## Roles

Exactly two roles exist:

| Role | How it is created |
| --- | --- |
| `CUSTOMER` | Public registration, and most seed users |
| `ADMIN` | Seed data / database administration only |

A registration request cannot set `role: "ADMIN"`. The backend always stores `CUSTOMER`.

### CUSTOMER can

- Register and log in
- Browse products and see available stock
- Create an order
- List, view, and cancel **their own** orders
- View **their own** notifications

### ADMIN can

- Manage products (create, update, delete)
- Manage inventory (create/update on-hand quantity)
- View **all** orders
- Browse the catalog
- View **their own** notifications

Frontend route hiding is UX only. Every privileged API is enforced on the backend.

## Prerequisites

1. Node.js 18+ (Node 25 is fine)
2. npm
3. PostgreSQL 14+ running locally

## First-time setup

1. Create a local database:

```sql
CREATE DATABASE cloudresilience;
```

2. Copy environment files:

```bash
copy .env.example .env
copy frontend\.env.example frontend\.env
```

On macOS/Linux use `cp` instead of `copy`.

3. Edit `.env` and set your local PostgreSQL username/password. The example value `change_me` is a placeholder. Keep `JWT_SECRET` and `INTERNAL_SERVICE_TOKEN` the same across services.

4. Install dependencies:

```bash
npm run install:all
```

5. Run migrations and seed data:

```bash
npm run db:setup
```

If you already have an older local database, run `npm run migrate` to add the `users.role` column. For a clean demo dataset, recreate the database and run `npm run db:setup`.

6. Start every service and the frontend:

```bash
npm run dev
```

Open http://localhost:5173

You can also start one service at a time:

```bash
npm run dev:user
npm run dev:product
npm run dev:inventory
npm run dev:order
npm run dev:notification
npm run dev:frontend
```

## Demo credentials

All seeded users use the same development password: `Password123!`

| Name | Email | Role |
| --- | --- | --- |
| Admin User | admin@example.com | ADMIN |
| Alice Student | alice@example.com | CUSTOMER |
| Bob Student | bob@example.com | CUSTOMER |
| Carol Student | carol@example.com | CUSTOMER |
| Dave Student | dave@example.com | CUSTOMER |
| Eve Student | eve@example.com | CUSTOMER |

These are fake local-development accounts only.

## Typical flows

Customer: register/login → dashboard → browse products → create order → inventory reserved → view own order → cancel → inventory released → notification stored.

Admin: login → admin dashboard → manage products → manage inventory → view all orders → view notifications.

A customer cannot access another customer's order, manage products, manipulate inventory, self-register as ADMIN, or open admin UI routes.

## Tests

```bash
npm test
```

Service tests use an in-memory SQLite database so they can run without PostgreSQL. Order Service tests mock Product, Inventory, and Notification HTTP calls.

## Environment variables

See `.env.example` at the repository root and each service’s own `.env.example`. Do not commit real `.env` files.

`INTERNAL_SERVICE_TOKEN` is a local shared secret so the Order Service can reserve/release stock without giving that power to ordinary CUSTOMER JWTs.

## What this repository does not include

Docker, docker-compose, Kubernetes, Terraform, Google Cloud, CI/CD, Redis, Kafka, API gateways, backups, failover, chaos engineering, or BCDR automation. Those are later project phases.

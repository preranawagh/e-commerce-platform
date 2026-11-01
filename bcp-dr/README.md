# CloudResilience

An Infrastructure-as-Code based **Business Continuity and Disaster Recovery (BCDR) framework** for a multi-zone microservices application. CloudResilience coordinates existing recovery mechanisms (Kubernetes, managed PostgreSQL HA/PITR, Terraform), validates that the application and its business workflow actually work after a failure, and measures RTO, RPO, downtime and data loss.

This folder contains the protected application (five Node/Express services and a React frontend with RBAC) and, as the project progresses, the infrastructure, Kubernetes manifests and the BCDR controller.

## Project status and documents

| Phase | Status |
|---|---|
| 1. Existing-solution study (literature review, Patroni experiment, scope freeze) | ✅ Complete |
| 2. Application (local) + BCDR hardening (readiness, graceful shutdown, structured logs, e2e business flow) | ✅ Complete |
| 3. Containers (Dockerfiles, Compose stack, image scanning) | ✅ Complete — see [Run with Docker](#run-with-docker) |
| 4. Kubernetes (local kind cluster, Gateway API, network policies, self-healing baseline) | ✅ Complete — see [Run on Kubernetes](#run-on-kubernetes-kind) |
| 5–10. GCP/Terraform, BCDR controller, validation, metrics, scenarios, evaluation | ⬜ Planned |

| Document | Purpose |
|---|---|
| [PROJECT_ROADMAP.md](PROJECT_ROADMAP.md) | Master plan: phases, tasks, definitions of done, decision log |
| [docs/decisions/0001-scope.md](docs/decisions/0001-scope.md) | Frozen project scope, mandatory scenarios, target platform |
| [docs/decisions/0002-repository-root.md](docs/decisions/0002-repository-root.md) | Why the git root is the parent folder |
| [docs/literature-review/existing-solutions.md](docs/literature-review/existing-solutions.md) | Comparison of existing recovery solutions and the identified gap |
| [experiments/patroni/README.md](experiments/patroni/README.md) | Patroni PostgreSQL HA experiment with measured failover results |

### Repository layout

```text
bcp-dr/
├── services/          five backend services (user, product, inventory, order, notification)
├── shared/            helper library used by every service (not a runtime service)
├── frontend/          React + Vite client
├── database/          migrations, seeders, setup runner
├── experiments/
│   └── patroni/       completed PostgreSQL HA experiment (Docker Compose lab + drills)
├── docker/            Compose stack for the whole app
├── kubernetes/        Kustomize manifests (per-service folders, base, gateway, network policies, overlays)
├── scripts/           e2e business flow and the Kubernetes recovery baseline
├── docs/              decisions, literature review and recorded evidence
└── PROJECT_ROADMAP.md
```

The sections below describe the application as it runs locally today: Node.js and a PostgreSQL database on a developer machine.

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
- **Frontend** calls same-origin paths (`/api/users`, `/api/orders`, …). The web server in front of it routes each prefix to its service: the Vite dev proxy locally, nginx in the container, the Ingress in Kubernetes. It does not go through Order Service. `VITE_*_SERVICE_URL` can still point a service at another origin.
- `@cloudresilience/shared` is a helper package (JWT, errors, Helmet/CORS bootstrap). It is not a sixth runtime service.
- Persistent state lives in PostgreSQL, not in local files.

## Local ports

| App | URL |
| --- | --- |
| Frontend (`npm run dev`; proxies `/api/*` to the services) | http://localhost:5173 |
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
```

On macOS/Linux use `cp` instead of `copy`. The frontend needs no `.env` (its dev server proxies `/api/*`); `frontend/.env.example` lists the optional overrides.

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

Service tests use an in-memory SQLite database so they can run without PostgreSQL. Order Service tests mock Product, Inventory, and Notification HTTP calls. Health, readiness, request-id and graceful-shutdown behaviour (shared by all services) is tested in `services/user-service/tests/lifecycle.test.js`.

Lint the backend (services, shared library, database scripts, tooling):

```bash
npm run lint
```

### End-to-end business flow

With all five services running against a database that has been through `npm run db:setup`:

```bash
npm run e2e
```

This runs the complete business transaction through the real services as a synthetic probe customer: all services ready → login → product → inventory → create order → stock reserved → notification stored → cancel order → stock released → cancellation notification. It prints each step with its timing and exits `0` on PASS, `1` on FAIL (`--json` for machine-readable output, `--skip-ready` to skip the readiness step). The probe user and the `BCDR Probe Item` product are created by the `bcdr-probe` seeder from `BCDR_PROBE_EMAIL` / `BCDR_PROBE_PASSWORD`; every probe order is cancelled, so real stock is never touched. Each probe order also adds two notifications to the admin inbox.

This script is the starting point of the BCDR controller's business-level validator.

## Health, readiness, logs and shutdown

Every service exposes:

| Endpoint | Meaning | Status codes |
| --- | --- | --- |
| `GET /health` | Liveness: the process is up. Never touches the database. | 200 |
| `GET /ready` | Readiness: the database answers within `READY_CHECK_TIMEOUT_MS` and the service is not shutting down. | 200 ready, 503 not ready |

- **Logs** are one JSON object per line on stdout (pino), with `time`, `service`, `severity` (Cloud Logging compatible) and `requestId`. Authorization headers and the internal token are redacted.
- **Request ids:** each request gets an `X-Request-Id` (or keeps a valid incoming one), returned in the response and forwarded on Order Service's calls to the other services, so one order can be followed through all five logs.
- **Graceful shutdown:** on `SIGTERM`/`SIGINT` a service reports not ready, stops accepting connections, finishes in-flight requests, closes its database pool and exits within `SHUTDOWN_TIMEOUT_MS`.
- **Database pool** fails fast during an outage (`DB_POOL_ACQUIRE_MS`, default 10 s) and reconnects on its own once the database is back — no restart needed after a failover.

## Environment variables

See `.env.example` at the repository root and each service’s own `.env.example`. Do not commit real `.env` files.

`INTERNAL_SERVICE_TOKEN` is a local shared secret so the Order Service can reserve/release stock without giving that power to ordinary CUSTOMER JWTs.

Database TLS (`DB_SSL`), pool sizing, log level, readiness timeout, shutdown timeout and the probe account are documented inline in `.env.example`. `npm run migrate:undo` reverts the most recent migration.

## Running against the Patroni HA lab

The services can use the Patroni cluster from [experiments/patroni](experiments/patroni/) instead of a local PostgreSQL. Point `DB_PORT=5000` and `DB_PASSWORD=postgres1` at its HAProxy write endpoint; see [PATRONI_BCP_TESTING.md](experiments/patroni/PATRONI_BCP_TESTING.md).

## Run with Docker

Everything — PostgreSQL, migrations, the five services and the frontend — runs from one Compose file. Only Docker is needed.

```bash
cd docker
cp .env.example .env        # set every change_me value (git-ignored)
docker compose up -d --build --wait
```

| What | Where |
| --- | --- |
| Web app (nginx) | http://localhost:8088 (`FRONTEND_PORT` in `docker/.env`) |
| Services (for tests/debugging) | 127.0.0.1:3001–3005 |

Startup order is enforced: `postgres` healthy → `migrate` applies migrations and seeds, then exits → services start → frontend. Then, from `bcp-dr/`:

```bash
npm run e2e:docker          # business flow against the containers (reads docker/.env)
```

Stop with `docker compose down` (keeps the database volume) or `docker compose down -v` (deletes it).

**Images** (`cloudresilience/<name>:local`, built from the `bcp-dr/` root because services depend on `shared/`):

| Image | Dockerfile | Notes |
| --- | --- | --- |
| 5 services | `services/<name>/Dockerfile` | `node:24.22-alpine`, production deps only, runs as `node` with read-only app files, `tini` as PID 1, `HEALTHCHECK` on `/health` |
| `migrate` | `database/Dockerfile` | One-shot: `setup` (default), `migrate`, `seed` or `undo` |
| `frontend` | `frontend/Dockerfile` | Vite build served by unprivileged nginx on 8080; routes `/api/<service>` to each service, re-resolving names every 10 s so recreated containers are found |

Containers run with a read-only filesystem, all Linux capabilities dropped, `no-new-privileges`, and memory/CPU limits.

**Against the Patroni HA lab instead of the local postgres container:**

```bash
(cd ../experiments/patroni && docker compose up -d --wait)
docker compose -f docker-compose.yml -f docker-compose.patroni.yml up -d --build --wait
```

The probe account then lives in the Patroni database, created with whichever `BCDR_PROBE_PASSWORD` was used when it was first seeded there. If you seeded it from the host, check with `npm run e2e` rather than `npm run e2e:docker`.

## Run on Kubernetes (kind)

A local cluster with one control plane and three workers, each labelled as its own zone (`zone-a`, `zone-b`, `zone-c`). Needs Docker, [kind](https://kind.sigs.k8s.io/) and kubectl.

**1. Cluster and images** (from `bcp-dr/`, after the Docker images are built):

```bash
kind create cluster --config kubernetes/kind-cluster.yaml
for i in user-service product-service inventory-service order-service notification-service migrate frontend; do kind load docker-image cloudresilience/$i:local --name cloudresilience; done
```

**2. Cluster add-ons** (third-party, installed once per cluster, not part of the app's manifests):

```bash
kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/download/v0.9.1/components.yaml
kubectl patch deployment metrics-server -n kube-system --type=json -p '[{"op":"add","path":"/spec/template/spec/containers/0/args/-","value":"--kubelet-insecure-tls"}]'
kubectl apply --server-side -f https://github.com/envoyproxy/gateway/releases/download/v1.9.3/install.yaml
kubectl wait --timeout=5m -n envoy-gateway-system deployment/envoy-gateway --for=condition=Available
```

metrics-server feeds the autoscalers; Envoy Gateway is the Gateway API controller that runs the front door.

**3. Secret** (random values, never written to a file):

```bash
kubectl create namespace cloudresilience
kubectl create secret generic app-secrets -n cloudresilience   --from-literal=DB_PASSWORD=$(openssl rand -hex 24) --from-literal=JWT_SECRET=$(openssl rand -hex 32)   --from-literal=INTERNAL_SERVICE_TOKEN=$(openssl rand -hex 32) --from-literal=BCDR_PROBE_PASSWORD=$(openssl rand -hex 16)
```

**4. Application:**

```bash
kubectl apply -k kubernetes/overlays/local
kubectl get pods -n cloudresilience -o wide
```

Open http://localhost:8090. The Gateway routes `/api/<service>` to each service and everything else to the frontend.

| Folder | Contents |
| --- | --- |
| `kubernetes/<service>/`, `kubernetes/frontend/` | ServiceAccount, Deployment (2 replicas spread over zones, probes, hardened `securityContext`), Service, HPA (2–4 pods at 70% CPU), PodDisruptionBudget |
| `kubernetes/base/` | Namespace, ConfigMap, migration Job; pulls in every folder |
| `kubernetes/gateway/` | GatewayClass, Gateway and HTTPRoute |
| `kubernetes/network-policies/` | Default deny; only the paths the app needs are allowed |
| `kubernetes/overlays/local/` | In-cluster PostgreSQL (laptop only) and the kind NodePort for the Gateway |

**Self-healing baseline** (what Kubernetes does without the BCDR controller):

```bash
node scripts/k8s-baseline.js pod-delete
node scripts/k8s-baseline.js bad-image
node scripts/k8s-baseline.js node-stop
```

Results are appended to [docs/evidence/phase4-baseline/results.jsonl](docs/evidence/phase4-baseline/).

## Not built yet

Terraform/GCP infrastructure, CI/CD and the BCDR controller are later phases. See [PROJECT_ROADMAP.md](PROJECT_ROADMAP.md). Redis, Kafka, API gateways and multi-region DR are out of scope ([decision 0001](docs/decisions/0001-scope.md)).

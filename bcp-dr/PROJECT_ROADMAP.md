# CloudResilience — Project Roadmap & Development Reference

> **Purpose of this file.** Single source of truth for *what* we are building, *where we are*, and *what comes next*.
> Read it before starting any work session; tick boxes and append to the Decision Log as work lands.
>
> - Blueprint: `D:\bcdr project bp 2.pdf` ("CloudResilience: IaC-Based BCDR Framework for a Multi-Zone Microservices Application")
> - Last reviewed against the codebase: **2026-11-01** (commit `32043a4` + uncommitted Phase 4 work) — **Phases 1–4 complete**
> - Frozen scope: [docs/decisions/0001-scope.md](docs/decisions/0001-scope.md)

---

## 0. Project in One Paragraph

CloudResilience is a **lightweight, application-aware BCDR control layer**. It does *not* replace Kubernetes self-healing, Cloud SQL HA/PITR, Patroni, Velero or Terraform. It **coordinates** them around one microservices application and then proves recovery happened at three levels — **infrastructure recovered → application recovered → business recovered** — recording standardized **RTO, RPO, downtime and data-loss** evidence in an incident report.

```
Failure → Detection → Classification → Recovery Policy → Runbook Execution → Recovery Tracking
        → Application Validation → Business Transaction Validation → RTO/RPO/Downtime/Data Loss → Incident Report
```

**Contribution = COORDINATION + APPLICATION-AWARE VALIDATION + MEASUREMENT + REPRODUCIBLE EXPERIMENTS.**

### Ground rules (from the blueprint — do not drift)

1. **App first, BCDR second.** Build → containerize → deploy → verify normal operation → *only then* build the controller.
2. **Don't rebuild existing mechanisms.** Kubernetes heals pods; Cloud SQL fails over; Terraform rebuilds infra. The controller *invokes or observes* them.
3. **Deterministic classifier.** Rules/policy tables only. **No AI/ML** in this project (future work).
4. **One scenario end-to-end before the next.** Pod failure first, fully measured, then expand.
5. **Patroni is a finished experiment**, not the project. Document it, park it under `experiments/patroni/`, move on. Final GCP design uses **Cloud SQL**.
6. **A recovery is only `RECOVERED` after the business transaction passes.** "All pods Running" is not success.
7. **Security is built in at each phase**, not bolted on at the end.

---

## 1. Current State Assessment (as of 2026-10-21)

### 1.1 Overall position on the blueprint timeline

```
Literature review ✅ → Patroni setup ✅ → Patroni failover testing ✅ → Patroni documented ✅ → Scope frozen ✅
→ Microservices application ✅ (local) → BCDR hardening ✅ (readiness, shutdown, logs, e2e business flow)
→ Docker ✅ → Kubernetes ✅ → GCP/Terraform ⬜  ◀── YOU ARE HERE (Phase 5) → Cloud SQL + PITR ⬜
→ BCDR Controller ⬜ → First scenario ⬜ → Validator ⬜ → Metrics/Reports ⬜
→ More scenarios ⬜ → Experiments & evaluation ⬜
```

### 1.2 What exists and works

| Area | Status | Notes |
|---|---|---|
| 5 Node/Express services (`services/*-service`) | ✅ Done | User :3001, Product :3002, Inventory :3003, Order :3004, Notification :3005 |
| Shared lib (`shared/`) | ✅ Done | Helmet, CORS, JWT auth, RBAC, validation, errors, HTTP client, `/health` |
| Business workflow | ✅ Done | Login → product → inventory reserve → order (DB txn) → notification. Order Service orchestrates over REST, releases stock on failure |
| RBAC | ✅ Done | `CUSTOMER` / `ADMIN`; internal calls use `X-Internal-Token` |
| React frontend (`frontend/`, Vite) | ✅ Done | Calls each service URL directly via `VITE_*_SERVICE_URL` (build-time) |
| DB migrations + seeders | ✅ Done | 7 migrations, demo seed; new `database/runSetup.js` runner (uncommitted) |
| Unit/integration tests | ✅ **50/50 passing** | Jest + supertest, in-memory SQLite, Order tests mock HTTP deps |
| Patroni HA lab | ✅ Done (uncommitted) | etcd + 2× Spilo (PG15/Patroni) + HAProxy :5000; drills A–D documented in `PATRONI_BCP_TESTING.md` |
| Local tooling | ⚠️ Partial | Node 25, Docker 29, kubectl 1.36 installed. **Terraform and gcloud not installed** |

### 1.3 Gaps & issues found in the existing code

| # | Finding | Why it matters for BCDR | Fix in phase |
|---|---|---|---|
| G1 | ~~`/health` returns `ok` unconditionally; no DB-aware readiness endpoint~~ | ✅ Resolved 2026-10-25 — `/ready` checks the DB | P2 |
| G2 | ~~No SIGTERM / graceful shutdown in `server.js`~~ | ✅ Resolved 2026-10-25 — `shared/startServer.js` | P2 |
| G3 | ~~Logs are plain `console.log`, no timestamps/JSON/request IDs~~ | ✅ Resolved 2026-10-25 — pino JSON logs with request ids | P2 |
| G4 | Notification failures are swallowed (`console.error`) in `orderService.notifyOrderEvent` | An order can "succeed" without a notification — the business validator **must** check the notification explicitly | P7 (validator) |
| G5 | ~~Frontend bakes absolute service URLs at build time~~ | ✅ Resolved 2026-10-26 — same-origin `/api/...` paths | P3 |
| G6 | ~~No end-to-end (cross-service) test of the full transaction~~ | ✅ Resolved 2026-10-25 — `scripts/e2e-business-flow.js` (`npm run e2e`) | P2 |
| G7 | ~~No dedicated synthetic probe user/product~~ | ✅ Resolved 2026-10-25 — `bcdr-probe` seeder | P2 |
| G8 | ~~`migrate:undo` still uses `sequelize-cli` while `migrate`/`seed` now use `runSetup.js`~~ | ✅ Resolved 2026-10-25 — `runSetup.js undo` | P2 |
| G9 | ~~`Dockerfile` (custom Patroni image) and `patroni-node1/2.yml` are **not used** by `docker-compose.yml` (which uses Spilo + `SPILO_CONFIGURATION`)~~ | ✅ Resolved 2026-10-22 — archived in `experiments/patroni/unused-custom-image/` | P1 |
| G10 | ~~`docker-compose.yml` at the project root is Patroni-only~~ | ✅ Resolved 2026-10-22 — moved to `experiments/patroni/` | P1 |
| G11 | ~~Root `README.md` says "Docker, K8s, Terraform … intentionally not included"~~ | ✅ Resolved 2026-10-24 — README rewritten with status, documents and layout | P1 |
| G12 | ~~Git root is `e-commerce-platform/`, project lives in `bcp-dr/`; root `package.json` deleted (uncommitted)~~ | ✅ Resolved 2026-10-24 — D1 = keep git root ([0002](docs/decisions/0002-repository-root.md)); root `package.json` stays deleted; pointer `README.md` added at git root | P1 |
| G13 | Order creation is a cross-service saga without durable compensation | If Order crashes after reserve but before commit, stock stays reserved. Acceptable for scope; **document as a known limitation** and watch for it in data-loss analysis | P10 (docs) |
| G14 | ~~No linting (ESLint)~~ | ✅ Backend resolved 2026-10-25 (`npm run lint`); frontend still unlinted → P3/CI | P3/CI |

---

## 2. Target Repository Layout

Blueprint §26 layout mapped onto the current code. **Keep existing service folder names** (`user-service` etc.) — renaming buys nothing and churns imports/scripts.

```
bcp-dr/                              (= "CloudResilience/")
├── services/                        ✅ exists
│   ├── user-service/  product-service/  inventory-service/  order-service/  notification-service/
│   │   └── Dockerfile               ⬜ P3
├── shared/                          ✅ exists (helper lib, not a runtime service)
├── frontend/                        ✅ exists  (+ Dockerfile, nginx.conf ⬜ P3)
├── database/                        ✅ exists (migrations, seeders, runSetup.js)
├── experiments/
│   └── patroni/                     ⬜ P1 — move docker-compose.yml, haproxy.cfg, PATRONI_BCP_TESTING.md here
├── docker/                          ⬜ P3 — docker-compose.yml for the full app stack
├── kubernetes/                      ⬜ P4 — Kustomize
│   ├── base/   (namespace, configmap, secrets template, networkpolicies, migration job)
│   ├── user/ product/ inventory/ order/ notification/ frontend/   (deployment, service, hpa, pdb)
│   ├── ingress/
│   └── overlays/ local/  gke/
├── terraform/                       ⬜ P5
│   ├── modules/ network/ gke/ cloudsql/ storage/ artifact-registry/ secret-manager/ monitoring/ iam/
│   ├── environments/dev/            (main.tf, variables.tf, terraform.tfvars, backend.tf)
├── bcdr/                            ⬜ P6–P9
│   ├── controller/ detector/ classifier/ policy/ executor/ tracker/ validator/ metrics/ reporter/
│   ├── adapters/  kubernetes/ cloudsql/ terraform/      (thin wrappers around real mechanisms)
│   ├── runbooks/  pod_failure.yaml node_failure.yaml bad_deployment.yaml db_failure.yaml data_restore.yaml infrastructure_failure.yaml
│   ├── scenarios/ pod_failure/ node_failure/ bad_deployment/ db_failure/ data_restore/ infrastructure_failure/
│   ├── probes/    availability prober + write-ack load generator (for downtime & data loss)
│   ├── reports/   (generated JSON/Markdown incident reports — gitignored except samples)
│   └── cli.js     (`bcdr simulate <scenario>`, `bcdr report`, `bcdr validate`)
├── scripts/                         ⬜ P2 — e2e smoke test, helpers
├── docs/
│   ├── architecture/  literature-review/  runbooks/  experiments/  decisions/
└── PROJECT_ROADMAP.md               ← this file
.github/workflows/                   ⬜ at the *git* root (see decision D1)
```

---

## 3. Phase Plan

Each phase lists **tasks**, **deliverables**, and a **Definition of Done (DoD)**. Do not start a phase until the previous phase's DoD holds (except where noted as parallelizable).

Suggested 12-week schedule (blueprint §28: three months). Week 1 = week of 2026-10-26.

| Week | Phase(s) |
|---|---|
| 1 | P1 wrap-up + P2 hardening |
| 2 | P3 Containerization |
| 3 | P4 Kubernetes (local cluster) |
| 4–5 | P5 GCP via Terraform + Cloud SQL/PITR |
| 6 | P6 Controller skeleton + Scenario 1 (pod failure) end-to-end |
| 7 | P7 Application Validator (5 levels) |
| 8 | P8 Metrics + Reporter; Scenario 1 repeated & measured |
| 9–10 | P9 Scenarios 2–5 (node, bad deploy, DB availability, PITR) |
| 11 | P9 Scenario 6 (infra loss) — *only if 1–5 are solid* + CI/security completion |
| 12 | P10 Evaluation, analysis, final documentation |

---

### Phase 1 — Existing Solution Study (wrap-up) · ✅ *complete 2026-10-24 (git commit pending)*

**Tasks**
- [ ] Commit the current uncommitted work (Patroni lab, `runSetup.js`, `.sequelizerc`, `.dockerignore`) — ideally on a branch.
- [x] Decide repo layout (**D1**) and resolve the deleted root `package.json`. *(2026-10-24 — keep `e-commerce-platform/` as git root; [decision 0002](docs/decisions/0002-repository-root.md))*
- [x] Create `experiments/patroni/` and move: `docker-compose.yml`, `haproxy.cfg`, `PATRONI_BCP_TESTING.md`. *(2026-10-22; guide paths updated, `experiments/` added to `.dockerignore`)*
- [x] Delete or archive the unused `Dockerfile` (custom Patroni image) and `patroni-node1.yml` / `patroni-node2.yml`, **or** document them as "alternative non-Spilo setup, not used" (G9). *(archived in `experiments/patroni/unused-custom-image/`)*
- [x] Write `experiments/patroni/README.md` covering (blueprint §24): Architecture · Configuration · PostgreSQL replication · Failover mechanism · Failure simulation (drills A–D) · Observed recovery · **Measured recovery time (record actual numbers from drill C/D)** · Limitations. *(2026-10-22 — 8 automated runs via `scripts/run-drills.sh`: graceful stop write-RTO ≈ 7 s, crash ≈ 33 s, isolation ≈ 28 s, 0 of 405 acked writes lost, no split-brain)*
- [x] Add a comparison table of existing solutions (Patroni, repmgr, Velero, Kasten, AWS DRS, Azure Site Recovery, Veeam, Terraform, K8s) → `docs/literature-review/`. *(2026-10-24 — [existing-solutions.md](docs/literature-review/existing-solutions.md), 11 solutions incl. Masakari and Google Cloud Backup and DR from the presentation; reference column left for citations)*
- [x] Write the **scope freeze** statement → `docs/decisions/0001-scope.md` (what is in/out; mandatory vs. optional scenarios). *(2026-10-24 — scenarios 1–4 mandatory, 5 recommended, 6 stretch; GCP primary with VM-based fallback)*
- [x] Update root `README.md` (G11). *(2026-10-24)*
- [x] *(extra)* Second independent drill batch (2026-10-23) merged into the Patroni README — 16 runs total, 0 of 772 acknowledged writes lost.

**DoD:** Patroni experiment is self-contained under `experiments/patroni/` with recorded numbers; scope is frozen in writing; working tree is clean.

---

### Phase 2 — Application hardening for BCDR · ✅ *complete 2026-10-25 (plain-PostgreSQL e2e run and git commit pending)*

**Tasks**
- [x] **G1** Add to `shared/createApp.js` (or a helper) two endpoints in every service:
  - `GET /health` (liveness) — process alive, no dependencies.
  - `GET /ready` (readiness) — `sequelize.authenticate()` succeeds (with short timeout); returns 503 otherwise.
  *(2026-10-25 — `shared/health.js`; also 503 while shutting down; verified live: all 5 return 503 within ~10 ms when the DB is unreachable, 200 again without restart)*
- [x] **G2** Graceful shutdown in every `server.js`: on `SIGTERM` stop accepting connections, finish in-flight requests, close the Sequelize pool, exit (timeout < K8s `terminationGracePeriodSeconds`). *(2026-10-25 — `shared/startServer.js`, `SHUTDOWN_TIMEOUT_MS` default 10 s; unit-tested, and verified in a Linux container: `docker stop` → shutdown complete in 15 ms, exit code 0)*
- [x] **G3** Structured JSON logging (e.g. `pino` + `pino-http`) with ISO timestamps, service name, `requestId`; propagate `X-Request-Id` through `shared/httpClient.js`. *(2026-10-25 — pino 9 + pino-http 10, Cloud Logging `severity`, AsyncLocalStorage request context, auth/internal-token redaction; one order traced across all 5 services in live logs)*
- [x] Make `DB_HOST/PORT/USER/PASSWORD/NAME`, service URLs, ports, `JWT_SECRET`, `INTERNAL_SERVICE_TOKEN` all purely env-driven (already mostly true — verify nothing else is hardcoded). Add `DB_SSL` option for Cloud SQL. *(2026-10-25 — only localhost dev fallbacks remain; `DB_SSL`, `DB_POOL_MAX`, `DB_POOL_ACQUIRE_MS` (fail fast, default 10 s) added)*
- [x] **G7** Seed a dedicated **probe identity**: `bcdr-probe@example.com` (CUSTOMER) and a `BCDR Probe Item` product with very large stock. Validator orders use only these and cancel themselves afterward. *(seeder `20261025000001-bcdr-probe.js`, idempotent, stock 1 000 000)*
- [x] **G6** Write `scripts/e2e-business-flow.js`: login → GET product → GET inventory (before) → POST order → GET inventory (after, verify decrement) → GET notifications (verify `ORDER_CREATED` for that order) → cancel order (verify stock released). Exit code 0/1 + JSON timing output. **This file is later reused as the Level-5 validator.** *(2026-10-25 — 10 steps incl. readiness and cancellation notification; exports `runBusinessFlow()`; always cancels its order)*
- [x] **G8** Make `migrate:undo` consistent with `runSetup.js` (add an `undo` command) or document the mix. *(`node database/runSetup.js undo`)*
- [x] Add ESLint (G14) with a minimal shared config. *(ESLint 9 flat config, backend only; `npm run lint` clean. Frontend linting deferred to Phase 3/CI — needs React rules)*

**DoD:** `npm test` green; `scripts/e2e-business-flow.js` passes against a locally running stack (against both plain PostgreSQL and the Patroni HAProxy :5000); `/ready` returns 503 when DB is stopped and 200 when it returns.

**Verification (2026-10-25):**
- [x] `npm test` — 58/58 (50 existing + 8 lifecycle tests); `npm run lint` clean.
- [x] e2e PASS against the Patroni HAProxy :5000 (10 steps, ~1 s); exit code 1 when the DB is unreachable, 0 after it returns.
- [x] `/ready` → 503 on all five services with the DB unreachable (`ECONNREFUSED`), 200 again **without restarting** any service.
- [x] Bonus: Patroni leader crashed (`docker kill`) under the running app → business flow PASS again **28 s** after the crash, no service restart (matches Patroni's ~30 s crash failover).
- [ ] e2e against plain local PostgreSQL (:5432) — needs the owner's local DB password; run `npm run db:setup` + `npm run e2e` with `.env` pointed at 5432.

---

### Phase 3 — Containerization · ✅ *complete 2026-10-26 (git commit pending)*

**Tasks**
- [x] One `Dockerfile` per service. *(`node:24.22-alpine`, tini, npm/corepack removed from runtime, read-only app files; plus `database/Dockerfile` migrate image)* Build context = `bcp-dr/` root (services depend on `file:../../shared`). Pattern:
  - Base `node:<current LTS>-alpine`, multi-stage, `npm ci --omit=dev`, copy `shared/` + service.
  - Run as non-root (`USER node`), `NODE_ENV=production`, `EXPOSE` service port, `HEALTHCHECK` on `/health`.
  - Start Node under an init (`tini`, or `docker run --init`): as PID 1 without one, Node ignores SIGTERM until the service has installed its handler, so a pod stopped during startup waits for the full grace period. Run `node` directly, not via `npm start`, so signals reach it.
  - Install `shared/` dependencies inside the image (services link to it via `file:../../shared`); never bind-mount Windows `node_modules` (startup took ~108 s in a test container).
  - Pin image versions; no secrets in images.
- [x] **G5** Frontend: switch `services/api.js` defaults to same-origin relative paths (`/api/users`, `/api/products`, …) and serve the build with nginx (multi-stage), with nginx/ingress routing `/api/<x>` to each service. Keep `VITE_*` overrides for local dev. *(unprivileged nginx 1.30; per-request DNS so recreated containers are followed; unknown `/api/*` → JSON 404; Vite dev proxy added so `npm run dev` needs no frontend `.env`)*
- [x] Fix `.dockerignore` — it currently ignores `Dockerfile*` and `docker-compose*.yml` (harmless for builds, but double-check it doesn't exclude anything needed) and does not exclude `experiments/`. *(verified; it also keeps a local `frontend/.env` out of the production build)*
- [x] `docker/docker-compose.yml`: `postgres:15` (with healthcheck + volume) → one-shot `migrate` container (`node database/runSetup.js setup`) → 5 services (with `depends_on: service_healthy`) → frontend. Env via `docker/.env` (from `.env.example`). *(used `postgres:16-alpine`; secrets required, no defaults; read-only FS, `cap_drop: ALL`, `no-new-privileges`, CPU/memory limits; host ports on 127.0.0.1; web app on `FRONTEND_PORT`, default 8088 because 8080 is often taken, e.g. by Burp Suite)*
- [x] Optional variant: compose override pointing services at the Patroni HAProxy (`experiments/patroni`) to demo app-level behavior during DB failover. *(`docker/docker-compose.patroni.yml`; verified)*
- [x] Image scanning locally with Trivy (preview of CI). *(Trivy 0.76.1: initially 2 CRITICAL + 9–11 HIGH per service → 0 CRITICAL, 0 HIGH in all 7 images)*

**DoD:** `docker compose up` on a clean machine yields a working app; `scripts/e2e-business-flow.js` passes against the containers; Trivy shows no CRITICAL vulns in our images.

**Verification (2026-10-26):**
- [x] Clean slate (`down -v`, `build --no-cache --pull`): build 60 s, stack healthy in 25 s, 7 migrations applied to an empty database, `npm run e2e:docker` PASS.
- [x] Web UI through nginx on :8088: login and catalog work, no browser console errors; SPA routes and all five `/api/*` prefixes routed; one set of security headers.
- [x] Graceful stop: SIGTERM via tini → shutdown complete in 5 ms, exit 0.
- [x] Container recreated on a new IP (`.7` → `.9`): nginx reached it within ~1 s.
- [x] Database stopped: all `/ready` → 503, `/health` 200, e2e exit 1; ready again 1 s after restart, e2e PASS.
- [x] Node process killed inside a container: Docker restarted it, ready in 6 s, e2e PASS.
- [x] Patroni variant: services on `bcp_dr_net` via HAProxy, e2e PASS.
- [x] Trivy: 0 CRITICAL, 0 HIGH in all 7 images (one accepted MEDIUM, see Decision Log). `npm test` 58/58, `npm run lint` clean.

---

### Phase 4 — Kubernetes (local first: kind / minikube / Docker Desktop) · ✅ *complete 2026-11-01 (git commit pending)*

**Tasks** — per service (`kubernetes/<svc>/`):
- [x] `Deployment`: `replicas: 2` (3 for order/inventory on GKE), resource `requests`/`limits`, `livenessProbe` → `/health`, `readinessProbe` → `/ready`, `startupProbe`, `terminationGracePeriodSeconds`, `topologySpreadConstraints` on `topology.kubernetes.io/zone` (and `kubernetes.io/hostname`), labels `app`, `tier`, `version`. *(2026-11-01 — `kubernetes/<service>/`; zone spread is `ScheduleAnyway` so pods can still be rescheduled during a zone outage; 10/10 pods ready on first apply, each service's 2 pods in different zones; e2e PASS inside the cluster)*
- [x] `securityContext`: `runAsNonRoot`, `readOnlyRootFilesystem: true` (+ `emptyDir` for `/tmp`), `allowPrivilegeEscalation: false`, drop all capabilities, `seccompProfile: RuntimeDefault`. *(From P3: the frontend's nginx also needs writable `emptyDir`s at `/etc/nginx/conf.d` and `/tmp`, owned by uid 101 — same as the Compose `tmpfs` entries.)*
- [x] `Service` (ClusterIP), `HorizontalPodAutoscaler` (CPU), `PodDisruptionBudget` (`minAvailable: 1`). *(HPA min 2 / max 4 at 70% CPU; needs metrics-server v0.9.1 with `--kubelet-insecure-tls` on kind — installed by the owner, not via the Kustomize build)*
- [x] Dedicated `ServiceAccount` per service, `automountServiceAccountToken: false` where not needed. *(each service gets only the secrets it uses; product-service has no internal token)*

Shared (`kubernetes/base/`, `kubernetes/ingress/`):
- [x] Namespace `cloudresilience`; `ConfigMap` (service URLs use cluster DNS, e.g. `http://product-service:3002`); `Secret` template (JWT, internal token, DB creds) — real values never committed. *(Secret created with `kubectl create secret` from random values; never in a file)*
- [x] Migration `Job` (runs `runSetup.js setup`) before services roll out. *(retries until PostgreSQL is ready — 4th attempt succeeded)*
- [x] ~~`Ingress`~~ **Gateway API** with path routing `/` → frontend, `/api/users` → user, … (requires G5). *(2026-11-01 — ingress-nginx is retired, so `kubernetes/gateway/` uses GatewayClass/Gateway/HTTPRoute with Envoy Gateway v1.9.3 as controller; on kind the Envoy proxy is a NodePort 30080 → http://localhost:8090 via `overlays/local/envoy-proxy.yaml`. Frontend Deployment added in `kubernetes/frontend/` (uid 101, `emptyDir` for `/tmp` and `conf.d`, FQDN service URLs because nginx's resolver ignores the DNS search list). The controller install is run by the owner — see README)*
- [x] `NetworkPolicies`: default-deny; allow ingress-controller → frontend & APIs; order → product/inventory/notification/user; all services → DB egress; DNS egress. *(2026-11-01 — `kubernetes/network-policies/`, 7 policies; kindnet enforces them. Verified: order → product/user allowed; product → inventory, notification → order and pod → internet blocked; probes unaffected; e2e PASS with policies on)*
- [x] Kustomize overlays: `overlays/local` (in-cluster Postgres StatefulSet for dev only) and `overlays/gke` (Cloud SQL via Auth Proxy sidecar or private IP, Artifact Registry images). *(`overlays/local` done (Postgres + kind NodePort for the Gateway). `overlays/gke` moves to Phase 5 — it needs the Cloud SQL, Artifact Registry and IAM outputs from Terraform)*
- [x] **Observe native recovery manually** (baseline for later): delete an order pod, drain a node, deploy a broken image tag — record what K8s does by itself and how long it takes. *(2026-11-01 — automated as `scripts/k8s-baseline.js`, results in `docs/evidence/phase4-baseline/results.jsonl`; in-cluster probe on order-service every ~0.5 s)*

  | Scenario (K8s only, no controller) | Result | Failed probes |
  |---|---|---|
  | Pod delete | replacement ready in 13.8 s | 0 / 37 |
  | Broken image tag | new pod `ImagePullBackOff`, old pods keep serving; **no automatic rollback** (manual `rollout undo` → healthy in 0.9 s) | 0 / 101 |
  | Node stopped (`docker stop`, zone-c) | node `Unknown` after 43.5 s, dead pod out of the Service at 44.1 s; replacement ready only at **356.5 s** (300 s default eviction toleration); no rebalancing after the node returned | 15 / 637 over 38.6 s |

**DoD:** full app healthy on a local cluster through the Ingress; e2e script passes; manual pod-delete recovery observed and timed (this is the "no-controller" baseline).

**Verification (2026-11-01):**
- [x] Add-ons installed by the owner: Envoy Gateway v1.9.3, metrics-server v0.9.1 — all 6 HPAs report CPU (e.g. `cpu: 4%/70%`).
- [x] Gateway `web` Programmed; 2 Envoy proxy pods in different zones; NodePort 30080 → http://localhost:8090.
- [x] Through the Gateway: `/` and SPA routes → 200 HTML, all five `/api/*` prefixes routed, unknown `/api/*` → JSON 404; login page loads with no console errors.
- [x] `npm run e2e` with every service URL set to http://localhost:8090: PASS, 10/10 steps (run `e2e-c3afc7b7`) — with NetworkPolicies enforced.
- [x] Fix found during the check: Envoy Gateway sets `externalTrafficPolicy: Local`, so the NodePort only answered on nodes running an Envoy pod (not the control plane that kind maps :8090 to). `overlays/local/envoy-proxy.yaml` sets `Cluster`.

---

### Phase 5 — GCP via Terraform (+ Cloud SQL HA/PITR) · 🟡 *started 2026-11-14*

**Prerequisites:** install Terraform + gcloud CLI; GCP project with billing; **set a budget alert**.

> **Status 2026-11-14:** ✅ Terraform 1.17.1 + gcloud 593.0.0 installed · ✅ Free Trial active (₹28,569 credit, expires **2027-02-13**) · ✅ project `cloudresilience-dev` in organisation `waghprerana07-org`, billing enabled · ✅ budget `cloudresilience-trial` ₹4,000/month, credits excluded, alerts 25/50/90/100 % · ✅ gcloud + application-default credentials · Org policies (secure-by-default): no service-account keys, uniform bucket access, protocol forwarding INTERNAL only, no automatic grants to default service accounts — all compatible with the Terraform design. ⚠️ UPI autopay mandate expires **2026-12-31**: check Billing → Payment method around 2026-12-24 and renew if asked. Regional GKE + Cloud SQL HA cost real money → `terraform destroy` (or scale to zero) between experiment sessions; keep `deletion_protection` on Cloud SQL except when deliberately testing infra loss.

**Tasks** (`terraform/modules/*`, `terraform/environments/dev`):
- [x] Remote state in a GCS bucket (versioned) — bootstrap once, documented. *(2026-11-14 — `gs://cloudresilience-dev-tfstate`, asia-south1, public access blocked, uniform access, versioned (20 newest kept), `prevent_destroy`; created by `terraform/bootstrap/`; dev uses it via git-ignored `backend.hcl`)*
- [ ] `network`: custom VPC, subnet with secondary ranges for pods/services, Cloud NAT, firewall rules, Private Service Access for Cloud SQL. *(code written + `terraform validate` clean 2026-11-14; not applied yet)*
- [ ] `gke`: **regional** cluster across 3 zones (Standard with small node pool, or Autopilot — decision **D4**), Workload Identity, private nodes, release channel, network policy enabled. *(code written + `terraform validate` clean 2026-11-14; not applied yet)*
- [ ] `cloudsql`: PostgreSQL 15, **`availability_type = REGIONAL` (HA)**, automated backups, **PITR (WAL retention)**, private IP only, `deletion_protection`, maintenance window, `cloudresilience` database + app user. *(code written + `terraform validate` clean 2026-11-14; not applied yet)*
- [ ] `storage`: bucket for exports/backups and for BCDR report archival (versioning, lifecycle). *(code written + `terraform validate` clean 2026-11-14; not applied yet)*
- [ ] `artifact-registry`: Docker repo for the 6 images. *(code written + `terraform validate` clean 2026-11-14; not applied yet)*
- [ ] `secret-manager`: JWT secret, internal token, DB password; surfaced to pods via Secret Manager CSI driver or External Secrets. *(code written + `terraform validate` clean 2026-11-14; not applied yet)*
- [ ] `iam`: least-privilege GSAs — per-service runtime SA (Cloud SQL client, secret accessor), **BCDR controller SA** (GKE developer, Cloud SQL admin for failover/restore, storage object admin on report bucket), CI deployer SA via Workload Identity Federation (no JSON keys). *(code written + `terraform validate` clean 2026-11-14; not applied yet)*
- [ ] `monitoring`: uptime checks on the Ingress, alert policies (pod restarts, DB down, 5xx rate), log-based metrics. *(code written + `terraform validate` clean 2026-11-14; not applied yet)*
- [ ] Deploy the app via `kubernetes/overlays/gke`; DNS (Cloud DNS) optional — the LB IP is enough for the project.

**DoD:** `terraform apply` from scratch produces a working environment; app reachable via Cloud Load Balancer; e2e script passes in GCP; Cloud SQL HA + PITR verified enabled; `terraform destroy` + `apply` cycle documented and timed (feeds Scenario 6).

---

### Phase 6 — BCDR Controller (core) + Scenario 1 end-to-end

**Language decision D2:** recommended **Node.js** (same stack as the app; reuse `scripts/e2e-business-flow.js`; `@kubernetes/client-node`, `googleapis`, `js-yaml`, `commander`). Python is a valid alternative if preferred.

**Components** (`bcdr/controller/*`):

| Module | Responsibility | First implementation |
|---|---|---|
| `detector/` | Notice failure, create incident `{incident_id, detected_at, resource, failure, signals}` | Poll K8s API (deployments/pods/nodes/events) + `/ready` endpoints + DB ping; also accept events from `bcdr simulate` |
| `classifier/` | Map signals → failure class | Pure rules table: `POD_FAILURE`, `NODE_FAILURE`, `BAD_DEPLOYMENT`, `DB_AVAILABILITY_FAILURE`, `DATA_CORRUPTION`, `INFRASTRUCTURE_FAILURE`, `FULL_DISASTER` |
| `policy/` | Failure class → runbook | Static map (blueprint §13), loaded from YAML config |
| `executor/` | Run runbook steps in order | Step registry (`verify_failure`, `allow_kubernetes_recovery`, `wait_for_pod_ready`, `rollback_deployment`, `trigger_cloudsql_failover`, `pitr_restore`, `terraform_apply`, `deploy_application`, `validate_application`, `validate_business_transaction`, `record_metrics`); per-step timeout, retries, `on_failure` |
| `tracker/` | Incident state machine; timestamps every transition | States below; illegal transitions rejected; persisted to JSON |
| `validator/` | 5-level validation (Phase 7) | Stub returning PASS in P6, real in P7 |
| `metrics/` | RTO/RPO/downtime/data loss (Phase 8) | Timestamps only in P6 |
| `reporter/` | Incident report JSON + Markdown | Minimal JSON in P6 |
| `adapters/` | Thin wrappers: `kubernetes`, `cloudsql`, `terraform` | `kubernetes` only in P6 |

**State machine**
```
DETECTED → CLASSIFIED → RECOVERY_STARTED → RECOVERING → VALIDATING → RECOVERED
                                                            └→ VALIDATION_FAILED → RECOVERY_FAILED
(any step timeout/error) ─────────────────────────────────────→ RECOVERY_FAILED
```

**Runbook format** (`bcdr/runbooks/pod_failure.yaml`):
```yaml
failure: pod_failure
mechanism: kubernetes_self_healing
timeout_seconds: 300
steps:
  - verify_failure
  - allow_kubernetes_recovery
  - { name: wait_for_pod_ready, params: { deployment: order-service }, timeout_seconds: 180 }
  - validate_application
  - validate_business_transaction
  - record_metrics
```

**CLI** (`bcdr/cli.js`): `bcdr simulate pod-failure [--target order-service]`, `bcdr simulate node-failure`, `bcdr simulate db-failure`, `bcdr simulate bad-deployment`, `bcdr simulate data-corruption`, `bcdr simulate infrastructure-failure`, `bcdr report <incident-id>`, `bcdr validate` (run validator only).

**Tasks**
- [ ] Skeleton of all modules with interfaces + unit tests (classifier and tracker are pure → easy to test thoroughly).
- [ ] Scenario 1 injector: delete one `order-service` pod (`bcdr/scenarios/pod_failure/`).
- [ ] Run the full chain once end-to-end on GKE (local cluster acceptable for development).

**DoD:** `bcdr simulate pod-failure` produces an incident that walks the state machine to `RECOVERED` (with stub validator) and writes a report file.

---

### Phase 7 — Application Validator (5 levels)

| Level | Checks | Source |
|---|---|---|
| 1 Infrastructure | Nodes Ready; deployments `availableReplicas == replicas`; pods Running/Ready across zones | K8s API |
| 2 Service | `/health` and `/ready` of all 5 services → 200 | HTTP (in-cluster or via Ingress) |
| 3 API | Login returns JWT; `GET /api/products`; `GET /api/inventory/:id`; `GET /api/orders` | HTTP with probe identity |
| 4 Database | DB reachable; required tables present; probe rows readable; a write+read round trip works | Direct SQL (read-only checks) or via service APIs |
| 5 Business | Full transaction (from `scripts/e2e-business-flow.js`): login → product → inventory before → create order → inventory decreased → **notification exists for that order (G4)** → cancel → stock released | HTTP with probe identity |

**Tasks**
- [ ] Implement levels as independent functions returning `{level, status, checks[], duration_ms}`; validator stops at first failed level and reports which one.
- [ ] Retry policy: business validation retried N times with backoff before declaring `VALIDATION_FAILED`.
- [ ] Ensure probe orders are always cleaned up (cancel in `finally`).

**DoD:** validator correctly reports PASS on a healthy system and FAILs at the right level when you (a) scale a deployment to 0, (b) stop the DB, (c) break the notification service.

---

### Phase 8 — Metrics & Reporting

**Fix these definitions before running experiments** (blueprint §17 — write them into `docs/experiments/metric-definitions.md` and do not change them mid-evaluation):

| Timestamp | Meaning |
|---|---|
| `t_failure` | Moment the fault is injected (recorded by the simulator) |
| `t_detected` | Detector creates the incident |
| `t_classified` | Classifier assigns a class |
| `t_recovery_started` | Executor begins the first recovery step |
| `t_infra_ready` | Level 1 passes |
| `t_service_ready` | Levels 2–4 pass |
| `t_business_ok` | Level 5 passes (= recovery complete) |

| Metric | Definition |
|---|---|
| **Detection latency** | `t_detected − t_failure` |
| **RTO (measured recovery time)** | `t_business_ok − t_failure` (blueprint example: 10:00:00 → 10:05:30 = 330 s). Also report `t_infra_ready − t_failure` to show the infra-vs-business gap. |
| **Downtime** | From the **first failed** availability probe to the **first successful** business probe, measured by an independent prober (`bcdr/probes/`) polling every 1 s throughout the experiment. |
| **RPO** | `t_failure − t_last_recovered_write`, where `t_last_recovered_write` = timestamp of the newest write present after recovery. |
| **Data loss** | `acknowledged_writes_before_failure − writes_present_after_recovery`, using a **write-ack load generator** that creates orders/heartbeat rows continuously and logs every acknowledged ID. Classify as *preserved / partially lost / restored from earlier point / unavailable*. |

**Tasks**
- [ ] Availability prober + write-ack load generator (`bcdr/probes/`), started/stopped by the scenario runner.
- [ ] Metrics module computes the above from tracker timestamps + probe logs.
- [ ] Reporter writes `bcdr/reports/INC-<n>.json` (schema below) + a human-readable Markdown version, and appends a row to `bcdr/reports/results.csv`.

```json
{
  "incident_id": "INC-001", "scenario": "pod_failure", "run": 1,
  "failure_type": "pod_failure", "failure_class": "POD_FAILURE", "resource": "order-service",
  "policy": "kubernetes_self_healing", "runbook": "pod_failure.yaml",
  "failure_at": "...", "detected_at": "...", "classified_at": "...",
  "recovery_started_at": "...", "infra_ready_at": "...", "recovery_completed_at": "...",
  "validation": { "infrastructure": "PASS", "service": "PASS", "api": "PASS", "database": "PASS", "business": "PASS" },
  "detection_seconds": 4, "rto_seconds": 184, "rpo_seconds": 0, "downtime_seconds": 92,
  "data_loss": { "count": 0, "classification": "preserved" },
  "status": "RECOVERED", "steps": [ { "name": "...", "started_at": "...", "ended_at": "...", "status": "..." } ]
}
```

**DoD:** Scenario 1 run 5× produces 5 consistent reports and a CSV row each.

---

### Phase 9 — Additional Scenarios (in this order; blueprint §23)

| # | Scenario | Injection | Class → Policy | Recovery mechanism | Key metric | Priority |
|---|---|---|---|---|---|---|
| 1 | Pod failure | delete `order-service` pod | POD_FAILURE → self-healing | K8s ReplicaSet | RTO, downtime | **Mandatory** |
| 2 | Node failure | cordon+drain or delete a GKE node VM | NODE_FAILURE → rescheduling | K8s scheduler + PDB/topology spread | RTO, downtime | **Mandatory** |
| 3 | Bad deployment | roll out broken image tag / failing readiness | BAD_DEPLOYMENT → rollback | `kubectl rollout undo` via K8s API | RTO, downtime | **Mandatory** |
| 4 | DB availability | `gcloud sql instances failover` (or restart) | DB_AVAILABILITY_FAILURE → Cloud SQL HA | Cloud SQL regional failover | RTO, downtime, data loss (≈0) | **Mandatory** |
| 5 | Data corruption | controlled `DELETE`/`UPDATE` of orders after recording a marker time | DATA_CORRUPTION → PITR | Cloud SQL PITR clone → repoint app (Secret/ConfigMap) → rollout | **RPO, data loss** | Strongly recommended |
| 6 | Infrastructure loss | `terraform destroy` of GKE (keep DB or restore from backup) | INFRASTRUCTURE_FAILURE → reconstruction | Terraform apply → DB restore → deploy → validate | RTO, RPO | Optional (only if 1–5 solid) |

For each scenario: injector in `bcdr/scenarios/<name>/`, runbook YAML, classifier rule, adapter step(s), doc in `docs/runbooks/<name>.md`, and ≥ 1 successful measured run before moving on.

**DoD:** at least scenarios 1–4 complete end-to-end with reports.

---

### Phase 10 — Evaluation & Documentation

- [ ] Run each completed scenario **N ≥ 5 times** (same conditions, documented in `docs/experiments/protocol.md`).
- [ ] Results table per run: Scenario · Failure time · Detection time · Recovery start · Recovery completion · Validation result · RTO · RPO · Downtime · Data loss.
- [ ] Analysis: mean / median / min / max / std-dev per scenario; infra-ready vs business-ready gap (core argument of the project); compare with Patroni lab numbers and K8s-only baseline from P4.
- [ ] Threats to validity & limitations (single region, synthetic load, G13 saga, small sample size, cloud variance).
- [ ] Architecture docs + diagrams in `docs/architecture/`; runbook docs; final report chapters.

---

## 4. Cross-Cutting: Security & CI/CD (blueprint §25)

Build these progressively — checkboxes are tagged with the phase in which they should land.

**Application / containers**
- [x] Helmet, CORS allow-list, JWT, RBAC, input validation, internal token *(exists)*
- [x] Non-root, minimal images, pinned versions, no secrets in images (P3) *(2026-10-26)*
- [ ] Trivy image scan with fail on CRITICAL (P3 → CI) *(local scan done in P3: 0 CRITICAL/HIGH; the CI gate is still to do)*

**Kubernetes**
- [ ] RBAC: BCDR controller gets a namespaced Role limited to what runbooks need (get/list/watch pods, deployments, nodes; patch deployments for rollback; delete pods only for simulation) (P4/P6)
- [ ] NetworkPolicies default-deny (P4) · securityContext hardening (P4) · per-service ServiceAccounts (P4) · resource limits (P4)

**GCP**
- [ ] Least-privilege IAM, Workload Identity, Secret Manager, Cloud SQL private IP only, CMEK optional, deletion protection (P5)

**CI/CD — `.github/workflows/`** (at the git root; see D1)
- [ ] `ci.yml` on PR: install → ESLint → `npm test` → `npm audit --audit-level=high` → CodeQL/Semgrep (SAST) → Docker build → Trivy → Checkov on `terraform/` and `kubernetes/`
- [ ] `deploy.yml` on main: build & push to Artifact Registry (Workload Identity Federation) → `kubectl apply -k kubernetes/overlays/gke` → post-deploy `bcdr validate`
- [ ] Optional: `terraform-plan.yml` on PRs touching `terraform/`

---

## 5. Immediate Next Steps (start here)

1. **Commit the Phase 3 work** (manual, by the project owner), together with `PROJECT_ROADMAP.md`, the git-root `README.md` and the `bcp-dr/README.md` edits, which were not part of commit `41d24ea`.
2. ~~Restructure Patroni, write its README~~ ✅ · ~~Scope freeze, root README, D1~~ ✅
3. ~~Phase 2 hardening and `scripts/e2e-business-flow.js`~~ ✅
4. ~~Phase 3: Dockerfiles, same-origin frontend, Compose stack, Trivy~~ ✅
5. ~~**Phase 4:** Kubernetes manifests, Gateway, network policies, K8s-only baseline~~ ✅ — **commit the Phase 4 work** (owner).
6. **Phase 5:** run the GCP-vs-VM decision gate, install Terraform + gcloud, create the GCP project with a budget alert.
   Decision gate: [decision 0001 §4](docs/decisions/0001-scope.md).

---

## 6. Open Decisions

| ID | Decision | Options | Recommendation | Status |
|---|---|---|---|---|
| D1 | Repository root | (a) make `bcp-dr/` the git root; (b) keep `e-commerce-platform/` as root with `.github/` there and CI `working-directory: bcp-dr` | (b) — existing GitHub repo, no history rewrite | **Decided (b)** — [0002](docs/decisions/0002-repository-root.md) |
| D2 | Controller language | Node.js / Python | Node.js (stack reuse, shared e2e script) | Open |
| D3 | Local K8s for dev | kind / minikube / Docker Desktop K8s | kind (multi-node → can simulate node failure + zone labels) | **Decided: kind** (v0.33, 1 control plane + 3 workers in zone-a/b/c) |
| D4 | GKE mode | Standard regional / Autopilot regional | Standard (node failure scenario needs node-level control) | **Default in code:** Standard *multi-zonal* (zonal control plane → fee covered by free tier; nodes in 3 zones) |
| D5 | GCP region | e.g. `asia-south1`, `us-central1` | Closest region with 3 zones and lowest cost | **Default in code:** `asia-south1` (one variable to change) |
| D6 | Cloud SQL access from pods | Auth Proxy sidecar / private IP direct | Private IP + Auth Proxy sidecar (IAM auth, TLS) | Open |
| D7 | Incident persistence | JSON files / SQLite / Cloud SQL table | JSON files in `bcdr/reports/` + archive to GCS | Open |
| D8 | Scenario 6 in scope? | yes / stretch | Stretch goal | **Decided: stretch** — [0001](docs/decisions/0001-scope.md) |
| D9 | Target platform | GCP / VM-based | GCP primary, VM-based fallback | **Decided: GCP** — gate passed 2026-11-14 ([0001 §4](docs/decisions/0001-scope.md)) |

---

## 7. Decision Log

Append entries as decisions are made (date · ID · decision · reason).

| Date | ID | Decision | Reason |
|---|---|---|---|
| 2026-10-21 | — | Keep existing service folder names (`*-service`) instead of blueprint's short names | Avoid churn; mapping documented in §2 |
| 2026-10-21 | — | Patroni remains a standalone experiment; GCP target uses Cloud SQL | Blueprint §24 |
| 2026-10-22 | — | Every recovery measurement records the injected failure mode (graceful vs crash vs partition) | Patroni drills: same mechanism gave ~7 s (SIGTERM) vs ~33 s (SIGKILL) write RTO |
| 2026-10-22 | — | Data loss is measured with a write-ack probe (acked IDs vs rows present), not assumed | Prototype in `experiments/patroni/scripts/run-drills.sh`; basis for Phase 8 |
| 2026-10-24 | D1 | Keep `e-commerce-platform/` as git root; `bcp-dr/` is the project root | Existing GitHub repo; avoids rewriting every path ([0002](docs/decisions/0002-repository-root.md)) |
| 2026-10-24 | — | Scope frozen: scenarios 1–4 mandatory, 5 recommended, 6 stretch; no AI/ML, multi-cloud, dashboards | [0001](docs/decisions/0001-scope.md) |
| 2026-10-24 | D8, D9 | Scenario 6 = stretch; GCP primary with VM-based fallback, decided at start of Phase 5 | Presentation GCP-vs-VM comparison; cost risk ([0001 §4](docs/decisions/0001-scope.md)) |
| 2026-10-26 | — | Images use Node 24 LTS (`node:24.22-alpine`), `nginx-unprivileged:1.30-alpine`, `postgres:16-alpine`; minor versions pinned | Supported through the project; reproducible but still patchable |
| 2026-10-26 | — | npm/corepack removed from runtime images | Not needed at runtime; removed all HIGH CVEs coming from npm's bundled dependencies |
| 2026-10-26 | — | **Accepted risk:** MEDIUM CVE-2026-41907 in `uuid@8.3.2` | Pinned by Sequelize 6 (`uuid ^8.3.2`); fix needs uuid ≥ 11. Revisit if Sequelize is upgraded |
| 2026-10-26 | — | Compose web port defaults to 8088 (`FRONTEND_PORT`) | 8080 commonly taken (Burp Suite on the dev machine) |
| 2026-11-01 | D3 | kind for the local cluster; 3 workers labelled `topology.kubernetes.io/zone` zone-a/b/c; web on :8090 | Multi-node, can stop a "zone" with `docker stop`; mirrors a 3-zone GKE region |
| 2026-11-01 | — | Gateway API + Envoy Gateway instead of Ingress + ingress-nginx | ingress-nginx is retired; Gateway API is the current standard and GKE has its own Gateway controller for Phase 5 |
| 2026-11-01 | — | On kind, the Envoy NodePort uses `externalTrafficPolicy: Cluster` | Envoy Gateway's default `Local` drops traffic arriving at the control plane (where kind maps :8090), which runs no Envoy pod. On GKE the cloud load balancer health-checks nodes, so `Local` is fine there |
| 2026-11-14 | D9 | Phase 5 decision gate passed: **GCP** (not the VM fallback), funded by the $300 / 90-day Free Trial, with education credits requested as backup | Fits the budget if the environment is torn down between sessions (~$0.30/h active, ~$0.15/day idle; ~$200+/month if left on). One trial per customer — no extra accounts for more credit. Trial signup is delayed until infrastructure code is ready, because its 90 days can't be paused |
| 2026-11-14 | — | Terraform: google provider `~> 8.11`; GKE Standard multi-zonal, private nodes, DNS-based control-plane endpoint, Dataplane V2, Workload Identity, Gateway API; Cloud SQL PG16 Enterprise HA + 7-day PITR, private IP, encrypted connections, pgAudit | Checkov 3.4.5: 107 passed, 0 failed, 10 skipped with in-code reasons (PG16 to match tested stack, no client certs, no log_duration, Dataplane V2 instead of legacy network policy, metadata server on node pool, no Workspace groups, Binary Authorization deferred to CI, Google-managed keys, no bucket access-log bucket ×2) |
| 2026-11-01 | — | Liveness uses `/health`, readiness `/ready`; zone spread is `ScheduleAnyway` | A DB outage must not restart every pod; pods must still be schedulable while a zone is down |
| 2026-11-01 | — | Secrets created with `kubectl create secret` from random values, never stored in files; each service gets only the keys it uses | Least privilege; nothing secret in git (GKE will use Secret Manager) |
| 2026-11-01 | — | metrics-server and the Gateway controller are cluster add-ons installed by the owner, not part of the app's Kustomize build | They are third-party, cluster-wide components; GKE provides its own |

---

## 8. Future Work (out of scope — blueprint §29)

Pluggable multi-cloud recovery adapters (AWS/Azure/on-prem) · policy-as-configuration schema (`failure_type → mechanism → validation → success_condition`) · incident history analytics & BCDR dashboard · scheduled automated DR drills · advanced detection (anomaly detection, dependency graphs, ML classification).

*If a task drifts toward any of these, stop and check §0 ground rules.*

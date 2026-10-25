# 0001 — Scope freeze

- **Status:** Accepted
- **Date:** 2026-10-24
- **Sources:** blueprint `CloudResilience: IaC-Based BCDR Framework for a Multi-Zone Microservices Application` (§1, §23, §27–30), project presentation, [PROJECT_ROADMAP.md](../../PROJECT_ROADMAP.md)

This record freezes what CloudResilience will deliver. Anything not listed under **In scope** is out of scope. Changing the scope requires a new decision record that supersedes this one.

---

## 1. Aim

Design and implement a lightweight, application-aware BCDR framework that **coordinates** existing recovery mechanisms, **validates** end-to-end application and business functionality after failures, and **measures** recovery using RTO, RPO, downtime and data-loss metrics.

## 2. In scope

### 2.1 Protected application (exists — hardened, not extended)
- Five Node.js services — User, Product, Inventory, Order, Notification — plus the React frontend.
- Business workflow used for validation: **login → product → inventory → order → inventory update → notification**.
- Changes allowed only where BCDR needs them: readiness endpoint, graceful shutdown, structured logs, a synthetic probe user/product, an end-to-end business-flow script. **No new business features.**

### 2.2 Platform
- Docker images and Docker Compose for local runs.
- Kubernetes manifests: Deployments, Services, ConfigMaps, Secrets, probes, resource limits, replicas, HPA, PodDisruptionBudgets, topology spread, NetworkPolicies.
- Terraform for all cloud infrastructure (see §4 for target platform).

### 2.3 BCDR controller (the contribution)
| Component | Frozen behaviour |
|---|---|
| Detector | Kubernetes API/events, service health endpoints, database reachability, and controlled simulation commands. Creates an incident. |
| Classifier | **Deterministic rules only.** |
| Policy engine | Static mapping failure class → recovery policy → runbook. |
| Runbook executor | YAML runbooks of named steps with timeouts and failure handling. |
| Recovery tracker | State machine `DETECTED → CLASSIFIED → RECOVERY_STARTED → RECOVERING → VALIDATING → RECOVERED`, with `VALIDATION_FAILED → RECOVERY_FAILED`. |
| Application validator | Five levels: infrastructure, service, API, database, **business transaction**. `RECOVERED` only after level 5 passes. |
| Metrics | RTO, RPO, downtime, data loss, detection latency, recovery and validation status, using the definitions frozen in roadmap Phase 8. |
| Reporter | Structured JSON + Markdown incident report per run, plus a results CSV. Generated from recorded data (**not AI-generated**). |
| Simulation CLI | `bcdr simulate <scenario>`. |

### 2.4 Failure scenarios
| # | Scenario | Recovery mechanism | Validation | Priority |
|---|---|---|---|---|
| 1 | Pod failure | Kubernetes self-healing | API + business | **Mandatory** |
| 2 | Node failure | Kubernetes rescheduling | Application + business | **Mandatory** |
| 3 | Bad deployment | Rollback | API + business | **Mandatory** |
| 4 | Database availability failure | Cloud SQL HA failover | Database + business | **Mandatory** |
| 5 | Data corruption | PITR / restore | Data + business, RPO and data loss | Recommended |
| 6 | Infrastructure loss | Terraform reconstruction + DB restore + redeploy | Full validation | Stretch — attempted only after 1–5 work |

Scenarios are implemented **one at a time**, each end-to-end, before the next begins.

### 2.5 Evaluation
- Each completed scenario repeated **at least 5 times** under a documented protocol.
- Reported per run: failure time, detection time, recovery start, recovery completion, validation result, RTO, RPO, downtime, data loss.
- Analysis: mean / median / min / max / standard deviation; infrastructure-ready vs. business-ready gap; comparison with the Kubernetes-only baseline and the Patroni experiment.

### 2.6 Security (built in, not a separate phase)
Non-root containers, read-only filesystems where practical, resource limits, Kubernetes RBAC and service accounts, NetworkPolicies, Secrets / Secret Manager, least-privilege IAM, private database access, and a CI pipeline with tests, dependency scanning, SAST, Trivy and Checkov.

## 3. Out of scope

- AI / machine-learning classification, anomaly detection, dependency-graph analysis.
- Multi-cloud or pluggable cloud adapters beyond what the chosen platform needs.
- Multi-region DR, global load balancing, active-active databases.
- Dashboards, recovery-history analytics, scheduled/automated DR drills.
- Rebuilding what existing mechanisms already do (Kubernetes self-healing, database replication/failover, backup engines).
- Further Patroni work — the experiment is complete and frozen ([experiments/patroni](../../experiments/patroni/README.md)), except where §4 fallback requires it.
- New application features (payments, search, carts, etc.), mobile clients, API gateway, message queues.
- Production-grade operations: on-call alerting, SLAs, cost optimisation beyond a budget alert.

These are recorded as **future work** (blueprint §29).

## 4. Target platform

**Primary: Google Cloud** — regional GKE across three zones, Cloud SQL for PostgreSQL with HA and PITR, Cloud Storage, Artifact Registry, Secret Manager, Cloud Monitoring/Logging, all provisioned with Terraform.

**Fallback: VM-based** (from the presentation's GCP-vs-VM comparison) — the same microservices, Docker images, Terraform and BCDR controller, with Kubernetes on VMs, PostgreSQL with Patroni for HA, local/VM backup storage for PITR, Kubernetes Secrets, and Prometheus/Grafana. Cost: existing hardware only.

| Aspect | GCP (primary) | VM-based (fallback) |
|---|---|---|
| Orchestration | GKE | Kubernetes on VMs |
| Database HA | Cloud SQL HA | Patroni + PostgreSQL |
| Backup / PITR | Cloud SQL backups + PITR | Base backups + WAL archive on local/VM storage |
| Secrets | Secret Manager | Kubernetes Secrets |
| Monitoring | Cloud Monitoring | Prometheus / Grafana |
| Controller, validator, metrics | Same | Same |

**Decision gate:** at the start of roadmap Phase 5 (GCP + Terraform). If GCP billing or education credits are not available by then, switch to the VM-based fallback. The switch only changes the adapters the controller calls and the database HA mechanism; the controller, runbook format, validator, metrics and evaluation stay the same.

## 5. Fixed constraints

1. Build the application → containerize → deploy → verify normal operation → **only then** build BCDR.
2. The classifier stays deterministic.
3. Recovery is invoked or observed through existing mechanisms; CloudResilience coordinates, validates and measures.
4. Metric definitions are fixed before experiments start and not changed during evaluation.
5. Timebox: three months from 2026-10-26, following the roadmap's 12-week schedule.

# Existing Recovery Solutions — Comparison and Gap

Phase 1 deliverable (blueprint §2, roadmap Phase 1). Source table: project presentation *"CloudResilience: Infrastructure-as-Code Based BCDR Framework for a Multi-Zone Microservices Application"* (Prerana Wagh), extended with how each solution relates to CloudResilience.

> **Positioning rule (blueprint §2).** CloudResilience does **not** claim that existing products cannot orchestrate or validate recovery — enterprise platforms such as Azure Site Recovery and Veeam Recovery Orchestrator do both. The claim is narrower: CloudResilience is a *small, reproducible control layer* that coordinates *heterogeneous* open mechanisms around *one application* and measures *business-level* recovery in a *common format*.

> **Citations:** add references from the literature review (official documentation and papers) in the last column of Table 1 before submission.

---

## 1. Solutions studied

### Table 1 — What each solution does

| Solution | Primary problem solved | Recovery scope | Orchestration / validation | License / cost model | Reference |
|---|---|---|---|---|---|
| **Kubernetes** | Pod/service self-healing | Application platform | Native rescheduling and health checks (liveness/readiness probes) | Open source — Apache 2.0 | |
| **Patroni** | PostgreSQL high availability | Database | Automatic PostgreSQL failover via a DCS leader lock | Open source — MIT | |
| **repmgr** | PostgreSQL replication and failover | Database | Replication setup, monitoring, failover / switchover | Open source — GPLv3 | |
| **Velero** | Kubernetes backup and restore | Kubernetes resources and persistent data | Backup/restore workflows, schedules, restore hooks | Open source — Apache 2.0 | |
| **Kasten K10** (Veeam) | Kubernetes application backup and DR | Kubernetes applications | Policy-based backup, restore and DR | Free limited edition + paid Enterprise | |
| **Masakari** (OpenStack) | VM high availability | VMs / OpenStack infrastructure | Failure detection and automated instance rescue | Open source — Apache 2.0 | |
| **AWS Elastic Disaster Recovery** | Workload disaster recovery | Servers / applications | Recovery plans, drills, recovery and failback | Commercial — usage-based | |
| **Azure Site Recovery** | VM / workload disaster recovery | VMs, multi-tier applications | Recovery plans, sequencing, scripts, test failover | Paid Azure service — consumption-based | |
| **Google Cloud Backup and DR** | Managed backup and recovery | Cloud workloads and data | Centralized backup and recovery management | Commercial — consumption-based | |
| **Veeam Recovery Orchestrator** | Enterprise DR orchestration | VMs / physical workloads | Recovery plans, testing, orchestration and reporting | Commercial; evaluation / NFR options | |
| **Terraform** | Infrastructure reconstruction | Cloud infrastructure | Declarative provisioning / rebuild | Varies by version: ≤ 1.5 MPL 2.0; ≥ 1.6 BSL 1.1 (converts to MPL after the change date). OpenTofu fork is MPL 2.0 | |

### Table 2 — Where each sits relative to CloudResilience

| Solution | Layer it recovers | What it reports as "recovered" | Role in CloudResilience |
|---|---|---|---|
| Kubernetes | Pods, deployments, node placement | Pods Ready / replicas available | **Used** — recovery mechanism for pod failure, node failure, bad deployment (rollback) |
| Patroni | PostgreSQL primary | New leader holds the DCS lock; `/primary` = 200 | **Studied experimentally** ([experiments/patroni](../../experiments/patroni/README.md)); fallback DB HA mechanism for the VM-based option |
| repmgr | PostgreSQL primary | Standby promoted | Studied (literature only) |
| Velero | Kubernetes objects / volumes | Restore completed | Not used — app state lives in the managed database, not in cluster volumes |
| Kasten K10 | Kubernetes applications | Restore/DR policy completed | Not used — enterprise-oriented; overlaps with Velero |
| Masakari | OpenStack VMs | Instance rescued | Not applicable — no OpenStack |
| AWS DRS | Servers / applications | Recovery instance launched | Not applicable — different cloud |
| Azure Site Recovery | VMs / multi-tier apps | Recovery plan completed (custom scripts possible) | Not applicable — different cloud; closest in concept to the controller |
| Google Cloud Backup and DR | Cloud workloads / data | Backup restored | Not used — Cloud SQL native backups/PITR are sufficient for one database |
| Veeam Recovery Orchestrator | VMs / physical workloads | Plan executed, tested, reported | Not applicable — enterprise licence; closest in concept to the controller |
| Terraform | Cloud infrastructure | `apply` succeeded / plan converged | **Used** — infrastructure provisioning and reconstruction (infrastructure-loss scenario) |
| *Cloud SQL HA / PITR* (managed) | PostgreSQL instance / data | Failover complete / clone restored | **Used** — DB availability failure and data-corruption scenarios |

---

## 2. Findings from the Patroni experiment

Hands-on study of one solution (16 automated failover runs, two batches). Full write-up: [experiments/patroni/README.md](../../experiments/patroni/README.md).

| Failure | Write recovery time (mean) | Confirmed writes lost |
|---|---|---|
| Planned switchover | ≈ 6 s | 0 |
| Graceful stop (SIGTERM) | ≈ 7 s | 0 |
| Crash (SIGKILL) | ≈ 32 s (bounded by leader-lock TTL) | 0 |
| Network isolation | ≈ 29 s; isolated node self-demoted, no split-brain | 0 |

Lessons carried into CloudResilience:

1. The **same mechanism** gives a 4–5× different recovery time depending on the **failure mode** → the controller must classify and record the failure type with every measurement.
2. Patroni's notion of "recovered" is **database-level** only; it says nothing about the services or the business transaction.
3. RPO must be **measured** (acknowledged writes vs. rows present), not assumed from the replication setting.

---

## 3. Identified gap

Challenges identified (presentation, "Fragmented Recovery Across Application Layers"):

1. **Fragmented recovery mechanisms.** Each layer — application, microservices, Kubernetes, database, infrastructure — has its own tool, triggered and observed separately.
2. **Infrastructure recovery ≠ application recovery.** Pods Running, a promoted database, or a successful `terraform apply` do not prove the application works.
3. **Validation must reach the business layer.** Recovery is only meaningful when a real workflow (login → product → inventory → order → inventory update → notification) succeeds.
4. **Recovery results are not comparable.** Each mechanism reports different information in a different format; there is no common experimental record of RTO, RPO, downtime and data loss.

Open-source tools (Kubernetes, Patroni, repmgr, Velero, Terraform) each address one layer. Commercial DR platforms (Azure Site Recovery, AWS DRS, Veeam) do provide orchestration, recovery plans and testing, but they are VM/workload-centric, platform-specific and licence-bound, and they are not designed as a small reproducible research instrument around a single microservices application.

## 4. CloudResilience's contribution

**Aim:** design and implement a lightweight, application-aware BCDR framework that **coordinates** existing recovery mechanisms, **validates** end-to-end application and business functionality after failures, and **measures** recovery using RTO, RPO, downtime and data-loss metrics.

```
COORDINATION + APPLICATION-AWARE VALIDATION + MEASUREMENT + REPRODUCIBLE RECOVERY EXPERIMENTS
```

It deliberately does **not** build another database HA system, Kubernetes recovery, backup product, replication engine or cloud DR service.

# Experiment: PostgreSQL HA with Patroni

Hands-on study of an existing PostgreSQL high-availability solution, carried out before building the CloudResilience controller (blueprint §24). It establishes **what a database-layer HA mechanism recovers on its own, how fast, and what it does not tell you** — the gap CloudResilience is meant to fill.

> Status: **complete.** This experiment is frozen. The final GCP architecture uses **Cloud SQL HA/PITR**, not Patroni.

| | |
|---|---|
| Step-by-step drill guide | [PATRONI_BCP_TESTING.md](PATRONI_BCP_TESTING.md) |
| Automated, measured drills | [scripts/run-drills.sh](scripts/run-drills.sh) |
| Raw results | [results/](results/) |
| Archived alternative setup (not used) | [unused-custom-image/](unused-custom-image/) |

---

## 1. Architecture

```text
            application / psql / probe
                       │
                       ▼
             ┌───────────────────┐
             │  HAProxy :5000    │  write endpoint — routes only to the node whose
             │  (stats :7000)    │  Patroni REST API answers GET /primary → 200
             └─────────┬─────────┘
            health-check :8008 every 2 s
             ┌─────────┴─────────┐
             ▼                   ▼
   ┌──────────────────┐  ┌──────────────────┐
   │ pg-node1         │  │ pg-node2         │
   │ Spilo: Patroni + │  │ Spilo: Patroni + │
   │ PostgreSQL 15    │◀─┤ PostgreSQL 15    │   streaming replication
   │ REST :8008       │─▶│ REST :8008(→8009)│   (asynchronous)
   └────────┬─────────┘  └────────┬─────────┘
            │   leader key + lease (ttl 30 s)   │
            └──────────────┬──────────────────┘
                           ▼
                   ┌───────────────┐
                   │ etcd v3 :2379 │   DCS — single source of truth for "who is leader"
                   └───────────────┘
```

All four containers run on one Docker bridge network, `bcp_dr_net`, on a single host.

| Component | Image / version | Role |
|---|---|---|
| etcd | `quay.io/coreos/etcd:v3.5.15` (single member) | Distributed configuration store holding the leader key |
| pg-node1, pg-node2 | `ghcr.io/zalando/spilo-15:3.2-p1` (PostgreSQL 15 + Patroni) | Database members; Patroni manages promotion/demotion |
| HAProxy | `haproxy:2.8` | Stable write endpoint that follows the current primary |

Test host: Windows 11, Docker Desktop (Docker 29.8.0).

## 2. Configuration

Defined in [docker-compose.yml](docker-compose.yml) (via `SPILO_CONFIGURATION`) and [haproxy.cfg](haproxy.cfg).

| Setting | Value | Effect |
|---|---|---|
| `ttl` | 30 s | Lifetime of the leader key. If the leader stops renewing it, a replica may take over after it expires. **Upper bound on crash failover time.** |
| `loop_wait` | 10 s | How often each Patroni runs its HA loop (renews key / checks health) |
| `retry_timeout` | 10 s | How long DCS/PostgreSQL operations are retried before demoting |
| `maximum_lag_on_failover` | 1 MiB | A replica further behind than this is not allowed to promote |
| `use_pg_rewind` | true | Old primary is rewound and rejoins as a replica instead of being rebuilt |
| `use_slots` | true | Replication slots keep WAL until the replica has consumed it |
| `synchronous_mode` | *off (default)* | Replication is **asynchronous** — see RPO discussion |
| HAProxy check | `GET /primary`, `inter 2s fall 2 rise 1`, `on-marked-down shutdown-sessions` | Only the primary is UP; connections to a demoted node are cut |

The `unused-custom-image/` folder holds an earlier attempt that built Patroni on top of `postgres:15` with standalone `patroni-node*.yml` files. It was replaced by Spilo, which ships Patroni pre-integrated; it is kept for reference only and is not referenced by the compose file.

## 3. Replication and failover mechanism

1. **Steady state.** The leader holds the etcd leader key and renews its lease every `loop_wait`. The replica streams WAL from it (async) through a replication slot. HAProxy sees `/primary` = 200 only on the leader.
2. **Leader disappears.**
   - *Graceful* (SIGTERM, e.g. `docker stop`): Patroni stops PostgreSQL cleanly and **deletes the leader key** on the way out. The replica's next HA loop sees no leader and promotes almost immediately.
   - *Crash / partition* (SIGKILL, network loss): nothing is released. The replica must wait until the lease **expires** (≤ `ttl`), then races for the key, checks its lag against `maximum_lag_on_failover`, and promotes.
3. **Traffic follows.** HAProxy marks the new primary UP after one successful check (`rise 1`, ≤ 2 s) and the old one DOWN, terminating its sessions.
4. **Self-fencing.** A leader that cannot renew its key (e.g. isolated from etcd) demotes itself to read-only once `retry_timeout`/`ttl` elapse — this is what prevents split-brain.
5. **Rejoin.** When the old leader returns, Patroni runs `pg_rewind` if needed and re-attaches it as a streaming replica.

## 4. Failure simulation method

Four scenarios, automated in [scripts/run-drills.sh](scripts/run-drills.sh):

| Scenario | Injection | Real-world analogue |
|---|---|---|
| `planned_switchover` | `patronictl switchover --force` | Planned maintenance / patching |
| `hard_failover` | `docker stop <leader>` (SIGTERM) | Graceful node shutdown, drain |
| `crash_failover` | `docker kill <leader>` (SIGKILL) | Process/VM crash, power loss |
| `network_isolation` | `docker network disconnect bcp_dr_net <leader>` | Network partition; split-brain test |

**Measurement.** A probe container on `bcp_dr_net` inserts one row through HAProxy (`:5000`) every 200 ms (`PGCONNECT_TIMEOUT=1`) and logs each attempt as `OK`/`FAIL` with millisecond timestamps. All timestamps come from Docker's clock, so they are comparable. Per run:

| Metric | Definition |
|---|---|
| **Promotion** | Injection → surviving node's REST `/primary` returns 200 |
| **Detection** | Injection → first failed probe write |
| **Write RTO** | Injection → first successful probe write after the failure |
| **Write outage (downtime)** | First failed write → first successful write |
| **Acked writes lost (RPO)** | Probe writes acknowledged as committed that are absent after recovery |
| **Rejoin** | Old leader restarted/reconnected → both members healthy, one streaming replica |

Reproduce from this directory, with the cluster running:

```bash
bash scripts/run-drills.sh 3 1 1 3   # 3 stop, 1 isolation, 1 switchover, 3 crash runs
```

## 5. Results

Two independent batches of 8 runs on the same host, run on different days by different operators — 16 runs in total. Times in seconds.

| Batch | Date | Raw data |
|---|---|---|
| A | 2026-10-22 | [results/drills-20261022-113639.csv](results/drills-20261022-113639.csv) |
| B | 2026-10-23 | [results/drills-20261023-234013.csv](results/drills-20261023-234013.csv) |

### Per run — batch A

| Run | Scenario | Old → new leader | Promotion | Detection | Write RTO | Write outage | Acked writes | Lost | Rejoin |
|---|---|---|---|---|---|---|---|---|---|
| switchover-1 | planned_switchover | node2 → node1 | 4.4 | 1.8 | 6.4 | 4.7 | 46 | 0 | 1.1 |
| hard-1 | hard_failover (SIGTERM) | node1 → node2 | 4.8 | 0.5 | 7.8 | 7.2 | 35 | 0 | 6.8 |
| hard-2 | hard_failover (SIGTERM) | node2 → node1 | 5.5 | 1.2 | 8.1 | 6.9 | 42 | 0 | 7.6 |
| hard-3 | hard_failover (SIGTERM) | node1 → node2 | 5.5 | 1.0 | 5.9 | 5.0 | 35 | 0 | 7.5 |
| crash-1 | crash_failover (SIGKILL) | node2 → node1 | 30.0 | 0.8 | 32.8 | 32.1 | 38 | 0 | 15.8 |
| crash-2 | crash_failover (SIGKILL) | node1 → node2 | 31.7 | 0.3 | 32.5 | 32.2 | 36 | 0 | 10.4 |
| crash-3 | crash_failover (SIGKILL) | node2 → node1 | 30.5 | 0.7 | 33.8 | 33.1 | 35 | 0 | 11.9 |
| isolation-1 | network_isolation | node1 → node2 | 27.5 | 0.8 | 28.1 | 27.3 | 138 | 0 | 9.4 |

### Per run — batch B

| Run | Scenario | Old → new leader | Promotion | Detection | Write RTO | Write outage | Acked writes | Lost | Rejoin |
|---|---|---|---|---|---|---|---|---|---|
| switchover-1 | planned_switchover | node2 → node1 | 4.0 | 1.3 | 6.2 | 5.0 | 45 | 0 | 1.7 |
| hard-1 | hard_failover (SIGTERM) | node1 → node2 | 5.5 | 0.9 | 8.4 | 7.5 | 34 | 0 | 8.5 |
| hard-2 | hard_failover (SIGTERM) | node2 → node1 | 5.4 | 0.9 | 6.0 | 5.1 | 35 | 0 | 10.1 |
| hard-3 | hard_failover (SIGTERM) | node1 → node2 | 5.3 | 1.1 | 6.2 | 5.1 | 34 | 0 | 8.6 |
| crash-1 | crash_failover (SIGKILL) | node2 → node1 | 28.3 | 0.9 | 28.3 | 27.4 | 32 | 0 | 15.0 |
| crash-2 | crash_failover (SIGKILL) | node1 → node2 | 34.9 | 0.8 | 35.0 | 34.2 | 31 | 0 | 12.6 |
| crash-3 | crash_failover (SIGKILL) | node2 → node1 | 26.8 | 0.6 | 27.7 | 27.0 | 34 | 0 | 19.8 |
| isolation-1 | network_isolation | node1 → node2 | 29.5 | 0.8 | 29.5 | 28.6 | 122 | 0 | 12.8 |

Split-brain check (both isolation runs): the isolated former leader reported `pg_is_in_recovery() = t` — it **demoted itself**; only one writable primary existed.

### Summary across both batches (mean, min–max; SD = sample standard deviation)

| Scenario | n | Promotion | Detection | Write RTO | Write outage | Acked writes lost | Rejoin |
|---|---|---|---|---|---|---|---|
| Planned switchover | 2 | 4.2 (4.0–4.4) | 1.6 | 6.3 (6.2–6.4) | 4.8 (4.7–5.0) | 0 / 91 | 1.1–1.7 |
| Graceful stop (SIGTERM) | 6 | 5.3 (4.8–5.5), SD 0.3 | 0.9 | 7.1 (5.9–8.4), SD 1.2 | 6.1 (5.0–7.5), SD 1.2 | 0 / 215 | 6.8–10.1 |
| **Crash (SIGKILL)** | 6 | **30.4 (26.8–34.9), SD 2.8** | 0.7 | **31.7 (27.7–35.0), SD 3.0** | **31.0 (27.0–34.2), SD 3.0** | 0 / 206 | 10.4–19.8 |
| Network isolation | 2 | 28.5 (27.5–29.5) | 0.8 | 28.8 (28.1–29.5) | 28.0 (27.3–28.6) | 0 / 260 | 9.4–12.8 |
| **All runs** | **16** | | | | | **0 / 772** | |

Batch B reproduced batch A: graceful-stop means differ by < 1 s, and every run in both batches lost zero acknowledged writes. Crash times spread wider in batch B (27.7–35.0 s vs 32.5–33.8 s), as expected: the leader renews its lease every `loop_wait` (10 s), so how long the replica waits depends on when the last renewal happened before the kill.

### Observations

1. **The failure mode dominates RTO, not the mechanism.** The same cluster recovers writes in ~7 s (mean 7.1) when the leader exits cleanly and ~32 s (mean 31.7) when it crashes — a 4.5× difference — because only a clean exit releases the leader key. Crash and partition RTO are bounded by `ttl` (30 s) plus HAProxy's check interval (≤ 2 s) plus connection retry. *Any BCDR measurement must state which failure was injected; "Patroni RTO" alone is ambiguous.* (The original guide's estimate of 30–45 s for `docker stop` was wrong for this reason and has been corrected.)
2. **Detection by the client is fast (0.3–1.8 s, all 16 runs)** — the application notices immediately, but cannot do anything until the DCS lease expires. Downtime ≈ RTO.
3. **No acknowledged write was lost in any run (RPO = 0 observed, 772 acked writes over 16 runs).** This is with asynchronous replication at a low write rate (~5 inserts/s) where replica lag stayed at 0 MB. It is **not a guarantee**: with async replication, writes committed on the primary but not yet streamed can be lost on a crash, up to `maximum_lag_on_failover` (1 MiB of WAL). Guaranteeing RPO = 0 requires `synchronous_mode: true`, at a latency and availability cost.
4. **Fencing works.** Under partition the isolated leader demoted itself; HAProxy routed to exactly one primary throughout.
5. **Rejoin is automatic** (1–20 s) via `pg_rewind`; crash rejoin is slower because PostgreSQL performs crash recovery first. The cluster advanced from timeline 11 to 20 (batch A) and 21 to 29 (batch B) without manual intervention.
6. **Tuning trade-off.** Lowering `ttl`/`loop_wait` would shorten crash RTO but raises the risk of spurious failovers on transient etcd/network hiccups.

## 6. Limitations of this experiment

- **Single host.** All nodes share one Docker VM; no real zone, disk or network-hardware failure is exercised. Network isolation is simulated with Docker networking.
- **Single etcd member.** The DCS is itself a single point of failure; an etcd outage would make both nodes demote (read-only cluster). Production needs a 3- or 5-member etcd.
- **Single HAProxy.** Also a SPOF; production would use keepalived/VIP, a cloud load balancer, or client-side multi-host connection strings.
- **Two members.** No quorum among database nodes; a third member (or a witness) is normally recommended.
- **Small sample** (n = 2–6 per scenario) and synthetic single-row write load; numbers indicate magnitude, not statistically robust distributions.
- **Database-layer only.** Patroni reports the database recovered. It says nothing about whether the five services reconnected, whether in-flight orders were consistent across services, or whether a customer could complete a purchase. The probe measures *write availability*, not *business availability*.
- The probe leaves a `bcdr_probe` table in the `postgres` database of the cluster (harmless; drop it or reset with `docker compose down -v`).

## 7. Relevance to CloudResilience

Patroni is a good example of what blueprint §2 calls an *existing mechanism that recovers its particular layer*. The experiment shows three things the CloudResilience controller must add on top of such mechanisms:

1. **Classification matters** — graceful stop, crash and partition produce very different recovery behaviour from the same mechanism, so the controller should record the failure class with every measurement.
2. **Infrastructure-recovered ≠ business-recovered** — Patroni's "promotion complete" is only one timestamp; the controller must continue through service, API, database and business-transaction validation before declaring `RECOVERED`.
3. **RPO must be measured, not assumed** — the write-ack probe used here is the prototype for the controller's data-loss measurement (roadmap Phase 8).

The managed equivalent in the final GCP design is **Cloud SQL HA (regional) failover**, evaluated in CloudResilience Scenario 4, with PITR covering the data-corruption case that no replication-based HA (including Patroni) can fix, since corruption replicates too.

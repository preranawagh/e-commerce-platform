# Patroni BCP / DR Testing Playground

Local, self-contained PostgreSQL high-availability lab for CloudResilience. See [README.md](README.md) for the experiment write-up and measured results.

| Role | Service | Port on localhost |
| --- | --- | --- |
| DCS (etcd) | `etcd` | `2379` |
| Patroni node 1 REST API | `pg-node1` | `8008` |
| Patroni node 2 REST API | `pg-node2` | `8009` |
| **Write VIP (HAProxy → current primary only)** | `haproxy` | **`5000`** |
| HAProxy stats page | `haproxy` | `7000` |

Cluster name: `ecommerce-cluster`

Run every `docker compose` command below from this directory:

```powershell
cd C:\Users\waghp\Desktop\e-commerce-platform\bcp-dr\experiments\patroni
```

The Compose project name is pinned to `bcp-dr` (`name:` in `docker-compose.yml`), so containers and volumes created before the lab moved here are reused as-is.

Patroni config inside each Spilo container: `/home/postgres/postgres.yml`

---

## 0. Start the cluster

```powershell
docker compose up -d
```

First run pulls `ghcr.io/zalando/spilo-15:3.2-p1` and bootstraps PostgreSQL. Wait until both nodes are healthy:

```powershell
docker compose ps
```

`etcd`, `pg-node1`, `pg-node2`, and `haproxy` should show `healthy` (allow 45–90 seconds after the images are already local).

Watch bootstrap if needed:

```powershell
docker compose logs -f pg-node1 pg-node2
```

Stop following with `Ctrl+C` when you see one node become leader and the other start streaming.

### Application connection (use this, not a node’s 5432)

```text
Host:     localhost
Port:     5000
User:     postgres
Password: postgres1
Database: cloudresilience
```

URI:

```text
postgresql://postgres:postgres1@localhost:5000/cloudresilience
```

Point the microservices at HAProxy by setting these in the project-root `bcp-dr/.env` (and each service `.env` that overrides them):

```text
DB_HOST=localhost
DB_PORT=5000
DB_NAME=cloudresilience
DB_USER=postgres
DB_PASSWORD=postgres1
```

Create the application database on the current primary. Ignore `already exists` if you re-run it:

```powershell
docker compose exec pg-node1 bash -lc "PGPASSWORD=postgres1 psql -h haproxy -p 5000 -U postgres -d postgres -c 'CREATE DATABASE cloudresilience;'"
```

Then, from the project root (`bcp-dr`, two levels up):

```powershell
cd ..\..
npm run db:setup
cd experiments\patroni
```

Keep the services talking to **port 5000** for every drill. Do not connect the app directly to `pg-node1` or `pg-node2`.

---

## Scenario A — Verification (cluster health and topology)

### A1. Patroni topology

```powershell
docker compose exec pg-node1 patronictl -c /home/postgres/postgres.yml list
```

Expected shape (leader member name may be `pg-node1` or `pg-node2` on first boot):

```text
+ Cluster: ecommerce-cluster (....) ----+-----------+----+-----------+
| Member    | Host      | Role    | State     | TL | Lag in MB |
+-----------+-----------+---------+-----------+----+-----------+
| pg-node1  | pg-node1  | Leader  | running   |  1 |           |
| pg-node2  | pg-node2  | Replica | streaming |  1 |         0 |
+-----------+-----------+---------+-----------+----+-----------+
```

Record the **Leader** member name. You will use it in Scenarios B–D.

### A2. REST API: only the primary answers `/primary` with HTTP 200

```powershell
curl.exe -s -o NUL -w "pg-node1 /primary -> %{http_code}`n" http://localhost:8008/primary
curl.exe -s -o NUL -w "pg-node2 /primary -> %{http_code}`n" http://localhost:8009/primary
```

Expected:

- Leader: `200`
- Replica: `503`

JSON for the leader (change the port if `pg-node2` is leader: `8009`):

```powershell
curl.exe -s http://localhost:8008/patroni
```

You should see `"role": "master"` (or `"primary"`) on the leader and `"role": "replica"` on the other node:

```powershell
curl.exe -s http://localhost:8009/patroni
```

### A3. HAProxy routes writes only to the leader

Open http://localhost:7000/ — exactly one of `pg-node1` / `pg-node2` should be **UP** on backend `postgres_primary`.

Confirm PostgreSQL through the VIP:

```powershell
docker compose exec pg-node1 bash -lc "PGPASSWORD=postgres1 psql -h haproxy -p 5000 -U postgres -d postgres -c \"SELECT inet_server_addr() AS connected_to, pg_is_in_recovery() AS in_recovery, current_user;\""
```

Expected: `in_recovery = f` (you are on the writable primary, never a replica).

Write a canary row you can watch across failovers:

```powershell
docker compose exec pg-node1 bash -lc "PGPASSWORD=postgres1 psql -h haproxy -p 5000 -U postgres -d postgres -c \"CREATE TABLE IF NOT EXISTS bcp_drill(id int PRIMARY KEY, note text, wrote_at timestamptz DEFAULT now()); INSERT INTO bcp_drill(id, note) VALUES (1, 'scenario-a') ON CONFLICT (id) DO UPDATE SET note = EXCLUDED.note, wrote_at = now();\""
```

---

## Scenario B — Controlled switchover (graceful maintenance failover)

Goal: move the primary to the other node without killing a container. This is the maintenance / planned DR path.

### B1. Confirm current leader

```powershell
docker compose exec pg-node1 patronictl -c /home/postgres/postgres.yml list
```

### B2. Interactive switchover

This prompts for leader, candidate, schedule, and confirmation. Answer with the current **Leader**, the other member as candidate, `now`, and `y`.

```powershell
docker compose exec -it pg-node1 patronictl -c /home/postgres/postgres.yml switchover ecommerce-cluster
```

Example session if `pg-node1` is leader:

```text
Master [pg-node1]: pg-node1
Candidate ['pg-node2'] []: pg-node2
When should the switchover take place (e.g. 2020-01-01T12:00) [now]: now
Are you sure you want to switchover cluster ecommerce-cluster, demoting current master pg-node1? [y/N]: y
```

Non-interactive equivalent (edit member names to match `patronictl list`):

```powershell
docker compose exec pg-node1 patronictl -c /home/postgres/postgres.yml switchover ecommerce-cluster --leader pg-node1 --candidate pg-node2 --force
```

### B3. Verify

```powershell
docker compose exec pg-node1 patronictl -c /home/postgres/postgres.yml list
```

The previous replica must now be `Leader`; the old leader must be `Replica` with `Lag in MB` near `0`.

```powershell
curl.exe -s -o NUL -w "pg-node1 /primary -> %{http_code}`n" http://localhost:8008/primary
curl.exe -s -o NUL -w "pg-node2 /primary -> %{http_code}`n" http://localhost:8009/primary
```

Refresh http://localhost:7000/ — HAProxy must mark the new leader **UP** and the old leader **DOWN** (because `/primary` is now 503 there).

Write through port `5000` again; it must succeed on the new primary:

```powershell
docker compose exec pg-node1 bash -lc "PGPASSWORD=postgres1 psql -h haproxy -p 5000 -U postgres -d postgres -c \"INSERT INTO bcp_drill(id, note) VALUES (2, 'scenario-b-switchover') ON CONFLICT (id) DO UPDATE SET note = EXCLUDED.note, wrote_at = now(); SELECT * FROM bcp_drill ORDER BY id;\""
```

Expected: `in_recovery` remains false through HAProxy; row `2` is visible.

---

## Scenario C — Hard failover (stop the primary, measure RTO)

Goal: simulate a primary outage with `docker compose stop`, watch Patroni promote the replica, and measure recovery time until writes work again on port `5000`.

Patroni `ttl` is **30 seconds** and `loop_wait` is **10 seconds**. HAProxy re-checks every **2 seconds**.

Which signal you send changes the result a lot (measured 2026-10-22, see [README.md](README.md#5-results)):

- `docker compose stop` sends **SIGTERM**. Patroni shuts PostgreSQL down cleanly and **releases the leader key**, so the replica promotes in ~5 s and writes return in ~6–8 s. This models a *graceful* outage (planned shutdown, node drain).
- `docker kill` sends **SIGKILL**. Nothing is released, so the replica must wait for the leader key **TTL** to expire: promotion ~30 s, writes return in ~32 s (27–35 s over 6 runs). This models a real *crash*. Use `docker kill $leader` in C2 for crash RTO.

For repeatable measurements with a write probe, use `bash scripts/run-drills.sh` instead of the manual loop below.

### C1. Identify the live leader and the replica REST port

```powershell
docker compose exec pg-node1 patronictl -c /home/postgres/postgres.yml list
```

Use:

- Leader service name as `$leader` (`pg-node1` or `pg-node2`)
- Replica REST URL: `http://localhost:8009/primary` if replica is `pg-node2`, or `http://localhost:8008/primary` if replica is `pg-node1`

### C2. Stop the primary and time promotion

Example when `pg-node1` is leader and `pg-node2` is replica. Swap names/ports if topology is reversed.

```powershell
$leader = "pg-node1"
$replicaPrimaryUrl = "http://localhost:8009/primary"

$start = Get-Date
docker compose stop $leader

do {
    Start-Sleep -Milliseconds 500
    $code = curl.exe -s -o NUL -w "%{http_code}" $replicaPrimaryUrl
    $elapsed = [math]::Round(((Get-Date) - $start).TotalSeconds, 1)
    Write-Host "$(Get-Date -Format HH:mm:ss.fff) replica /primary=$code  elapsed=${elapsed}s"
} while ($code -ne "200")

Write-Host "Patroni promotion RTO: $elapsed seconds"
```

### C3. Confirm HAProxy and data

```powershell
docker compose exec pg-node2 patronictl -c /home/postgres/postgres.yml list
```

The surviving node must be `Leader`. The stopped node will be missing from the running containers (`docker compose ps`).

```powershell
docker compose exec pg-node2 bash -lc "PGPASSWORD=postgres1 psql -h haproxy -p 5000 -U postgres -d postgres -c \"INSERT INTO bcp_drill(id, note) VALUES (3, 'scenario-c-hard-failover') ON CONFLICT (id) DO UPDATE SET note = EXCLUDED.note, wrote_at = now(); SELECT inet_server_addr(), pg_is_in_recovery(), * FROM bcp_drill ORDER BY id;\""
```

Expected: insert succeeds; rows `1` and `2` from earlier drills are still present (RPO ≈ 0 for committed transactions that had streamed to the replica).

http://localhost:7000/ should show only the surviving node **UP**.

### C4. Bring the old primary back (rejoin as replica)

```powershell
docker compose start pg-node1
```

Wait ~20 seconds, then:

```powershell
docker compose exec pg-node2 patronictl -c /home/postgres/postgres.yml list
```

Expected: former primary returns as `Replica`, `streaming`, lag `0`. If rewind is required, Spilo/Patroni runs `pg_rewind` automatically (`use_pg_rewind: true`).

Do not continue to Scenario D until **both** members are listed and streaming.

---

## Scenario D — Network isolation / split-brain check

Goal: pull the leader off `bcp_dr_net` so it cannot see etcd or HAProxy. The replica should become the unique writable primary. The isolated node should demote itself instead of remaining a second writer.

Docker Compose project network name is **`bcp_dr_net`**. Container names are **`pg-node1`** and **`pg-node2`**.

### D1. Identify the leader

```powershell
docker compose exec pg-node1 patronictl -c /home/postgres/postgres.yml list
```

The examples below assume `pg-node1` is leader. If `pg-node2` is leader, swap those two names everywhere in this scenario.

### D2. Watch logs in a second terminal (optional but useful)

Terminal 2 — current leader:

```powershell
docker logs -f pg-node1
```

Terminal 3 — current replica:

```powershell
docker logs -f pg-node2
```

### D3. Disconnect the leader from the overlay/bridge network

```powershell
docker network disconnect bcp_dr_net pg-node1
```

Immediate effects:

- HAProxy can no longer health-check or send traffic to `pg-node1`.
- `pg-node1` can no longer refresh its etcd leader lock.
- After `ttl` (30s) the lock expires; `pg-node2` should acquire it and promote.

Poll the surviving node (still on the network):

```powershell
$start = Get-Date
do {
    Start-Sleep -Milliseconds 500
    $code = curl.exe -s -o NUL -w "%{http_code}" http://localhost:8009/primary
    $elapsed = [math]::Round(((Get-Date) - $start).TotalSeconds, 1)
    Write-Host "$(Get-Date -Format HH:mm:ss.fff) pg-node2 /primary=$code  elapsed=${elapsed}s"
} while ($code -ne "200")

Write-Host "Promotion after isolation: $elapsed seconds"
```

If `pg-node2` was the isolated leader, poll `http://localhost:8008/primary` instead.

### D4. Prove there is no split-brain on the write VIP

```powershell
docker compose exec pg-node2 patronictl -c /home/postgres/postgres.yml list
```

Expected: `pg-node2` is `Leader`. `pg-node1` may appear unreachable / not listed until it is reconnected.

Writes through HAProxy must succeed **and** `pg_is_in_recovery()` must be `f`:

```powershell
docker compose exec pg-node2 bash -lc "PGPASSWORD=postgres1 psql -h haproxy -p 5000 -U postgres -d postgres -c \"INSERT INTO bcp_drill(id, note) VALUES (4, 'scenario-d-after-isolation') ON CONFLICT (id) DO UPDATE SET note = EXCLUDED.note, wrote_at = now(); SELECT inet_server_addr() AS vip_backend, pg_is_in_recovery() AS in_recovery; SELECT * FROM bcp_drill ORDER BY id;\""
```

### D5. Confirm the isolated node demoted (no second writer)

`docker compose exec` still works because it uses the Docker daemon, not `bcp_dr_net`:

```powershell
docker exec pg-node1 bash -lc "psql -U postgres -c \"SELECT pg_is_in_recovery() AS isolated_in_recovery, pg_is_wal_replay_paused();\""
```

Expected after Patroni notices it lost the DCS lock:

- `isolated_in_recovery = t` (demoted; it will not accept writes)
- Leader lock is **not** still held by this node

You may also see `pg_is_in_recovery() = t` slightly before HAProxy reports the other node as primary; wait until both D4 and D5 agree.

A split-brain failure would look like **both** of these being true at once:

- Isolated node: `pg_is_in_recovery() = f`
- Surviving node: `/primary` returns `200`

That must **not** happen. HAProxy only ever has one `/primary` 200 backend, so the application on port `5000` is protected even during the brief window while the isolated node is still shutting down writes locally.

### D6. Reconnect and heal

```powershell
docker network connect bcp_dr_net pg-node1
```

Wait 15–30 seconds:

```powershell
docker compose exec pg-node2 patronictl -c /home/postgres/postgres.yml list
```

Expected: `pg-node1` rejoins as `Replica`, `streaming`, lag `0`. If timelines diverged, rewind/rebuild runs automatically.

```powershell
docker compose exec pg-node2 bash -lc "PGPASSWORD=postgres1 psql -h haproxy -p 5000 -U postgres -d postgres -c \"SELECT * FROM bcp_drill ORDER BY id;\""
```

Row `4` written during isolation must still be present on the healed cluster.

---

## Reset the playground

Stop containers, keep data volumes:

```powershell
docker compose down
```

Destroy data (new cluster identity, empty database):

```powershell
docker compose down -v
docker compose up -d
```

After `-v` you must recreate `cloudresilience` and re-run `npm run db:setup` from the project root.

---

## Command cheat sheet

```powershell
docker compose exec pg-node1 patronictl -c /home/postgres/postgres.yml list
docker compose exec pg-node1 patronictl -c /home/postgres/postgres.yml history
docker compose exec pg-node1 patronictl -c /home/postgres/postgres.yml failover ecommerce-cluster --force
curl.exe -s http://localhost:8008/patroni
curl.exe -s http://localhost:8009/patroni
curl.exe -s -o NUL -w "%{http_code}`n" http://localhost:8008/primary
curl.exe -s -o NUL -w "%{http_code}`n" http://localhost:8009/primary
```

Application DSN used in every drill:

```text
postgresql://postgres:postgres1@localhost:5000/cloudresilience
```

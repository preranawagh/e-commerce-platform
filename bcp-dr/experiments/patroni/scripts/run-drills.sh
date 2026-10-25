#!/usr/bin/env bash
# Repeatable failover drills for the Patroni lab.
#
# A probe container on bcp_dr_net inserts one row through HAProxy (:5000) every
# PROBE_INTERVAL seconds and logs each attempt as OK/FAIL with a millisecond
# timestamp. All timestamps are taken inside Docker's clock, so they are
# comparable with each other.
#
# Usage (from experiments/patroni):
#   bash scripts/run-drills.sh [stop_runs] [isolation_runs] [switchover_runs] [crash_runs]
#
# Scenarios:
#   planned_switchover  patronictl switchover (maintenance path)
#   hard_failover       `docker stop` = SIGTERM: Patroni shuts down cleanly and
#                       releases the leader key, so promotion is fast
#   crash_failover      `docker kill` = SIGKILL: no clean shutdown, the replica
#                       must wait for the leader key TTL to expire
#   network_isolation   leader disconnected from bcp_dr_net (split-brain check)
# Output: results/drills-<timestamp>.csv plus raw probe logs in results/raw/.

set -euo pipefail
export MSYS_NO_PATHCONV=1   # keep Git Bash on Windows from rewriting container paths

HARD_RUNS=${1:-3}
ISOLATION_RUNS=${2:-1}
SWITCHOVER_RUNS=${3:-1}
CRASH_RUNS=${4:-0}
PROBE_INTERVAL=${PROBE_INTERVAL:-0.2}
NET=bcp_dr_net
IMAGE=ghcr.io/zalando/spilo-15:3.2-p1
PSQL="PGPASSWORD=postgres1 PGCONNECT_TIMEOUT=1 psql -h haproxy -p 5000 -U postgres -d postgres -qAt"

cd "$(dirname "$0")/.."
mkdir -p results/raw
STAMP=$(date +%Y%m%d-%H%M%S)
CSV="results/drills-$STAMP.csv"
echo "run,scenario,old_leader,new_leader,promotion_s,first_fail_after_injection_s,write_rto_s,write_outage_s,acked_writes,acked_missing,unacked_but_present,rejoin_s" > "$CSV"

now_ms() { docker exec probe-clock date +%s%3N; }

leader() {
  for n in pg-node1:8008 pg-node2:8009; do
    if [ "$(curl -s -o /dev/null -w '%{http_code}' "http://localhost:${n#*:}/primary")" = 200 ]; then
      echo "${n%%:*}"; return; fi
  done
  echo none
}
other() { [ "$1" = pg-node1 ] && echo pg-node2 || echo pg-node1; }
port_of() { [ "$1" = pg-node1 ] && echo 8008 || echo 8009; }

wait_healthy_pair() {
  # Both members up: one answers /primary, the other /replica (streaming).
  local start; start=$(now_ms)
  until [ "$(curl -s -o /dev/null -w '%{http_code}' http://localhost:8008/health)" = 200 ] \
     && [ "$(curl -s -o /dev/null -w '%{http_code}' http://localhost:8009/health)" = 200 ] \
     && { [ "$(curl -s -o /dev/null -w '%{http_code}' http://localhost:8008/replica)" = 200 ] \
          || [ "$(curl -s -o /dev/null -w '%{http_code}' http://localhost:8009/replica)" = 200 ]; } \
     && [ "$(leader)" != none ]; do
    sleep 1
    if [ $(( $(now_ms) - start )) -gt 240000 ]; then echo "cluster did not heal in 240s" >&2; exit 1; fi
  done
  echo $(( $(now_ms) - start ))
}

# A long-lived helper container gives us a clock inside Docker's VM.
docker rm -f probe-clock >/dev/null 2>&1 || true
docker run -d --name probe-clock --network "$NET" --entrypoint sleep "$IMAGE" infinity >/dev/null

docker exec probe-clock bash -c "$PSQL -c 'CREATE TABLE IF NOT EXISTS bcdr_probe(run text, seq int, client_ms bigint, server_ts timestamptz DEFAULT now(), PRIMARY KEY(run, seq));'"

start_probe() {
  local run=$1
  docker rm -f probe-writer >/dev/null 2>&1 || true
  docker run -d --name probe-writer --network "$NET" --entrypoint bash "$IMAGE" -c "
    i=0
    while true; do
      i=\$((i+1)); ts=\$(date +%s%3N)
      if $PSQL -c \"INSERT INTO bcdr_probe(run, seq, client_ms) VALUES ('$run', \$i, \$ts)\" >/dev/null 2>&1; then
        echo \"OK \$i \$ts \$(date +%s%3N)\"
      else
        echo \"FAIL \$i \$ts \$(date +%s%3N)\"
      fi
      sleep $PROBE_INTERVAL
    done" >/dev/null
}

stop_probe() {
  local run=$1
  sleep 3   # a few post-recovery OKs so the window is closed
  docker logs probe-writer > "results/raw/$run.log" 2>&1
  docker rm -f probe-writer >/dev/null
}

analyse() {
  # args: run scenario old new t0 promotion_ms rejoin_ms
  local run=$1 scen=$2 old=$3 new=$4 t0=$5 promo=$6 rejoin=$7 log="results/raw/$1.log"
  local first_fail first_ok_after acked missing extra present
  first_fail=$(awk -v t0="$t0" '$1=="FAIL" && $3>=t0 {print $3; exit}' "$log")
  first_ok_after=$(awk -v t0="$t0" -v ff="${first_fail:-0}" '$1=="OK" && $3>=t0 && $3>ff && ff>0 {print $4; exit}' "$log")
  acked=$(awk '$1=="OK"' "$log" | wc -l | tr -d ' ')
  present=$(docker exec probe-clock bash -c "$PSQL -c \"SELECT string_agg(seq::text, ' ') FROM bcdr_probe WHERE run='$run'\"")
  missing=0; extra=0
  for s in $(awk '$1=="OK"{print $2}' "$log"); do
    case " $present " in *" $s "*) ;; *) missing=$((missing+1));; esac
  done
  for s in $(awk '$1=="FAIL"{print $2}' "$log"); do
    case " $present " in *" $s "*) extra=$((extra+1));; esac
  done
  local fail_s rto_s outage_s
  if [ -n "$first_fail" ]; then
    fail_s=$(awk -v a="$first_fail" -v b="$t0" 'BEGIN{printf "%.1f",(a-b)/1000}')
    rto_s=$(awk -v a="$first_ok_after" -v b="$t0" 'BEGIN{printf "%.1f",(a-b)/1000}')
    outage_s=$(awk -v a="$first_ok_after" -v b="$first_fail" 'BEGIN{printf "%.1f",(a-b)/1000}')
  else
    fail_s=NA; rto_s=0.0; outage_s=0.0
  fi
  local promo_s rejoin_s
  promo_s=$(awk -v a="$promo" 'BEGIN{printf "%.1f",a/1000}')
  rejoin_s=$(awk -v a="$rejoin" 'BEGIN{printf "%.1f",a/1000}')
  echo "$run,$scen,$old,$new,$promo_s,$fail_s,$rto_s,$outage_s,$acked,$missing,$extra,$rejoin_s" | tee -a "$CSV"
}

wait_promotion() {
  # Poll the surviving member's /primary until it answers 200; returns ms since t0.
  local node=$1 t0=$2
  until [ "$(curl -s -o /dev/null -w '%{http_code}' "http://localhost:$(port_of "$node")/primary")" = 200 ]; do
    sleep 0.25
    if [ $(( $(now_ms) - t0 )) -gt 180000 ]; then echo "no promotion in 180s" >&2; exit 1; fi
  done
  echo $(( $(now_ms) - t0 ))
}

wait_write_ok_after() {
  local t0=$1
  until docker logs probe-writer 2>/dev/null | awk -v t0="$t0" '$1=="FAIL"&&$3>=t0{f=1} f&&$1=="OK"{ok=1} END{exit !ok}'; do
    sleep 0.5
    if [ $(( $(now_ms) - t0 )) -gt 180000 ]; then echo "writes did not recover in 180s" >&2; break; fi
  done
}

echo "Waiting for a healthy leader/replica pair..."
wait_healthy_pair >/dev/null

run_hard() {
  # $1 = run number, $2 = docker verb (stop|kill), $3 = scenario name
  local verb=${2:-stop} scen=${3:-hard_failover}
  local run="${scen%%_*}-$1-$STAMP" old new t0 promo rejoin
  old=$(leader); new=$(other "$old")
  echo "== $run: docker $verb leader $old"
  start_probe "$run"; sleep 5
  t0=$(now_ms); docker "$verb" "$old" >/dev/null
  promo=$(wait_promotion "$new" "$t0")
  wait_write_ok_after "$t0"
  stop_probe "$run"
  local r0; r0=$(now_ms); docker start "$old" >/dev/null
  wait_healthy_pair >/dev/null; rejoin=$(( $(now_ms) - r0 ))
  analyse "$run" "$scen" "$old" "$new" "$t0" "$promo" "$rejoin"
}

run_isolation() {
  local run="isolation-$1-$STAMP" old new t0 promo rejoin demoted
  old=$(leader); new=$(other "$old")
  echo "== $run: disconnecting leader $old from $NET"
  start_probe "$run"; sleep 5
  t0=$(now_ms); docker network disconnect "$NET" "$old"
  promo=$(wait_promotion "$new" "$t0")
  wait_write_ok_after "$t0"
  # Split-brain check: isolated node must be in recovery (demoted) once the other node is primary.
  for _ in $(seq 1 60); do
    demoted=$(docker exec "$old" bash -c "psql -U postgres -qAtc 'SELECT pg_is_in_recovery()'" 2>/dev/null || echo err)
    [ "$demoted" = t ] && break; sleep 1
  done
  echo "   isolated $old pg_is_in_recovery=$demoted  (t = demoted, no split-brain)"
  echo "$run isolated_node_in_recovery=$demoted" >> "results/raw/split-brain-$STAMP.txt"
  stop_probe "$run"
  local r0; r0=$(now_ms); docker network connect "$NET" "$old"
  wait_healthy_pair >/dev/null; rejoin=$(( $(now_ms) - r0 ))
  analyse "$run" network_isolation "$old" "$new" "$t0" "$promo" "$rejoin"
}

run_switchover() {
  local run="switchover-$1-$STAMP" old new t0 promo
  old=$(leader); new=$(other "$old")
  echo "== $run: planned switchover $old -> $new"
  start_probe "$run"; sleep 5
  # Patroni refuses a switchover while the candidate is still catching up, so retry briefly.
  local out attempt
  for attempt in 1 2 3 4 5 6; do
    t0=$(now_ms)
    if out=$(docker exec "$new" patronictl -c /home/postgres/postgres.yml switchover ecommerce-cluster \
        --leader "$old" --candidate "$new" --force 2>&1); then break; fi
    echo "   switchover attempt $attempt refused: $(echo "$out" | tail -1)"
    [ "$attempt" = 6 ] && { echo "switchover failed" >&2; exit 1; }
    sleep 10
  done
  promo=$(wait_promotion "$new" "$t0")
  sleep 5
  stop_probe "$run"
  local rejoin; rejoin=$(wait_healthy_pair)
  analyse "$run" planned_switchover "$old" "$new" "$t0" "$promo" "$rejoin"
}

for i in $(seq 1 "$SWITCHOVER_RUNS"); do run_switchover "$i"; done
for i in $(seq 1 "$HARD_RUNS"); do run_hard "$i" stop hard_failover; done
for i in $(seq 1 "$CRASH_RUNS"); do run_hard "$i" kill crash_failover; done
for i in $(seq 1 "$ISOLATION_RUNS"); do run_isolation "$i"; done

docker rm -f probe-clock >/dev/null
echo
echo "Results: $CSV"

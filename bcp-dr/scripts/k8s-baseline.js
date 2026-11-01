#!/usr/bin/env node
// Phase 4 baseline: how Kubernetes recovers BY ITSELF (no BCDR controller yet).
// Breaks one thing on the local kind cluster, measures recovery, and puts it back.
//
//   node scripts/k8s-baseline.js pod-delete   # kill one order-service pod
//   node scripts/k8s-baseline.js node-stop    # power off the worker (zone) running an order-service pod
//   node scripts/k8s-baseline.js bad-image    # roll out an image tag that does not exist
//
// While it runs, a probe inside the cluster calls order-service through its
// Service every ~0.5 s, so we also see whether customers would have noticed.
// Results are appended to docs/evidence/phase4-baseline/results.jsonl.

const { execFileSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const NS = 'cloudresilience';
const SVC = 'order-service';
const PROBE_URL = `http://${SVC}.${NS}.svc.cluster.local:3004/health`;
const OUT = path.join(__dirname, '..', 'docs', 'evidence', 'phase4-baseline', 'results.jsonl');
const NODE_STOP_WAIT_S = Number(process.env.NODE_STOP_WAIT_S || 420);

const sh = (cmd, args) => execFileSync(cmd, args, { encoding: 'utf8' }).trim();
const kubectl = (...args) => sh('kubectl', ['-n', NS, ...args]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const now = () => Date.now();
const secs = (ms) => Math.round(ms / 100) / 10;
const log = (msg) => console.log(`${new Date().toISOString().slice(11, 23)}  ${msg}`);

function pods(app) {
  return JSON.parse(kubectl('get', 'pods', '-l', `app.kubernetes.io/name=${app}`, '-o', 'json')).items.map((p) => ({
    name: p.metadata.name,
    node: p.spec.nodeName,
    deleting: !!p.metadata.deletionTimestamp,
    phase: p.status.phase,
    ready: (p.status.conditions || []).some((c) => c.type === 'Ready' && c.status === 'True'),
    waiting: (p.status.containerStatuses || []).map((c) => c.state.waiting && c.state.waiting.reason).filter(Boolean)[0],
  }));
}

function nodeReady(node) {
  const conds = JSON.parse(sh('kubectl', ['get', 'node', node, '-o', 'json'])).status.conditions;
  return conds.find((c) => c.type === 'Ready').status; // True | False | Unknown
}

function readyEndpoints() {
  const slices = JSON.parse(kubectl('get', 'endpointslices', '-l', `kubernetes.io/service-name=${SVC}`, '-o', 'json')).items;
  return slices.flatMap((s) => s.endpoints || []).filter((e) => e.conditions && e.conditions.ready).map((e) => e.nodeName);
}

async function waitFor(label, fn, timeoutS) {
  const start = now();
  while (now() - start < timeoutS * 1000) {
    if (fn()) return now();
    await sleep(500);
  }
  log(`timed out after ${timeoutS}s waiting for: ${label}`);
  return null;
}

// Probe from a frontend pod (the frontend is allowed to call the APIs) that is
// not on the node we are about to break.
function startProbe(avoidNode) {
  const pod = pods('frontend').find((p) => p.ready && p.node !== avoidNode);
  if (!pod) throw new Error('no ready frontend pod to probe from');
  const results = [];
  const loop = `while true; do if wget -q -T 2 -O /dev/null ${PROBE_URL}; then echo ok; else echo fail; fi; sleep 0.5; done`;
  const child = spawn('kubectl', ['-n', NS, 'exec', pod.name, '--', 'sh', '-c', loop]);
  let buf = '';
  child.stdout.on('data', (d) => {
    buf += d;
    const lines = buf.split('\n');
    buf = lines.pop();
    for (const l of lines) if (l.trim()) results.push({ t: now(), ok: l.trim() === 'ok' });
  });
  return {
    stop() {
      child.kill();
      const fails = results.filter((r) => !r.ok);
      return {
        probes: results.length,
        failures: fails.length,
        outage_window_s: fails.length ? secs(fails[fails.length - 1].t - fails[0].t) : 0,
      };
    },
  };
}

async function podDelete() {
  const victim = pods(SVC).find((p) => p.ready);
  const probe = startProbe(null);
  await sleep(3000);
  const t0 = now();
  log(`deleting pod ${victim.name} on ${victim.node}`);
  kubectl('delete', 'pod', victim.name, '--wait=false');
  const tReady = await waitFor('2 ready pods again', () => pods(SVC).filter((p) => p.ready && !p.deleting && p.name !== victim.name).length >= 2, 120);
  await sleep(3000);
  const replacement = pods(SVC).find((p) => p.name !== victim.name && !p.deleting && p.ready && p.node);
  return {
    victim: victim.name,
    replacement_ready_s: tReady && secs(tReady - t0),
    replacement_node: replacement && replacement.node,
    ...probe.stop(),
  };
}

async function nodeStop() {
  const victim = pods(SVC).find((p) => p.ready);
  const node = victim.node;
  const probe = startProbe(node);
  await sleep(3000);
  const t0 = now();
  log(`stopping node ${node} (docker stop) — it hosts ${victim.name}`);
  sh('docker', ['stop', node]);
  try {
    const tNotReady = await waitFor('node NotReady', () => nodeReady(node) !== 'True', 180);
    log(`node marked ${nodeReady(node)}`);
    const tEndpoint = await waitFor('dead pod removed from Service', () => !readyEndpoints().includes(node), 180);
    log('dead pod no longer receives traffic');
    log(`waiting up to ${NODE_STOP_WAIT_S}s for Kubernetes to start a replacement on another node`);
    const tResched = await waitFor('replacement pod ready elsewhere',
      () => pods(SVC).filter((p) => p.ready && p.node !== node).length >= 2, NODE_STOP_WAIT_S);
    return {
      node,
      victim: victim.name,
      node_notready_s: tNotReady && secs(tNotReady - t0),
      endpoint_removed_s: tEndpoint && secs(tEndpoint - t0),
      replacement_ready_s: tResched ? secs(tResched - t0) : `not within ${NODE_STOP_WAIT_S}s`,
      ...probe.stop(),
    };
  } finally {
    log(`restarting node ${node}`);
    sh('docker', ['start', node]);
    await waitFor('node Ready again', () => nodeReady(node) === 'True', 180);
    log('node is Ready again');
  }
}

async function badImage() {
  const container = SVC;
  const good = kubectl('get', 'deploy', SVC, '-o', `jsonpath={.spec.template.spec.containers[0].image}`);
  const probe = startProbe(null);
  await sleep(3000);
  const t0 = now();
  log(`rolling out a broken image tag (was ${good})`);
  kubectl('set', 'image', `deploy/${SVC}`, `${container}=cloudresilience/${SVC}:does-not-exist`);
  await waitFor('new pod stuck pulling', () => pods(SVC).some((p) => /ImagePull/.test(p.waiting || '')), 60);
  await sleep(45000); // watch for a while: does Kubernetes undo it by itself?
  const during = pods(SVC);
  const stillServing = during.filter((p) => p.ready).length;
  const stuck = during.find((p) => p.waiting);
  log(`after 45 s: ${stillServing} old pods still serving, new pod is ${stuck && stuck.waiting}; Kubernetes did not roll back`);
  const tUndo = now();
  kubectl('rollout', 'undo', `deploy/${SVC}`);
  kubectl('rollout', 'status', `deploy/${SVC}`, '--timeout=120s');
  const tClean = now();
  return {
    new_pod_state: stuck && stuck.waiting,
    old_pods_serving: stillServing,
    auto_rollback: false,
    manual_undo_to_healthy_s: secs(tClean - tUndo),
    broken_for_s: secs(tClean - t0),
    ...probe.stop(),
  };
}

const scenarios = { 'pod-delete': podDelete, 'node-stop': nodeStop, 'bad-image': badImage };

(async () => {
  const name = process.argv[2];
  if (!scenarios[name]) {
    console.error(`usage: node scripts/k8s-baseline.js <${Object.keys(scenarios).join('|')}>`);
    process.exit(2);
  }
  const started = new Date().toISOString();
  const result = await scenarios[name]();
  const record = { scenario: name, started, ...result };
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.appendFileSync(OUT, JSON.stringify(record) + '\n');
  console.log('\nRESULT ' + JSON.stringify(record, null, 2));
  process.exit(0);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});

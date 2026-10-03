// validation/twin-rate-random-arrivals/harness/run.mjs — study 2026-10-twin-rate-random-arrivals. Registered in
// ../PREREGISTRATION.md (d1827a2) before this file existed; generator, cells, seeds, bars and figures are §1–§3
// there. Drives the committed dist/ (run `npx tsc` first).
//
//   node validation/twin-rate-random-arrivals/harness/run.mjs            full run, R = 10000, writes results/run-<UTC>/
//   node validation/twin-rate-random-arrivals/harness/run.mjs --smoke    R = 20 per cell, prints each cell's line

import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const gate = require('../../../dist/per-shard/twin-gate.js');
const pkg = require('../../../package.json');

const HERE = dirname(fileURLToPath(import.meta.url));
const SMOKE = process.argv.includes('--smoke');
const T = 60, R = SMOKE ? 20 : 10000, ALPHA = 0.05, TRAFFIC = 2440, P0 = 0.005, PROCS = 4, SEED0 = 20261003;
const BAR = ALPHA + 2.58 * Math.sqrt((ALPHA * (1 - ALPHA)) / 10000);
const CFG_BASE = { alphaRollback: ALPHA, alphaProceed: 1e-12, alphaSrm: 0.001, canaryWeight: 0.5, maxTicks: T };
const METRICS = [
  { id: 'http_5xx', kind: 'rate', worse: 'higher', tolerance: 0.2 },
  { id: 'p99_latency', kind: 'sign', worse: 'higher', tolerance: 0.15, margin: { relative: 0.10 } },
];

// ── Generator primitives, as 2026-09-twin-null / 2026-09-twin-gate ─────────────────────────────
function lcg(seed) {
  let s = seed >>> 0;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return (s + 0.5) / 4294967296; };
}
function gaussian(rng) { return Math.sqrt(-2 * Math.log(rng())) * Math.cos(2 * Math.PI * rng()); }
function poisson(rng, mean) {
  if (mean <= 0) return 0;
  if (mean > 30) return Math.max(0, Math.round(mean + Math.sqrt(mean) * gaussian(rng)));
  const L = Math.exp(-mean); let k = 0, p = 1;
  do { k++; p *= rng(); } while (p > L);
  return k - 1;
}
function binomial(rng, n, p) {
  if (n <= 0 || p <= 0) return 0;
  if (p >= 1) return n;
  if (p > 0.5) return n - binomial(rng, n, 1 - p);
  const v = n * p * (1 - p);
  if (v >= 30) return Math.min(n, Math.max(0, Math.round(n * p + Math.sqrt(v) * gaussian(rng))));
  const lq = Math.log(1 - p);
  let x = 0, k = 0;
  for (;;) { x += Math.floor(Math.log(rng()) / lq) + 1; if (x > n) return k; k++; }
}
/** Multinomial(n, ¼ × 4) by sequential binomials. */
function splitProcs(rng, n) {
  const out = []; let left = n;
  for (let i = 0; i < PROCS; i++) { const k = i === PROCS - 1 ? left : binomial(rng, left, 1 / (PROCS - i)); out.push(k); left -= k; }
  return out;
}
function oddsShift(p, psi) { return (psi * p) / (1 - p + psi * p); }
/** The real service's counter (server.mjs): request n faults iff ⌊n·f + ½⌋ > ⌊(n−1)·f + ½⌋. Faults among
 *  requests n0+1..n0+k = ⌊(n0+k)·f + ½⌋ − ⌊n0·f + ½⌋. */
function counterFaults(n0, k, f) { return Math.floor((n0 + k) * f + 0.5) - Math.floor(n0 * f + 0.5); }

// ── Cells, in §3 order ──────────────────────────────────────────────────────────────────────────
const CELLS = [
  { id: 'N-R', arrivals: 'random', rho: 1.0, bar: 'null' },
  { id: 'D-1.5', arrivals: 'deterministic', rho: 1.5, bar: 'repro', band: [37, 43] },
  { id: 'D-2.0', arrivals: 'deterministic', rho: 2.0, bar: 'repro', band: [22, 29] },
  { id: 'R-1.5', arrivals: 'random', rho: 1.5, bar: null },
  { id: 'R-2.0', arrivals: 'random', rho: 2.0, bar: null },
  { id: 'R-1.2', arrivals: 'random', rho: 1.2, bar: null },
];

function replicate(cell, rng) {
  const cfg = { ...CFG_BASE, metrics: METRICS };
  let gs = gate.initTwinGate(cfg);
  const pc = oddsShift(P0, cell.rho), pk = P0;
  const counters = { canary: new Array(PROCS).fill(0), control: new Array(PROCS).fill(0) };
  let eventsC = 0, eventsK = 0;
  for (let t = 1; t <= T; t++) {
    const n = poisson(rng, TRAFFIC);
    const nc = binomial(rng, n, 0.5), nk = n - nc;
    let bc, bk;
    if (cell.arrivals === 'random') { bc = binomial(rng, nc, pc); bk = binomial(rng, nk, pk); }
    else {
      bc = 0; bk = 0;
      for (const [arm, nArm, f] of [['canary', nc, pc], ['control', nk, pk]]) {
        const per = splitProcs(rng, nArm);
        for (let i = 0; i < PROCS; i++) { const b = counterFaults(counters[arm][i], per[i], f); counters[arm][i] += per[i]; if (arm === 'canary') bc += b; else bk += b; }
      }
    }
    eventsC += bc; eventsK += bk;
    const input = { canaryRequests: nc, controlRequests: nk, observations: {
      http_5xx: { canaryEvents: bc, canaryTotal: nc, controlEvents: bk, controlTotal: nk },
      p99_latency: { canary: 76, control: 76 },
    } };
    const step = gate.stepTwinGate(cfg, gs, input);
    gs = step.state;
    const d = step.decision;
    if (d.verdict !== 'extend') {
      const fired = d.metrics.filter((m) => m.rollbackE >= 2 / ALPHA).map((m) => m.id);
      return { verdict: d.verdict, tick: d.tick, fired, eventsC, eventsK };
    }
  }
  return { verdict: 'extend', tick: null, fired: [], eventsC, eventsK };
}

function quantile(sorted, q) { if (sorted.length === 0) return null; return sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))]; }

// ── Run ─────────────────────────────────────────────────────────────────────────────────────────
const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
const out = join(HERE, '..', 'results', `${SMOKE ? 'smoke' : 'run'}-${stamp}`);
if (existsSync(out)) throw new Error(`refusing to overwrite ${out}`);
const results = [];
CELLS.forEach((cell, i) => {
  const rng = lcg(SEED0 + 7919 * i);
  const reps = [];
  for (let r = 0; r < R; r++) reps.push(replicate(cell, rng));
  const rollbacks = reps.filter((x) => x.verdict === 'rollback');
  const ticks = rollbacks.map((x) => x.tick).sort((a, b) => a - b);
  const wrongDetector = rollbacks.filter((x) => !(x.fired.length === 1 && x.fired[0] === 'http_5xx')).length;
  const res = {
    cell: cell.id, arrivals: cell.arrivals, rho: cell.rho, R,
    rollback_by_60: rollbacks.length / R, undecided_at_60: reps.filter((x) => x.verdict === 'extend' || x.verdict === 'inconclusive').length / R, // the gate returns 'inconclusive' at maxTicks
    proceeds: reps.filter((x) => x.verdict === 'proceed').length, halts: reps.filter((x) => x.verdict === 'invalid_experiment').length,
    inconclusive: reps.filter((x) => x.verdict === 'inconclusive').length,
    tick: { median: quantile(ticks, 0.5), q25: quantile(ticks, 0.25), q75: quantile(ticks, 0.75), p90: quantile(ticks, 0.9), p99: quantile(ticks, 0.99), min: ticks[0] ?? null, max: ticks[ticks.length - 1] ?? null },
    rollbacks_not_on_http_5xx_alone: wrongDetector,
    mean_events_per_tick: { canary: reps.reduce((a, x) => a + x.eventsC / (x.tick ?? T), 0) / R, control: reps.reduce((a, x) => a + x.eventsK / (x.tick ?? T), 0) / R },
  };
  let verdict = 'reported';
  if (cell.bar === 'null') verdict = res.rollback_by_60 <= BAR ? 'PASS' : 'FAIL';
  if (cell.bar === 'repro') verdict = res.tick.median !== null && res.tick.median >= cell.band[0] && res.tick.median <= cell.band[1] && res.rollback_by_60 >= 0.99 ? 'PASS' : 'FAIL';
  res.verdict = verdict;
  results.push(res);
  console.log(`${cell.id.padEnd(6)} rollback_by_60=${res.rollback_by_60.toFixed(4)} median=${res.tick.median} IQR=${res.tick.q25}–${res.tick.q75} p90=${res.tick.p90} p99=${res.tick.p99} undecided=${res.undecided_at_60.toFixed(4)} halts=${res.halts} proceeds=${res.proceeds} ${verdict}`);
});
const sha = (() => { try { return execSync('git rev-parse HEAD', { cwd: HERE }).toString().trim(); } catch { return null; } })();
const dirty = (() => { try { return execSync('git status --porcelain -- dist detectors per-shard validation/twin-rate-random-arrivals/harness', { cwd: HERE }).toString().trim().split('\n').filter(Boolean); } catch { return null; } })();
mkdirSync(out, { recursive: true });
const E1 = results[0].verdict, E2 = results[1].verdict === 'PASS' && results[2].verdict === 'PASS' ? 'PASS' : 'NOT EXECUTABLE for the comparison claim';
writeFileSync(join(out, 'results.json'), JSON.stringify({ study: '2026-10-twin-rate-random-arrivals', T, R, ALPHA, BAR, TRAFFIC, P0, PROCS, SEED0, engine: { version: pkg.version, sha, dirty }, node: process.version, generated: new Date().toISOString(), endpoints: { E1, E2 }, results }, null, 2));
console.log(`E1 ${E1}; E2 ${E2}; written ${out}`);

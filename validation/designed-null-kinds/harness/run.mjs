// validation/designed-null-kinds/harness/run.mjs — study 2026-10-designed-null-kinds (ADR 0038). Registered in
// ../PREREGISTRATION.md (7c588e3, Amendment 1 dfef808) before this file existed; generators, cells, bars §1–§4.
// Drives the committed dist/ (run `npx tsc` first).
//   node validation/designed-null-kinds/harness/run.mjs            full run, R = 10000
//   node validation/designed-null-kinds/harness/run.mjs --smoke    R = 20
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const gate = require('../../../dist/per-shard/twin-gate.js');
const twin = require('../../../dist/detectors/twin-contrast.js');
const inv = require('../../../dist/detectors/invariant.js');
const pkg = require('../../../package.json');
const HERE = dirname(fileURLToPath(import.meta.url));
const SMOKE = process.argv.includes('--smoke');
const R = SMOKE ? 20 : 10000, ALPHA = 0.05, SEED0 = 20261003;
const BAR = ALPHA + 2.58 * Math.sqrt((ALPHA * (1 - ALPHA)) / 10000);

function lcg(seed) { let s = seed >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return (s + 0.5) / 4294967296; }; }
function gaussian(rng) { return Math.sqrt(-2 * Math.log(rng())) * Math.cos(2 * Math.PI * rng()); }
function poisson(rng, mean) { if (mean <= 0) return 0; if (mean > 30) return Math.max(0, Math.round(mean + Math.sqrt(mean) * gaussian(rng))); const L = Math.exp(-mean); let k = 0, p = 1; do { k++; p *= rng(); } while (p > L); return k - 1; }
function binomial(rng, n, p) { if (n <= 0 || p <= 0) return 0; if (p >= 1) return n; if (p > 0.5) return n - binomial(rng, n, 1 - p); const v = n * p * (1 - p); if (v >= 30) return Math.min(n, Math.max(0, Math.round(n * p + Math.sqrt(v) * gaussian(rng)))); const lq = Math.log(1 - p); let x = 0, k = 0; for (;;) { x += Math.floor(Math.log(rng()) / lq) + 1; if (x > n) return k; k++; } }
function oddsShift(p, psi) { return (psi * p) / (1 - p + psi * p); }

// §1 rate cells, §2 invariant cells, in registration order
const CELLS = [
  { id: 'R0-rep', kind: 'rate', m: 0, psi: 1.0, T: 60, bar: 'rep' },
  { id: 'V-m0.2-ψ1', kind: 'rate', m: 0.2, psi: 1.0, T: 300, bar: 'null' },
  { id: 'V-m0.2-ψ1.1', kind: 'rate', m: 0.2, psi: 1.1, T: 300, bar: 'null' },
  { id: 'V-m0.2-ψ1.2', kind: 'rate', m: 0.2, psi: 1.2, T: 300, bar: 'null' },
  { id: 'H-m0.2-ψ1', kind: 'rate', m: 0.2, psi: 1.0, T: 300, bar: null, het: true },
  { id: 'P-m0.2-ψ1.5', kind: 'rate', m: 0.2, psi: 1.5, T: 60, bar: null },
  { id: 'P-m0.2-ψ2.0', kind: 'rate', m: 0.2, psi: 2.0, T: 60, bar: 'power' },
  { id: 'P-m0.2-ψ3.0', kind: 'rate', m: 0.2, psi: 3.0, T: 60, bar: null },
  { id: 'IV-ε0.002-f0', kind: 'inv', eps: 0.002, f: 0, lam: 10, T: 300, bar: 'null' },
  { id: 'IV-ε0.002-f0.001', kind: 'inv', eps: 0.002, f: 0.001, lam: 10, T: 300, bar: 'null' },
  { id: 'IV-ε0.002-f0.002', kind: 'inv', eps: 0.002, f: 0.002, lam: 10, T: 300, bar: 'null' },
  { id: 'IV-ε0.002-λ50', kind: 'inv', eps: 0.002, f: 0, lam: 50, T: 300, bar: null },
  { id: 'IP-ε0.002-f0.005', kind: 'inv', eps: 0.002, f: 0.005, lam: 10, T: 60, bar: 'power' },
  { id: 'IP-ε0.002-f0.01', kind: 'inv', eps: 0.002, f: 0.01, lam: 10, T: 60, bar: null },
  { id: 'IP-ε0.002-f0.003', kind: 'inv', eps: 0.002, f: 0.003, lam: 10, T: 60, bar: null },
];

function rateArm(rng, n, psi, het) {
  if (!het) return binomial(rng, n, oddsShift(0.005, psi));
  const nHot = Math.round(n * 0.01);
  return binomial(rng, nHot, oddsShift(0.5, psi)) + binomial(rng, n - nHot, oddsShift(0.005, psi));
}
function replicateRate(cell, rng, shadowCheck) {
  const spec = { id: 'http_5xx', kind: 'rate', worse: 'higher', tolerance: 0.5, ...(cell.m > 0 ? { margin: { relative: cell.m } } : {}) };
  const cfg = { metrics: [spec], alphaRollback: ALPHA, alphaProceed: 1e-12, alphaSrm: 0.001, canaryWeight: 0.5, maxTicks: cell.T };
  let gs = gate.initTwinGate(cfg);
  let maxDiff = 0;
  for (let t = 1; t <= cell.T; t++) {
    const n = poisson(rng, 2440); const nc = binomial(rng, n, 0.5), nk = n - nc;
    const bc = rateArm(rng, nc, cell.psi, cell.het), bk = rateArm(rng, nk, 1, cell.het);
    const obs = { canaryEvents: bc, canaryTotal: nc, controlEvents: bk, controlTotal: nk };
    if (shadowCheck) { // E2: the m = 0 margined spec computes the same scores as the unmargined one
      const a = twin.twinScore(spec, obs), b = twin.twinScore({ ...spec, margin: { relative: 0 } }, obs);
      if (typeof a === 'object' && typeof b === 'object') maxDiff = Math.max(maxDiff, Math.abs(a.rollbackNull - b.rollbackNull), Math.abs(a.x - b.x), Math.abs(a.proceedNull - b.proceedNull));
      else if (a !== b) maxDiff = Infinity;
    }
    const step = gate.stepTwinGate(cfg, gs, { canaryRequests: nc, controlRequests: nk, observations: { http_5xx: obs } });
    gs = step.state;
    if (step.decision.verdict !== 'extend') return { verdict: step.decision.verdict, tick: step.decision.tick, maxDiff };
  }
  return { verdict: 'extend', tick: null, maxDiff };
}
function replicateInv(cell, rng) {
  const spec = { id: 'unaccounted', tolerance: cell.eps, alpha: ALPHA };
  let st = inv.initInvariant(spec); let prev = poisson(rng, cell.lam);
  for (let t = 1; t <= cell.T; t++) {
    const n = poisson(rng, 4870); const inflight = poisson(rng, cell.lam); const drops = binomial(rng, n, cell.f);
    const s = inv.stepInvariant(spec, st, { total: n, accounted: Math.max(0, Math.min(n, n - drops - inflight + prev)) });
    prev = inflight; st = s.state;
    if (s.fire) return { verdict: 'rollback', tick: t };
  }
  return { verdict: 'extend', tick: null };
}
const q = (a, p) => a.length ? a[Math.min(a.length - 1, Math.floor(p * a.length))] : null;
const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
const out = join(HERE, '..', 'results', `${SMOKE ? 'smoke' : 'run'}-${stamp}`);
if (existsSync(out)) throw new Error(`refusing to overwrite ${out}`);
const results = [];
CELLS.forEach((cell, i) => {
  const rng = lcg(SEED0 + 7919 * i);
  const reps = []; let maxDiff = 0;
  for (let r = 0; r < R; r++) { const x = cell.kind === 'rate' ? replicateRate(cell, rng, cell.bar === 'rep' && r === 0) : replicateInv(cell, rng); reps.push(x); if (x.maxDiff) maxDiff = Math.max(maxDiff, x.maxDiff); }
  const rb = reps.filter((x) => x.verdict === 'rollback'); const ticks = rb.map((x) => x.tick).sort((a, b) => a - b);
  const res = { cell: cell.id, kind: cell.kind, params: { m: cell.m, psi: cell.psi, het: !!cell.het, eps: cell.eps, f: cell.f, lam: cell.lam }, T: cell.T, R, fired: rb.length / R,
    halts: reps.filter((x) => x.verdict === 'invalid_experiment').length, proceeds: reps.filter((x) => x.verdict === 'proceed').length,
    tick: { median: q(ticks, 0.5), q25: q(ticks, 0.25), q75: q(ticks, 0.75), p90: q(ticks, 0.9), min: ticks[0] ?? null, max: ticks[ticks.length - 1] ?? null },
    score_max_diff: cell.bar === 'rep' ? maxDiff : undefined };
  res.verdict = cell.bar === 'null' ? (res.fired <= BAR ? 'PASS' : 'FAIL') : cell.bar === 'power' ? (res.fired >= 0.95 ? 'PASS' : 'FAIL') : cell.bar === 'rep' ? (Math.abs(res.fired - 0) <= 0.01 && maxDiff <= 1e-12 ? 'PASS' : 'FAIL') : 'reported';
  results.push(res);
  console.log(`${cell.id.padEnd(18)} fired=${res.fired.toFixed(4)} median=${res.tick.median} IQR=${res.tick.q25}–${res.tick.q75} p90=${res.tick.p90} halts=${res.halts} ${res.verdict}${cell.bar === 'rep' ? ` maxDiff=${maxDiff}` : ''}`);
});
const by = Object.fromEntries(results.map((r) => [r.cell, r]));
const E1 = ['V-m0.2-ψ1', 'V-m0.2-ψ1.1', 'V-m0.2-ψ1.2'].every((c) => by[c].verdict === 'PASS') ? 'PASS' : 'FAIL';
const E2 = by['R0-rep'].verdict, E3 = ['IV-ε0.002-f0', 'IV-ε0.002-f0.001', 'IV-ε0.002-f0.002'].every((c) => by[c].verdict === 'PASS') ? 'PASS' : 'FAIL';
const E4 = by['P-m0.2-ψ2.0'].verdict === 'PASS' && by['IP-ε0.002-f0.005'].verdict === 'PASS' ? 'PASS' : 'FAIL';
const sha = execSync('git rev-parse HEAD', { cwd: HERE }).toString().trim();
const dirty = execSync('git status --porcelain -- dist detectors per-shard validation/designed-null-kinds/harness', { cwd: HERE }).toString().trim().split('\n').filter(Boolean);
mkdirSync(out, { recursive: true });
writeFileSync(join(out, 'results.json'), JSON.stringify({ study: '2026-10-designed-null-kinds', R, ALPHA, BAR, SEED0, engine: { version: pkg.version, sha, dirty }, node: process.version, generated: new Date().toISOString(), endpoints: { E1, E2, E3, E4 }, ship_rule: [E1, E2, E3, E4].every((e) => e === 'PASS') ? 'MET' : 'NOT MET', results }, null, 2));
console.log(`E1 ${E1} E2 ${E2} E3 ${E3} E4 ${E4}; written ${out}`);

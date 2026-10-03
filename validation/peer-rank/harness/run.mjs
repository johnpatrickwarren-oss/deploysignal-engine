// validation/peer-rank/harness/run.mjs — study 2026-10-peer-rank (ADR 0039). Registered in ../PREREGISTRATION.md
// (1129db3) before this file existed; generator, cells, bars §1–§3. Drives the committed dist/.
//   node validation/peer-rank/harness/run.mjs [--smoke]
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const pr = require('../../../dist/detectors/peer-rank.js');
const twin = require('../../../dist/detectors/twin-contrast.js');
const pkg = require('../../../package.json');
const HERE = dirname(fileURLToPath(import.meta.url));
const SMOKE = process.argv.includes('--smoke');
const R = SMOKE ? 20 : 10000, ALPHA = 0.05, SEED0 = 20261003, DAY = 1440;
const BAR = ALPHA + 2.58 * Math.sqrt((ALPHA * (1 - ALPHA)) / 10000);
function lcg(seed) { let s = seed >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return (s + 0.5) / 4294967296; }; }
function gaussian(rng) { return Math.sqrt(-2 * Math.log(rng())) * Math.cos(2 * Math.PI * rng()); }
function poisson(rng, mean) { if (mean <= 0) return 0; if (mean > 30) return Math.max(0, Math.round(mean + Math.sqrt(mean) * gaussian(rng))); const L = Math.exp(-mean); let k = 0, p = 1; do { k++; p *= rng(); } while (p > L); return k - 1; }
function centeredLognormal(rng) { return Math.exp(0.75 * gaussian(rng)) - Math.exp(0.28125); }

const CELLS = [
  { id: 'S2-rep', N: 2, m: 0.02, d: 0, r: 0, T: 300, bar: 'rep' },
  { id: 'V4-m0.02', N: 4, m: 0.02, d: 0, r: 0, T: 2000, bar: 'null' },
  { id: 'V16-m0.02', N: 16, m: 0.02, d: 0, r: 0, T: 2000, bar: 'null' },
  { id: 'V4-d0.01', N: 4, m: 0.02, d: 0.01, r: 0, T: 2000, bar: 'null' },
  { id: 'V4-d0.018', N: 4, m: 0.02, d: 0.018, r: 0, T: 2000, bar: 'null' },
  { id: 'M4-m0-d0.01', N: 4, m: 0, d: 0.01, r: 0, T: 2000, bar: null },
  { id: 'P4-r0.04', N: 4, m: 0.02, d: 0, r: 0.04, T: 300, bar: 'power' },
  { id: 'P16-r0.04', N: 16, m: 0.02, d: 0, r: 0.04, T: 300, bar: null },
  { id: 'P4-r0.03', N: 4, m: 0.02, d: 0, r: 0.03, T: 300, bar: null },
  { id: 'Q4-r0.01', N: 4, m: 0.02, d: 0, r: 0.01, T: 300, bar: 'proceed' },
];
function spec(cell) { return { id: 'sig', worse: 'higher', tolerance: 0.1, alpha: ALPHA, ...(cell.m > 0 ? { margin: { relative: cell.m } } : {}) }; }
function tick(rng, cell, t, ar) {
  const s = 1 + 0.5 * Math.sin((2 * Math.PI * t) / DAY); const L = 100 * s;
  const vals = [];
  for (let i = 0; i < cell.N; i++) {
    ar[i] = 0.5 * ar[i] + 0.1 * gaussian(rng);
    const n = poisson(rng, 1000);
    let v = L + 10 * ar[i] + (30 * centeredLognormal(rng)) / Math.sqrt(Math.max(n, 1));
    if (i === 0) v += (cell.d + cell.r) * L;
    vals.push(v);
  }
  return vals;
}
function replicate(cell, rng, repCheck) {
  const sp = spec(cell); let st = pr.initPeerRank(sp); const ar = new Array(cell.N).fill(0);
  let tst = repCheck ? twin.initTwinMetric() : null; const tsp = { id: 'sig', kind: 'sign', worse: 'higher', tolerance: 0.1, ...(cell.m > 0 ? { margin: { relative: cell.m } } : {}) };
  let maxDiff = 0;
  for (let t = 1; t <= cell.T; t++) {
    const v = tick(rng, cell, t, ar);
    const s = pr.stepPeerRank(sp, st, { unit: v[0], peers: v.slice(1) });
    if (repCheck) { tst = twin.updateTwinMetric(tsp, tst, { canary: v[0], control: v[1] }); const te = twin.twinMetricEvidence(tst); maxDiff = Math.max(maxDiff, Math.abs(s.rollbackE - te.rollbackE) / Math.max(1, te.rollbackE), Math.abs(s.proceedE - te.proceedE) / Math.max(1, te.proceedE)); }
    st = s.state;
    if (s.fire) return { verdict: 'rollback', tick: t, maxDiff };
    if (s.proceed) return { verdict: 'proceed', tick: t, maxDiff };
  }
  return { verdict: 'extend', tick: null, maxDiff };
}
const q = (a, p) => a.length ? a[Math.min(a.length - 1, Math.floor(p * a.length))] : null;
const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
const out = join(HERE, '..', 'results', `${SMOKE ? 'smoke' : 'run'}-${stamp}`);
if (existsSync(out)) throw new Error(`refusing to overwrite ${out}`);
const results = [];
CELLS.forEach((cell, i) => {
  const rng = lcg(SEED0 + 7919 * i); const reps = []; let maxDiff = 0;
  for (let r = 0; r < R; r++) { const x = replicate(cell, rng, cell.bar === 'rep' && r === 0); reps.push(x); maxDiff = Math.max(maxDiff, x.maxDiff); }
  const rb = reps.filter((x) => x.verdict === 'rollback'), pc = reps.filter((x) => x.verdict === 'proceed');
  const ticks = rb.map((x) => x.tick).sort((a, b) => a - b), pticks = pc.map((x) => x.tick).sort((a, b) => a - b);
  const rb60 = rb.filter((x) => x.tick <= 60).length / R;
  const res = { cell: cell.id, N: cell.N, m: cell.m, d: cell.d, r: cell.r, T: cell.T, R, rollback: rb.length / R, rollback_by_60: rb60, proceed: pc.length / R,
    tick: { median: q(ticks, 0.5), q25: q(ticks, 0.25), q75: q(ticks, 0.75), p90: q(ticks, 0.9) }, proceed_tick_median: q(pticks, 0.5), rep_max_rel_diff: cell.bar === 'rep' ? maxDiff : undefined };
  res.verdict = cell.bar === 'null' ? (res.rollback <= BAR ? 'PASS' : 'FAIL') : cell.bar === 'power' ? (rb60 >= 0.95 ? 'PASS' : 'FAIL') : cell.bar === 'proceed' ? (res.proceed >= 0.9 && res.rollback <= BAR ? 'PASS' : 'FAIL') : cell.bar === 'rep' ? (maxDiff <= 1e-9 ? 'PASS' : 'FAIL') : 'reported';
  results.push(res);
  console.log(`${cell.id.padEnd(12)} rollback=${res.rollback.toFixed(4)} by60=${rb60.toFixed(4)} proceed=${res.proceed.toFixed(4)} median=${res.tick.median} IQR=${res.tick.q25}–${res.tick.q75} ${res.verdict}${cell.bar === 'rep' ? ` maxRelDiff=${maxDiff}` : ''}`);
});
const by = Object.fromEntries(results.map((r) => [r.cell, r]));
const E1 = ['V4-m0.02', 'V16-m0.02', 'V4-d0.01', 'V4-d0.018'].every((c) => by[c].verdict === 'PASS') ? 'PASS' : 'FAIL';
const E2 = by['S2-rep'].verdict, E3 = by['P4-r0.04'].verdict, E4 = by['Q4-r0.01'].verdict;
const sha = execSync('git rev-parse HEAD', { cwd: HERE }).toString().trim();
const dirty = execSync('git status --porcelain -- dist detectors validation/peer-rank/harness', { cwd: HERE }).toString().trim().split('\n').filter(Boolean);
mkdirSync(out, { recursive: true });
writeFileSync(join(out, 'results.json'), JSON.stringify({ study: '2026-10-peer-rank', R, ALPHA, BAR, SEED0, engine: { version: pkg.version, sha, dirty }, node: process.version, generated: new Date().toISOString(), endpoints: { E1, E2, E3, E4 }, ship_rule: [E1, E2, E3, E4].every((e) => e === 'PASS') ? 'MET' : 'NOT MET', results }, null, 2));
console.log(`E1 ${E1} E2 ${E2} E3 ${E3} E4 ${E4}; written ${out}`);

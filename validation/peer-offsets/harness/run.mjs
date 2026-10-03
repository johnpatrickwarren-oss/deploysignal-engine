// validation/peer-offsets/harness/run.mjs — study 2026-10-peer-offsets (ADR 0040). Registered in ../PREREGISTRATION.md
// (ff8511f) before this file existed; generator, cells, bars §1–§3. Drives the committed dist/.
//   node validation/peer-offsets/harness/run.mjs [--smoke]
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const pr = require('../../../dist/detectors/peer-rank.js');
const pkg = require('../../../package.json');
const HERE = dirname(fileURLToPath(import.meta.url));
const SMOKE = process.argv.includes('--smoke');
const R = SMOKE ? 20 : 10000, ALPHA = 0.05, SEED0 = 20261003, DAY = 1440, PRE = 576, N = 4;
const BAR = ALPHA + 2.58 * Math.sqrt((ALPHA * (1 - ALPHA)) / 10000);
function lcg(seed) { let s = seed >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return (s + 0.5) / 4294967296; }; }
function gaussian(rng) { return Math.sqrt(-2 * Math.log(rng())) * Math.cos(2 * Math.PI * rng()); }
function poisson(rng, mean) { if (mean <= 0) return 0; if (mean > 30) return Math.max(0, Math.round(mean + Math.sqrt(mean) * gaussian(rng))); const L = Math.exp(-mean); let k = 0, p = 1; do { k++; p *= rng(); } while (p > L); return k - 1; }
function centeredLognormal(rng) { return Math.exp(0.75 * gaussian(rng)) - Math.exp(0.28125); }
const median = (xs) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : NaN; };

const CELLS = [
  { id: 'R-off0', g: 0, offsets: 'zero', noise: false, m: 0.02, d: 0, r: 0, T: 300, bar: 'rep' },
  { id: 'NG-g0.5', g: 0.5, offsets: 'none', noise: false, m: 0.02, d: 0, r: 0, T: 2000, bar: null },
  { id: 'EX-g0.5', g: 0.5, offsets: 'exact', noise: false, m: 0.02, d: 0, r: 0, T: 2000, bar: 'null' },
  { id: 'EX-g2.0', g: 2.0, offsets: 'exact', noise: false, m: 0.02, d: 0, r: 0, T: 2000, bar: 'null' },
  { id: 'EST-g0.5', g: 0.5, offsets: 'est', noise: false, m: 0.02, d: 0, r: 0, T: 2000, bar: 'null' },
  { id: 'EST-g0.5-n', g: 0.5, offsets: 'est', noise: true, m: 0.02, d: 0, r: 0, T: 2000, bar: 'null' },
  { id: 'EST-g2.0-n', g: 2.0, offsets: 'est', noise: true, m: 0.02, d: 0, r: 0, T: 2000, bar: 'null' },
  { id: 'EST-g0.5-n-m0.10', g: 0.5, offsets: 'est', noise: true, m: 0.10, d: 0, r: 0, T: 2000, bar: null },
  { id: 'P-g0.5-r0.04', g: 0.5, offsets: 'est', noise: true, m: 0.02, d: 0, r: 0.04, T: 300, bar: 'power' },
  { id: 'P-g2.0-r0.04', g: 2.0, offsets: 'est', noise: true, m: 0.02, d: 0, r: 0.04, T: 300, bar: null },
  { id: 'Q-g0.5-r0.01', g: 0.5, offsets: 'est', noise: true, m: 0.02, d: 0, r: 0.01, T: 300, bar: 'proceed' },
];
function spec(cell) { return { id: 'sig', worse: 'higher', tolerance: 0.1, alpha: ALPHA, margin: { relative: cell.m } }; }
// §1: gaps G = (g, −g/2, 0); gap noise G_j,t = G_j (1 + 0.1 b_j,t), b AR(1) σ 1 φ 0.9
function makeGen(cell) {
  const G = [cell.g, -cell.g / 2, 0]; const ar = new Array(N).fill(0); const b = new Array(N - 1).fill(0);
  return function tick(rng, t, effect) {
    const s = 1 + 0.5 * Math.sin((2 * Math.PI * t) / DAY); const L = 100 * s;
    const vals = [];
    for (let i = 0; i < N; i++) {
      ar[i] = 0.5 * ar[i] + 0.1 * gaussian(rng);
      const n = poisson(rng, 1000);
      let v = L + 10 * ar[i] + (30 * centeredLognormal(rng)) / Math.sqrt(Math.max(n, 1));
      if (i === 0) v += effect * L;
      else { const j = i - 1; let Gj = G[j]; if (cell.noise) { b[j] = 0.9 * b[j] + Math.sqrt(1 - 0.81) * gaussian(rng); Gj = G[j] * (1 + 0.1 * b[j]); } v *= 1 + Gj; }
      vals.push(v);
    }
    return vals;
  };
}
function offsetsFor(cell, rng, gen) {
  if (cell.offsets === 'none') return undefined;
  if (cell.offsets === 'zero') return [0, 0, 0];
  const G = [cell.g, -cell.g / 2, 0];
  if (cell.offsets === 'exact') return G.map((g) => 1 / (1 + g) - 1);
  // estimated: median over a PRE-tick pre-window (δ = Δ = 0) of unit / peer_j − 1
  const ratios = [[], [], []];
  for (let t = -PRE; t < 0; t++) { const v = gen(rng, t, 0); for (let j = 0; j < 3; j++) ratios[j].push(v[0] / v[j + 1] - 1); }
  return ratios.map(median);
}
function replicate(cell, rng, repCheck) {
  const sp = spec(cell); const gen = makeGen(cell);
  const offsets = offsetsFor(cell, rng, gen);
  let st = pr.initPeerRank(sp); let maxDiff = 0, proceedTick = null;
  let st39 = repCheck ? pr.initPeerRank(sp) : null;
  for (let t = 1; t <= cell.T; t++) {
    const v = gen(rng, t, cell.d + cell.r);
    const s = pr.stepPeerRank(sp, st, { unit: v[0], peers: v.slice(1), ...(offsets ? { offsets } : {}) });
    if (repCheck) { const s39 = pr.stepPeerRank(sp, st39, { unit: v[0], peers: v.slice(1) }); st39 = s39.state; maxDiff = Math.max(maxDiff, Math.abs(s.rollbackE - s39.rollbackE) / Math.max(1, s39.rollbackE)); }
    st = s.state;
    if (s.fire) return { verdict: 'rollback', tick: t, maxDiff, proceedTick };
    if (s.proceed && proceedTick === null) { proceedTick = t; if (cell.bar === 'power' || cell.bar === 'proceed') return { verdict: 'proceed', tick: t, maxDiff, proceedTick }; }
  }
  return { verdict: proceedTick !== null ? 'proceed' : 'extend', tick: null, maxDiff, proceedTick };
}
const q = (a, p) => a.length ? a[Math.min(a.length - 1, Math.floor(p * a.length))] : null;
const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
const out = join(HERE, '..', 'results', `${SMOKE ? 'smoke' : 'run'}-${stamp}`);
if (existsSync(out)) throw new Error(`refusing to overwrite ${out}`);
const results = [];
CELLS.forEach((cell, i) => {
  const rng = lcg(SEED0 + 7919 * i); const reps = []; let maxDiff = 0;
  for (let r = 0; r < R; r++) { const x = replicate(cell, rng, cell.bar === 'rep' && r === 0); reps.push(x); maxDiff = Math.max(maxDiff, x.maxDiff); }
  const rb = reps.filter((x) => x.verdict === 'rollback'); const ticks = rb.map((x) => x.tick).sort((a, b) => a - b);
  const pticks = reps.filter((x) => x.proceedTick !== null).map((x) => x.proceedTick).sort((a, b) => a - b);
  const rb60 = rb.filter((x) => x.tick <= 60).length / R;
  const res = { cell: cell.id, params: { g: cell.g, offsets: cell.offsets, noise: cell.noise, m: cell.m, r: cell.r }, T: cell.T, R, rollback: rb.length / R, rollback_by_60: rb60, proceed: reps.filter((x) => x.verdict === 'proceed').length / R,
    tick: { median: q(ticks, 0.5), q25: q(ticks, 0.25), q75: q(ticks, 0.75), p90: q(ticks, 0.9) }, proceed_tick_median: q(pticks, 0.5), rep_max_rel_diff: cell.bar === 'rep' ? maxDiff : undefined };
  res.verdict = cell.bar === 'null' ? (res.rollback <= BAR ? 'PASS' : 'FAIL') : cell.bar === 'power' ? (rb60 >= 0.95 ? 'PASS' : 'FAIL') : cell.bar === 'proceed' ? (res.proceed >= 0.9 && res.rollback <= BAR ? 'PASS' : 'FAIL') : cell.bar === 'rep' ? (maxDiff <= 1e-9 ? 'PASS' : 'FAIL') : 'reported';
  results.push(res);
  console.log(`${cell.id.padEnd(18)} rollback=${res.rollback.toFixed(4)} by60=${rb60.toFixed(4)} proceed=${res.proceed.toFixed(4)} median=${res.tick.median} IQR=${res.tick.q25}–${res.tick.q75} ${res.verdict}${cell.bar === 'rep' ? ` maxRelDiff=${maxDiff}` : ''}`);
});
const by = Object.fromEntries(results.map((r) => [r.cell, r]));
const E1 = ['EX-g0.5', 'EX-g2.0'].every((c) => by[c].verdict === 'PASS') ? 'PASS' : 'FAIL';
const E2 = ['EST-g0.5', 'EST-g0.5-n', 'EST-g2.0-n'].every((c) => by[c].verdict === 'PASS') ? 'PASS' : 'FAIL';
const E3 = by['R-off0'].verdict; const E4 = by['P-g0.5-r0.04'].verdict === 'PASS' && by['Q-g0.5-r0.01'].verdict === 'PASS' ? 'PASS' : 'FAIL';
const sha = execSync('git rev-parse HEAD', { cwd: HERE }).toString().trim();
const dirty = execSync('git status --porcelain -- dist detectors validation/peer-offsets/harness', { cwd: HERE }).toString().trim().split('\n').filter(Boolean);
mkdirSync(out, { recursive: true });
writeFileSync(join(out, 'results.json'), JSON.stringify({ study: '2026-10-peer-offsets', R, ALPHA, BAR, SEED0, PRE, engine: { version: pkg.version, sha, dirty }, node: process.version, generated: new Date().toISOString(), endpoints: { E1, E2, E3, E4 }, ship_rule: [E1, E2, E3, E4].every((e) => e === 'PASS') ? 'MET' : 'NOT MET', results }, null, 2));
console.log(`E1 ${E1} E2 ${E2} E3 ${E3} E4 ${E4}; written ${out}`);

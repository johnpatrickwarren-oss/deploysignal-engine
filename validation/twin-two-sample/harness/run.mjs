// validation/twin-two-sample/harness/run.mjs — study 2026-10-twin-two-sample (ADR 0042). Registered in ../PREREGISTRATION.md
// (5450e7a; Amendment 1 bfbc0a3, before run 0) before this file existed; generator, cells, bars §1–§3. Drives the committed dist/.
//   node validation/twin-two-sample/harness/run.mjs [--smoke]
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const ts = require('../../../dist/detectors/twin-two-sample.js');
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
  { id: 'V-iid', m: 0.02, d: 0, r: 0, rho: 0, v: 1, arSigma: 0.1, miss: 0, T: 2000, bar: 'null' },
  { id: 'V-ar', m: 0.02, d: 0, r: 0, rho: 0, v: 1, arSigma: 0.3, miss: 0, T: 2000, bar: 'null' },
  { id: 'V-d0.018', m: 0.02, d: 0.018, r: 0, rho: 0, v: 1, arSigma: 0.1, miss: 0, T: 2000, bar: 'null' },
  { id: 'V-miss', m: 0.02, d: 0, r: 0, rho: 0, v: 1, arSigma: 0.1, miss: 0.1, T: 2000, bar: 'null' },
  { id: 'M-m0-d0.01', m: 0, d: 0.01, r: 0, rho: 0, v: 1, arSigma: 0.1, miss: 0, T: 2000, bar: 'mech' },
  { id: 'P-rho0.8', m: 0.02, d: 0, r: 0, rho: 0.8, v: 1, arSigma: 0.1, miss: 0, T: 300, bar: 'power300' },
  { id: 'P-var2', m: 0.02, d: 0, r: 0, rho: 0, v: 2, arSigma: 0.1, miss: 0, T: 300, bar: 'power300' },
  { id: 'P-r0.08', m: 0.02, d: 0, r: 0.08, rho: 0, v: 1, arSigma: 0.1, miss: 0, T: 300, bar: 'power60', sign: true },
  { id: 'P-r0.04', m: 0.02, d: 0, r: 0.04, rho: 0, v: 1, arSigma: 0.1, miss: 0, T: 300, bar: null, sign: true },
  { id: 'P-rho0.8-m0', m: 0, d: 0, r: 0, rho: 0.8, v: 1, arSigma: 0.1, miss: 0, T: 300, bar: null },  // Amendment 1
  { id: 'P-var2-m0', m: 0, d: 0, r: 0, rho: 0, v: 2, arSigma: 0.1, miss: 0, T: 300, bar: null },      // Amendment 1
];
function spec(cell) { const mg = cell.m > 0 ? { margin: { relative: cell.m } } : {}; return { id: 'joint', alpha: ALPHA, coordinates: [{ id: 'c1', ...mg }, { id: 'c2', ...mg }] }; }
function signSpec(cell) { return { id: 'c1', kind: 'sign', worse: 'higher', tolerance: 0.1, ...(cell.m > 0 ? { margin: { relative: cell.m } } : {}) }; }
// §1: value_i = L_t + 10 a_arm + noise_i; canary: += (δ + Δ_i) L_t, noise correlation ρ between its coordinates, variance ×v
function replicate(cell, rng) {
  const sp = spec(cell); let st = ts.initTwinTwoSample(sp); const ar = [0, 0];
  const ssp = cell.sign ? signSpec(cell) : null; let sst = ssp ? twin.initTwinMetric() : null; let signTick = null;
  const phi = 0.5, sig = cell.arSigma;
  for (let t = 1; t <= cell.T; t++) {
    const s = 1 + 0.5 * Math.sin((2 * Math.PI * t) / DAY); const L = 100 * s;
    ar[0] = phi * ar[0] + sig * gaussian(rng); ar[1] = phi * ar[1] + sig * gaussian(rng);
    const nC = poisson(rng, 1000), nK = poisson(rng, 1000);
    const scC = 30 / Math.sqrt(Math.max(nC, 1)), scK = 30 / Math.sqrt(Math.max(nK, 1));
    // canary noise: correlated lognormal-centred pair via Gaussian copula when ρ > 0 (same marginals otherwise)
    let e1, e2;
    if (cell.rho > 0) { const g1 = gaussian(rng), g2 = cell.rho * g1 + Math.sqrt(1 - cell.rho * cell.rho) * gaussian(rng); e1 = Math.exp(0.75 * g1) - Math.exp(0.28125); e2 = Math.exp(0.75 * g2) - Math.exp(0.28125); }
    else { e1 = centeredLognormal(rng); e2 = centeredLognormal(rng); }
    const x = [L + 10 * ar[0] + cell.v * scC * e1 + (cell.d + cell.r) * L, L + 10 * ar[0] + cell.v * scC * e2 + cell.d * L];
    const y = [L + 10 * ar[1] + scK * centeredLognormal(rng), L + 10 * ar[1] + scK * centeredLognormal(rng)];
    if (cell.miss > 0 && rng() < cell.miss) { x[rng() < 0.5 ? 0 : 1] = NaN; }
    if (ssp && signTick === null) { sst = twin.updateTwinMetric(ssp, sst, { canary: x[0], control: y[0] }); if (twin.twinMetricEvidence(sst).rollbackE >= 1 / ALPHA) signTick = t; }
    const o = ts.stepTwinTwoSample(sp, st, x, y); st = o.state;
    if (o.fire) return { fired: true, tick: t, signTick, missing: st.missing };
  }
  return { fired: false, tick: null, signTick, missing: st.missing };
}
const q = (a, p) => a.length ? a[Math.min(a.length - 1, Math.floor(p * a.length))] : null;
const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
const out = join(HERE, '..', 'results', `${SMOKE ? 'smoke' : 'run'}-${stamp}`);
if (existsSync(out)) throw new Error(`refusing to overwrite ${out}`);
const results = [];
CELLS.forEach((cell, i) => {
  const rng = lcg(SEED0 + 7919 * i); const reps = [];
  for (let r = 0; r < R; r++) reps.push(replicate(cell, rng));
  const f = reps.filter((x) => x.fired); const ticks = f.map((x) => x.tick).sort((a, b) => a - b);
  const by60 = f.filter((x) => x.tick <= 60).length / R, by300 = f.filter((x) => x.tick <= 300).length / R;
  const res = { cell: cell.id, params: { m: cell.m, d: cell.d, r: cell.r, rho: cell.rho, v: cell.v, arSigma: cell.arSigma, miss: cell.miss }, T: cell.T, R, fired: f.length / R, by_60: by60, by_300: by300,
    tick: { median: q(ticks, 0.5), q25: q(ticks, 0.25), q75: q(ticks, 0.75), p90: q(ticks, 0.9) }, mean_missing: reps.reduce((a, x) => a + x.missing, 0) / R,
    sign_by_60: cell.sign ? reps.filter((x) => x.signTick !== null && x.signTick <= 60).length / R : undefined, sign_tick_median: cell.sign ? q(reps.map((x) => x.signTick).filter((x) => x !== null).sort((a, b) => a - b), 0.5) : undefined };
  res.verdict = cell.bar === 'null' ? (res.fired <= BAR ? 'PASS' : 'FAIL') : cell.bar === 'mech' ? (res.fired >= 0.9 ? 'PASS' : res.fired < 0.5 ? 'NOT EXECUTABLE' : 'FAIL') : cell.bar === 'power300' ? (by300 >= 0.8 ? 'PASS' : 'FAIL') : cell.bar === 'power60' ? (by60 >= 0.95 ? 'PASS' : 'FAIL') : 'reported';
  results.push(res);
  console.log(`${cell.id.padEnd(12)} fired=${res.fired.toFixed(4)} by60=${by60.toFixed(4)} by300=${by300.toFixed(4)} median=${res.tick.median} IQR=${res.tick.q25}–${res.tick.q75}${cell.sign ? ` sign_by60=${res.sign_by_60.toFixed(4)} sign_med=${res.sign_tick_median}` : ''} ${res.verdict}`);
});
const by = Object.fromEntries(results.map((r) => [r.cell, r]));
const E1 = ['V-iid', 'V-ar', 'V-d0.018', 'V-miss'].every((c) => by[c].verdict === 'PASS') ? 'PASS' : 'FAIL';
const E2 = by['M-m0-d0.01'].verdict; const E3 = ['P-rho0.8', 'P-var2'].every((c) => by[c].verdict === 'PASS') ? 'PASS' : 'FAIL'; const E4 = by['P-r0.08'].verdict;
const sha = execSync('git rev-parse HEAD', { cwd: HERE }).toString().trim();
const dirty = execSync('git status --porcelain -- dist detectors validation/twin-two-sample/harness', { cwd: HERE }).toString().trim().split('\n').filter(Boolean);
mkdirSync(out, { recursive: true });
writeFileSync(join(out, 'results.json'), JSON.stringify({ study: '2026-10-twin-two-sample', R, ALPHA, BAR, SEED0, engine: { version: pkg.version, sha, dirty }, node: process.version, generated: new Date().toISOString(), endpoints: { E1, E2, E3, E4 }, ship_rule: [E1, E2, E3, E4].every((e) => e === 'PASS') ? 'MET' : 'NOT MET', results }, null, 2));
console.log(`E1 ${E1} E2 ${E2} E3 ${E3} E4 ${E4}; written ${out}`);

// harness/run.mjs — terminal E[e] under an estimated baseline. Append-only.
import fs from 'node:fs'; import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { rng, gaussFrom } from '../../h0-battery/harness/nulls.mjs';
const require = createRequire(import.meta.url);
const STUDY = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const ENG = path.join(STUDY, '..', '..');
const safeT = require(path.join(ENG, 'dist/detectors/safe-t-e-value.js'));
const ui = require(path.join(ENG, 'dist/detectors/universal-inference-e-value.js'));
const bf = require(path.join(ENG, 'dist/detectors/nuisance-robust-bf-e-value.js'));

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const MODE = arg('--mode', 'sim'), N = Number(arg('--n', 4000)), NTEST = 100;
const ALPHAS = [0.05, 0.01], SEED = 20260801;

// null generators, phi carried so oracle cells can supply it
const ar1 = (r, phi) => { const g = gaussFrom(r); let p = g(); const sd = Math.sqrt(1 - phi * phi);
  return () => (p = phi * p + sd * g()); };
const logn = (r, s = 0.75) => { const g = gaussFrom(r); const m = Math.exp(s * s / 2);
  const sd = Math.sqrt((Math.exp(s * s) - 1) * Math.exp(s * s));
  return () => (Math.exp(s * g()) - m) / sd; };
const t3 = (r) => { const g = gaussFrom(r); return () => { const z = g();
  const c = g() ** 2 + g() ** 2 + g() ** 2; return (z / Math.sqrt(c / 3)) / Math.sqrt(3); }; };

const NULLS = [
  { id: 'N1',       m: 100, phi: 0,   oracle: true,  gen: (r) => gaussFrom(r) },
  { id: 'N2-m30',   m: 30,  phi: 0,   oracle: false, gen: (r) => gaussFrom(r) },
  { id: 'N2-m100',  m: 100, phi: 0,   oracle: false, gen: (r) => gaussFrom(r) },
  { id: 'N2-m500',  m: 500, phi: 0,   oracle: false, gen: (r) => gaussFrom(r) },
  { id: 'N3-p06',   m: 100, phi: 0.6, oracle: true,  gen: (r) => ar1(r, 0.6) },
  { id: 'N3-p09',   m: 100, phi: 0.9, oracle: true,  gen: (r) => ar1(r, 0.9) },
  { id: 'N4-p06',   m: 100, phi: 0.6, oracle: false, gen: (r) => ar1(r, 0.6) },
  { id: 'N4-p09',   m: 100, phi: 0.9, oracle: false, gen: (r) => ar1(r, 0.9) },
  { id: 'N5',       m: 100, phi: 0,   oracle: false, gen: logn },
  { id: 'N6',       m: 100, phi: 0,   oracle: false, gen: t3 },
];

const DETS = [
  { id: 'safe_t', min_cal: 3,
    run: (vals, cal, test, ns) => safeT.safeTwoSampleTEValue(vals, cal, test,
      ns.oracle ? { ar1Phi: ns.phi } : undefined) },
  { id: 'universal_inference', min_cal: 6,
    run: (vals, cal, test) => ui.universalInferenceMeanShiftEValue(vals, cal, test) },
  { id: 'nuisance_robust_bf_CONTROL', min_cal: 100,   // §7.3 known-failure control
    run: (vals, cal, test) => bf.nuisanceRobustBFEValue(vals, cal, test) },
];

const lower95 = (k, n) => { const p = k / n, z = 1.645, d = 1 + z * z / n;
  const c = p + z * z / (2 * n), h = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n));
  return Math.max(0, (c - h) / d); };

const engineVersion = JSON.parse(fs.readFileSync(path.join(ENG, 'package.json'), 'utf8')).version;
const gitSha = execSync('git rev-parse HEAD', { cwd: ENG }).toString().trim();
const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
const runDir = path.join(STUDY, 'results', MODE === 'live' ? 'live' : 'sim', `run-${stamp}`);
fs.mkdirSync(path.join(runDir, 'cells'), { recursive: true });

const cells = [];
for (const det of DETS) {
  for (const ns of NULLS) {
    if (ns.m < det.min_cal) continue;
    const es = [];
    for (let i = 0; i < N; i++) {
      const src = ns.gen(rng(SEED + i * 7919));
      const vals = Array.from({ length: ns.m + NTEST }, src);
      try { es.push(det.run(vals, { start: 0, len: ns.m }, { start: ns.m, len: NTEST }, ns)); }
      catch { es.push(NaN); }
      if (i < N) { // power control (§7.3): same series with a 3-sigma shift in the test window
        const shifted = vals.map((v, j) => (j >= ns.m ? v + 3 : v));
        try { (det._pow ??= []).push(det.run(shifted, { start: 0, len: ns.m }, { start: ns.m, len: NTEST }, ns)); }
        catch { /* counted as a miss */ }
      }
    }
    const good = es.filter(Number.isFinite);
    const mean = good.reduce((a, b) => a + b, 0) / good.length;
    const sorted = [...good].sort((a, b) => a - b);
    for (const alpha of ALPHAS) {
      const k = good.filter((e) => e >= 1 / alpha).length;
      const exc = k / good.length, lo = lower95(k, good.length);
      const c = { detector: det.id, null_id: ns.id, m: ns.m, alpha, n: good.length,
        exceedance: exc, lower_95: lo, verdict: lo > alpha ? 'FAIL' : 'not-refuted',
        mean_e: mean, p_e_ge_10: good.filter((e) => e >= 10).length / good.length,
        p99_e: sorted[Math.floor(0.99 * sorted.length)], nan_count: es.length - good.length,
        mode: MODE, engine_version: engineVersion, git_sha: gitSha };
      cells.push(c);
      fs.writeFileSync(path.join(runDir, 'cells', `${det.id}__${ns.id}__a${alpha}.json`),
        JSON.stringify(c, null, 2));
    }
    console.log(`${det.id.padEnd(28)} ${ns.id.padEnd(9)} mean_e=${mean.toFixed(4)} ` +
      `p99=${sorted[Math.floor(0.99 * sorted.length)].toFixed(2)} ` +
      `exc@.05=${(good.filter((e) => e >= 20).length / good.length).toFixed(4)}`);
  }
}
for (const det of DETS) {
  const pw = (det._pow ?? []).filter(Number.isFinite);
  const rate = pw.filter((e) => e >= 20).length / Math.max(pw.length, 1);
  fs.writeFileSync(path.join(runDir, 'cells', `CONTROL_power__${det.id}.json`),
    JSON.stringify({ control: 'power', detector: det.id, shift_sigma: 3,
      rate_e_ge_20: rate, verdict: rate >= 0.50 ? 'pass' : 'FAIL', mode: MODE }, null, 2));
  console.log(`CONTROL power ${det.id.padEnd(28)} rate(e>=1/0.05)=${rate.toFixed(4)} ${rate >= 0.50 ? 'pass' : 'FAIL'}`);
}

fs.writeFileSync(path.join(runDir, 'manifest.json'), JSON.stringify({
  study: '2026-08-terminal-evalue', mode: MODE, engine_version: engineVersion, git_sha: gitSha,
  node: process.version, seed: SEED, n: N, n_test: NTEST, alphas: ALPHAS, generated_at: stamp,
}, null, 2));
console.log(`\n${cells.length} cells -> ${path.relative(STUDY, runDir)}`);

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

// Registered additively 2026-08-07 -- ../POWER-PER-CELL-ADDENDUM-2026-08-07.md change (a).
// One-sided 95% NORMAL-APPROXIMATION lower confidence bound on mean(e). This is the
// instrument safe-t's frozen certification card names in its falsifier ("one-sided 95%
// lower bound of mean(e) > 1"); no run in the corpus recorded it, so the scorer fell back
// to the point estimate (validation/certification/lib/guards.mjs:63).
//   lower = max(0, mu - 1.645 * s / sqrt(n)),  s = sample sd with an (n-1) denominator.
// z = 1.645 is the same quantile lower95 above uses, so both intervals on a cell agree.
// Closed form, not a bootstrap: it consumes no RNG stream, so the run stays reproducible
// at the registered seed, and a reader can recompute it from mean_e, mean_e_sd and n.
// NOT a coverage guarantee. knowledge/stats/terminal-mean-is-not-measurable: for a
// heavy-tailed e the sample mean is biased DOWNWARD (a mean-1 martingale reads 0.0288 at
// N=4000) and s is set by a handful of draws, so s/sqrt(n) can exceed mu itself. The bound
// carries evidence only when it lies ABOVE 1; a reading at the 0 clamp is uninformative.
const meanSd = (xs) => { const n = xs.length; if (n < 2) return NaN;
  const mu = xs.reduce((a, b) => a + b, 0) / n;
  return Math.sqrt(xs.reduce((a, b) => a + (b - mu) ** 2, 0) / (n - 1)); };
const meanLower95 = (xs, mu, sd) =>
  (xs.length < 2 || !Number.isFinite(sd) ? NaN : Math.max(0, mu - 1.645 * sd / Math.sqrt(xs.length)));

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
        // Recorded PER CELL as well as pooled. The pooled rate averages over
        // every null, so a cell where the detector is inert is invisible in it
        // -- see ../POWER-PER-CELL-PREREG.md and WORKLIST C29.
        const key = `${det.id}__${ns.id}`;
        try { const pv = det.run(shifted, { start: 0, len: ns.m }, { start: ns.m, len: NTEST }, ns);
              (det._pow ??= []).push(pv);
              ((det._powCell ??= {})[key] ??= []).push(pv); }
        catch { ((det._powCell ??= {})[key] ??= []).push(NaN); }
      }
    }
    const good = es.filter(Number.isFinite);
    const mean = good.reduce((a, b) => a + b, 0) / good.length;
    const sd = meanSd(good);
    const meanLo = meanLower95(good, mean, sd);
    const sorted = [...good].sort((a, b) => a - b);
    // Per-cell power, computed before the alpha loop so every emitted cell
    // carries it. See ../POWER-PER-CELL-PREREG.md and WORKLIST C29.
    const pc = ((det._powCell ?? {})[`${det.id}__${ns.id}`] ?? []).filter(Number.isFinite);
    const pcRate = pc.length ? pc.filter((e) => e >= 20).length / pc.length : NaN;
    const pcVerdict = Number.isNaN(pcRate) ? 'not-measured' : (pcRate >= 0.5 ? 'powered' : 'INERT');
    for (const alpha of ALPHAS) {
      const k = good.filter((e) => e >= 1 / alpha).length;
      const exc = k / good.length, lo = lower95(k, good.length);
      const c = { detector: det.id, null_id: ns.id, m: ns.m, alpha, n: good.length,
        exceedance: exc, lower_95: lo, verdict: lo > alpha ? 'FAIL' : 'not-refuted',
        mean_e: mean, mean_e_sd: sd, mean_e_lower_95: meanLo,
        p_e_ge_10: good.filter((e) => e >= 10).length / good.length,
        p99_e: sorted[Math.floor(0.99 * sorted.length)], nan_count: es.length - good.length,
        power_this_cell: pcRate, power_verdict: pcVerdict,
        mode: MODE, engine_version: engineVersion, git_sha: gitSha };
      cells.push(c);
      fs.writeFileSync(path.join(runDir, 'cells', `${det.id}__${ns.id}__a${alpha}.json`),
        JSON.stringify(c, null, 2));
    }
    // Change (c), ../POWER-PER-CELL-ADDENDUM-2026-08-07.md. The per-cell power number
    // above is recorded a second time under the field name the certification scorer reads
    // for a power cell (validation/certification/lib/score.mjs:16 tests
    // `'detection_rate' in c || 'rate_e_ge_20' in c`; it does not read power_this_cell), so
    // a per-null power arm can pair with its validity cell. rate_e_ge_20 is the name this
    // study's own pooled CONTROL_power cells already use. Nothing is recomputed:
    // rate_e_ge_20 === power_this_cell. No exceedance/mean_e, so this is not a validity
    // candidate; no bare `verdict`, so no power token can be read as a validity verdict.
    if (pc.length) {
      const p = { control: 'power_per_cell', detector: det.id, null_id: ns.id, m: ns.m,
        shift_sigma: 3, n: pc.length, rate_e_ge_20: pcRate, power_verdict: pcVerdict,
        mode: MODE, engine_version: engineVersion, git_sha: gitSha };
      fs.writeFileSync(path.join(runDir, 'cells', `POWER__${det.id}__${ns.id}.json`),
        JSON.stringify(p, null, 2));
    }
    console.log(`${det.id.padEnd(28)} ${ns.id.padEnd(9)} mean_e=${mean.toFixed(4)} ` +
      `mean_lo95=${Number.isFinite(meanLo) ? meanLo.toFixed(4) : 'n/a'} ` +
      `exc@.05=${(good.filter((e) => e >= 20).length / good.length).toFixed(4)} ` +
      `POWER=${Number.isNaN(pcRate) ? ' n/a ' : pcRate.toFixed(4)} ${pcVerdict}`);
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
  // Provenance for the two recording additions this run carries. See rule 6.
  prereg: ['PREREGISTRATION.md', 'POWER-PER-CELL-PREREG.md'],
  addenda: ['POWER-PER-CELL-ADDENDUM-2026-08-07.md'],
  recorded_additions: ['mean_e_sd', 'mean_e_lower_95', 'POWER__* per-cell power arms (rate_e_ge_20)'],
}, null, 2));
console.log(`\n${cells.length} cells -> ${path.relative(STUDY, runDir)}`);

// C45 probe: decomposing the K6 / K6-slow `p_uniformity` KS excess into its three candidate
// components. Registered at ../PREREGISTRATION.md Amendment v2.C45 (WORKLIST C45).
//
// THE QUESTION. Both block-conformal shape detectors read a per-window conformal p that KS-rejects
// uniformity on the healthy arm — `shape_block_conformal_bet` 0.022904 against critical 0.008779 at
// n = 24,000 (`results/live/run-20260808T133746Z`), `shape_ecdf_accumulator` 0.041150 against
// 0.004808 at n = 80,000 (`run-20260809T035934Z`), and 0.037646 as the mean over 100 fresh
// calibration draws (`run-acrossdraw-20260809T065107Z`, so the excess is structural, not one draw's
// bad luck). Three mechanisms could carry it and nothing so far separates them:
//
//   (a) THE DISCRETE-RANK ATOM. p = (1 + #{ref >= live})/(m + 1) lives on an (m+1)-atom lattice, and
//       the sup gap between that lattice's CDF and continuous Uniform(0,1) is exactly 1/(m+1) —
//       a floor no sample size removes, because the KS statistic is computed against the continuous
//       reference (`computePUniformity`, run-battery.mjs).
//   (b) THE SHARED CALIBRATION REFERENCE. Every window of every trajectory of a run ranks against
//       ONE calibration draw. Conditional on that draw, p is not uniform: its CDF deviates from the
//       identity by the calibration draw's OWN empirical fluctuation, which is an O(1/sqrt(m))
//       deterministic (given the draw) distortion, not sampling noise — so it does NOT shrink as the
//       pooled n grows.
//   (c) RESIDUAL. Anything left: the estimated-median two-sided distance rank (K6), the reference
//       measure A shared inside T (K6-slow), tie handling, the injection-free live path.
//
// THE DESIGN. Four arms per construction, all on the SHIPPED modules (this file computes no p of its
// own), all at the geometries the runs use:
//
//   1. `atom`        — 1/(m+1), closed form, plus its MC appearance in the same KS statistic:
//                      n_p i.i.d. draws from the uniform (m+1)-atom lattice. This is (a) alone.
//   2. `shared`      — D = 1: one calibration draw, n_p pooled p from fresh null windows. This is
//                      what a run does. Reproduces the runs' readings or it does not.
//   3. `D-sweep`     — the same n_p spread over D independent calibration draws. As D grows the
//                      shared-reference distortion averages down like 1/sqrt(D); the atom floor does
//                      not move. The curve separates (b) from (a) directly.
//   4. `independent` — D = n_p (or n_windows): every window against its OWN fresh calibration draw.
//                      Full independence, matched against `atom` at the SAME n_p. Any gap here is
//                      the residual (c).
//   5. `n_p sweep`   — `shared` at four pooled sizes. THE DISCRIMINATOR: a deterministic
//                      shared-reference distortion is FLAT in n_p; sampling noise falls as
//                      1/sqrt(n_p). One curve tells them apart.
//
// SEED DISCIPLINE (../tools/README.md). Probe bases are >= 6e8 and every registered seed in this
// study is <= 1e8. This probe uses 8.4e8 (K6-slow) and 8.5e8 (K6). It reads no registered scenario
// seed, writes no run directory, emits no cell, and is not read by
// validation/certification/lib/collect.mjs.
//
// GENERATOR, disclosed: mulberry32(seed) uniforms -> Box-Muller standard normals, the form
// overlap-screen.mjs uses. This is NOT the registered study's PRNG (lib/inject.mjs's LCG). That is
// deliberate: if the shared arm reproduces the registered runs' KS magnitudes under a different
// generator, the mechanism is not a property of the LCG.
//
// Usage:  node validation/coverage/tools/ks-decomposition.mjs [--quick]

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const ENGINE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const require = createRequire(import.meta.url);
const acc = require(path.join(ENGINE_ROOT, 'dist/detectors/shape-ecdf-accumulator.js'));
const bet = require(path.join(ENGINE_ROOT, 'dist/detectors/shape-block-conformal-bet.js'));

const QUICK = process.argv.includes('--quick');

// ── generator (probe-local, disclosed above) ─────────────────────────────────
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function normals(rng, n) {
  const out = new Array(n);
  for (let i = 0; i < n; i += 2) {
    const u1 = Math.max(rng(), 1e-12), u2 = rng();
    const r = Math.sqrt(-2 * Math.log(u1)), th = 2 * Math.PI * u2;
    out[i] = r * Math.cos(th);
    if (i + 1 < n) out[i + 1] = r * Math.sin(th);
  }
  return out;
}

// Copied VERBATIM from validation/coverage/harness/run-battery.mjs's `computePUniformity`, because
// the probe has to compute the same statistic the runs report — a differently-conventioned KS would
// answer a different question. Only the decile counts are dropped (unused here).
function ks(rawPs) {
  const ps = rawPs.filter(Number.isFinite);
  const n = ps.length;
  const sorted = [...ps].sort((a, b) => a - b);
  let d = 0;
  for (let i = 0; i < n; i++) d = Math.max(d, (i + 1) / n - sorted[i], sorted[i] - i / n);
  return { n, ks_statistic: n > 0 ? d : NaN, ks_critical_at_alpha: n > 0 ? 1.36 / Math.sqrt(n) : NaN };
}

const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
const sd = (xs) => {
  if (xs.length < 2) return NaN;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1));
};
const f6 = (x) => (Number.isFinite(x) ? x.toFixed(6) : '   n/a  ');

// ── the two constructions, each wired to its own shipped module ──────────────
// `pPerWindow` is how many pooled p values one live window contributes: K6-slow reads one feature
// per window, K6 reads two (kurtosis and |skew|), which is why n = 80,000 on a 2,000 x 40 run and
// n = 24,000 on a 2,000 x 6 x 2 run.
const CONSTRUCTIONS = {
  k6slow: {
    label: 'shape_ecdf_accumulator (K6-slow)',
    seedBase: 840000000,
    m: acc.M_K6SLOW,                       // 500
    W: acc.W_K6SLOW,                       // 150
    calRows: acc.N_ROWS_K6SLOW,            // 100,000 (A = 25,000 + 500 blocks of 150)
    pPerWindow: 1,
    runReading: { single_draw: 0.041150, across_draw_mean: 0.037646, across_draw_sd: 0.010502, n_p: 80000 },
    calibrate: (rows) => acc.calibrateEcdfAccumulator(rows),
    windowPs: (w, cal) => [acc.ecdfAccumulatorWindow(w, cal).p],
  },
  k6: {
    label: 'shape_block_conformal_bet (K6)',
    seedBase: 850000000,
    m: 333,                                // floor(10,000 / 30), calibrateShapeBlocks's own m
    W: bet.W_K6,                           // 30
    calRows: 10000,
    pPerWindow: 2,
    runReading: { single_draw: 0.022904, across_draw_mean: null, across_draw_sd: null, n_p: 24000 },
    calibrate: (rows) => bet.calibrateShapeBlocks(rows, bet.W_K6),
    windowPs: (w, cal) => bet.shapeBetWindow(w, cal).perFeature.map((f) => f.p),
  },
};

// ── arm 1: the atom floor, closed form and as it appears in the statistic ────
// Under exact exchangeability p is uniform on {1/(m+1), ..., (m+1)/(m+1)}. sup_u |F_lattice(u) - u|
// is 1/(m+1) (attained just below each atom), so that is the floor the KS statistic cannot go under
// however large n_p is. The MC arm reports what the floor looks like at finite n_p, where sampling
// noise sits on top of it.
function armAtom(c, nP, reps, rng) {
  const out = [];
  for (let r = 0; r < reps; r++) {
    const ps = new Array(nP);
    for (let i = 0; i < nP; i++) ps[i] = Math.ceil(rng() * (c.m + 1)) / (c.m + 1);
    out.push(ks(ps).ks_statistic);
  }
  return out;
}

// ── arms 2-4: D independent calibration draws, n_p pooled p, on the real module ──
// D = 1 is what a run does. D = n_windows is full independence. Everything between traces how the
// shared-reference distortion averages down.
function armPooled(c, nP, D, seed) {
  const rng = mulberry32(seed);
  const nWindows = Math.round(nP / c.pPerWindow);
  const perDraw = Math.floor(nWindows / D);
  const ps = [];
  for (let d = 0; d < D; d++) {
    const cal = c.calibrate(normals(rng, c.calRows));
    for (let i = 0; i < perDraw; i++) {
      for (const p of c.windowPs(normals(rng, c.W), cal)) ps.push(p);
    }
  }
  return ks(ps).ks_statistic;
}

function reps(fn, n) {
  const out = [];
  for (let r = 0; r < n; r++) out.push(fn(r));
  return out;
}

function report(name) {
  const c = CONSTRUCTIONS[name];
  const R = QUICK ? 3 : 12;
  console.log(`\n${'='.repeat(96)}`);
  console.log(`${c.label}  —  m = ${c.m}, W = ${c.W}, calibration rows = ${c.calRows}, ${c.pPerWindow} p per window`);
  console.log(`run readings: single draw ${f6(c.runReading.single_draw)} at n_p = ${c.runReading.n_p}`
    + (c.runReading.across_draw_mean !== null
      ? `; across-draw mean ${f6(c.runReading.across_draw_mean)} (sd ${f6(c.runReading.across_draw_sd)})` : ''));
  console.log('='.repeat(96));

  // The pooled size every arm is compared AT. Matched n matters: the KS statistic's own noise floor
  // is ~0.87/sqrt(n_p), so two arms at different n_p are not comparable.
  const nP = QUICK ? 5000 : 20000;

  // (a) the atom floor
  const atomMC = armAtom(c, nP, R, mulberry32(c.seedBase + 1));
  console.log(`\n(a) ATOM  exact 1/(m+1) = ${f6(1 / (c.m + 1))}`);
  console.log(`    lattice MC at n_p = ${nP}: mean ${f6(mean(atomMC))}  sd ${f6(sd(atomMC))}  `
    + `[${f6(Math.min(...atomMC))}, ${f6(Math.max(...atomMC))}]  (R = ${R})`);
  console.log(`    KS critical at this n_p: ${f6(1.36 / Math.sqrt(nP))}`);

  // (b) the D-sweep, on the real module
  const dGrid = QUICK ? [1, 5, 50] : [1, 2, 5, 10, 25, 50, 100, 250, 1000];
  console.log(`\n(b) SHARED-REFERENCE D-SWEEP at n_p = ${nP}, on the shipped module`);
  console.log('    D      mean KS     sd        min         max        vs atom MC   0.8687/sqrt(m*D)');
  const dRows = [];
  for (const D of dGrid) {
    const r = D >= 100 ? Math.max(2, Math.floor(R / 3)) : R;
    const vals = reps((i) => armPooled(c, nP, D, c.seedBase + 100000 + D * 1000 + i), r);
    const predicted = 0.8687 / Math.sqrt(c.m * D);
    dRows.push({ D, mean: mean(vals), sd: sd(vals), r });
    console.log(`    ${String(D).padStart(5)}  ${f6(mean(vals))}  ${f6(sd(vals))}  `
      + `${f6(Math.min(...vals))}  ${f6(Math.max(...vals))}  ${f6(mean(vals) / mean(atomMC))}x    ${f6(predicted)}`);
  }

  // (c) full independence, matched against the atom floor at the SAME n_p
  const indepNP = QUICK ? 1000 : (name === 'k6slow' ? 4000 : nP);
  const indepR = name === 'k6slow' ? (QUICK ? 2 : 3) : R;
  const indepD = Math.round(indepNP / c.pPerWindow);
  const indepVals = reps((i) => armPooled(c, indepNP, indepD, c.seedBase + 500000 + i), indepR);
  const atomAtIndep = armAtom(c, indepNP, Math.max(indepR, 6), mulberry32(c.seedBase + 600000));
  console.log(`\n(c) FULL INDEPENDENCE — one fresh calibration draw PER WINDOW (D = ${indepD}) at n_p = ${indepNP}`);
  console.log(`    independent: mean ${f6(mean(indepVals))}  sd ${f6(sd(indepVals))}  (R = ${indepR})`);
  console.log(`    atom MC at the same n_p: mean ${f6(mean(atomAtIndep))}  sd ${f6(sd(atomAtIndep))}`);
  console.log(`    RESIDUAL (independent - atom) = ${f6(mean(indepVals) - mean(atomAtIndep))}`);
  const sharedAtIndepNP = reps((i) => armPooled(c, indepNP, 1, c.seedBase + 700000 + i), Math.max(indepR, 6));
  console.log(`    shared (D = 1) at the SAME n_p: mean ${f6(mean(sharedAtIndepNP))}  sd ${f6(sd(sharedAtIndepNP))}`);

  // the discriminator: is the shared-arm excess a bias or is it noise?
  const npGrid = QUICK ? [2000, 8000] : [5000, 20000, 80000, 200000];
  console.log('\n(d) DISCRIMINATOR — shared (D = 1) against pooled size. A deterministic');
  console.log('    shared-reference distortion is FLAT in n_p; sampling noise falls as 1/sqrt(n_p).');
  console.log('    n_p       mean KS     sd         atom MC     KS critical');
  for (const n of npGrid) {
    const r = n >= 80000 ? Math.max(2, Math.floor(R / 3)) : R;
    const vals = reps((i) => armPooled(c, n, 1, c.seedBase + 800000 + n + i), r);
    const at = armAtom(c, n, Math.max(r, 4), mulberry32(c.seedBase + 900000 + n));
    console.log(`    ${String(n).padStart(7)}  ${f6(mean(vals))}  ${f6(sd(vals))}  `
      + `${f6(mean(at))}  ${f6(1.36 / Math.sqrt(n))}`);
  }
}

// ── the settled shared arm, on its own, at whatever R the caller can afford ───
// Added at the C45 correction append (v2.C45 correction, item (b)): the R = 12 headline figures in
// C45.3 are ~10% (K6-slow) and ~5% (K6) high as estimates of E[shared KS], and a review measured the
// settled values at R = 80. This mode exists so those figures rest on committed code rather than on
// a scratch loop. `--reps N` sets R; `--shared-only` selects this mode; `--n-p N` overrides n_p.
function reportSharedOnly(name, R, nP) {
  const c = CONSTRUCTIONS[name];
  const vals = reps((i) => armPooled(c, nP, 1, c.seedBase + 1100000 + i), R);
  const closed = 0.8687 / Math.sqrt(c.m);
  const mu = mean(vals);
  const se = sd(vals) / Math.sqrt(R);
  console.log(`${c.label}  shared arm (D = 1), n_p = ${nP}, R = ${R}`);
  console.log(`  mean ${f6(mu)}  sd ${f6(sd(vals))}  se(mean) ${f6(se)}  `
    + `95% interval [${f6(mu - 1.96 * se)}, ${f6(mu + 1.96 * se)}]`);
  console.log(`  closed form 0.8687/sqrt(${c.m}) = ${f6(closed)}   measured/closed = ${f6(mu / closed)}`);
  console.log(`  run reading ${f6(c.runReading.single_draw)}  ->  (reading - mean)/sd = `
    + `${f6((c.runReading.single_draw - mu) / sd(vals))}   [an UNSTABLE draw-level z; see v2.C45's `
    + 'correction append item (a) — the stable statement is against K_0.95/sqrt(m)]');
}

const only = process.argv.find((a) => a === 'k6' || a === 'k6slow');
const numArg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? Number(process.argv[i + 1]) : d; };
if (process.argv.includes('--shared-only')) {
  const R = numArg('--reps', 80);
  const nP = numArg('--n-p', 20000);
  for (const name of only ? [only] : ['k6slow', 'k6']) reportSharedOnly(name, R, nP);
} else {
  for (const name of only ? [only] : ['k6slow', 'k6']) report(name);
}
console.log('\nprobe complete — no run directory written, no cell emitted, no registered seed read.');

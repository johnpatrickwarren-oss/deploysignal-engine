// test/adr-0005-safe-t-e-value.test.ts — ADR 0005.
//
// The safe (right-Haar / GROW) two-sample t-test e-value. Validates that the VARIANCE nuisance is
// genuinely fixed (exact scale-invariance; E[e|H0] ≤ 1 at EVERY calibration length with iid/known-φ
// residuals), and HONESTLY pins the reattributed floor: with the DEFAULT estimated φ, short-calibration
// φ-estimation error — not the variance — keeps E[e|H0] > 1 below cal ≈ 100.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  safeTwoSampleTEValue,
  SAFE_T_ENVELOPE,
  DEFAULT_EFFECT_PRIOR_VAR,
} from '../detectors/safe-t-e-value';

function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => { s = ((s * 1664525) + 1013904223) >>> 0; return s / 0x100000000; };
}
function gaussian(rng: () => number): number {
  const u1 = Math.max(rng(), 1e-12), u2 = rng();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}
/** iid Gaussian (no autocorrelation) — the regime where the safe-t null is EXACTLY t_ν. */
function iid(seed: number, len: number, base = 1000, sd = 2): number[] {
  const rng = lcg(seed); const v: number[] = [];
  for (let t = 0; t < len; t++) v.push(base + sd * gaussian(rng));
  return v;
}
/** AR(1) stream; optional mean shift from `shiftAt`. */
function ar1(seed: number, len: number, rho: number, shiftAt = -1, shift = 0, base = 1000, sd = 2): number[] {
  const rng = lcg(seed); const v: number[] = []; let p = gaussian(rng);
  for (let t = 0; t < len; t++) {
    p = rho * p + Math.sqrt(1 - rho * rho) * gaussian(rng);
    v.push(base + sd * p + (shiftAt >= 0 && t >= shiftAt ? shift : 0));
  }
  return v;
}
function mean(xs: number[]): number { return xs.reduce((a, b) => a + b, 0) / xs.length; }
function rate(xs: number[], k: number): number { return xs.filter((x) => x >= k).length / xs.length; }

// ── 1. The variance fix: E[e|H0] ≤ 1 at EVERY calibration length with iid residuals (φ=0). ──────────
test('variance fix: with iid residuals (φ=0), E[e|H0] ≤ 1 at every cal incl. cal=5 (no variance floor)', () => {
  for (const cl of [5, 10, 20, 50, 100]) {
    const es: number[] = [];
    for (let s = 0; s < 4000; s++) es.push(safeTwoSampleTEValue(iid(101 + s * 7919, cl + 200), { start: 0, len: cl }, { start: cl, len: 200 }, { ar1Phi: 0 }));
    assert.ok(mean(es) <= 1, `iid E[e|H0] at cal=${cl} must be ≤ 1; got ${mean(es).toFixed(3)}`);
    assert.ok(rate(es, 100) <= 0.01 + 0.004, `iid P(fire) at cal=${cl} must be ≤ α; got ${rate(es, 100).toFixed(4)}`);
  }
});

// ── 2. Exact scale/location invariance (the right-Haar property). ──────────────────────────────────
test('invariance: the e-value is EXACTLY invariant to an affine transform a + b·x of all data', () => {
  const v = ar1(2024, 1000, 0.5);
  const cal = { start: 0, len: 300 }, tst = { start: 300, len: 200 };
  const e0 = safeTwoSampleTEValue(v, cal, tst);
  for (const [a, b] of [[0, 7], [5000, 1], [-3000, 0.01], [12345, 250]] as const) {
    const e1 = safeTwoSampleTEValue(v.map((x) => a + b * x), cal, tst);
    assert.ok(Math.abs(e0 - e1) <= 1e-9 * Math.max(1, e0), `affine (a=${a},b=${b}) must leave the e-value unchanged: ${e0} vs ${e1}`);
  }
});

// ── 3. Power: detects a mean shift. ─────────────────────────────────────────────────────────────────
test('power: detects a mean shift (well-powered cal)', () => {
  const es: number[] = [];
  for (let s = 0; s < 1000; s++) es.push(safeTwoSampleTEValue(ar1(9001 + s * 7919, 800, 0.5, 520, 4), { start: 0, len: 500 }, { start: 500, len: 200 }));
  assert.ok(rate(es, 100) >= 0.95, `shift detection ${rate(es, 100)} must be ≥ 0.95`);
});

// ── 4. Closed form == the scaled-t marginal ratio BF = r^-1/2 · f_t(t/√r;ν)/f_t(t;ν) (independent). ──
test('formula: the closed form equals the scaled-t marginal ratio m₁(t)/m₀(t)', () => {
  // Student-t log-density up to the ν-only constant (which cancels in the ratio).
  const logFtKernel = (x: number, nu: number): number => -((nu + 1) / 2) * Math.log(1 + (x * x) / nu);
  for (const seed of [1, 42, 777]) {
    for (const [cl, tl] of [[300, 200], [50, 400], [600, 200]] as const) {
      const v = ar1(seed, cl + tl, 0.5, cl + 10, 3); // a shift so the e-value is well away from 1
      const cal = { start: 0, len: cl }, tst = { start: cl, len: tl };
      const got = safeTwoSampleTEValue(v, cal, tst);
      // Reconstruct t, ν, n_eff, r the same way, then form BF via the scaled-t density ratio.
      const phiFromValues = (vv: number[]): number => {
        // mirror computePerSignalAr1Phi on the cal window
        const w = vv.slice(0, cl); const m = mean(w);
        let lag1 = 0, varr = 0, xPrev = w[0] - m; varr += xPrev * xPrev;
        for (let i = 1; i < w.length; i++) { const x = w[i] - m; lag1 += x * xPrev; varr += x * x; xPrev = x; }
        if (varr < 1e-12) return 0;
        const phiOls = lag1 / varr; const phi = phiOls + (1 + 3 * phiOls) / w.length;
        return Math.max(-0.95, Math.min(0.95, phi));
      };
      const phi = phiFromValues(v);
      const wc: number[] = []; for (let t = 1; t < cl; t++) wc.push(v[t] - phi * v[t - 1]);
      const wt: number[] = []; for (let t = cl; t < cl + tl; t++) wt.push(v[t] - phi * v[t - 1]);
      const n1 = wc.length, n2 = wt.length, mc = mean(wc), mt = mean(wt);
      let ss = 0; for (const x of wc) ss += (x - mc) ** 2; for (const x of wt) ss += (x - mt) ** 2;
      const nu = n1 + n2 - 2, sp2 = Math.max(ss / nu, 1e-12), nEff = (n1 * n2) / (n1 + n2);
      const tstat = (mt - mc) / (Math.sqrt(sp2) * Math.sqrt(1 / n1 + 1 / n2));
      const r = 1 + nEff * DEFAULT_EFFECT_PRIOR_VAR;
      // BF = r^-1/2 · exp(logFt(t/√r) − logFt(t))
      const want = Math.pow(r, -0.5) * Math.exp(logFtKernel(tstat / Math.sqrt(r), nu) - logFtKernel(tstat, nu));
      assert.ok(Math.abs(Math.log(got) - Math.log(want)) < 1e-9, `seed=${seed} (${cl},${tl}): closed form ${got} vs scaled-t ratio ${want}`);
    }
  }
});

// ── 5. The reattributed floor (the honest ADR 0005 finding): with ESTIMATED φ, small-cal E[e|H0] is
//       inflated by the φ plug-in — NOT the variance (known φ stays valid at the same cal). ──────────
test('φ-floor: estimated φ inflates small-cal E[e|H0] where known φ does not (the floor is φ, not variance)', () => {
  const cl = 10, tl = 200, K = 8000;
  const estimated: number[] = [], known: number[] = [];
  for (let s = 0; s < K; s++) {
    const v = ar1(101 + s * 7919, cl + tl, 0.5);
    estimated.push(safeTwoSampleTEValue(v, { start: 0, len: cl }, { start: cl, len: tl }));            // default estimator
    known.push(safeTwoSampleTEValue(v, { start: 0, len: cl }, { start: cl, len: tl }, { ar1Phi: 0.5 })); // oracle φ
  }
  assert.ok(mean(known) <= 1, `with the TRUE φ, cal=${cl} is valid: E[e|H0]=${mean(known).toFixed(3)} ≤ 1`);
  // Mean ratio (huge at cal=10) AND the STABLE tail-probability statistic both show the φ-plug-in inflation
  // (the mean alone is heavy-tail / seed-unstable — cold-eye note).
  assert.ok(mean(estimated) > 10 * mean(known), `the estimated-φ plug-in must inflate E[e|H0] far above the known-φ value (${mean(estimated).toExponential(2)} vs ${mean(known).toFixed(3)}) — the floor is the φ plug-in`);
  assert.ok(rate(estimated, 100) > rate(known, 100), `estimated-φ tail P(e≥1/α) ${rate(estimated, 100).toFixed(4)} must exceed oracle-φ ${rate(known, 100).toFixed(4)} (stable evidence of the φ-driven inflation)`);
});

// ── Envelope + guards. ──────────────────────────────────────────────────────────────────────────────
test('envelope: shipped and honest about the φ-driven floor', () => {
  assert.equal(SAFE_T_ENVELOPE.variance, 'stable');
  assert.equal(SAFE_T_ENVELOPE.validUnderEstimatedBaseline, true);
  assert.equal(SAFE_T_ENVELOPE.minCalibration, 3);
  assert.match(SAFE_T_ENVELOPE.notes, /φ plug-in/);
});

test('guards: invalid windows / inputs throw RangeError', () => {
  const v = ar1(5, 1000, 0.5);
  assert.throws(() => safeTwoSampleTEValue(v, { start: 0, len: 2 }, { start: 2, len: 10 }), RangeError, 'cal.len < 3');
  assert.throws(() => safeTwoSampleTEValue(v, { start: 0, len: 100 }, { start: 100, len: 1 }), RangeError, 'test.len < 2');
  assert.throws(() => safeTwoSampleTEValue(v, { start: 0, len: 100 }, { start: 0, len: 10 }), RangeError, 'test.start < 1');
  assert.throws(() => safeTwoSampleTEValue(v, { start: 0, len: 100 }, { start: 950, len: 100 }), RangeError, 'out of bounds');
  assert.throws(() => safeTwoSampleTEValue(v, { start: 0, len: 100 }, { start: 100, len: 200 }, { effectPriorVar: 0 }), RangeError, 'effectPriorVar');
  const withNaN = v.slice(); withNaN[50] = NaN;
  assert.throws(() => safeTwoSampleTEValue(withNaN, { start: 0, len: 200 }, { start: 200, len: 100 }), RangeError, 'non-finite');
});

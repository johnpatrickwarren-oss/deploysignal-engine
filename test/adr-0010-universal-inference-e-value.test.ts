// test/adr-0010-universal-inference-e-value.test.ts — ADR 0010.
//
// The split likelihood-ratio (universal inference) e-value for an AR(1) mean shift. The headline is the
// GUARANTEE the safe-t (ADR 0005/0009) could not provide: E[e|H0] ≤ 1 holds for ANY φ — including the
// near-unit-root cells where the safe-t's heavy-tailed mean exploded to 1e15 — AND the e-value is BOUNDED
// (no catastrophic realisation). Independently cold-eye-attacked (8M+ draws, mulberry32, unseen seeds): no
// E[e|H0] > 1 found; worst cell ≈ 0.18–0.27; max single e ≈ 816.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  universalInferenceMeanShiftEValue,
  UI_MEAN_SHIFT_ENVELOPE,
} from '../detectors/universal-inference-e-value';
import { safeTwoSampleTEValue } from '../detectors/safe-t-e-value';

function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => { s = ((s * 1664525) + 1013904223) >>> 0; return s / 0x100000000; };
}
function gaussian(rng: () => number): number {
  const u1 = Math.max(rng(), 1e-12), u2 = rng();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}
function ar1(seed: number, len: number, rho: number, shiftAt = -1, shift = 0, base = 1000, sd = 2): number[] {
  const rng = lcg(seed); const v: number[] = []; let p = gaussian(rng);
  for (let t = 0; t < len; t++) { p = rho * p + Math.sqrt(1 - rho * rho) * gaussian(rng); v.push(base + sd * p + (shiftAt >= 0 && t >= shiftAt ? shift : 0)); }
  return v;
}
const mean = (xs: number[]): number => xs.reduce((a, b) => a + b, 0) / xs.length;
const rate = (xs: number[], k: number): number => xs.filter((x) => x >= k).length / xs.length;
const CAL = (cl: number) => ({ start: 0, len: cl });
const TST = (cl: number) => ({ start: cl, len: 200 });

// ── 1. THE GUARANTEE: E[e|H0] ≤ 1 for ANY φ incl. near unit root — AND the e-value stays BOUNDED. ────
//       (3 disjoint seed families per cell so a pass is not seed-luck — the lesson of ADR 0009.) ──────
test('guarantee: E[e|H0] ≤ 1 uniformly over cal × φ incl. near-unit-root, with the e-value bounded', () => {
  for (const cl of [10, 20, 50, 100, 200]) {
    for (const ph of [0, 0.5, 0.8, 0.9, 0.95, 0.99]) {
      let worstMean = 0, worstMax = 0;
      for (const baseSeed of [101, 50021, 314159]) {
        const es: number[] = [];
        for (let s = 0; s < 2500; s++) es.push(universalInferenceMeanShiftEValue(ar1(baseSeed + s * 7919, cl + 200, ph), CAL(cl), TST(cl)));
        worstMean = Math.max(worstMean, mean(es));
        worstMax = Math.max(worstMax, Math.max(...es));
      }
      assert.ok(worstMean <= 0.6, `E[e|H0] at cal=${cl}, φ=${ph} must be ≤ 1 (asserting ≤ 0.6 with margin); got ${worstMean.toFixed(3)}`);
      assert.ok(worstMax <= 5000, `e-value at cal=${cl}, φ=${ph} must stay BOUNDED (no exponent blow-up); got max ${worstMax.toExponential(2)}`);
    }
  }
});

// ── 2. The exact cell where the safe-t BLEW UP (ADR 0009 cold-eye: E[e|H0]=368) — UI stays valid+bounded.
test('contrast: at cal=50, φ=0.95 the safe-t mean explodes (>100) while the UI mean stays ≤ 1 and bounded', () => {
  const safe: number[] = [], ui: number[] = [];
  for (let s = 0; s < 4000; s++) {
    const v = ar1(2 + s * 7919, 250, 0.95);          // seed base 2: the cold-eye's reproduction
    safe.push(safeTwoSampleTEValue(v, CAL(50), TST(50)));
    ui.push(universalInferenceMeanShiftEValue(v, CAL(50), TST(50)));
  }
  assert.ok(mean(safe) > 100, `safe-t must blow up on this cell (got ${mean(safe).toExponential(2)})`);
  assert.ok(mean(ui) <= 1, `UI must stay valid (got ${mean(ui).toFixed(3)})`);
  assert.ok(Math.max(...ui) <= 5000, `UI must stay bounded (got ${Math.max(...ui).toExponential(2)})`);
});

// ── 3. Deep near-unit-root incl. φ=0.999 — the regime no safe-t variant could make valid. ────────────
test('near-unit-root: φ ∈ {0.99, 0.999} stay valid (E[e|H0] ≤ 1) and bounded', () => {
  for (const ph of [0.99, 0.999]) {
    const es: number[] = [];
    for (let s = 0; s < 4000; s++) es.push(universalInferenceMeanShiftEValue(ar1(777 + s * 7919, 400, ph), CAL(200), TST(200)));
    assert.ok(mean(es) <= 0.6, `φ=${ph} E[e|H0] must be ≤ 1; got ${mean(es).toFixed(3)}`);
    assert.ok(Math.max(...es) <= 5000, `φ=${ph} e-value must stay bounded; got ${Math.max(...es).toExponential(2)}`);
  }
});

// ── 4. POWER is real (not a trivially-valid always-small e-value): detects a mean shift at low φ. ─────
test('power: detects a mean shift — well-powered at φ ≤ 0.5', () => {
  const p0: number[] = [];
  for (let s = 0; s < 1500; s++) p0.push(universalInferenceMeanShiftEValue(ar1(9001 + s * 7919, 320, 0, 110, 4), CAL(100), TST(100)));
  assert.ok(rate(p0, 100) >= 0.9, `iid cal=100 shift detection ${rate(p0, 100).toFixed(2)} must be ≥ 0.9`);
  const p5: number[] = [];
  for (let s = 0; s < 1500; s++) p5.push(universalInferenceMeanShiftEValue(ar1(7001 + s * 7919, 420, 0.5, 210, 4), CAL(200), TST(200)));
  assert.ok(rate(p5, 100) >= 0.7, `φ=0.5 cal=200 shift detection ${rate(p5, 100).toFixed(2)} must be ≥ 0.7`);
});

// ── 5. Degenerate / guards. ─────────────────────────────────────────────────────────────────────────
test('degenerate: a constant series yields e ≈ 1 (no false fire)', () => {
  const v = new Array(300).fill(1000);
  const e = universalInferenceMeanShiftEValue(v, CAL(100), TST(100));
  assert.ok(Math.abs(e - 1) < 1e-6, `constant series must give e ≈ 1; got ${e}`);
});

test('guards: invalid windows / inputs throw RangeError', () => {
  const v = ar1(5, 1000, 0.5);
  assert.throws(() => universalInferenceMeanShiftEValue(v, CAL(5), TST(5)), RangeError, 'cal.len < 6');
  assert.throws(() => universalInferenceMeanShiftEValue(v, { start: 0, len: 100 }, { start: 100, len: 5 }), RangeError, 'test.len < 6');
  assert.throws(() => universalInferenceMeanShiftEValue(v, { start: 0, len: 100 }, { start: 0, len: 100 }), RangeError, 'test.start < 1');
  assert.throws(() => universalInferenceMeanShiftEValue(v, { start: 0, len: 100 }, { start: 950, len: 100 }), RangeError, 'out of bounds');
  const withNaN = v.slice(); withNaN[150] = NaN;
  assert.throws(() => universalInferenceMeanShiftEValue(withNaN, { start: 0, len: 200 }, { start: 200, len: 100 }), RangeError, 'non-finite');
});

// ── 6. Envelope: advertises the any-φ guarantee and the honest well-specification + power caveats. ───
test('envelope: any-φ validity advertised, with the well-specification + power caveats', () => {
  assert.equal(UI_MEAN_SHIFT_ENVELOPE.autocorrelation, 'ar1-any-phi');
  assert.equal(UI_MEAN_SHIFT_ENVELOPE.validUnderEstimatedBaseline, true);
  assert.equal(UI_MEAN_SHIFT_ENVELOPE.minCalibration, 6);
  assert.match(UI_MEAN_SHIFT_ENVELOPE.notes, /BY CONSTRUCTION for ANY φ/);
  assert.match(UI_MEAN_SHIFT_ENVELOPE.notes, /well-specification/);
});

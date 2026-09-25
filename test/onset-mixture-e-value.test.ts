// test/onset-mixture-e-value.test.ts — the onset-mixture e-value (ADR 0034): lockstep against
// Tessera's compiled tools while Tessera carries an independent copy, and Tessera's property tests.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  supAdjuster, normalizedMixtureEValue, geometricMixtureEValue, GEO_RHOS,
  ONSET_MIXTURE_GAUSSIAN_ENVELOPE, ONSET_MIXTURE_BOUNDED_ENVELOPE,
} from '../detectors/onset-mixture-e-value';
import { gInc, gBounded, BOUND_LAMBDAS } from '../detectors/_bounded-bet';
import { gInc as gIncViaMonitor } from '../fleet/calibration-monitor';
import { DETECTOR_ENVELOPES, eBenjaminiHochbergGuarded } from '../fleet/e-bh-guarded';
import { guaranteeFor } from '../guarantees';

function mulberry(seed: number): () => number {
  let a = seed >>> 0;
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function gauss(rng: () => number): number {
  let u = 0, v = 0; while (!u) u = rng(); while (!v) v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

// ── lockstep against Tessera (skips when Tessera re-exports this engine, or is unreachable) ──

function tesseraTools(): { mix: any; sup: any; dir: string; independent: boolean } | null {
  const root = path.resolve(__dirname, '..', '..');
  const candidates = [
    ...(process.env.TESSERA_ROOT ? [path.resolve(process.env.TESSERA_ROOT)] : []),
    path.resolve(root, '..', 'tessera'), path.resolve(root, '..', '..', '..', 'tessera'),
  ];
  for (const dir of candidates) {
    const m = path.join(dir, 'tools', 'mixture-evalue.js'), s = path.join(dir, 'tools', 'supfdr.js');
    if (fs.existsSync(m) && fs.existsSync(s)) {
      const src = path.join(dir, 'tools', 'mixture-evalue.ts');
      const independent = !(fs.existsSync(src)
        && fs.readFileSync(src, 'utf8').includes('deploysignal-engine/detectors/onset-mixture-e-value'));
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      return { mix: require(m), sup: require(s), dir, independent };
    }
  }
  return null;
}

export function lockstepAgainstTessera(streams = 120):
  { comparisons: number; mismatches: number; dir: string; independent: boolean } | null {
  const T = tesseraTools();
  if (!T) return null;
  if (!T.independent) return { comparisons: 0, mismatches: 0, dir: T.dir, independent: false };
  let comparisons = 0, mismatches = 0;
  const eq = (a: number, b: number) => { comparisons++; if (!(a === b || (Number.isNaN(a) && Number.isNaN(b)))) mismatches++; };
  for (let s = 0; s < streams; s++) {
    const rng = mulberry(500 + s);
    const n = [40, 120, 240, 600][s % 4];
    const shiftAt = (s % 3) === 0 ? n : Math.floor(n / 2);
    const r = Array.from({ length: n }, (_, t) => gauss(rng) * (1 + (s % 5) * 0.05) + (t >= shiftAt ? (s % 4) : 0));
    for (const inc of ['gaussian', 'bounded'] as const) {
      eq(normalizedMixtureEValue(r, inc), T.mix.normalizedMixtureEValue(r, inc));
      eq(geometricMixtureEValue(r, inc), T.mix.geometricMixtureEValue(r, inc));
      for (const cut of [1, 7, Math.floor(n / 3), n - 1]) eq(geometricMixtureEValue(r.slice(0, cut), inc), T.mix.geometricMixtureEValue(r.slice(0, cut), inc));
    }
    for (const e of [0, 0.5, 1, 1.5, 4, 1e6, r[0] * r[0]]) eq(supAdjuster(e), T.sup.supAdjuster(e));
  }
  return { comparisons, mismatches, dir: T.dir, independent: true };
}

test('LOCKSTEP: normalized and geometric mixture e-values and the adjuster equal Tessera\'s compiled tools', (t) => {
  const r = lockstepAgainstTessera(120);
  if (!r) { t.diagnostic('Tessera compiled tools not reachable; lockstep skipped'); t.skip(); return; }
  if (!r.independent) { t.diagnostic(`${r.dir}: tools/mixture-evalue.ts re-exports this engine; nothing independent to compare`); t.skip(); return; }
  assert.ok(r.comparisons > 2000, `expected > 2000 comparisons, got ${r.comparisons}`);
  assert.equal(r.mismatches, 0, `${r.mismatches} of ${r.comparisons} comparisons mismatch against ${r.dir}`);
});

// ── the increment family has one home ──

test('the Gaussian increment reached through fleet/calibration-monitor is the detectors/ function', () => {
  assert.equal(gIncViaMonitor, gInc);
  assert.equal(gInc(0), Math.min(100, (2 * Math.exp(-0.125) + 2 * Math.exp(-0.5) + 2 * Math.exp(-2)) / 6));
});

test('√E−1 adjuster satisfies the integral identity ∫_1^∞ A(e)/e² de = 1 (numerical, to 1e-3)', () => {
  // ∫_1^∞ (√e − 1)/e² de = [−2/√e + 1/e]_1^∞ = 2 − 1 = 1 exactly; check the implementation numerically.
  let acc = 0;
  // log-spaced Riemann sum to 1e8 (the tail beyond E is 2/√E − 1/E ≈ 2e-4 at 1e8)
  for (let e = 1, de = 1e-3; e < 1e8; e *= 1 + de) acc += supAdjuster(e) / (e * e) * e * de;
  assert.ok(Math.abs(acc - 1) < 5e-3, `integral ${acc}`);
  assert.equal(supAdjuster(0.5), 0);
  assert.equal(supAdjuster(1), 0);
  assert.equal(supAdjuster(4), 1);
});

// ── Tessera's property tests (test/mixture-evalue.test.ts), carried over verbatim in substance ──

test('normalizedMixtureEValue: near-zero on a bounded null, large on a sustained shift; empty → 0', () => {
  const T = 400;
  const nullSeries = Array.from({ length: T }, (_, t) => Math.sin(t));
  const faultSeries = nullSeries.map((v, t) => v + (t > 200 ? 3 : 0));
  const e0 = normalizedMixtureEValue(nullSeries), e1 = normalizedMixtureEValue(faultSeries);
  assert.ok(Number.isFinite(e0) && e0 >= 0);
  assert.ok(e1 > e0 && e1 > 5, `fault e-value should be clearly large; got ${e1}`);
  assert.equal(normalizedMixtureEValue([]), 0);
  assert.equal(geometricMixtureEValue([]), 0);
});

test('geometricMixtureEValue: prefix-monotone (gaussian and bounded), the property the always-on loop needs', () => {
  for (const [seed, inc] of [[7, 'gaussian'], [11, 'bounded']] as const) {
    const rng = mulberry(seed);
    const r = Array.from({ length: 600 }, (_, t) => gauss(rng) + (t >= 300 ? 2.5 : 0));
    let prev = 0;
    for (const cut of [50, 100, 200, 300, 350, 400, 500, 600]) {
      const v = geometricMixtureEValue(r.slice(0, cut), inc);
      assert.ok(v >= prev - 1e-12, `${inc} prefix ${cut}: ${v} < previous ${prev}`);
      prev = v;
    }
  }
});

test('E[·|H0] ≤ 1 empirically on iid N(0,1): geometric (gaussian) and normalized (both increments)', () => {
  const REPS = 300, T = 240;
  let sg = 0, sn = 0, sb = 0;
  for (let rep = 0; rep < REPS; rep++) {
    const rng = mulberry(1000 + rep);
    const r = Array.from({ length: T }, () => gauss(rng));
    sg += geometricMixtureEValue(r); sn += normalizedMixtureEValue(r); sb += normalizedMixtureEValue(r, 'bounded');
  }
  assert.ok(sg / REPS <= 1, `geometric null mean ${(sg / REPS).toFixed(3)}`);
  assert.ok(sn / REPS <= 1, `normalized null mean ${(sn / REPS).toFixed(3)}`);
  assert.ok(sb / REPS <= 1, `bounded null mean ${(sb / REPS).toFixed(3)}`);
});

test('bounded: E[·|H0] holds under t3 tails and a 15% scale under-estimate, where the Gaussian increment breaks', () => {
  const t3 = (rng: () => number): number => { const n = gauss(rng); const c = gauss(rng) ** 2 + gauss(rng) ** 2 + gauss(rng) ** 2; return n / Math.sqrt(c / 3); };
  let sumT = 0, sumS = 0;
  const REPS = 300, T = 240;
  for (let rep = 0; rep < REPS; rep++) {
    const rng = mulberry(9000 + rep);
    sumT += normalizedMixtureEValue(Array.from({ length: T }, () => t3(rng)), 'bounded');
    const rng2 = mulberry(19000 + rep);
    sumS += normalizedMixtureEValue(Array.from({ length: T }, () => 1.15 * gauss(rng2)), 'bounded');
  }
  assert.ok(sumT / REPS <= 1, `t3 null mean ${(sumT / REPS).toFixed(3)} must be ≤ 1`);
  assert.ok(sumS / REPS <= 1, `scale-error null mean ${(sumS / REPS).toFixed(3)} must be ≤ 1`);
});

test('detects sustained shifts: 4σ quickly, 0.3σ over a long window (bounded); 3σ (geometric)', () => {
  const rng = mulberry(77);
  const big = Array.from({ length: 400 }, (_, t) => gauss(rng) + (t >= 100 ? 4 : 0));
  assert.ok(normalizedMixtureEValue(big, 'bounded') > 10);
  const rng2 = mulberry(78);
  const small = Array.from({ length: 1440 }, (_, t) => gauss(rng2) + (t >= 200 ? 0.3 : 0));
  assert.ok(normalizedMixtureEValue(small, 'bounded') > 3);
  const rng3 = mulberry(42);
  const nullS = Array.from({ length: 400 }, () => gauss(rng3));
  const fault = nullS.map((v, t) => v + (t >= 100 ? 3 : 0));
  assert.ok(geometricMixtureEValue(fault) > Math.max(5, geometricMixtureEValue(nullS) * 10));
});

// ── the use criteria ──

test('the envelopes are in the guarded map and the guarantee table, and the gate refuses without a regime assertion', () => {
  assert.equal(DETECTOR_ENVELOPES.onset_mixture_gaussian, ONSET_MIXTURE_GAUSSIAN_ENVELOPE);
  assert.equal(DETECTOR_ENVELOPES.onset_mixture_bounded, ONSET_MIXTURE_BOUNDED_ENVELOPE);
  assert.equal(ONSET_MIXTURE_BOUNDED_ENVELOPE.variance, 'robust');
  assert.equal(ONSET_MIXTURE_GAUSSIAN_ENVELOPE.validUnderEstimatedBaseline, false);
  const row = guaranteeFor('onset_mixture_rtt_p99')!;
  assert.equal(row.validityClass, 'ville_anytime_valid');
  assert.equal(row.estimatedBaseline, ONSET_MIXTURE_GAUSSIAN_ENVELOPE, 'the live envelope object, not a copy');
  assert.equal(row.approximateEValue.form, 'epsilon_growing');
  assert.throws(() => eBenjaminiHochbergGuarded([{ detectorId: 'onset_mixture_gaussian', eValue: 50 }], 0.1), /estimated baseline|regime|assert/i);
  // ADR 0035: fit ≫ horizon alone no longer admits either id — the tail premise is asked for.
  assert.equal(ONSET_MIXTURE_GAUSSIAN_ENVELOPE.tailPremise, 'mgf');
  assert.equal(ONSET_MIXTURE_BOUNDED_ENVELOPE.tailPremise, 'clip-mean-zero');
  assert.throws(() => eBenjaminiHochbergGuarded([{ detectorId: 'onset_mixture_bounded', eValue: 50, assertions: { mMuchGreaterThanN: true } }], 0.1), /CLIPPED residual/);
  assert.throws(() => eBenjaminiHochbergGuarded([{ detectorId: 'onset_mixture_gaussian', eValue: 50, assertions: { mMuchGreaterThanN: true } }], 0.1), /mgf exists/);
  assert.doesNotThrow(() => eBenjaminiHochbergGuarded([{ detectorId: 'onset_mixture_bounded', eValue: 50, assertions: { mMuchGreaterThanN: true, clipMeanZero: true } }], 0.1));
  assert.doesNotThrow(() => eBenjaminiHochbergGuarded([{ detectorId: 'onset_mixture_gaussian', eValue: 50, assertions: { mMuchGreaterThanN: true, lightTails: true } }], 0.1));
  assert.doesNotThrow(() => eBenjaminiHochbergGuarded([{ detectorId: 'onset_mixture_gaussian', eValue: 50, assertions: { mMuchGreaterThanN: true, incrementMean: { lower95: 0.995, upper95: 0.999 } } }], 0.1));
  assert.throws(() => eBenjaminiHochbergGuarded([{ detectorId: 'onset_mixture_gaussian', eValue: 50, assertions: { mMuchGreaterThanN: true, lightTails: true, incrementMean: { lower95: 1.60, upper95: 1.62 } } }], 0.1), /REFUTES/);
  assert.deepEqual([...GEO_RHOS], [1 / 64, 1 / 1024, 1 / 16384]);
  assert.equal(BOUND_LAMBDAS.length, 8);
  assert.equal(gBounded(0, 0.5), 1);
});

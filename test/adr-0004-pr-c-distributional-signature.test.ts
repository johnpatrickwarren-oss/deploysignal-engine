// test/adr-0004-pr-c-distributional-signature.test.ts — ADR 0004 PR C.
//
// Ports Tessera's signature validation (tools/fault-discriminator.ts, Tessera ADR 0016 "Lever B") for
// the promoted distributionalSignature. Properties, per the migration plan (ADR 0004 § Migration #3,
// "the trend-whitening fix is load-bearing — pin the valid null"):
//
//   1. VARIANCE — a variance-inflation fault (test std ×3) trips fRatio; a clean benign mean step does not.
//   2. TREND — a degradation ramp trips trendT.
//   3. TREND-WHITENING (load-bearing) — on an AUTOCORRELATED null the whitened trendT stays controlled,
//      while the naive RAW-value trend t-stat spuriously trips far more often. Whitening is what makes
//      the null valid.
//   4. COLLAPSE — a downward detachment trips collapseSigma; it is ONE-SIDED (an upward step is invisible).
//   5. BENIGN vs SIGNATURE — a clean benign mean step (same shape, the BF's domain) leaves NO signature;
//      the three signature faults each trip theirs. (This is the BF-complement: the BF fires on the mean
//      shift, the signature correctly says "no distributional change".)

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  distributionalSignature,
  F_RATIO_THRESHOLD,
  TREND_T_THRESHOLD,
  COLLAPSE_SIGMA_THRESHOLD,
} from '../detectors/distributional-signature';

// ── deterministic PRNG + Gaussian. ──
function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => { s = ((s * 1664525) + 1013904223) >>> 0; return s / 0x100000000; };
}
function gaussian(rng: () => number): number {
  const u1 = Math.max(rng(), 1e-12), u2 = rng();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

// ── synthetic single-shard streams (mirrors Tessera genShard). ──
const M = 600, NT = 200, BASE = 1000, NOISE = 2, RHO = 0.5;
const BENIGN_DELTA = 4, FAULT_VAR_MULT = 3, FAULT_TREND = 10, FAULT_COLLAPSE = 40;
type ShardType = 'healthy' | 'benign' | 'fault-variance' | 'fault-trend' | 'fault-collapse' | 'benign-up';

function genShard(seed: number, type: ShardType, rho = RHO): number[] {
  const rng = lcg(seed);
  const v: number[] = [];
  let p = gaussian(rng);
  for (let t = 0; t < M + NT; t++) {
    const inTest = t >= M;
    const stdMult = inTest && type === 'fault-variance' ? FAULT_VAR_MULT : 1;
    p = rho * p + Math.sqrt(1 - rho * rho) * gaussian(rng);
    let x = BASE + NOISE * stdMult * p;
    if (inTest && type === 'benign') x += BENIGN_DELTA;
    if (inTest && type === 'benign-up') x += FAULT_COLLAPSE; // a large UPWARD benign step
    if (inTest && type === 'fault-trend') x += (FAULT_TREND * (t - M)) / NT;
    if (inTest && type === 'fault-collapse') x -= FAULT_COLLAPSE;
    v.push(x);
  }
  return v;
}

const CAL = { start: 0, len: M }, TST = { start: M, len: NT };
function mean(xs: number[]): number { return xs.reduce((a, b) => a + b, 0) / xs.length; }
/** Mean score / trip-rate over K seeded shards of a type. */
function sweep(type: ShardType, K: number, pick: (s: ReturnType<typeof distributionalSignature>) => number) {
  const vals: number[] = [];
  for (let s = 0; s < K; s++) vals.push(pick(distributionalSignature(genShard(17 + s * 13, type), CAL, TST)));
  return vals;
}
function rateOver(xs: number[], th: number): number { return xs.filter((x) => x > th).length / xs.length; }

// ── 1. Variance. ──────────────────────────────────────────────────────────────────────────────────
test('variance: a ×3-std inflation trips fRatio; a clean benign mean step does not', () => {
  const faultF = sweep('fault-variance', 200, (g) => g.fRatio);
  const benignF = sweep('benign', 200, (g) => g.fRatio);
  assert.ok(mean(faultF) > F_RATIO_THRESHOLD, `variance fault mean fRatio ${mean(faultF).toFixed(2)} must exceed ${F_RATIO_THRESHOLD}`);
  assert.ok(rateOver(faultF, F_RATIO_THRESHOLD) >= 0.95, 'variance fault should trip fRatio almost always');
  assert.ok(Math.abs(mean(benignF) - 1) < 0.3, `benign mean step keeps fRatio ≈ 1; got ${mean(benignF).toFixed(2)}`);
  assert.ok(rateOver(benignF, F_RATIO_THRESHOLD) <= 0.02, 'a benign mean step must not trip the variance score');
});

// ── 2. Trend. ─────────────────────────────────────────────────────────────────────────────────────
test('trend: a degradation ramp trips trendT', () => {
  const faultT = sweep('fault-trend', 200, (g) => g.trendT);
  assert.ok(mean(faultT) > TREND_T_THRESHOLD, `trend fault mean trendT ${mean(faultT).toFixed(2)} must exceed ${TREND_T_THRESHOLD}`);
  assert.ok(rateOver(faultT, TREND_T_THRESHOLD) >= 0.9, 'a real ramp should trip trendT (survives whitening as slope·(1−φ))');
});

// ── 3. Trend-whitening is load-bearing (THE pinned null). ──────────────────────────────────────────
test('trend-whitening: whitened trendT controls the autocorrelated null where a raw-value t-stat spuriously trips', () => {
  // Measured FP at threshold across ρ (K=600): whitened holds ~0.2% at EVERY ρ; the naive raw t-stat
  // inflates with autocorrelation — 1.8% (ρ=.5), 15% (.8), 33% (.9), 50% (.95) — the ~200–300× blow-up
  // Tessera ADR 0016 reported. ρ=0.9 gives a stark, robust separation.
  const K = 400, rho = 0.9;
  // Naive RAW trend t-stat on the (unwhitened) test values, with the iid slope-se — the BUG the engine avoids.
  function rawTrendT(v: number[]): number {
    const xs = v.slice(M, M + NT), nt = xs.length, kbar = (nt - 1) / 2, xbar = mean(xs);
    let stt = 0, sty = 0;
    for (let k = 0; k < nt; k++) { stt += (k - kbar) ** 2; sty += (k - kbar) * (xs[k] - xbar); }
    const slope = sty / stt;
    const s2 = Math.max(xs.reduce((a, b) => a + (b - xbar) ** 2, 0) / (nt - 1), 1e-9);
    return Math.abs(slope) / Math.sqrt(s2 / stt);
  }
  const whitened: number[] = [], raw: number[] = [];
  for (let s = 0; s < K; s++) {
    const v = genShard(31 + s * 13, 'healthy', rho); // a pure AR(0.9) null — NO trend
    whitened.push(distributionalSignature(v, CAL, TST).trendT);
    raw.push(rawTrendT(v));
  }
  const whitenedFP = rateOver(whitened, TREND_T_THRESHOLD);
  const rawFP = rateOver(raw, TREND_T_THRESHOLD);
  assert.ok(whitenedFP <= 0.05, `whitened trend FP rate ${(whitenedFP * 100).toFixed(1)}% must stay controlled on the AR(0.9) null`);
  assert.ok(rawFP >= 0.20, `raw-value trend FP rate ${(rawFP * 100).toFixed(1)}% must be high (the spurious inflation)`);
  assert.ok(rawFP > whitenedFP + 0.2, `raw FP ${(rawFP * 100).toFixed(1)}% must be MUCH higher than whitened ${(whitenedFP * 100).toFixed(1)}% (whitening removes the inflation)`);
});

// ── 4. Collapse — one-sided. ────────────────────────────────────────────────────────────────────
test('collapse: a downward detachment trips collapseSigma; it is one-sided (an upward step is invisible)', () => {
  const down = sweep('fault-collapse', 100, (g) => g.collapseSigma);
  const up = sweep('benign-up', 100, (g) => g.collapseSigma);
  assert.ok(mean(down) > COLLAPSE_SIGMA_THRESHOLD, `downward collapse mean collapseSigma ${mean(down).toFixed(1)} must exceed ${COLLAPSE_SIGMA_THRESHOLD}`);
  assert.ok(rateOver(down, COLLAPSE_SIGMA_THRESHOLD) >= 0.95, 'a downward collapse should trip collapseSigma');
  // An equally large UPWARD step yields collapseSigma exactly 0 (one-sided by construction).
  assert.ok(up.every((x) => x === 0), 'an upward step must yield collapseSigma = 0 (one-sided downward)');
});

// ── 5. Benign vs each signature fault (the BF-complement). ─────────────────────────────────────────
test('discrimination: signature faults trip hasSignature; a clean benign mean step does not', () => {
  const sigRate = (type: ShardType): number => {
    let trip = 0;
    for (let s = 0; s < 200; s++) if (distributionalSignature(genShard(101 + s * 13, type), CAL, TST).hasSignature) trip++;
    return trip / 200;
  };
  assert.ok(sigRate('fault-variance') >= 0.95, 'variance fault → signature');
  assert.ok(sigRate('fault-trend') >= 0.9, 'trend fault → signature');
  assert.ok(sigRate('fault-collapse') >= 0.95, 'collapse fault → signature');
  // The key complement: a benign mean step (the BF would fire on it) leaves NO distributional signature.
  assert.ok(sigRate('benign') <= 0.05, 'a clean benign mean step must NOT trip a signature (it is the BF’s domain)');
  assert.ok(sigRate('healthy') <= 0.05, 'a healthy null must NOT trip a signature');
});

// ── Guards. ──────────────────────────────────────────────────────────────────────────────────────
test('guards: invalid windows and non-finite inputs throw RangeError', () => {
  const v = genShard(5, 'healthy');
  assert.throws(() => distributionalSignature(v, { start: 0, len: 2 }, { start: 2, len: 10 }), RangeError, 'cal.len < 3');
  assert.throws(() => distributionalSignature(v, { start: 0, len: 100 }, { start: 100, len: 1 }), RangeError, 'test.len < 2');
  assert.throws(() => distributionalSignature(v, { start: 0, len: 100 }, { start: 0, len: 10 }), RangeError, 'test.start < 1');
  assert.throws(() => distributionalSignature(v, { start: 0, len: 100 }, { start: 750, len: 100 }), RangeError, 'out of bounds');
  const withNaN = v.slice(); withNaN[300] = NaN;
  assert.throws(() => distributionalSignature(withNaN, CAL, TST), RangeError, 'non-finite');
});

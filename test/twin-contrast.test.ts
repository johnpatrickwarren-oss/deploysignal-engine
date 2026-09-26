// test/twin-contrast.test.ts — ADR 0036: rate and sign twin kinds.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  type TwinMetricSpec,
  checkTwinMetricSpec, fisherNoncentralMean, twinScore,
  initTwinMetric, updateTwinMetric, twinMetricEvidence,
  TWIN_RATE_ENVELOPE, TWIN_SIGN_ENVELOPE,
} from '../detectors/twin-contrast';
import { lcg, poisson } from './_seeded';

const ERR: TwinMetricSpec = { id: 'http_5xx', kind: 'rate', worse: 'higher', tolerance: 0.5 };
const LAT: TwinMetricSpec = { id: 'p99_ms', kind: 'sign', worse: 'higher', tolerance: 0.1 };

test('fisherNoncentralMean: psi = 1 is the central hypergeometric mean', () => {
  assert.ok(Math.abs(fisherNoncentralMean(300, 700, 10, 1) - 3) < 1e-12);
});

test('fisherNoncentralMean: 1 + 1 arms with one event is psi / (1 + psi)', () => {
  assert.ok(Math.abs(fisherNoncentralMean(1, 1, 1, 2) - 2 / 3) < 1e-12);
});

test('fisherNoncentralMean is increasing in psi', () => {
  const a = fisherNoncentralMean(500, 500, 20, 1);
  const b = fisherNoncentralMean(500, 500, 20, 1.5);
  const c = fisherNoncentralMean(500, 500, 20, 3);
  assert.ok(a < b && b < c && c < 20, `${a} ${b} ${c}`);
});

test('fisherNoncentralMean does not throw at a large support (N ~ 5e5 requests per tick)', () => {
  const m = fisherNoncentralMean(500000, 500000, 500000, 1);
  assert.ok(Math.abs(m - 250000) < 1e-6 * 500000, `${m}`);
});

/** log-free small-N binomial coefficient (n <= 70 here, k <= 12: well inside double precision). */
function binom(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  const kk = Math.min(k, n - k);
  let result = 1;
  for (let i = 0; i < kk; i++) result = (result * (n - i)) / (i + 1);
  return result;
}

function bruteForceFisherMean(nc: number, nk: number, total: number, psi: number): number {
  const lo = Math.max(0, total - nk);
  const hi = Math.min(total, nc);
  let num = 0;
  let den = 0;
  for (let x = lo; x <= hi; x++) {
    const w = binom(nc, x) * binom(nk, total - x) * Math.pow(psi, x);
    num += x * w;
    den += w;
  }
  return num / den;
}

test('fisherNoncentralMean matches a brute-force weighted sum over the support', () => {
  const expected = bruteForceFisherMean(30, 70, 12, 1.7);
  const got = fisherNoncentralMean(30, 70, 12, 1.7);
  assert.ok(Math.abs(got - expected) < 1e-9, `${got} vs ${expected}`);
});

test('rate score: canary share of bad events, null = traffic share', () => {
  const s = twinScore(ERR, { canaryEvents: 6, canaryTotal: 300, controlEvents: 4, controlTotal: 700 });
  assert.ok(s !== 'skip' && s !== 'tie' && s !== 'missing');
  assert.ok(Math.abs(s.x - 0.6) < 1e-12);
  assert.ok(Math.abs(s.rollbackNull - 0.3) < 1e-12);
  assert.ok(s.proceedNull > 0.3 && s.proceedNull < 1);
});

test('rate score with worse = lower counts failures (total − events)', () => {
  const spec: TwinMetricSpec = { ...ERR, worse: 'lower' };
  const s = twinScore(spec, { canaryEvents: 990, canaryTotal: 1000, controlEvents: 999, controlTotal: 1000 });
  assert.ok(s !== 'skip' && s !== 'tie' && s !== 'missing');
  assert.ok(Math.abs(s.x - 10 / 11) < 1e-12);
});

test('rate score skips empty arms, zero bad events and a degenerate support', () => {
  assert.equal(twinScore(ERR, { canaryEvents: 0, canaryTotal: 0, controlEvents: 1, controlTotal: 10 }), 'skip');
  assert.equal(twinScore(ERR, { canaryEvents: 0, canaryTotal: 10, controlEvents: 0, controlTotal: 10 }), 'skip');
  assert.equal(twinScore(ERR, { canaryEvents: 5, canaryTotal: 5, controlEvents: 2, controlTotal: 2 }), 'skip');
  assert.throws(() => twinScore(ERR, { canaryEvents: 11, canaryTotal: 10, controlEvents: 0, controlTotal: 10 }), RangeError);
});

test('rate score rejects non-integer counts', () => {
  assert.throws(
    () => twinScore(ERR, { canaryEvents: 2.7, canaryTotal: 300, controlEvents: 4, controlTotal: 700 }),
    RangeError,
  );
  assert.throws(
    () => twinScore(ERR, { canaryEvents: 2, canaryTotal: 300.5, controlEvents: 4, controlTotal: 700 }),
    RangeError,
  );
});

test('sign score: worse orientation, ties, and missing values', () => {
  const up = twinScore(LAT, { canary: 120, control: 100 });
  assert.ok(up !== 'skip' && up !== 'tie' && up !== 'missing' && up.x === 1 && up.rollbackNull === 0.5);
  assert.ok(Math.abs(up.proceedNull - 0.6) < 1e-12);
  const lower = twinScore({ ...LAT, worse: 'lower' }, { canary: 120, control: 100 });
  assert.ok(lower !== 'skip' && lower !== 'tie' && lower !== 'missing' && lower.x === 0);
  assert.equal(twinScore(LAT, { canary: 100, control: 100 }), 'tie');
  assert.equal(twinScore(LAT, { canary: Number.NaN, control: 100 }), 'missing');
});

test('tolerance ranges are enforced per kind', () => {
  assert.throws(() => checkTwinMetricSpec({ ...ERR, tolerance: 0 }), RangeError);
  assert.throws(() => checkTwinMetricSpec({ ...ERR, tolerance: 11 }), RangeError);
  assert.throws(() => checkTwinMetricSpec({ ...LAT, tolerance: 0.5 }), RangeError);
  assert.doesNotThrow(() => checkTwinMetricSpec(LAT));
});

test('checkTwinMetricSpec rejects an unrecognized kind or worse direction', () => {
  assert.throws(() => checkTwinMetricSpec({ ...ERR, kind: 'bogus' as unknown as 'rate' }), RangeError);
  assert.throws(() => checkTwinMetricSpec({ ...ERR, worse: 'sideways' as unknown as 'higher' }), RangeError);
});

test('a missing sign observation (non-finite either arm) is distinct from a skip', () => {
  assert.equal(twinScore(LAT, { canary: Number.NaN, control: 100 }), 'missing');
  assert.equal(twinScore(LAT, { canary: 120, control: Number.NaN }), 'missing');
});

test('updateTwinMetric on a missing observation halves both wealths and counts it, leaving used/ties alone', () => {
  let st = updateTwinMetric(LAT, initTwinMetric(), { canary: 120, control: 100 });
  const before = twinMetricEvidence(st);
  st = updateTwinMetric(LAT, st, { canary: Number.NaN, control: 100 });
  const after = twinMetricEvidence(st);
  assert.ok(Math.abs(after.rollbackE - before.rollbackE / 2) < 1e-9, `${after.rollbackE} vs ${before.rollbackE / 2}`);
  assert.ok(Math.abs(after.proceedE - before.proceedE / 2) < 1e-9, `${after.proceedE} vs ${before.proceedE / 2}`);
  assert.equal(after.missing, before.missing + 1);
  assert.equal(after.used, before.used);
  assert.equal(after.ties, before.ties);
});

/** One tick of a rate pair: shared seasonal rate, unequal routing (normal-approximate binomial
 *  split, to keep the suite fast), per-arm multiplier. */
function rateTick(rng: () => number, t: number, w: number, canaryMult: number) {
  const season = 1 + 0.5 * Math.sin((2 * Math.PI * t) / 144);
  const n = poisson(rng, 1000 * season);
  const z = Math.sqrt(-2 * Math.log(rng())) * Math.cos(2 * Math.PI * rng());
  const nc = Math.min(n, Math.max(0, Math.round(n * w + Math.sqrt(n * w * (1 - w)) * z)));
  const nk = n - nc;
  const p = 0.01 * season;
  return {
    canaryEvents: Math.min(nc, poisson(rng, nc * p * canaryMult)), canaryTotal: nc,
    controlEvents: Math.min(nk, poisson(rng, nk * p)), controlTotal: nk,
  };
}

test('rate H0 (equal rates, w = 0.3, shared seasonality): false rollback within the Ville bound', () => {
  const rng = lcg(11);
  const R = 1000, T = 300, alpha = 0.05;
  let fired = 0;
  for (let r = 0; r < R; r++) {
    let st = initTwinMetric();
    for (let t = 0; t < T; t++) {
      st = updateTwinMetric(ERR, st, rateTick(rng, t, 0.3, 1));
      if (twinMetricEvidence(st).rollbackE >= 1 / alpha) { fired++; break; }
    }
  }
  const bar = alpha + 3 * Math.sqrt(alpha * (1 - alpha) / R);
  assert.ok(fired / R <= bar, `false rollback ${fired / R} > ${bar}`);
});

test('rate power: canary at twice the bad-event rate rolls back within 300 ticks in >= 95% of runs', () => {
  const rng = lcg(12);
  const R = 200, T = 300, alpha = 0.05;
  let fired = 0;
  for (let r = 0; r < R; r++) {
    let st = initTwinMetric();
    for (let t = 0; t < T; t++) {
      st = updateTwinMetric(ERR, st, rateTick(rng, t, 0.5, 2));
      if (twinMetricEvidence(st).rollbackE >= 1 / alpha) { fired++; break; }
    }
  }
  assert.ok(fired / R >= 0.95, `power ${fired / R}`);
});

test('rate proceed: identical arms clear a 50% odds tolerance within 300 ticks in >= 90% of runs', () => {
  const rng = lcg(13);
  const R = 200, T = 300, alpha = 0.05;
  let cleared = 0;
  for (let r = 0; r < R; r++) {
    let st = initTwinMetric();
    for (let t = 0; t < T; t++) {
      st = updateTwinMetric(ERR, st, rateTick(rng, t, 0.5, 1));
      if (twinMetricEvidence(st).proceedE >= 1 / alpha) { cleared++; break; }
    }
  }
  assert.ok(cleared / R >= 0.9, `proceed rate ${cleared / R}`);
});

/** One tick of Bernoulli-arm rate data: n requests per arm, independent per-request bad-event draws
 *  at a fixed per-arm probability — the exact Fisher noncentral hypergeometric regime the PROCEED
 *  null assumes (one bad-event probability per arm per tick, no cross-request dependence). */
function bernoulliCount(rng: () => number, n: number, p: number): number {
  let k = 0;
  for (let i = 0; i < n; i++) if (rng() < p) k++;
  return k;
}

function rateBernoulliTick(rng: () => number, n: number, pCanary: number, pControl: number) {
  return {
    canaryEvents: bernoulliCount(rng, n, pCanary), canaryTotal: n,
    controlEvents: bernoulliCount(rng, n, pControl), controlTotal: n,
  };
}

test('rate proceed H0 (binomial arms at odds ratio 1 + ρ): false proceed within the Ville bound', () => {
  // ERR.tolerance is 0.5: ρ = 0.5 is exactly the boundary of the proceed null (ψ ≥ 1 + ρ), the
  // least favorable point — the composite null's type-I rate is tightest there.
  const rng = lcg(21);
  const R = 500, T = 300, alpha = 0.05, n = 100;
  const rho = ERR.tolerance;
  const pControl = 0.05;
  const oddsControl = pControl / (1 - pControl);
  const oddsCanary = (1 + rho) * oddsControl;
  const pCanary = oddsCanary / (1 + oddsCanary);
  let falseProceed = 0;
  for (let r = 0; r < R; r++) {
    let st = initTwinMetric();
    for (let t = 0; t < T; t++) {
      st = updateTwinMetric(ERR, st, rateBernoulliTick(rng, n, pCanary, pControl));
      if (twinMetricEvidence(st).proceedE >= 1 / alpha) { falseProceed++; break; }
    }
  }
  const bar = alpha + 3 * Math.sqrt(alpha * (1 - alpha) / R);
  assert.ok(falseProceed / R <= bar, `false proceed rate ${falseProceed / R} > ${bar}`);
});

/** One tick of sign data at a fixed, exact P(worse): no ties, so every tick contributes. */
function signBernoulliTick(rng: () => number, pWorse: number) {
  const control = 100;
  return { canary: rng() < pWorse ? control + 1 : control - 1, control };
}

test('sign proceed H0 (P(worse) = 0.5 + τ): false proceed within the Ville bound', () => {
  // LAT.tolerance is 0.1: τ = 0.1 is exactly the boundary of the proceed null (P(worse) ≥ 0.5 + τ).
  const rng = lcg(22);
  const R = 1000, T = 300, alpha = 0.05;
  const pWorse = 0.5 + LAT.tolerance;
  let falseProceed = 0;
  for (let r = 0; r < R; r++) {
    let st = initTwinMetric();
    for (let t = 0; t < T; t++) {
      st = updateTwinMetric(LAT, st, signBernoulliTick(rng, pWorse));
      if (twinMetricEvidence(st).proceedE >= 1 / alpha) { falseProceed++; break; }
    }
  }
  const bar = alpha + 3 * Math.sqrt(alpha * (1 - alpha) / R);
  assert.ok(falseProceed / R <= bar, `false proceed rate ${falseProceed / R} > ${bar}`);
});

test('the envelopes carry their pairing premises and estimate nothing', () => {
  assert.equal(TWIN_RATE_ENVELOPE.pairingPremise, 'exchangeable-arms');
  assert.equal(TWIN_SIGN_ENVELOPE.pairingPremise, 'exchangeable-equal-weight-arms');
  assert.equal(TWIN_RATE_ENVELOPE.baseline, 'randomized-twin');
  assert.equal(TWIN_RATE_ENVELOPE.validUnderEstimatedBaseline, true);
});

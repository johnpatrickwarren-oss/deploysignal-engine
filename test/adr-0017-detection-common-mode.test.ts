// test/adr-0017-detection-common-mode.test.ts — ADR 0017, the detection-oriented common-mode.
//
// The FDP-oriented multi-factor common-mode (ADR 0008) ABSORBS a single-shard test-window fault into that
// shard's loading (it is collinear with the nonstationary factor), giving 0% detection (FAIR test, ADR 0016).
// The detection-oriented common-mode removes the CROSSED-domain common-mode by backfitting with the loading
// fit on the healthy REFERENCE window, so a test-window fault is PRESERVED. Properties asserted:
//   1. On a crossed-domain, heterogeneous-loading, nonstationary fleet it REMOVES the common-mode on healthy
//      shards (residual variance ≪ raw).
//   2. It PRESERVES a single-shard test-window step in the residual, where the full-loading multi-factor
//      common-mode ABSORBS it — the whole point.
//   3. Guards.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { detectionOrientedResiduals } from '../fleet/detection-common-mode';
import { multiFactorRobustResiduals } from '../fleet/multi-factor-common-mode';

function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => { s = ((s * 1664525) + 1013904223) >>> 0; return s / 0x100000000; };
}
function gaussian(rng: () => number): number {
  const u1 = Math.max(rng(), 1e-12), u2 = rng();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

// 48 shards over TWO CROSSED partitions: cooling domain = i % 4, power domain = i % 3 (gcd=1 ⇒ genuinely
// crossed). Each domain carries its own nonstationary factor (AR(1) + a ramp). Loadings are heterogeneous.
const N = 48, REF = 160, NT = 120, T = REF + NT, FONSET = REF;
const NCOOL = 4, NPOWER = 3, NOISE = 1, RHO = 0.6, STEP = 8;
const coolOf = (i: number): number => i % NCOOL;
const powerOf = (i: number): number => i % NPOWER;

function genFleet(seed: number, victim: number): { X: number[][] } {
  const rng = lcg(seed); const g = (): number => gaussian(rng);
  // per-domain nonstationary factors: AR(1) innovations + a per-domain linear ramp.
  const mkFactor = (rampPerT: number): number[] => {
    const f = new Array(T).fill(0);
    let p = g();
    for (let tt = 0; tt < T; tt++) { p = RHO * p + Math.sqrt(1 - RHO * RHO) * g(); f[tt] = p + rampPerT * tt; }
    return f;
  };
  const cool = Array.from({ length: NCOOL }, (_, d) => mkFactor(0.03 * (d + 1)));
  const power = Array.from({ length: NPOWER }, (_, e) => mkFactor(-0.02 * (e + 1)));
  const X: number[][] = [];
  for (let i = 0; i < N; i++) {
    const lvl = 5 * g();
    const lamCool = 0.4 + 1.2 * rng();   // heterogeneous loadings
    const lamPower = 0.4 + 1.2 * rng();
    const fc = cool[coolOf(i)], fp = power[powerOf(i)];
    const row = new Array(T);
    for (let tt = 0; tt < T; tt++) {
      row[tt] = lvl + lamCool * fc[tt] + lamPower * fp[tt] + NOISE * g()
        + (i === victim && tt >= FONSET ? STEP : 0);
    }
    X[i] = row;
  }
  return { X };
}

const partitions = (): number[][] => {
  const cool = Array.from({ length: N }, (_, i) => coolOf(i));
  const power = Array.from({ length: N }, (_, i) => powerOf(i));
  return [cool, power];
};
const mean = (r: ReadonlyArray<number>, a: number, b: number): number => {
  let s = 0; for (let i = a; i < b; i++) s += r[i]; return s / (b - a);
};
const sd = (r: ReadonlyArray<number>, a: number, b: number): number => {
  const m = mean(r, a, b); let s = 0; for (let i = a; i < b; i++) s += (r[i] - m) ** 2; return Math.sqrt(s / (b - a));
};
const median = (xs: number[]): number => { const s = [...xs].sort((p, q) => p - q); return s[s.length >> 1]; };
const residShift = (r: ReadonlyArray<number>): number => mean(r, FONSET, T) - mean(r, 0, REF);

test('detection common-mode: removes crossed-domain common-mode on healthy shards', () => {
  const { X } = genFleet(7, -1); // no fault
  const R = detectionOrientedResiduals(X, REF, partitions(), { iterations: 4, loadLen: REF });
  // residual variance must be a small fraction of the raw (level-removed) variance — common-mode gone.
  const ratios: number[] = [];
  for (let i = 0; i < N; i++) {
    const rawSd = sd(X[i], 0, T);          // raw includes the big common-mode swing
    const resSd = sd(R[i], 0, T);
    ratios.push(resSd / rawSd);
  }
  const medRatio = median(ratios);
  assert.ok(medRatio < 0.5, `expected residual/raw sd ratio < 0.5 (common-mode removed); got ${medRatio.toFixed(3)}`);
});

test('detection common-mode: PRESERVES a single-shard fault that the FDP-oriented common-mode ABSORBS', () => {
  const victim: number = 17;
  let detPreserve = 0, mfPreserve = 0, healthyFp = 0, nSeeds = 0;
  for (let seed = 1; seed <= 5; seed++) {
    const { X } = genFleet(seed, victim);
    const Rdet = detectionOrientedResiduals(X, REF, partitions(), { iterations: 4, loadLen: REF });
    const Rmf = multiFactorRobustResiduals(X, REF, { factors: 2 }); // full-loading, FDP-oriented
    detPreserve += residShift(Rdet[victim]);
    mfPreserve += residShift(Rmf[victim]);
    // a healthy shard's residual shift should stay small under the detection common-mode
    healthyFp += Math.abs(residShift(Rdet[victim === 0 ? 1 : 0]));
    nSeeds++;
  }
  detPreserve /= nSeeds; mfPreserve /= nSeeds; healthyFp /= nSeeds;

  // 1. The detection common-mode keeps most of the STEP in the residual.
  assert.ok(detPreserve > 0.55 * STEP,
    `detection common-mode should preserve the fault (> ${(0.55 * STEP).toFixed(1)}); got ${detPreserve.toFixed(2)}`);
  // 2. The full-loading common-mode absorbs most of it.
  assert.ok(mfPreserve < 0.5 * STEP,
    `full-loading common-mode should absorb the fault (< ${(0.5 * STEP).toFixed(1)}); got ${mfPreserve.toFixed(2)}`);
  // 3. Detection-oriented preserves materially more signal than the FDP-oriented one (the whole point).
  assert.ok(detPreserve > 2 * mfPreserve,
    `detection should preserve ≫ FDP-oriented; det=${detPreserve.toFixed(2)} mf=${mfPreserve.toFixed(2)}`);
  // 4. A healthy shard stays near zero (fault is localised, not smeared).
  assert.ok(healthyFp < 0.4 * detPreserve,
    `healthy shard residual shift should stay small; got ${healthyFp.toFixed(2)} vs victim ${detPreserve.toFixed(2)}`);
});

test('detection common-mode: a single-member domain does NOT self-absorb its own fault', () => {
  // Regression for the <2-member guard: a shard alone in a domain has no shared factor — fitting a loading on
  // its own series would subtract its own fault (self-absorption → false negative). 5 shards: 1..4 share a
  // factor, shard 0 is alone; a fault on shard 0 must SURVIVE.
  const n = 5, ref = 80, t = 160, fonset = 80, step = 10;
  const rng = lcg(99), gg = (): number => gaussian(rng);
  const F = new Array(t); { let p = gg(); for (let k = 0; k < t; k++) { p = 0.6 * p + 0.8 * gg(); F[k] = p; } }
  const X: number[][] = [];
  for (let i = 0; i < n; i++) {
    const lam = i === 0 ? 0 : 0.5 + rng();
    const row = new Array(t);
    for (let k = 0; k < t; k++) row[k] = (i === 0 ? gg() : lam * F[k] + gg()) + (i === 0 && k >= fonset ? step : 0);
    X.push(row);
  }
  const part = [[0, 1, 1, 1, 1]]; // shard 0 alone in domain 0; shards 1..4 in domain 1
  const R = detectionOrientedResiduals(X, ref, part, { iterations: 4, loadLen: ref });
  const shift = mean(R[0], fonset, t) - mean(R[0], 0, ref);
  assert.ok(shift > 0.5 * step, `sole-member shard must keep its fault (not self-absorb); got ${shift.toFixed(2)}`);
});

test('detection common-mode: leaveOutGroups preserves a coherent GROUP fault that in-sample absorbs', () => {
  // A coherent fault across a group that is a meaningful fraction of a domain is absorbed by the in-sample
  // baseline (the group pulls the robust factor). leaveOutGroups excludes the group from its own factor, so
  // the fault is preserved. 40 shards, ONE cool domain; group 0 = 12 shards (30%) all shift together.
  const n = 40, ref = 120, t = 240, fonset = 120, delta = 8, gsize = 12;
  const rng = lcg(7), gg = (): number => gaussian(rng);
  const F = new Array(t); { let p = gg(); for (let k = 0; k < t; k++) { p = 0.6 * p + 0.8 * gg() + 0.02 * k; F[k] = p; } }
  const X: number[][] = [];
  for (let i = 0; i < n; i++) {
    const lam = 0.5 + rng();
    const row = new Array(t);
    for (let k = 0; k < t; k++) row[k] = lam * F[k] + gg() + (i < gsize && k >= fonset ? delta : 0);
    X.push(row);
  }
  const part = [Array.from({ length: n }, () => 0)];                       // single cool domain
  const groups = Array.from({ length: n }, (_, i) => (i < gsize ? 0 : 1)); // leave-out groups
  const groupShift = (R: number[][]): number => {
    let s = 0; for (let i = 0; i < gsize; i++) s += mean(R[i], fonset, t) - mean(R[i], 0, ref); return s / gsize;
  };
  const sIn = groupShift(detectionOrientedResiduals(X, ref, part, { iterations: 4, loadLen: ref }));
  const sLo = groupShift(detectionOrientedResiduals(X, ref, part, { iterations: 4, loadLen: ref, leaveOutGroups: groups }));
  // leave-group-out preserves nearly the FULL group fault; in-sample absorbs some (the group pulls the
  // in-sample factor). (On real crossed-domain topology the in-sample absorption compounds across domains and
  // is far larger — ADR 0017 measures ~3.5/8; this single-domain unit fleet absorbs less but the direction is
  // the same.)
  assert.ok(sLo > 0.8 * delta, `leave-group-out should preserve ~the full group fault (> ${(0.8 * delta).toFixed(1)}); got ${sLo.toFixed(2)}`);
  assert.ok(sLo > 1.2 * sIn, `leave-group-out should preserve more than in-sample; lo=${sLo.toFixed(2)} in=${sIn.toFixed(2)}`);
});

test('detection common-mode: guards', () => {
  const X = genFleet(1, -1).X;
  const P = partitions();
  assert.throws(() => detectionOrientedResiduals([], REF, P), /at least one shard/);
  assert.throws(() => detectionOrientedResiduals(X, 0, P), /calLen must be an integer/);
  assert.throws(() => detectionOrientedResiduals(X, REF, P, { iterations: 0 }), /iterations must be a positive integer/);
  assert.throws(() => detectionOrientedResiduals(X, REF, P, { loadLen: T + 1 }), /loadLen must be an integer/);
  assert.throws(() => detectionOrientedResiduals(X, REF, []), /at least one factor partition/);
  assert.throws(() => detectionOrientedResiduals(X, REF, [[0, 1, 2]]), /expected one label per shard/);
  const ragged = X.map((r, i) => (i === 3 ? r.slice(0, T - 1) : r));
  assert.throws(() => detectionOrientedResiduals(ragged, REF, P), /ragged matrix/);
  assert.throws(() => detectionOrientedResiduals(X, REF, P, { leaveOutGroups: [0, 1, 2] }), /leaveOutGroups has length/);
});

// test/e-bh-guarded.test.ts — the gate must REFUSE, not report.
//
// Before 2026-08-02 assertValidForFdrPath had zero production callers across six repos and
// minCalibration was read by nothing. These assertions exist so that cannot silently recur.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  eBenjaminiHochbergGuarded, envelopeFor, DETECTOR_ENVELOPES,
} from '../fleet/e-bh-guarded';

const ok = (detectorId: string, eValue: number, extra = {}) => ({ detectorId, eValue, ...extra });

test('an unknown detector id is refused, not admitted', () => {
  assert.throws(
    () => eBenjaminiHochbergGuarded([ok('spectral_e_detector_kv_cache', 5)], 0.1),
    /no validity envelope/,
    'a blank envelope means unrecorded, not safe',
  );
});

test('Families C, D and E are absent from the map, so all three are refused', () => {
  for (const id of ['hotelling_t2_safe', 'sequential_mmd_betting_e_process',
    'spectral_e_detector_kv_cache', 'mahalanobis_conformal_baseline']) {
    assert.equal(envelopeFor(id), undefined, `${id} must not have an envelope yet`);
    assert.throws(() => eBenjaminiHochbergGuarded([ok(id, 5)], 0.1), /no validity envelope/);
  }
});

test('a plug-in detector is refused under an estimated baseline', () => {
  assert.throws(
    () => eBenjaminiHochbergGuarded([ok('betting_e_process', 50)], 0.1),
    /outside its validity regime/,
    'betting is validUnderEstimatedBaseline: false and asserts nothing here',
  );
});

test('the same detector is admitted once the caller asserts its regime', () => {
  const r = eBenjaminiHochbergGuarded(
    [ok('betting_e_process', 50, { assertions: { trueBaseline: true, clipMeanZero: true } })], 0.1);
  assert.ok(r.selected.length >= 0, 'admitted with an explicit regime assertion');
});

test('both UI envelopes pass the gate unconditionally — no measured φ bound', () => {
  // safe-t is deliberately NOT in this list any more; see the φ-bound test below.
  for (const id of ['universal_inference_e_value', 'sequential_ui_e_process']) {
    assert.ok(envelopeFor(id), `${id} must be mapped`);
    assert.doesNotThrow(() => eBenjaminiHochbergGuarded([ok(id, 50)], 0.1),
      `${id} is validUnderEstimatedBaseline: true and carries no maxPhiValid`);
  }
});

test('safe-t now requires a φ within its measured validity bound — CONTRACT CHANGE 2026-08-05', () => {
  // Was: safe-t passed the gate unconditionally, as validUnderEstimatedBaseline: true.
  // Now: its envelope carries maxPhiValid = 0.95, because exceedance was measured at 0.1420
  // against α=0.05 at φ=0.99 (knowledge/stats/power-per-cell-2026-08-05). An UNMEASURED φ is
  // refused, on the same principle this module already applies to an unmapped detector id:
  // blank means unrecorded, not safe.
  assert.ok(envelopeFor('safe_t_e_value'), 'safe_t_e_value must be mapped');
  assert.throws(
    () => eBenjaminiHochbergGuarded([ok('safe_t_e_value', 50)], 0.1),
    /UNMEASURED φ/,
    'an unmeasured φ is refused, not assumed to be zero',
  );
  assert.doesNotThrow(
    () => eBenjaminiHochbergGuarded(
      [ok('safe_t_e_value', 50, { assertions: { phiUnmeasuredAccepted: true } })], 0.1),
    'the escape hatch is explicit and greppable, not a silent default',
  );
  assert.throws(
    () => eBenjaminiHochbergGuarded(
      [ok('safe_t_e_value', 50, { assertions: { observedPhi: 0.99 } })], 0.1),
    /φ=0.99/,
    'a φ above the bound is refused',
  );
  assert.doesNotThrow(
    () => eBenjaminiHochbergGuarded(
      [ok('safe_t_e_value', 50, { assertions: { observedPhi: 0.95 } })], 0.1),
    'φ at the bound is admitted',
  );
});

test('the retracted BF is refused by name rather than as an unknown id', () => {
  assert.throws(
    () => eBenjaminiHochbergGuarded([ok('nuisance_robust_bf_e_value', 50)], 0.1),
    /outside its validity regime/,
  );
});

test('minCalibration is enforced — no code path read it before', () => {
  const env = envelopeFor('safe_t_e_value');
  assert.ok(env?.minCalibration !== undefined, 'safe-t declares a floor');
  assert.throws(
    () => eBenjaminiHochbergGuarded(
      [ok('safe_t_e_value', 50, {
        calLen: (env!.minCalibration as number) - 1,
        // φ acknowledged so this reaches the calLen check rather than stopping at the φ gate.
        assertions: { phiUnmeasuredAccepted: true },
      })], 0.1),
    /needs cal ≥/,
  );
  assert.doesNotThrow(() => eBenjaminiHochbergGuarded(
    [ok('safe_t_e_value', 50, {
      calLen: env!.minCalibration,
      assertions: { phiUnmeasuredAccepted: true },
    })], 0.1));
});

test('one bad shard refuses the whole batch', () => {
  assert.throws(
    () => eBenjaminiHochbergGuarded(
      [ok('safe_t_e_value', 50, { assertions: { phiUnmeasuredAccepted: true } }), ok('spectral_e_detector_kv_cache', 50)], 0.1),
    /no validity envelope/,
    'e-BH is a joint procedure; a single inadmissible coordinate voids the guarantee',
  );
});

test('every mapped envelope satisfies the type at runtime too', () => {
  for (const [id, env] of Object.entries(DETECTOR_ENVELOPES)) {
    assert.equal(typeof env.validUnderEstimatedBaseline, 'boolean', `${id}`);
    assert.ok(env.baseline && env.autocorrelation && env.null && env.variance, `${id}`);
  }
});

// ── ADR 0035: the tail premise ──────────────────────────────────────────────────────────────────

import { freshCalibrationMonitor, updateCalibration, freshIncrementEstimator, updateIncrementEstimator, incrementEstimate, gInc } from '../fleet/calibration-monitor';
import { INCREMENT_MEAN_BOUND } from '../detectors/validity-envelope';

test('ADR 0035: an envelope carrying a tail premise refuses fit ≫ horizon alone, names the premise, and admits the matching promise', () => {
  // h0-battery Amendment A6 (inc-20260925T044059Z): Gaussian increment 1.61 on t3 / 1.91 on the
  // lognormal; bounded increment 1.0009-1.0083 for the negative-λ wealths on the lognormal.
  assert.equal(envelopeFor('onset_mixture_gaussian')!.tailPremise, 'mgf');
  assert.equal(envelopeFor('onset_mixture_bounded')!.tailPremise, 'clip-mean-zero');
  assert.throws(
    () => eBenjaminiHochbergGuarded([ok('onset_mixture_gaussian', 50, { assertions: { mMuchGreaterThanN: true } })], 0.1),
    /mgf exists.*1\.61 on t3.*no increment mean was measured/s, 'the Gaussian premise is named with its measurement');
  assert.throws(
    () => eBenjaminiHochbergGuarded([ok('onset_mixture_bounded', 50, { assertions: { mMuchGreaterThanN: true } })], 0.1),
    /CLIPPED residual.*1\.0009-1\.0083/s, 'the bounded premise is named with its measurement');
  assert.doesNotThrow(() => eBenjaminiHochbergGuarded([ok('onset_mixture_gaussian', 50, { assertions: { mMuchGreaterThanN: true, lightTails: true } })], 0.1));
  assert.doesNotThrow(() => eBenjaminiHochbergGuarded([ok('onset_mixture_bounded', 50, { assertions: { mMuchGreaterThanN: true, clipMeanZero: true } })], 0.1));
  // the wrong premise's promise does not transfer
  assert.throws(() => eBenjaminiHochbergGuarded([ok('onset_mixture_gaussian', 50, { assertions: { mMuchGreaterThanN: true, clipMeanZero: true } })], 0.1), /mgf exists/);
  assert.throws(() => eBenjaminiHochbergGuarded([ok('onset_mixture_bounded', 50, { assertions: { mMuchGreaterThanN: true, lightTails: true } })], 0.1), /CLIPPED residual/);
  // the tail assertion does not replace the baseline one
  assert.throws(() => eBenjaminiHochbergGuarded([ok('onset_mixture_gaussian', 50, { assertions: { lightTails: true } })], 0.1), /estimated baseline/);
});

test('ADR 0035: a measured increment mean clears without a promise, refutes over any promise, and falls back to the promise when inconclusive', () => {
  assert.equal(INCREMENT_MEAN_BOUND, 1.0005);
  const g = (assertions: object) => () => eBenjaminiHochbergGuarded([ok('onset_mixture_gaussian', 50, { assertions: { mMuchGreaterThanN: true, ...assertions } })], 0.1);
  assert.doesNotThrow(g({ incrementMean: { lower95: 0.9952, upper95: 0.9983 } }), 'A6 N1: CLEARED');
  assert.throws(g({ incrementMean: { lower95: 1.5997, upper95: 1.6157 }, lightTails: true }), /REFUTES.*no promise overrides/s, 'A6 N6: REFUTED, the promise does not save it');
  assert.throws(g({ incrementMean: { lower95: 0.99, upper95: 1.01 } }), /inconclusive/, 'a short feed: inconclusive, no promise');
  assert.doesNotThrow(g({ incrementMean: { lower95: 0.99, upper95: 1.01 }, lightTails: true }), 'a short feed with the promise');
  const b = (assertions: object) => () => eBenjaminiHochbergGuarded([ok('onset_mixture_bounded', 50, { assertions: { mMuchGreaterThanN: true, ...assertions } })], 0.1);
  assert.throws(b({ incrementMean: { lower95: 1.00808, upper95: 1.00858 }, clipMeanZero: true }), /REFUTES/, 'A6 N5 λ = −0.9');
  assert.doesNotThrow(b({ incrementMean: { lower95: 0.99971, upper95: 1.00021 } }), 'A6 N6 λ = −0.9: CLEARED');
});

test('h0-battery A7 (2026-09-25): the two Family-A wealths and the contrast ids carry their construction\'s premise — the bet clip-mean-zero, the mixture mgf', () => {
  // ADR 0035 had said the betting e-process carries 'mgf' structurally; A7 corrected it and measured
  // both: betting 1.00000 on symmetric tails / 1.00118 on the lognormal; mixture divergent on t3.
  const premise: Record<string, string> = {
    betting_e_process: 'clip-mean-zero', page_cusum_mixture_supermartingale: 'mgf',
    contrast_null_betting: 'clip-mean-zero', contrast_null_mixture: 'mgf',
  };
  for (const [id, p] of Object.entries(premise)) {
    assert.equal(envelopeFor(id)!.tailPremise, p, id);
    assert.throws(() => eBenjaminiHochbergGuarded([ok(id, 50, { assertions: { mMuchGreaterThanN: true } })], 0.1), p === 'mgf' ? /mgf exists/ : /CLIPPED residual/, id);
    const promise = p === 'mgf' ? { lightTails: true } : { clipMeanZero: true };
    assert.doesNotThrow(() => eBenjaminiHochbergGuarded([ok(id, 50, { assertions: { mMuchGreaterThanN: true, ...promise } })], 0.1), id);
    assert.doesNotThrow(() => eBenjaminiHochbergGuarded([ok(id, 50, { assertions: { mMuchGreaterThanN: true, incrementMean: { lower95: 0.99995, upper95: 1.00005 } } })], 0.1), id);
  }
  // the contrast views share every other field of the one envelope
  const { tailPremise: _a, ...mix } = envelopeFor('contrast_null_mixture')! as any;
  const { tailPremise: _b, ...bet } = envelopeFor('contrast_null_betting')! as any;
  assert.deepEqual(mix, bet);
});

test('ADR 0035: why the Ville monitor\'s verdict is not a tail assertion — on t3 it barely revokes while the increment estimator refutes', () => {
  // ∏ g drifts at E[log g], negative under a heavy tail even when E[g] = 1.6. Seeds fixed; 100 feeds × 2000 ticks.
  const mul = (seed: number) => { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
  const gaussFrom = (r: () => number) => () => { let u = 0, v = 0; while (u === 0) u = r(); while (v === 0) v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
  const t3 = (g: () => number) => () => { const z = g(); const chi = g() ** 2 + g() ** 2 + g() ** 2; return (z / Math.sqrt(chi / 3)) / Math.sqrt(3); };
  let revoked = 0;
  const est = freshIncrementEstimator();
  for (let i = 0; i < 100; i++) {
    const src = t3(gaussFrom(mul(1000 + i)));
    const m = freshCalibrationMonitor({ alpha: 0.01, incrementKind: 'gaussian' });
    for (let t = 0; t < 2000; t++) { const r = src(); updateCalibration(m, r); updateIncrementEstimator(est, Math.log(gInc(r))); }
    if (!m.passing) revoked++;
  }
  const e = incrementEstimate(est);
  assert.ok(revoked <= 10, `the monitor revoked ${revoked}/100 t3 feeds — expected a handful (measured 1.25% at 400 feeds)`);
  assert.ok(e.lower95 > INCREMENT_MEAN_BOUND && e.mean > 1.4, `the estimator on the same 200,000 increments: mean ${e.mean.toFixed(3)}, lower95 ${e.lower95.toFixed(3)} — a refutation`);
});

test('ADR 0035: where the monitor does revoke on heavy tails the channel is the MAD scale of the fit, not the tail — 0.656 on unit-variance t3', () => {
  // knowledge stats/e-by-t2-2026-09-04 and stats/contrast-null-2026-09-05 record the Gaussian monitor
  // revoking under t3; the contrast fit standardises by MAD (per-shard/contrast.ts:95). Same seeds,
  // three scales: oracle 2.5%, fit sd 3.5%, fit MAD 73.5% at 200 feeds. 60 feeds here.
  const mul = (seed: number) => { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
  const gaussFrom = (r: () => number) => () => { let u = 0, v = 0; while (u === 0) u = r(); while (v === 0) v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
  const t3 = (g: () => number) => () => { const z = g(); const chi = g() ** 2 + g() ** 2 + g() ** 2; return (z / Math.sqrt(chi / 3)) / Math.sqrt(3); };
  const median = (a: number[]) => { const s = [...a].sort((x, y) => x - y); const n = s.length; return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2; };
  const mad = (a: number[]) => { const m = median(a); return 1.4826 * median(a.map((x) => Math.abs(x - m))); };
  let revokedOracle = 0, revokedMad = 0, madSum = 0;
  for (let i = 0; i < 60; i++) {
    const src = t3(gaussFrom(mul(5000 + i)));
    const fit = Array.from({ length: 2000 }, src);
    const s = mad(fit); madSum += s;
    const stream = Array.from({ length: 2000 }, src);
    const mo = freshCalibrationMonitor({ alpha: 0.01, incrementKind: 'gaussian' });
    const mm = freshCalibrationMonitor({ alpha: 0.01, incrementKind: 'gaussian' });
    for (const r of stream) { updateCalibration(mo, r); updateCalibration(mm, r / s); }
    if (!mo.passing) revokedOracle++;
    if (!mm.passing) revokedMad++;
  }
  assert.ok(madSum / 60 < 0.72 && madSum / 60 > 0.60, `MAD of unit-variance t3 reads ${(madSum / 60).toFixed(3)}`);
  assert.ok(revokedOracle <= 8, `oracle scale: ${revokedOracle}/60 revoked`);
  assert.ok(revokedMad >= 30, `MAD scale: ${revokedMad}/60 revoked — the scale channel`);
});

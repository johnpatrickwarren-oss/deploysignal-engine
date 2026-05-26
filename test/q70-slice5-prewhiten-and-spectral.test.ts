// test/q70-slice5-prewhiten-and-spectral.test.ts — SLICE 5 interventions:
//
//   1. AR(1) pre-whitening at dispatch (prewhitenSeries helper)
//   2. Post-fire cooldown (applyFireCooldown helper)
//   3. Innovation variance stamping in buildPerDatasetConfig
//   4. Spectral lag bounds + per-dataset bootstrap calibration
//
// These tests pin the SLICE 5 calibration regime so future PRs that
// touch the dispatcher / per-dataset config can't silently regress.
// The dispatcher behavior is verified via the in-process dispatch shape
// (no NAB repo required); the calibrator behavior is verified via
// synthetic input distributions chosen to exercise each branch.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  prewhitenSeries,
  applyFireCooldown,
  type DetectorFiringDecision,
} from '../tools/run-nab-validation';
import {
  buildPerDatasetConfig,
  calibrateSpectralBootstrapQuantile,
} from '../tools/run-nab-per-dataset';

// ── prewhitenSeries ─────────────────────────────────────────────────

test('SLICE 5 prewhiten — phi=0 passes deviations through unchanged', () => {
  const values = [10, 12, 8, 11, 9, 13];
  const mean = 10;
  const out = prewhitenSeries(values, 0, mean);
  // With phi=0 the residual is just (x - mean), re-centered by adding mean back ⇒ x.
  assert.deepEqual(out, values);
});

test('SLICE 5 prewhiten — phi=0.5 removes AR(1) lag-1 correlation', () => {
  // Generate AR(1) data with phi=0.5, then pre-whiten with phi=0.5.
  // Resulting series should have lag-1 ACF near zero.
  const N = 2000;
  const values: number[] = [];
  let prev = 0;
  let seed = 0xBEEF;
  const rng = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
  for (let i = 0; i < N; i++) {
    const eps = (rng() * 2 - 1) * 1.0;
    prev = 0.5 * prev + eps;
    values.push(prev);
  }
  const out = prewhitenSeries(values, 0.5, 0);
  // Empirical lag-1 ACF of residuals
  let num = 0, denom = 0;
  let mu = 0;
  for (const x of out) mu += x;
  mu /= out.length;
  for (let i = 1; i < out.length; i++) num += (out[i] - mu) * (out[i - 1] - mu);
  for (const x of out) denom += (x - mu) * (x - mu);
  const lag1 = num / denom;
  assert.ok(Math.abs(lag1) < 0.10, `pre-whitened lag-1 ACF should be near 0; got ${lag1}`);
});

test('SLICE 5 prewhiten — rejects invalid phi', () => {
  assert.throws(() => prewhitenSeries([1, 2, 3], 1.5, 0), /phi/);
  assert.throws(() => prewhitenSeries([1, 2, 3], -1.0, 0), /phi/);
  assert.throws(() => prewhitenSeries([1, 2, 3], NaN, 0), /phi/);
});

// ── applyFireCooldown ──────────────────────────────────────────────

test('SLICE 5 cooldown — suppresses fires within K ticks of a previous fire', () => {
  const firings: DetectorFiringDecision[] = [
    { tick: 0, fire: false },
    { tick: 5, fire: true },
    { tick: 6, fire: true },   // suppressed (within cooldown)
    { tick: 10, fire: true },  // suppressed (within cooldown)
    { tick: 16, fire: true },  // suppressed (within cooldown of tick 5 cooldown=10)
    { tick: 20, fire: true },  // allowed (16+1 cooldown=10 → next allowed at 16)... wait
  ];
  const out = applyFireCooldown(firings, 10);
  // First fire at tick 5 → suppress until 5+10=15. Fires at 6, 10 suppressed. Fire at 16 ≥ 15 + 1 = 16 → allowed; new suppressUntil = 26. Fire at 20 < 26 → suppressed.
  assert.equal(out[1].fire, true);  // tick 5
  assert.equal(out[2].fire, false); // tick 6
  assert.equal(out[3].fire, false); // tick 10
  assert.equal(out[4].fire, true);  // tick 16 (15 has passed by 16)
  assert.equal(out[5].fire, false); // tick 20 (within 16+10)
});

test('SLICE 5 cooldown — cooldown=0 passes firings through unchanged', () => {
  const firings: DetectorFiringDecision[] = [
    { tick: 0, fire: true },
    { tick: 1, fire: true },
    { tick: 2, fire: false },
  ];
  const out = applyFireCooldown(firings, 0);
  assert.deepEqual(out, firings);
});

// ── buildPerDatasetConfig SLICE 5 default ──────────────────────────

test('SLICE 5 calibrator — default mode stamps pre-whitening + cooldown provenance', () => {
  // Synthetic AR(1) data with phi=0.85; expected pre-whitening provenance.
  const N = 500;
  const values: number[] = [];
  let prev = 0;
  let seed = 0xCAFE;
  const rng = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
  for (let i = 0; i < N; i++) {
    const eps = rng() * 2 - 1;
    prev = 0.85 * prev + eps;
    values.push(prev);
  }
  const { provenance } = buildPerDatasetConfig(values, 'p99_latency', 0.15);
  assert.ok(provenance.pre_whitening, 'pre_whitening provenance expected by default');
  assert.equal(provenance.hac_inflation, undefined, 'hac_inflation should NOT be stamped by default');
  // Innovation variance < marginal variance for high-phi AR(1)
  assert.ok(
    provenance.pre_whitening!.innovation_sigma_squared < provenance.pre_whitening!.marginal_sigma_squared,
    'innovation σ² should be smaller than marginal σ² for high-φ data',
  );
  // Default cooldown is 1000 ticks
  assert.equal(provenance.family_a_cooldown_ticks, 1000);
});

test('SLICE 5 calibrator — useHacInflation: true falls back to SLICE 4 HAC behavior', () => {
  const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
  const { provenance } = buildPerDatasetConfig(values, 'p99_latency', 0.5, {
    useHacInflation: true,
    usePrewhitening: false,
  });
  assert.ok(provenance.hac_inflation, 'hac_inflation expected when opted in');
  assert.equal(provenance.pre_whitening, undefined, 'pre_whitening should be absent when HAC opted in');
});

test('SLICE 5 calibrator — rejects mutually-exclusive pre-whiten + HAC', () => {
  const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  assert.throws(
    () => buildPerDatasetConfig(values, 'p99_latency', 0.5, {
      useHacInflation: true,
      usePrewhitening: true,
    }),
    /mutually exclusive/,
  );
});

test('SLICE 5 calibrator — stub config carries spectral lag bounds + bootstrap quantile', () => {
  const N = 500;
  const values: number[] = [];
  for (let i = 0; i < N; i++) values.push(Math.sin(i / 10));
  const { config, provenance } = buildPerDatasetConfig(values, 'p99_latency', 0.15);
  const familyD = (config as any).baseline_cells.aggregate_fallback.family_D.p99_latency;
  assert.equal(familyD.min_peak_lag, 3, 'spectral min_peak_lag default = 3');
  assert.equal(familyD.max_peak_lag, 10, 'spectral max_peak_lag default = 10');
  assert.equal(typeof familyD.bootstrap_null_quantile, 'number');
  assert.ok(familyD.bootstrap_null_quantile > 0 && familyD.bootstrap_null_quantile <= 1);
  // Provenance carries the calibration trail
  assert.ok(provenance.spectral_bootstrap, 'spectral_bootstrap provenance expected');
  assert.equal(provenance.spectral_bootstrap!.min_peak_lag, 3);
  assert.equal(provenance.spectral_bootstrap!.max_peak_lag, 10);
});

// ── calibrateSpectralBootstrapQuantile ─────────────────────────────

test('SLICE 5 spectral calibration — uses fallback quantile on too-short input', () => {
  const r = calibrateSpectralBootstrapQuantile([1, 2, 3, 4, 5], 3, 10, 0.99);
  assert.equal(r.empirically_calibrated, false, 'short input → fallback');
  assert.equal(r.quantile_used, 0.9, 'fallback quantile is 0.9 (SLICE 5 conservative floor)');
});

test('SLICE 5 spectral calibration — empirically calibrates on sufficient input', () => {
  // Generate 500 iid Gaussian-like noise; peak ACF on 60-tick windows should be small.
  const N = 500;
  const values: number[] = [];
  let seed = 0xFACE;
  const rng = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
  for (let i = 0; i < N; i++) values.push(rng() * 2 - 1);
  const r = calibrateSpectralBootstrapQuantile(values, 3, 10, 0.99);
  assert.equal(r.empirically_calibrated, true);
  assert.ok(r.n_subwindows >= 30, `expected ≥30 subwindows; got ${r.n_subwindows}`);
  // 99th percentile of peakACF on iid noise should be moderate (< 0.5).
  assert.ok(r.quantile_used < 0.5, `iid noise 99th-percentile peak-ACF should be < 0.5; got ${r.quantile_used}`);
});

test('SLICE 5 spectral calibration — AR(1) data yields a HIGH bootstrap quantile', () => {
  // Generate AR(1) phi=0.95 data; peak ACF on 60-tick windows should be high.
  const N = 1000;
  const values: number[] = [];
  let prev = 0;
  let seed = 0xDEAD;
  const rng = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
  for (let i = 0; i < N; i++) {
    const eps = rng() * 2 - 1;
    prev = 0.95 * prev + eps;
    values.push(prev);
  }
  const r = calibrateSpectralBootstrapQuantile(values, 3, 10, 0.99);
  assert.equal(r.empirically_calibrated, true);
  // For φ=0.95 AR(1) data, peakACF over lags 3-10 should be ≥ φ³ ≈ 0.86.
  assert.ok(r.quantile_used > 0.5, `AR(1) high-φ peak-ACF should be > 0.5; got ${r.quantile_used}`);
});

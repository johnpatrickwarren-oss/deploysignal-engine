// test/q70-slice7-mixture-supermartingale-nab.test.ts — SLICE 7 wires
// the Howard-Ramdas-2021 mixture-supermartingale detector into NAB dispatch.
//
// SLICE 1-3 deferred per-detector dispatch wiring of the §7 LIL fallback
// pending architect cross-check of the application formula. SLICE 3's
// empirical attempt showed |S_n| ≥ √V_n · b(V_n) over-fires at 100% on
// iid H₀. SLICE 7 resolves the cross-check: the LIL bound is for
// empirical-CDF / quantile work (per confseq library docstring), NOT
// mean-shift. The architecturally correct anytime-valid construct for
// mean-shift detection is the closed-form Gaussian mixture-supermartingale
// (Howard-Ramdas-2021 §4.2), already shipped at
// `detectors/family-a-mixture-supermartingale.ts`.
//
// These tests pin the SLICE 7 wiring contract: the NAB dispatcher
// supports `family_A_mixture_supermartingale` as a detector family;
// the calibrator stamps `mixture_supermartingale_params` + `ar1_phi`
// in the per-signal config; the detector pre-whitens internally.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import {
  runDetectorOverDataset,
  type DetectorFiringDecision,
} from '../tools/run-nab-validation';
import { buildPerDatasetConfig } from '../tools/run-nab-per-dataset';

// ── Calibrator stamping ────────────────────────────────────────────

test('SLICE 7 calibrator — stub config carries mixture_supermartingale_params + ar1_phi', () => {
  // Synthetic AR(1) phi=0.85 data so the calibrator estimates a
  // meaningful phi and stamps the mixture params.
  const N = 500;
  const values: number[] = [];
  let prev = 0;
  let seed = 0xBEEF;
  const rng = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
  for (let i = 0; i < N; i++) {
    const eps = rng() * 2 - 1;
    prev = 0.85 * prev + eps;
    values.push(prev);
  }
  const { config } = buildPerDatasetConfig(values, 'p99_latency', 0.15);
  const perSig = (config as any).baseline_cells.aggregate_fallback.family_A.per_signal.p99_latency;
  assert.ok(perSig.mixture_supermartingale_params,
    'mixture_supermartingale_params expected on stub config');
  assert.equal(perSig.mixture_supermartingale_params.mixture_distribution, 'gaussian',
    'heavy_tail signal class → gaussian mixture');
  assert.ok(perSig.mixture_supermartingale_params.gaussian_sigma_squared_prior > 0,
    'gaussian_sigma_squared_prior expected positive');
  assert.ok(typeof perSig.ar1_phi === 'number',
    'ar1_phi expected on stub config (consumed by detector internal pre-whitening)');
});

// ── Dispatch case ─────────────────────────────────────────────────

test('SLICE 7 dispatch — family_A_mixture_supermartingale routes through HR-2021 detector', () => {
  const N = 200;
  const values: number[] = [];
  // First 100 ticks: ~N(0, 1). Last 100 ticks: ~N(2, 1) (mean shift).
  let seed = 0xCAFE;
  const rng = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
  for (let i = 0; i < N; i++) {
    const z = (rng() - 0.5) * 4; // ~U(-2, 2), variance ~1.33
    values.push((i < 100 ? 0 : 2) + z);
  }
  const { config, provenance } = buildPerDatasetConfig(values, 'p99_latency', 0.15);
  const tmp = path.join(os.tmpdir(), `slice7-disp-${Date.now()}.json`);
  fs.writeFileSync(tmp, JSON.stringify(config));
  try {
    const firings: DetectorFiringDecision[] = runDetectorOverDataset(
      'family_A_mixture_supermartingale', values, tmp, 'p99_latency',
    );
    assert.equal(firings.length, N, 'one firing decision per tick');
    // At least one fire should occur in the post-shift region (ticks 100+).
    const postShiftFires = firings.filter((f) => f.fire && f.tick >= 100);
    assert.ok(postShiftFires.length > 0,
      `expected detector to fire on 2σ mean shift; got ${postShiftFires.length} post-shift fires`);
    // Statistic field should carry M_t.
    assert.ok(firings.every((f) => f.statistic_value !== undefined),
      'mixture-SM dispatch should populate statistic_value with M_t');
    // Pre-probationary fires excluded from final score by scorePostProbationary —
    // but the dispatch returns ALL firings; scoring happens upstream.
    void provenance;
  } finally {
    fs.unlinkSync(tmp);
  }
});

test('SLICE 7 dispatch — falls back to all-false when mixture params missing', () => {
  // Build a config WITHOUT mixture_supermartingale_params (signal_class
  // outside the deriveMixtureSupermartingaleParams allowlist). We force
  // this by overwriting the per_signal block after build.
  const values: number[] = [];
  for (let i = 0; i < 100; i++) values.push(Math.sin(i / 10));
  const { config } = buildPerDatasetConfig(values, 'p99_latency', 0.15);
  // Delete the stamped mixture params to simulate a pre-SLICE-7 config.
  delete (config as any).baseline_cells.aggregate_fallback.family_A.per_signal.p99_latency.mixture_supermartingale_params;
  const tmp = path.join(os.tmpdir(), `slice7-fallback-${Date.now()}.json`);
  fs.writeFileSync(tmp, JSON.stringify(config));
  try {
    const firings = runDetectorOverDataset(
      'family_A_mixture_supermartingale', values, tmp, 'p99_latency',
    );
    assert.equal(firings.length, values.length);
    assert.ok(firings.every((f) => f.fire === false),
      'config without mixture params should produce silent (all-false) dispatch');
  } finally {
    fs.unlinkSync(tmp);
  }
});

// ── Architect decision marker ─────────────────────────────────────

test('SLICE 7 architect decision — LIL primitive deprecation comment is in place', () => {
  const filePath = fs.existsSync(path.resolve(__dirname, '..', 'detectors', 'self-normalized-e-process-fallback.ts'))
    ? path.resolve(__dirname, '..', 'detectors', 'self-normalized-e-process-fallback.ts')
    : path.resolve(__dirname, '..', '..', 'detectors', 'self-normalized-e-process-fallback.ts');
  const src = fs.readFileSync(filePath, 'utf8');
  assert.ok(src.includes('SLICE 7 ARCHITECT DECISION'),
    'self-normalized-e-process-fallback.ts must carry the SLICE 7 architect decision marker '
    + 'explaining the LIL primitive scope correction');
  assert.ok(src.includes('mean-shift detection'),
    'comment should explicitly note the LIL primitive is NOT for mean-shift detection');
  assert.ok(src.includes('family-a-mixture-supermartingale'),
    'comment should point readers to the correct mean-shift construct');
});

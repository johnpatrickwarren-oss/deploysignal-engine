// test/q70-phase-e-slice9-seasonal.test.ts — Phase E SLICE 9 seasonal
// decomposition math + calibrator integration.
//
// Per coordination/PHASE-E-SLICE-9-SPEC.md § Acceptance.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  detectDominantPeriod,
  seasonalMeans,
  deseasonalize,
  decomposeSeasonal,
} from '../detectors/seasonal';
import { buildPerDatasetConfig } from '../tools/run-nab-per-dataset';

// ── Helpers ────────────────────────────────────────────────────────

function periodicPlusNoise(N: number, period: number, amplitude: number, noiseScale: number, seed: number): number[] {
  let s = seed;
  const rng = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  const out: number[] = [];
  for (let i = 0; i < N; i++) {
    out.push(amplitude * Math.sin(2 * Math.PI * i / period) + noiseScale * (rng() - 0.5) * 2);
  }
  return out;
}

function highPhiAr1NoPeriod(N: number, phi: number, seed: number): number[] {
  let s = seed;
  const rng = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  const out: number[] = [];
  let prev = 0;
  for (let i = 0; i < N; i++) {
    const eps = (rng() - 0.5) * 2;
    prev = phi * prev + eps;
    out.push(prev);
  }
  return out;
}

// ── detectDominantPeriod ───────────────────────────────────────────

test('SLICE 9 detectDominantPeriod — identifies daily period on synthetic cycle + noise', () => {
  const N = 1000;
  const period = 24;
  const x = periodicPlusNoise(N, period, 10, 1, 0xBEEF);
  const mu = x.reduce((a, b) => a + b, 0) / x.length;
  const result = detectDominantPeriod(x, mu);
  // Allow tolerance ±2 (the first-peak algorithm may snap to a nearby lag).
  assert.ok(Math.abs(result.period - period) <= 2,
    `expected period ≈ ${period}; got ${result.period}`);
  assert.ok(result.acf_at_period > 0.5, `expected strong ACF at peak; got ${result.acf_at_period}`);
});

test('SLICE 9 detectDominantPeriod — returns 0 on high-φ AR(1) with no period (monotone ACF)', () => {
  const x = highPhiAr1NoPeriod(1000, 0.7, 0xCAFE);
  const mu = x.reduce((a, b) => a + b, 0) / x.length;
  const result = detectDominantPeriod(x, mu, { min_acf: 0.25 });
  assert.equal(result.period, 0,
    `AR(1) with no period should return 0; got period=${result.period}`);
});

test('SLICE 9 detectDominantPeriod — returns 0 when input too short', () => {
  const result = detectDominantPeriod([1, 2, 3, 4, 5], 3);
  assert.equal(result.period, 0);
});

// ── seasonalMeans + deseasonalize ──────────────────────────────────

test('SLICE 9 seasonalMeans — sum ≈ 0 by mean-centering construction', () => {
  const x = periodicPlusNoise(500, 24, 5, 0.5, 0xFACE);
  const mu = x.reduce((a, b) => a + b, 0) / x.length;
  const s = seasonalMeans(x, 24, mu);
  const sum = s.reduce((a, b) => a + b, 0);
  // Σ s = (1/N) · Σ (x − μ) summed over all phases = 0 by construction
  // (when each phase has equal count).
  assert.ok(Math.abs(sum) < 1, `Σ seasonal_means should be ≈ 0; got ${sum}`);
});

test('SLICE 9 deseasonalize — removes the periodic component', () => {
  const x = periodicPlusNoise(500, 24, 10, 0.1, 0xDEAD);
  const mu = x.reduce((a, b) => a + b, 0) / x.length;
  const s = seasonalMeans(x, 24, mu);
  const des = deseasonalize(x, s, 24, 0);
  // Variance of deseasoned should be << variance of input
  const inputVar = x.reduce((a, b) => a + (b - mu) ** 2, 0) / x.length;
  const desMu = des.reduce((a, b) => a + b, 0) / des.length;
  const desVar = des.reduce((a, b) => a + (b - desMu) ** 2, 0) / des.length;
  assert.ok(desVar < inputVar * 0.5,
    `deseasoned variance (${desVar.toFixed(2)}) should be << input variance (${inputVar.toFixed(2)})`);
});

test('SLICE 9 deseasonalize — rejects mismatched seasonal length', () => {
  assert.throws(
    () => deseasonalize([1, 2, 3], [0, 0], 3),
    /seasonal length 2 must equal period 3/,
  );
});

// ── decomposeSeasonal (combined helper) ───────────────────────────

test('SLICE 9 decomposeSeasonal — returns period=0 + identity on AR(1) data', () => {
  const x = highPhiAr1NoPeriod(1000, 0.5, 0xBADF00D);
  const mu = x.reduce((a, b) => a + b, 0) / x.length;
  const result = decomposeSeasonal(x, mu);
  assert.equal(result.period, 0);
  assert.equal(result.seasonal_means.length, 0);
  assert.deepEqual(result.deseasonalized, x);
});

test('SLICE 9 decomposeSeasonal — on periodic data, deseasonalized has lower variance', () => {
  const x = periodicPlusNoise(800, 30, 8, 0.5, 0xC0FFEE);
  const mu = x.reduce((a, b) => a + b, 0) / x.length;
  const result = decomposeSeasonal(x, mu);
  assert.ok(result.period > 0, 'expected period detection');
  const inputVar = x.reduce((a, b) => a + (b - mu) ** 2, 0) / x.length;
  const desMu = result.deseasonalized.reduce((a, b) => a + b, 0) / result.deseasonalized.length;
  const desVar = result.deseasonalized.reduce((a, b) => a + (b - desMu) ** 2, 0) / result.deseasonalized.length;
  assert.ok(desVar < inputVar, `expected deseasoned var < input var`);
});

// ── Calibrator integration ─────────────────────────────────────────

test('SLICE 9 calibrator — useSeasonalDecomposition:true stamps seasonal_decomposition when period found', () => {
  const x = periodicPlusNoise(800, 30, 8, 0.5, 0xFEED);
  const { provenance } = buildPerDatasetConfig(x, 'p99_latency', 0.5, {
    useSeasonalDecomposition: true,
  });
  // Period detection may snap to a nearby lag; the key is that seasonal
  // decomposition is stamped.
  assert.ok(provenance.seasonal_decomposition, 'seasonal_decomposition expected when period detected');
  assert.ok(provenance.seasonal_decomposition!.period > 0);
  assert.equal(provenance.seasonal_decomposition!.seasonal_means.length, provenance.seasonal_decomposition!.period);
  assert.ok(provenance.seasonal_decomposition!.sigma2_innovation_deseasoned > 0);
});

test('SLICE 9 calibrator — useSeasonalDecomposition:false (default) does not stamp seasonal', () => {
  const x = periodicPlusNoise(800, 30, 8, 0.5, 0xCAFE);
  const { provenance } = buildPerDatasetConfig(x, 'p99_latency', 0.5);
  assert.equal(provenance.seasonal_decomposition, undefined);
});

test('SLICE 9 calibrator — falls through gracefully when no period detected', () => {
  // Pure AR(1) data has no period; seasonal_decomposition should NOT be stamped
  // (period=0 path → no provenance per the spec § ASK 2 fall-through).
  const x = highPhiAr1NoPeriod(600, 0.5, 0xFADEBABE);
  const { provenance } = buildPerDatasetConfig(x, 'p99_latency', 0.5, {
    useSeasonalDecomposition: true,
  });
  assert.equal(provenance.seasonal_decomposition, undefined,
    'no period detected → seasonal_decomposition omitted');
});

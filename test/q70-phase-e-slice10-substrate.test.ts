// test/q70-phase-e-slice10-substrate.test.ts — Phase E SLICE 10 substrate
// file format: schema validation + fit/load round-trip.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { fitProductionSubstrate } from '../tools/fit-production-substrate';
import {
  loadProductionSubstrate,
  substrateToFamilyAPerSignal,
  substrateToFamilyDPerSignal,
  substrateToDispatchOpts,
} from '../tools/load-production-substrate';
import {
  isProductionArSubstrate,
  type ProductionArSubstrate,
} from '../types/production-ar-substrate';

function syntheticAr1(N: number, phi: number, seed: number): number[] {
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

// ── Schema validation ──────────────────────────────────────────────

test('SLICE 10 isProductionArSubstrate — rejects wrong version', () => {
  assert.equal(isProductionArSubstrate({ version: 'wrong-version' }), false);
  assert.equal(isProductionArSubstrate({ version: 'phase-e-slice10-v0' }), false);
});

test('SLICE 10 isProductionArSubstrate — rejects missing required fields', () => {
  assert.equal(isProductionArSubstrate({ version: 'phase-e-slice10-v1' }), false);
  assert.equal(isProductionArSubstrate({
    version: 'phase-e-slice10-v1',
    source: { signal_name: 's', n_observations: 100 },
    baseline: { mean: 0, sigma_squared_marginal: 1 },
    // ar1 missing
    generated_at: '2026-05-26T00:00:00Z',
  }), false);
});

test('SLICE 10 isProductionArSubstrate — accepts minimal valid substrate', () => {
  const minimal = {
    version: 'phase-e-slice10-v1' as const,
    source: { signal_name: 'p99_latency', n_observations: 1000 },
    baseline: { mean: 100, sigma_squared_marginal: 25 },
    ar1: { phi: 0.5, sigma_squared_innovation: 18.75 },
    generated_at: '2026-05-26T00:00:00Z',
  };
  assert.equal(isProductionArSubstrate(minimal), true);
});

// ── fit + load round-trip ──────────────────────────────────────────

test('SLICE 10 fit + write + load round-trip preserves all fields', () => {
  const values = syntheticAr1(500, 0.7, 0xC0DE);
  const substrate = fitProductionSubstrate(values, {
    signalName: 'p99_latency',
    description: 'unit test',
    fitArPCalibration: true,
    fitSeasonalDecomposition: false,  // AR(1) data has no period
    fitSpectral: true,
  });
  const tmp = path.join(os.tmpdir(), `slice10-roundtrip-${Date.now()}.json`);
  fs.writeFileSync(tmp, JSON.stringify(substrate, null, 2));
  try {
    const loaded = loadProductionSubstrate(tmp);
    // Normalize via JSON round-trip on both sides so undefined fields
    // collapse the same way (JSON.stringify drops undefined).
    assert.deepEqual(
      JSON.parse(JSON.stringify(loaded)),
      JSON.parse(JSON.stringify(substrate)),
      'round-trip should preserve all set fields',
    );
  } finally {
    if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
  }
});

test('SLICE 10 fitProductionSubstrate — minimal substrate has only required fields', () => {
  const values = syntheticAr1(100, 0.3, 0xDEAD);
  const s = fitProductionSubstrate(values, { signalName: 'minimal_signal' });
  assert.ok(s.version === 'phase-e-slice10-v1');
  assert.equal(s.source.signal_name, 'minimal_signal');
  assert.equal(s.ar_p, undefined, 'AR(p) opt-out by default');
  assert.equal(s.seasonal, undefined, 'seasonal opt-out by default');
  assert.equal(s.spectral, undefined, 'spectral opt-out by default');
});

test('SLICE 10 fitProductionSubstrate — opting into all fits populates all optional blocks (with enough data)', () => {
  // Use seasonal-friendly synthetic so the seasonal block actually populates.
  let s = 0xFEED;
  const rng = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  const values: number[] = [];
  for (let i = 0; i < 2000; i++) {
    values.push(10 * Math.sin(2 * Math.PI * i / 24) + (rng() - 0.5) * 2);
  }
  const sub = fitProductionSubstrate(values, {
    signalName: 'periodic',
    fitArPCalibration: true,
    fitSeasonalDecomposition: true,
    fitSpectral: true,
  });
  assert.ok(sub.ar_p, 'ar_p expected');
  assert.ok(sub.seasonal, 'seasonal expected on periodic input');
  assert.ok(sub.spectral, 'spectral expected');
  assert.ok(sub.seasonal!.period > 0, 'seasonal period > 0 on periodic input');
});

test('SLICE 10 loadProductionSubstrate — throws on bad file', () => {
  const tmp = path.join(os.tmpdir(), `slice10-bad-${Date.now()}.json`);
  fs.writeFileSync(tmp, JSON.stringify({ version: 'wrong' }));
  try {
    assert.throws(() => loadProductionSubstrate(tmp), /invalid substrate/);
  } finally {
    fs.unlinkSync(tmp);
  }
});

// ── Substrate → consumer mappings ──────────────────────────────────

test('SLICE 10 substrateToFamilyAPerSignal — uses seasonal innovation σ² when present', () => {
  const sub: ProductionArSubstrate = {
    version: 'phase-e-slice10-v1',
    source: { signal_name: 's', n_observations: 100 },
    baseline: { mean: 50, sigma_squared_marginal: 100 },
    ar1: { phi: 0.5, sigma_squared_innovation: 75 },
    seasonal: {
      period: 24,
      seasonal_means: new Array(24).fill(0),
      acf_at_period: 0.8,
      ar1_phi_deseasoned: 0.2,
      sigma_squared_innovation_deseasoned: 50,
    },
    generated_at: '2026-05-26T00:00:00Z',
  };
  const familyA = substrateToFamilyAPerSignal(sub) as any;
  assert.equal(familyA.baseline_sigma_squared, 50, 'seasonal innovation σ² should be stamped');
  assert.equal(familyA.ar1_phi, 0.2, 'seasonal-deseasoned φ should be stamped');
});

test('SLICE 10 substrateToFamilyAPerSignal — falls back to AR(p) innovation when no seasonal', () => {
  const sub: ProductionArSubstrate = {
    version: 'phase-e-slice10-v1',
    source: { signal_name: 's', n_observations: 100 },
    baseline: { mean: 50, sigma_squared_marginal: 100 },
    ar1: { phi: 0.5, sigma_squared_innovation: 75 },
    ar_p: {
      p: 3,
      phi: [0.5, 0.1, -0.05],
      sigma_squared_innovation: 60,
      ic_kind: 'aic',
      reflection_coefficients: [0.5, 0.1, -0.05],
    },
    generated_at: '2026-05-26T00:00:00Z',
  };
  const familyA = substrateToFamilyAPerSignal(sub) as any;
  assert.equal(familyA.baseline_sigma_squared, 60, 'AR(p) innovation σ² should be stamped');
});

test('SLICE 10 substrateToFamilyAPerSignal — falls back to AR(1) when no AR(p)/seasonal', () => {
  const sub: ProductionArSubstrate = {
    version: 'phase-e-slice10-v1',
    source: { signal_name: 's', n_observations: 100 },
    baseline: { mean: 50, sigma_squared_marginal: 100 },
    ar1: { phi: 0.5, sigma_squared_innovation: 75 },
    generated_at: '2026-05-26T00:00:00Z',
  };
  const familyA = substrateToFamilyAPerSignal(sub) as any;
  assert.equal(familyA.baseline_sigma_squared, 75, 'AR(1) innovation σ² should be stamped');
  assert.equal(familyA.ar1_phi, 0.5, 'raw AR(1) φ when no seasonal');
});

test('SLICE 10 substrateToFamilyDPerSignal — uses substrate spectral when present', () => {
  const sub: ProductionArSubstrate = {
    version: 'phase-e-slice10-v1',
    source: { signal_name: 's', n_observations: 100 },
    baseline: { mean: 50, sigma_squared_marginal: 100 },
    ar1: { phi: 0.5, sigma_squared_innovation: 75 },
    spectral: {
      bootstrap_null_quantile: 0.85,
      min_peak_lag: 3,
      max_peak_lag: 10,
      empirically_calibrated: true,
    },
    generated_at: '2026-05-26T00:00:00Z',
  };
  const familyD = substrateToFamilyDPerSignal(sub) as any;
  assert.equal(familyD.bootstrap_null_quantile, 0.85);
});

test('SLICE 10 substrateToDispatchOpts — returns seasonal info when present', () => {
  const sub: ProductionArSubstrate = {
    version: 'phase-e-slice10-v1',
    source: { signal_name: 's', n_observations: 100 },
    baseline: { mean: 50, sigma_squared_marginal: 100 },
    ar1: { phi: 0.5, sigma_squared_innovation: 75 },
    seasonal: {
      period: 24,
      seasonal_means: new Array(24).fill(0),
      acf_at_period: 0.8,
      ar1_phi_deseasoned: 0.2,
      sigma_squared_innovation_deseasoned: 50,
    },
    ar_p: {
      p: 2,
      phi: [0.3, 0.1],
      sigma_squared_innovation: 70,
      ic_kind: 'aic',
      reflection_coefficients: [0.3, 0.1],
    },
    generated_at: '2026-05-26T00:00:00Z',
  };
  const opts = substrateToDispatchOpts(sub);
  assert.equal(opts.prewhitenMean, 50);
  assert.equal(opts.prewhitenPhi, 0.2, 'seasonal-deseasoned φ');
  assert.deepEqual(opts.prewhitenPhiArray, [0.3, 0.1]);
  assert.equal(opts.seasonalPeriod, 24);
  assert.equal(opts.seasonalMeans?.length, 24);
});

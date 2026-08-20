// tests/harness.test.mjs — instrument guards for the C57 harness, per harness-discipline
// rule 1 (smoke-check every interface) made permanent as tests.
//
//   node --test validation/family-c-witness-centering/tests/

import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';
import {
  ENGINE_ROOT, familyCBuild, rowsFromDeviations, liveMetricsFrom, EVAL_CTX,
  CELL_KEY, SIGNALS, P, covarianceCorr, cholesky, bettingC,
} from '../../family-ce-nulls/harness/bundle.mjs';
import { NULLS, deviationStream, mulberry32, gaussFrom } from '../../family-ce-nulls/harness/nulls.mjs';
import { stampBettingParams, analyticRffMean } from '../harness/stamp.mjs';

const require = createRequire(import.meta.url);
const rff = require(path.join(ENGINE_ROOT, 'dist', 'detectors', 'family-c-rff.js'));
const smmd = require(path.join(ENGINE_ROOT, 'dist', 'detectors', 'sequential-mmd.js'));

const spec = NULLS.find((s) => s.id === 'HC-gauss-corr');

test('splitmix-fed deviation generator reproduces deviationStream bit-identically on mulberry32', () => {
  // The harness's deviationStreamRng body, inlined here against the canonical generator:
  // same gaussFrom, same Cholesky, same loop order. Fed the same mulberry32 uniforms it must
  // produce the same vectors to the bit, or the new-seed cells are on a different law.
  const seed = 987654321;
  const canonical = deviationStream(spec, seed);
  const r = mulberry32(seed);
  const g = gaussFrom(r);
  const L = cholesky(covarianceCorr());
  const mine = () => {
    const u = new Array(P);
    for (let k = 0; k < P; k++) u[k] = g();
    const z = new Array(P);
    for (let i = 0; i < P; i++) {
      let s = 0;
      for (let j = 0; j <= i; j++) s += L[i][j] * u[j];
      z[i] = s;
    }
    return z;
  };
  for (let t = 0; t < 1000; t++) {
    const a = canonical(), b = mine();
    for (let i = 0; i < P; i++) assert.equal(a[i], b[i], `tick ${t} coord ${i}`);
  }
});

function compiledCell() {
  const baseDraw = deviationStream(spec, 20260803 + 13 * 7919);
  const rows = rowsFromDeviations(Array.from({ length: 600 }, baseDraw));
  const famC = familyCBuild.buildFamilyCPerCell(
    rows, { covariance_method_override: 'mcd' }, CELL_KEY, 1e-4).result;
  stampBettingParams(famC, CELL_KEY, 1e-4);
  return famC;
}

test('reconstructed stamp carries the retired block\'s exact shape and constants', () => {
  const famC = compiledCell();
  const bp = famC.betting_e_process_params;
  assert.ok(bp, 'params stamped');
  assert.equal(bp.kernel_bandwidth_sigma, famC.mmd_params.bandwidth, 'bandwidth = mmd_params.bandwidth');
  assert.equal(bp.lambda_max, 0.5);
  assert.equal(bp.betting_strategy, 'ons');
  assert.equal(bp.ons_initial_lambda, 0);
  assert.equal(bp.alpha, 1e-4);
  assert.equal(bp.baseline_sample_size, 500);
  assert.equal(bp.rff_dim, 256);
  assert.equal(bp.rff_seed, rff.rffCellSeed({ hour_of_day: 0, day_of_week: -1, tier: undefined }));
  assert.equal(bp.baseline_rff_mean.length, 256);
  // The mean is the pool mean under the SAME seed the runtime would regenerate.
  const pool = smmd.generateBaselinePool(famC, 500, smmd.baselinePoolSeed(CELL_KEY));
  const fm = rff.computeRffFeatureMap(bp.rff_seed, 256, famC.mean_vector.length, bp.kernel_bandwidth_sigma);
  const mu = rff.rffMeanOverPool(pool, fm);
  for (let i = 0; i < 256; i++) assert.equal(bp.baseline_rff_mean[i], mu[i], `mu[${i}]`);
});

test('closed-form embedding agrees with a large Monte Carlo pool', () => {
  // C13 measured ||mc(32000) - exact||_2 = 4.49e-3; the guard bar is 0.01.
  const famC = compiledCell();
  const bp = famC.betting_e_process_params;
  const fm = rff.computeRffFeatureMap(bp.rff_seed, 256, famC.mean_vector.length, bp.kernel_bandwidth_sigma);
  const exact = analyticRffMean(famC.covariance, fm);
  const pool = smmd.generateBaselinePool(famC, 32000, smmd.baselinePoolSeed(CELL_KEY));
  const mc = rff.rffMeanOverPool(pool, fm);
  let d2 = 0;
  for (let i = 0; i < 256; i++) d2 += (exact[i] - mc[i]) ** 2;
  assert.ok(Math.sqrt(d2) < 0.01, `||exact - mc32000|| = ${Math.sqrt(d2)}`);
});

test('arm smoke: the driven detector fires on an obvious shift and stays quiet on H0', () => {
  const famC = compiledCell();
  const bp = famC.betting_e_process_params;
  const fm = rff.computeRffFeatureMap(bp.rff_seed, 256, famC.mean_vector.length, bp.kernel_bandwidth_sigma);
  bp.baseline_rff_mean = analyticRffMean(covarianceCorr(), fm);
  const cfg = {
    family_c_signals: SIGNALS,
    alpha_budget: { total: 1e-3, per_family: { C: 2e-4 } },
    bake_profiles: {},
    traffic_pct_gate: { min_traffic_pct_for_fire: 0 },
    baseline_cells: {
      dimensions: ['hour_of_day'],
      cells: [{ key: CELL_KEY, n_samples: 600, confidence: 'strict', family_C: famC }],
      aggregate_fallback: { family_C: famC },
    },
  };
  const run = (shift, T) => {
    const draw = deviationStream(spec, 424242);
    const states = {};
    let fired = false, lastLog = 0, evaluated = 0;
    for (let t = 0; t < T; t++) {
      const dev = draw().map((x) => x + shift);
      const v = bettingC.evaluateFamilyCBettingEProcess(
        cfg, liveMetricsFrom(dev, famC.mean_vector), states, EVAL_CTX);
      assert.ok(v, 'verdict non-null');
      if (v.verdict === 'fire') fired = true;
      if (v.verdict !== 'suppressed') evaluated++;
      const k = Object.keys(states).find((s) => s.startsWith('__fc_betting'));
      lastLog = states[k].log_S_t;
    }
    return { fired, lastLog, evaluated };
  };
  const h1 = run(0.5, 300);   // a 10-sigma mean shift on every coordinate
  assert.equal(h1.evaluated, 300, 'every H1 tick evaluated');
  assert.ok(h1.fired, `obvious shift fires (log_S end ${h1.lastLog})`);
  const h0 = run(0, 300);
  assert.equal(h0.evaluated, 300, 'every H0 tick evaluated');
  assert.ok(!h0.fired, `H0 does not cross the shipped threshold (log_S end ${h0.lastLog})`);
  assert.ok(Math.abs(h0.lastLog) < Math.log(20), 'H0 wealth stays below the alpha=0.05 line in one draw');
});

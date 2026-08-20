// harness/stamp.mjs — the retired betting-params stamp, reconstructed per PREREGISTRATION
// Amendment A1.
//
// deploysignal cee899c set FAMILY_C_MMD_RETIRED = true, so buildFamilyCPerCell stamps
// betting_e_process_params = null unconditionally. This module reconstructs exactly the object
// the retired stamp block produced (_family-c-build.ts:300-373 at deploysignal e5e13c0), using
// ONLY engine dist functions — the same functions that block called, verified byte-identical to
// deploysignal's engine copy by verifyProvenance(). Constants: lambda_max = 0.5
// (_family-c-build.ts:39), pool size 500 (:45 = engine BASELINE_POOL_SIZE), alpha = the
// buildBundle alphaMMD (1e-4), rff_dim = RFF_DEFAULT_DIM (256).
//
// Fidelity gate: E0.1 — the REPA2 cells must reproduce family-c-pool's committed A2 numbers,
// which were produced through the pre-retirement calibrator. Any drift here fails that anchor
// and the study is NOT-EXECUTABLE.

import path from 'node:path';
import { createRequire } from 'node:module';
import { ENGINE_ROOT } from '../../family-ce-nulls/harness/bundle.mjs';

const require = createRequire(import.meta.url);
const DET = (m) => require(path.join(ENGINE_ROOT, 'dist', 'detectors', `${m}.js`));
const rff = DET('family-c-rff');
const smmd = DET('sequential-mmd');

export const STAMP_LAMBDA_MAX = 0.5;
export const STAMP_POOL_SIZE = 500;

/** Stamp betting_e_process_params on a compiled FamilyCPerCell in place, exactly as the
 *  retired calibrator block did. Requires cell.mmd_params (still stamped by the live
 *  calibrator; carries the median-heuristic bandwidth). */
export function stampBettingParams(cell, cellKey, alpha) {
  if (!cell.mmd_params) throw new Error('stamp: cell has no mmd_params (bandwidth source)');
  const bandwidth = cell.mmd_params.bandwidth;
  const rffSeed = rff.rffCellSeed({
    hour_of_day: cellKey.hour_of_day, day_of_week: cellKey.day_of_week, tier: undefined,
  });
  const pool = smmd.generateBaselinePool(
    cell, STAMP_POOL_SIZE,
    smmd.baselinePoolSeed({ hour_of_day: cellKey.hour_of_day, day_of_week: cellKey.day_of_week }),
  );
  const fm = rff.computeRffFeatureMap(rffSeed, rff.RFF_DEFAULT_DIM, cell.mean_vector.length, bandwidth);
  const mu = rff.rffMeanOverPool(pool, fm);
  cell.betting_e_process_params = {
    kernel_bandwidth_sigma: bandwidth,
    lambda_max: STAMP_LAMBDA_MAX,
    betting_strategy: 'ons',
    ons_initial_lambda: 0,
    alpha,
    baseline_sample_size: STAMP_POOL_SIZE,
    rff_seed: rffSeed,
    rff_dim: rff.RFF_DEFAULT_DIM,
    baseline_rff_mean: Array.from(mu),
  };
}

/** Exact mean embedding of N(0, S) under the feature map — the family-c-pool §3 closed form
 *  (run-pool.mjs analyticRffMean, S made a parameter as in exploratory-oracle-sigma.mjs):
 *    μ_P^φ[i] = √(2/D) · exp(−½ ωᵢᵀ S ωᵢ) · cos(bᵢ)
 *  Exact because the deviation law is N(0, S) by construction and
 *  E[cos(Z + b)] = e^{−v/2}·cos b for Z ~ N(0, v). */
export function analyticRffMean(S, fm) {
  const D = fm.D, d = fm.d, scale = Math.sqrt(2 / D);
  const out = new Array(D);
  for (let i = 0; i < D; i++) {
    const w = fm.omega[i];
    let v = 0;
    for (let r = 0; r < d; r++) {
      let s = 0;
      for (let c = 0; c < d; c++) s += S[r][c] * w[c];
      v += w[r] * s;
    }
    out[i] = scale * Math.exp(-0.5 * v) * Math.cos(fm.b[i]);
  }
  return out;
}

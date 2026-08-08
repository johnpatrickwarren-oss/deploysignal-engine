// tools/stamp-heldout-family-e.mjs
//
// K4 held-out conformal calibration route (coverage-matrix-v1, Task 7).
//
// Builds Addition #22 weighted-e-value ConformalParams (types/families/e.ts:61-97,
// kind: 'weighted_e_value') from real held-out calibration rows -- replacing
// deploysignal's chi_p parametric-Gaussian-bootstrap synthesis
// (~/concord/deploysignal/tools/calibrators/family-e.ts's buildFamilyEPerCell, the
// force_weighted_e_value branch -- the only selector this repo's frozen
// family_E_conformal card documents as ever reaching the weighted_e_value kind on
// the shipped path).
//
// Substrate (PREREGISTRATION.md Amendment A7): clustersynth
// (validation/shape-battery/harness/run-clustersynth.mjs) was checked and found to
// ship only multivariate per-shard telemetry -- not the 1-D stream this K4 route
// scores. The held-out rows are instead drawn, by the caller, from this battery's
// own generator (validation/coverage/lib/inject.mjs's rng/gaussFrom); this is
// registered tier T1, not T2. HELDOUT_SEED = 20760838 for the registered battery
// stream (Amendment v1.2 item 1 -- v1.1's literal 20261338 was an arithmetic error
// against CELL_SEED + 500000). This module does not draw rows itself; it stamps
// whatever rows the caller supplies, so it carries no seed of its own.
//
// Construction (Amendment A2): K4's read is 1-D -- x_t = [v_t], Sigma = [[1]] -- so
// the live/calibration Mahalanobis score s = sqrt(x^T Sigma^-1 x) reduces to |v|
// exactly. The general multivariate scorer (detectors/_conformal-math.ts's
// mahalanobisDistance) is not imported here; this module implements its 1x1 special
// case directly, matching detectors/conformal.ts:428's
// `mahalanobisDistance(x_t, input.covariance)` call under Sigma=[[1]] bit for bit.
//
// Held-out rows carry no per-sample weight -- this is a single T1 calibration draw,
// not a decaying baseline window -- so weights are uniform 1, effective_sample_size
// == n exactly, and halflife_days (no decay applied) is carried as Infinity so the
// field stays present and self-describing to any audit consumer that reads it, per
// ConformalParams' required-field contract (types/families/e.ts:84-90).

/** Registered floor: held-out calibration rows must number at least this many per
 *  cell (PREREGISTRATION.md Amendment A1, "n >= 10,000/cell"). */
export const HELDOUT_MIN_ROWS = 10000;

/** Stamp Addition #22 weighted-e-value calibration params from held-out
 *  calibration rows -- each row a scalar draw from the held-out substrate (the
 *  K4 injected series' own value under the null), pre-reduced by this module to
 *  its 1-D Mahalanobis score.
 *
 *  Returns a `ConformalParams` object with `kind: 'weighted_e_value'`, ready to
 *  pass as `evaluateConformalWeightedEValue`'s `input.params`
 *  (`detectors/conformal.ts:424-462`) alongside `covariance: [[1]]` and the
 *  caller's own `alpha`.
 *
 *  `alpha` is accepted and validated here (interface completeness, and so a
 *  misconfigured caller fails at stamp time rather than silently at query time)
 *  but does not enter the calibration arithmetic below: `scores`/`weights`/
 *  `cumulative_weights_above` are alpha-independent by construction, the same way
 *  `buildFamilyEPerCell` in deploysignal's own calibrator never takes alpha --
 *  alpha only enters at evaluate time, via `evaluateConformalWeightedEValue`'s own
 *  `input.alpha` (conformal.ts:424,430-431). */
export function stampHeldoutFamilyE({ calibrationRows, alpha }) {
  if (!Array.isArray(calibrationRows)) {
    throw new Error('stampHeldoutFamilyE: calibrationRows must be an array of scalar rows');
  }
  const n = calibrationRows.length;
  if (n < HELDOUT_MIN_ROWS) {
    throw new Error(
      `stampHeldoutFamilyE: calibrationRows has ${n} rows, below the registered floor `
      + `n >= ${HELDOUT_MIN_ROWS} (PREREGISTRATION.md Amendment A1)`,
    );
  }
  if (typeof alpha !== 'number' || !(alpha > 0 && alpha < 1)) {
    throw new Error(`stampHeldoutFamilyE: alpha must be a number in (0,1), got ${alpha}`);
  }

  // 1-D Mahalanobis score under Sigma=[[1]]: s = |v| (Amendment A2).
  const scored = calibrationRows.map((v) => Math.abs(v));
  const order = scored.map((_, i) => i).sort((a, b) => scored[a] - scored[b]);
  const scores = order.map((i) => scored[i]);
  // Held-out rows are unweighted: no time-decay applies to a single calibration draw.
  const weights = new Array(n).fill(1);

  // Reverse-cumulative weight sum, matching buildFamilyEPerCell's own construction
  // (deploysignal's tools/calibrators/family-e.ts): cumulative_weights_above[k] =
  // sum of weights[k..n-1] over the sorted (ascending) order.
  const cumulative_weights_above = new Array(n);
  let runningTail = 0;
  for (let k = n - 1; k >= 0; k--) {
    runningTail += weights[k];
    cumulative_weights_above[k] = runningTail;
  }
  const total_weight = runningTail;

  return {
    kind: 'weighted_e_value',
    scores,
    weights,
    cumulative_weights_above,
    total_weight,
    halflife_days: Infinity,
    effective_sample_size: n,
    calibration_method: 'heldout_empirical_e_value',
  };
}

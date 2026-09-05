// Amendment v1.C69 (2026-09-03): `e_detector` -- a run-length guarantee (E_inf[N*] >= 1/alpha_ARL),
// not an e-value one. Its instruments are the two v1.C66 endpoints, which for THIS class carry
// verdict authority (validation/e-detector-cert/PREREGISTRATION.md §2).
export const CLASSES = ['test_martingale', 'terminal_e_value', 'e_process', 'e_detector'];
// C1 vocabulary fix: the terminal instruments are `exceedance` and the MEAN. The mean's
// field name in the corpus is `mean_e` (validation/terminal-evalue/harness/run.mjs:95).
// This table said `mean_above_1` until 2026-08-07 -- a field that exists in no cell in
// any run, so mean-bearing cells were never recognized as carrying their class's second
// instrument and the protocol's mean rule had nothing to fire on. The protocol names the
// instrument "exceedance and mean above 1, scored jointly"; `mean_above_1` was that
// English read as a field name.
export const CLASS_INSTRUMENTS = {
  test_martingale: ['increment_estimator'],
  terminal_e_value: ['exceedance', 'mean_e'],
  e_process: ['stopped_mean', 'crossing_rate'],
  e_detector: ['arl0_T', 'delay_canonical'],
};

// ── Amendment v1.C69 registered constants (do not move inside protocol v1) ──
// One-sided 95% normal quantile: S2 clears on arl0_T - Z*se >= 1/alpha_arl, refutes on
// arl0_T + Z*se < 1/alpha_arl, and is INCONCLUSIVE between. S3 scores delay_canonical + Z*se.
export const E_DETECTOR_Z = 1.645;
// A canonical delay cell with more than this fraction of post-onset trajectories censored at T
// is not scoreable (the censored mean would understate the delay).
export const E_DETECTOR_CENSOR_MAX = 0.01;
// The class canonical severity the delay floor is read at: FAULT_CLASSES.K1.canonical, 1.5 sigma.
export const E_DETECTOR_CANONICAL_SHIFT_SIGMA = 1.5;
// psi*(Delta_U)/psi*(Delta_L) on the frozen 16-lambda grid (0.25 .. 3 sigma): (3/0.25)^2 = 144.
export const E_DETECTOR_LOG_RATIO = Math.log(144);
/** A persistent step of delta (in sigma) in the metric is a step of delta*sqrt((1-phi)/(1+phi))
 *  in the AR(1)-whitened residual after its first post-onset tick. The delay bound is evaluated
 *  at this effective shift because that is the post-change law the detector sees. */
export function effectiveShift(deltaSigma, phi) {
  if (!(Math.abs(phi) < 1)) throw new Error(`effectiveShift: |phi| must be < 1, got ${phi}`);
  return deltaSigma * Math.sqrt((1 - phi) / (1 + phi));
}
/** Shin-Ramdas-Rinaldo 2022 Theorem 4.3 with Proposition B.2 on the registered grid:
 *  E_nu[N* - nu | N* > nu] <= g_alpha/D + V/D^2 + 1, D = delta^2/2, V = delta^2,
 *  g_alpha = min_{eta in [1.001, 8]} eta*log(1/alpha) + log(1 + log(144)/log(eta)).
 *  Registered values at alpha_arl = 1e-3, delta = 1.5: phi 0 -> 13.0, 0.3 -> 23.3, 0.6 -> 49.1,
 *  0.9 -> 229.6. A FLOOR for the class, not a theorem about the increment mixture (the theorem
 *  is proved for the mixture of detectors). */
export function eDetectorDelayBound(alphaArl, deltaEff, increment = 'gaussian') {
  if (!(alphaArl > 0 && alphaArl < 1)) throw new Error(`eDetectorDelayBound: alpha_arl must be in (0,1), got ${alphaArl}`);
  if (!(deltaEff > 0)) throw new Error(`eDetectorDelayBound: delta_eff must be > 0, got ${deltaEff}`);
  if (!E_DETECTOR_INCREMENTS.includes(increment)) throw new Error(`eDetectorDelayBound: increment must be one of ${E_DETECTOR_INCREMENTS.join('|')}, got ${increment}`);
  let g = Infinity;
  for (let eta = 1.001; eta <= 8; eta += 0.001) {
    g = Math.min(g, eta * Math.log(1 / alphaArl) + Math.log(1 + E_DETECTOR_LOG_RATIO / Math.log(eta)));
  }
  const { D, V } = increment === 'bounded' ? boundedIncrementGrowth(deltaEff) : { D: (deltaEff * deltaEff) / 2, V: deltaEff * deltaEff };
  return { g_alpha: g, bound: g / D + V / (D * D) + 1, increment, D, V };
}

// Amendment v1.C77 (2026-09-04): the delay floor is evaluated at the card's declared increment
// family. Absent = 'gaussian' = the v1.C69 arithmetic above, unchanged.
export const E_DETECTOR_INCREMENTS = ['gaussian', 'bounded'];
// The bounded-bet increment's grid and clip (fleet/calibration-monitor.ts BOUND_LAMBDAS / BOUND_CLIP,
// restated here so the scorer's arithmetic is pinned by the cards that pin this file).
export const E_DETECTOR_BOUNDED_LAMBDAS = [0.1, 0.3, 0.6, 0.9, -0.1, -0.3, -0.6, -0.9];
export const E_DETECTOR_BOUNDED_CLIP = 3;
/** D = E[log(1 + lambda*clip(r, +-3)/3)] and V its variance under r ~ N(delta_eff, 1), at the grid
 *  lambda that maximizes D; midpoint quadrature over z in [-8, 8], 8,001 points (v1.C77 C77.3).
 *  Registered values at alpha_arl = 1e-3, delta = 1.5: phi 0 -> D* 34.9, 0.3 -> 47.0, 0.6 -> 71.9,
 *  0.9 -> 239.9 (against the Gaussian 13.0 / 23.3 / 49.1 / 229.6). */
export function boundedIncrementGrowth(deltaEff) {
  if (!(deltaEff > 0)) throw new Error(`boundedIncrementGrowth: delta_eff must be > 0, got ${deltaEff}`);
  const n = 8001, lo = -8, hi = 8, h = (hi - lo) / n, B = E_DETECTOR_BOUNDED_CLIP;
  let best = null;
  for (const lam of E_DETECTOR_BOUNDED_LAMBDAS) {
    let s = 0, s2 = 0, W = 0;
    for (let i = 0; i < n; i++) {
      const z = lo + (i + 0.5) * h;
      const w = Math.exp(-0.5 * z * z) / Math.sqrt(2 * Math.PI) * h;
      const r = deltaEff + z, c = Math.max(-B, Math.min(B, r));
      const l = Math.log(1 + (lam * c) / B);
      s += w * l; s2 += w * l * l; W += w;
    }
    const D = s / W, V = s2 / W - D * D;
    if (best === null || D > best.D) best = { lambda: lam, D, V };
  }
  return best;
}
// The registered bound a terminal e-value's mean is scored against: E[e|H0] <= 1.
// Registered 2026-08-07 with the third card freeze; a mechanical-verdict protocol's
// numbers cannot drift between runs. See stats/terminal-mean-is-not-measurable for why
// only readings ABOVE this bound carry evidence.
export const TERMINAL_MEAN_BOUND = 1;
// Registered 2026-08-06 with the claim-card freeze; do not move (protocol: mechanical verdict).
export const INERTNESS_FLOOR = 0.10;
export const INERTNESS_SHIFT_SIGMA = 3;
export const TIERS = ['T1', 'T2', 'T3'];

// Tier of the substrate a study ran on (protocol "Evidence tiers"): T1 house synthetic,
// T2 independent synthetic, T3 real telemetry. Mechanical rule, in precedence order:
//   1. an explicit `tier` on the run manifest wins (a study that knows its own substrate
//      says so; this is the only way a T3 run can declare itself today);
//   2. a study name whose tokens include `real` (real-telemetry, gwdg-real, ...) is T3;
//   3. `clustersynth` anywhere in the name is T2 -- the generator the detectors were not
//      tuned against;
//   4. otherwise T1.
// Token-bounded on purpose: a bare substring test would read 'realignment' as real telemetry.
const REAL_SUBSTRATE = /(^|[-_.\s])real([-_.\s]|$)/i;
export const tierOfStudy = (study, declaredTier = null) => {
  if (declaredTier != null) {
    if (!TIERS.includes(declaredTier)) throw new Error(`unregistered tier "${declaredTier}" (expected one of ${TIERS.join('|')})`);
    return declaredTier;
  }
  const name = String(study ?? '');
  if (REAL_SUBSTRATE.test(name)) return 'T3';
  if (/clustersynth/i.test(name)) return 'T2';
  return 'T1';
};

export const VERDICTS = ['USE', 'ADVISORY', 'REFUSE', 'NOT_EXECUTABLE', 'EXPIRED'];

/** Every verdict the scorer emits passes through here, so a token outside the registered
 *  vocabulary is a crash rather than a card nobody can interpret. */
export function assertVerdict(verdict) {
  if (!VERDICTS.includes(verdict)) {
    throw new Error(`unregistered verdict "${verdict}" (registered: ${VERDICTS.join('|')})`);
  }
  return verdict;
}

export const COVERAGE_FLOOR = 0.50;
export const FAULT_CLASSES = Object.freeze({
  K1: { name: 'per-metric step shift',      canonical: '1.5sigma',        grid: ['0.75sigma', '1.5sigma', '3sigma'] },
  K2: { name: 'group-in-unison',            canonical: 'K10-e0.5sigma',   grid: ['K5-e0.25sigma', 'K5-e0.5sigma', 'K10-e0.25sigma', 'K10-e0.5sigma', 'K10-e0.75sigma', 'K20-e0.25sigma', 'K20-e0.5sigma'] },
  K3: { name: 'sub-threshold oscillation',  canonical: 'A0.75sigma-f0.05', grid: ['A0.5sigma-f0.02', 'A0.5sigma-f0.05', 'A0.75sigma-f0.02', 'A0.75sigma-f0.05', 'A0.75sigma-f0.1'] },
  K4: { name: 'far-outside-norm point',     canonical: '5sigma-point',    grid: ['3sigma-point', '5sigma-point', '8sigma-point'] },
  // Amendment v2.K5R (2026-08-08). K5's grid was re-registered: `injectDrift` adds
  // slope*(t-at)*sigma over (t-at) = 0..199, so the original three slopes reach terminal shifts of
  // only 0.00995 / 0.0199 / 0.0995 sigma and scored-window MEAN shifts of half those -- the
  // retired canonical `slope1e-4` changed 0 of 14,000 paired e>=20 decisions relative to no
  // injection at all (K5R.2). The four appended cells reach 0.4975 / 0.995 / 1.99 / 3.98 sigma
  // terminal while their per-tick increment stays 0.0025-0.02 sigma, 37x-300x below every
  // registered level-shift severity, which is the class definition's requirement. Canonical is the
  // 2-sigma-terminal cell, mid-grid among the four, mirroring how the other five classes pick
  // theirs. The three original entries are KEPT and still measured: they are correct measurements
  // of a different question (K5R.4), reported and deciding nothing. Grid order is the cell-table
  // order run-battery.mjs's assertRegistryAgreement compares against string-for-string.
  K5: { name: 'slow drift',                 canonical: 'slope1e-2',       grid: ['slope5e-5', 'slope1e-4', 'slope5e-4', 'slope2.5e-3', 'slope5e-3', 'slope1e-2', 'slope2e-2'] },
  K6: { name: 'distributional shape change', canonical: 'mix-d1.5',       grid: ['mix-d1.0', 'mix-d1.5', 'mix-d2.0'] },
  // Amendment v2.K6A.1 (K6A.1.13 item 1), 2026-08-08. A class row does not exist until this
  // object has a key: `coverageFor` (lib/score.mjs:358) and `classRow` (verdict.mjs:270)
  // iterate `Object.keys(FAULT_CLASSES)`, and nothing anywhere iterates the cells' own
  // `fault_class` values -- so cells carrying `fault_class: 'K6-slow'` could not create a row
  // by themselves. Same K6 severity grammar and same canonical severity as K6, because it is
  // the same injection: what differs is the HORIZON the class is read over (T = 6,300 ticks,
  // 40 disjoint windows of 150, against K6's 300/6x30 deploy-gate span, K6A.1.9) and the
  // detector assigned to it -- `shape_ecdf_accumulator` ALONE (K6A.1.9, with the disclosed
  // cost that the row has no paired-comparison partner).
  'K6-slow': { name: 'distributional shape change, hours-scale accumulator', canonical: 'mix-d1.5', grid: ['mix-d1.0', 'mix-d1.5', 'mix-d2.0'] },
});

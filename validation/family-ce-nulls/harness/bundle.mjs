// harness/bundle.mjs — builds the two calibration bundles the H₀ battery
// could not build, using the SHIPPED calibrators, not re-implementations.
//
// Why this file exists: `validation/h0-battery/harness/detectors.mjs`
// OUT_OF_SCOPE lists `family_C_mmd_betting` and `family_E_conformal` with the
// reason "needs a compiled calibration bundle the harness does not build".
// Both detectors self-gate on the presence of compiled fields
// (`betting_e_process_params`, `ConformalParams.kind === 'weighted_e_value'`),
// so neither can be driven from the h0-battery's synthetic
// `{ mu, sigma, phi, alpha }` config. This module builds the real thing.
//
// Provenance of the calibrator code:
//   ../deploysignal/tools/calibrators/_family-c-build.js  (buildFamilyCPerCell)
//   ../deploysignal/tools/calibrators/family-e.js         (buildFamilyEPerCell)
// Those compiled modules resolve `@johnpatrickwarren-oss/deploysignal-engine`
// out of `deploysignal/node_modules`. That copy was verified byte-identical to
// this repo's `dist/detectors/{sequential-mmd,family-c-rff,conformal,
// family-c-betting-e-process,_family-c-betting-witness}.js` at registration
// time (see PREREGISTRATION §2), so the P-side pool the calibrator embeds and
// the one this repo's detector regenerates at runtime are the same object.
// `verifyProvenance()` re-checks that on every run and throws if it drifted.

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const ENGINE_ROOT = path.resolve(HERE, '..', '..', '..');
export const DS_ROOT = path.resolve(ENGINE_ROOT, '..', 'deploysignal');

const require = createRequire(import.meta.url);
const CAL = (m) => require(path.join(DS_ROOT, 'tools', 'calibrators', `${m}.js`));
const DET = (m) => require(path.join(ENGINE_ROOT, 'dist', 'detectors', `${m}.js`));

export const familyCBuild = CAL('_family-c-build');
export const familyECal = CAL('family-e');
export const hotelling = DET('hotelling');
export const bettingC = DET('family-c-betting-e-process');
export const conformal = DET('conformal');

/** The five compiled modules the calibrator imports out of its own
 *  node_modules copy of the engine. If any has drifted from this repo's
 *  `dist/`, the bundle would be calibrated against a different detector than
 *  the one being measured, and the measurement would be meaningless. */
const SHARED = [
  'sequential-mmd', 'family-c-rff', 'conformal',
  'family-c-betting-e-process', '_family-c-betting-witness',
];

export function verifyProvenance() {
  const pkgDist = path.join(
    DS_ROOT, 'node_modules', '@johnpatrickwarren-oss', 'deploysignal-engine', 'dist', 'detectors');
  const localDist = path.join(ENGINE_ROOT, 'dist', 'detectors');
  const out = [];
  for (const m of SHARED) {
    const a = fs.readFileSync(path.join(pkgDist, `${m}.js`));
    const b = fs.readFileSync(path.join(localDist, `${m}.js`));
    if (!a.equals(b)) {
      throw new Error(
        `provenance: deploysignal's engine copy of ${m}.js differs from `
        + `deploysignal-engine/dist. The calibrator would compile against a `
        + `different detector than the one measured. Refusing to run.`);
    }
    out.push(m);
  }
  return out;
}

// ── The synthetic cell ────────────────────────────────────────────────
//
// Family C / E both consume the 11-signal joint vector in FAMILY_C_SIGNALS
// order and both work in RELATIVE deviation r_i = (x_i − μ_i)/μ_i. So the
// generative model is stated on r, and rows are emitted as x_i = μ_i(1 + r_i).
// `LEVELS` are plausible per-signal magnitudes; nothing downstream depends on
// them beyond making the relative-deviation transform well conditioned.

export const SIGNALS = hotelling.FAMILY_C_SIGNALS;
export const P = SIGNALS.length;
export const LEVELS = [120, 45, 800, 0.62, 0.0031, 0.004, 0.41, 0.02, 900, 0.05, 100];

/** Per-signal relative-deviation sd. 5% is the scale; the median-heuristic
 *  bandwidth adapts to it, so results are near scale-invariant. */
export const SD = 0.05;
/** AR-style correlation ρ^|i−j| across signals for the correlated cells. */
export const RHO = 0.3;

export function covarianceCorr() {
  const S = [];
  for (let i = 0; i < P; i++) {
    S.push([]);
    for (let j = 0; j < P; j++) S[i].push(SD * SD * Math.pow(RHO, Math.abs(i - j)));
  }
  return S;
}

export function covarianceDiag() {
  const S = [];
  for (let i = 0; i < P; i++) {
    S.push([]);
    for (let j = 0; j < P; j++) S[i].push(i === j ? SD * SD : 0);
  }
  return S;
}

export function cholesky(A) {
  const n = A.length;
  const L = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      let s = A[i][j];
      for (let k = 0; k < j; k++) s -= L[i][k] * L[j][k];
      if (i === j) L[i][i] = Math.sqrt(Math.max(s, 1e-18));
      else L[i][j] = s / L[j][j];
    }
  }
  return L;
}

export function rowsFromDeviations(devs) {
  return devs.map((z) => z.map((v, i) => LEVELS[i] * (1 + v)));
}

export function liveMetricsFrom(dev, meanVector) {
  const m = {};
  for (let i = 0; i < P; i++) m[SIGNALS[i]] = meanVector[i] * (1 + dev[i]);
  return m;
}

// ── Compiled-config assembly ──────────────────────────────────────────

export const CELL_KEY = { hour_of_day: 0, day_of_week: -1 };

/** Build one compiled bundle from `rows` (n × p raw baseline rows).
 *
 *  `covariance_method_override: 'mcd'` is REQUIRED, and that is itself a
 *  finding — see PREREGISTRATION §3. Under the default `auto` route,
 *  `chooseCovarianceMethod` picks MCD, then the REPLY-50 D6b low-variance
 *  auto-skip demotes a clean baseline back to Ledoit-Wolf, and the D7 gate in
 *  `buildFamilyCPerCell` only stamps `mmd_params` when the method is mcd/mrcd.
 *  No `mmd_params` ⇒ no `betting_e_process_params` ⇒ the Family C MMD
 *  betting e-process does not exist on the cell at all.
 *
 *  Family E's `force_weighted_e_value` selector is likewise required: the
 *  `auto` path's ESS gate cannot be passed at any span (PREREGISTRATION §3). */
export function buildBundle(rows, { alphaC = 2e-4, alphaE = 1e-4, halflifeDays = 7,
  baselineSpanDays = 14 } = {}) {
  const alphaMMD = alphaC * 0.5;
  const famC = familyCBuild.buildFamilyCPerCell(
    rows, { covariance_method_override: 'mcd' }, CELL_KEY, alphaMMD).result;
  if (!famC.betting_e_process_params) {
    throw new Error('bundle: calibrator produced no betting_e_process_params');
  }
  const famE = familyECal.buildFamilyEPerCell(
    famC, familyECal.familyESeedForCell(CELL_KEY), halflifeDays, baselineSpanDays,
    'force_weighted_e_value');
  if (!famE || famE.kind !== 'weighted_e_value') {
    throw new Error(`bundle: expected weighted_e_value, got ${famE && famE.kind}`);
  }
  const cfg = {
    family_c_signals: SIGNALS,
    alpha_budget: { total: 1e-3, per_family: { C: alphaC, E: alphaE } },
    bake_profiles: {},
    traffic_pct_gate: { min_traffic_pct_for_fire: 0 },
    baseline_cells: {
      dimensions: ['hour_of_day'],
      cells: [{
        key: CELL_KEY, n_samples: rows.length, confidence: 'strict',
        family_C: famC, family_E: famE,
      }],
      aggregate_fallback: { family_C: famC, family_E: famE },
    },
  };
  return { cfg, famC, famE };
}

/** Runtime context that clears every suppression gate, so every tick is an
 *  evaluated tick. Same convention as the h0-battery's adapters. */
export const EVAL_CTX = {
  hourOfDay: CELL_KEY.hour_of_day, dayOfWeek: CELL_KEY.day_of_week,
  ticksSinceDeploy: 999, deployAgeDays: 0, trafficPct: 100,
};

/** The ESS-gate arithmetic quoted in PREREGISTRATION §3, recomputed from the
 *  shipped constants so the claim is checked rather than asserted. */
export function essGateProfile() {
  const M = familyECal.FAMILY_E_CALIBRATION_SIZE;
  const rows = [];
  for (const span of [7, 10, 14, 21, 28, 30, 60, 120, 365, 3650]) {
    const halflife = Math.min(span / 2, 14);
    const lambda = Math.log(2) / halflife;
    const ess = familyECal.expectedESSUnderUniformAge(lambda, span, M);
    rows.push({ span_days: span, halflife_days: halflife, ess_ratio: ess / M });
  }
  return {
    threshold: familyECal.FAMILY_E_ESS_THRESHOLD,
    min_span_days: familyECal.FAMILY_E_MIN_SPAN_DAYS,
    calibration_size: M,
    max_ess_ratio: Math.max(...rows.map((r) => r.ess_ratio)),
    rows,
  };
}

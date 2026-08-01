// harness/detectors.mjs — adapters giving every detector one shape.
//
// §8.2 required establishing that each detector can be driven from a synthetic
// config without a compiled artifact. This file is the answer, including the
// detectors for which the answer is no. A detector that cannot be scored is
// listed in OUT_OF_SCOPE with a reason — §8.4 forbids quietly passing it.
//
// Adapter contract:
//   make(cfg) -> { step(rawValue) -> boolean fired, logM() -> number }
// `cfg` carries { mu, sigma, phi, alpha, windows }.

import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const D = (m) => require(`../../../dist/detectors/${m}.js`);

const spectral = D('spectral');
const betting = D('betting-e-process');
const mixture = D('family-a-mixture-supermartingale');
const hotelling = D('_hotelling-safe');

const W = 30, LO = 3, HI = 10;

export const DETECTORS = [
  {
    id: 'family_D_spectral_e_detector',
    family: 'D',
    windowed: true,
    make(cfg) {
      const st = spectral.freshSpectralEDetectorState();
      const buf = [];
      let sinceEval = 0;
      const params = {
        null_mean: cfg.mu, null_std: cfg.sigma,
        betting_delta: 0.3 * cfg.sigma,
        min_peak_lag: LO, max_peak_lag: HI,
      };
      return {
        step(x) {
          buf.push(x);
          if (buf.length > W) buf.shift();
          if (buf.length < W) return false;
          // N1 evaluates on disjoint windows; N7 on every tick (shipped).
          if (cfg.windows === 'disjoint') {
            if (++sinceEval < W) return false;
            sinceEval = 0;
          }
          const peak = spectral.peakACF(buf, LO, HI).peak;
          const v = spectral.evaluateSpectralEDetector(
            { params, alpha: cfg.alpha, signal: 'h0' }, peak, st);
          return v.verdict === 'fire';
        },
        logM: () => st.log_M,
      };
    },
    // The windowed statistic's own null moments, not the data's.
    calibrate(sample, cfg) {
      const peaks = [];
      for (let i = 0; i + W <= sample.length; i += W) {
        peaks.push(spectral.peakACF(sample.slice(i, i + W), LO, HI).peak);
      }
      const mu = peaks.reduce((a, b) => a + b, 0) / peaks.length;
      const sd = Math.sqrt(peaks.reduce((a, b) => a + (b - mu) ** 2, 0) / peaks.length);
      return { mu, sigma: sd };
    },
  },

  {
    id: 'family_A_betting_e_process',
    family: 'A',
    windowed: false,
    make(cfg) {
      const st = betting.freshBettingState();
      const params = {
        derivation: { mean: cfg.mu, empirical_variance: cfg.sigma ** 2, ar1_phi: cfg.phi ?? 0 },
        min_ticks_before_eligible: 0, min_observation_window: 0,
      };
      return {
        step(x) {
          const v = betting.evaluateBettingEProcess(
            { signal: 'h0', params, state: st, alphaBetting: cfg.alpha,
              ticksSinceDeploy: 999, trafficPct: 100 }, x - cfg.mu);
          return v.verdict === 'fire';
        },
        logM: () => st.log_M ?? Math.log(Math.max(st.M ?? 1, 1e-300)),
      };
    },
  },

  {
    id: 'family_A_mixture_supermartingale',
    family: 'A',
    windowed: false,
    make(cfg) {
      const st = mixture.freshMixtureSupermartingaleState();
      const params = { mixture_distribution: 'gaussian',
        gaussian_sigma_squared_prior: cfg.sigma ** 2, ar1_phi: cfg.phi ?? 0 };
      return {
        step(x) {
          const v = mixture.evaluatePageCusumMixtureSupermartingale({
            x_centered: x - cfg.mu, live_value: x, baseline_mean: cfg.mu,
            sigma_squared: cfg.sigma ** 2, params, state: st, alpha: cfg.alpha,
          });
          return v.fire === true;
        },
        // This detector keeps linear M_t, not ADR-0026 log wealth.
        logM: () => Math.log(Math.max(st.M_t ?? 1, 1e-300)),
      };
    },
  },

  {
    id: 'family_C_safe_hotelling',
    family: 'C',
    windowed: false,
    vector: 2,
    make(cfg) {
      const st = hotelling.freshSafeHotellingState();
      const cell = {
        mean: [cfg.mu, cfg.mu],
        covariance: [[cfg.sigma ** 2, 0], [0, cfg.sigma ** 2]],
        // 0.5*(logdet(S+tau^2 I) - logdet(S)), per ../deploysignal/tools/
        // calibrators/_family-c-build.ts:241. REQUIRED: omitting it makes z_t
        // NaN, and ADR 0026 HOLDS the wealth on a non-finite increment, so the
        // detector reports `clean` forever without erroring. Found 2026-08-01.
        safe_hotelling_params: {
          tau_squared: cfg.sigma ** 2,
          precompiled_log_det_shrink: 0.5 * 2 * Math.log(2),
        },
      };
      return {
        step(xv) {
          const v = hotelling.evaluateSafeHotelling({ cell, alpha: cfg.alpha }, xv, st);
          return v.verdict === 'fire';
        },
        logM: () => st.log_M ?? 0,
      };
    },
  },
];

/** §8.4 — named, with a reason, rather than scored and quietly passed. */
export const OUT_OF_SCOPE = [
  { id: 'safe_t_e_value', reason:
    'Fixed-window terminal e-value, not a sequential wealth process. P1 is a sup-crossing endpoint and is undefined for it. Needs a separate terminal-E[e] study.' },
  { id: 'universal_inference_e_value', reason:
    'Same: fixed split, terminal e-value (engine ADR 0010).' },
  { id: 'sequential_ui_e_process', reason:
    'Has a wealth process, but its interface consumes a whole prefix per tick (O(T^2)); driving it needs a different adapter shape. Deferred, not excluded on principle.' },
  { id: 'family_C_mmd_betting', reason:
    'Requires a compiled baseline pool (baseline_rff_mean or a synthesized P-side pool) that this harness does not build. The non-Gaussian-null cell registered in PREREGISTRATION §3 needs that pool and is deferred with it.' },
  { id: 'family_E_conformal', reason:
    'The default compiler path emits the `unweighted` kind, which has no wealth process. PREREGISTRATION §3 says report that rather than score it. The forced weighted_e_value kind needs a 20k-draw calibration bundle this harness does not build.' },
];

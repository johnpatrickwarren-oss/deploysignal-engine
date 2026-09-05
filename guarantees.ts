// guarantees.ts — the engine's own guarantee table, assembled from code.
//
// WORKLIST C4 (knowledge wiki): DeploySignal's engine/guarantees.ts classifies detectors for ITS
// runtime; the engine repo — the package six consumers pin — carried no equivalent, so a consumer
// had no engine-side answer to "what does this detector guarantee, and under what regime?" This
// table is that answer. Two rules govern it:
//
//   1. ASSEMBLED, NOT ASSERTED. Every axis-2 entry is the live envelope object exported by the
//      detector's own module (never a copy), and every registry detector id maps to exactly one
//      row (test/guarantees.test.ts enforces completeness). A claim with no code object behind it
//      appears as the literal 'unrecorded' — blank means unrecorded, not safe.
//   2. EVIDENCE-DATED. A validity class that changed after measurement carries the measurement and
//      its date, not just the label. Family D is the standing example: reclassified after the
//      2026-08-01 H0 battery (FAR 0.576 at oracle parameters, rolling windows), repaired to
//      disjoint windows (FAR 0.0005), measured NOT an e-process there under finite-K calibration
//      (E[M_T|H0] = 1.0636 at T=300, 1.1076 at T=900, K = 400 windows; exact-moment cells read
//      1.0257 not-refuted / 1.1184 FAIL-marginal — family-d-emean run-20260818T222835Z, C54: a c
//      without its calibration-window count K is under-specified), and priced by the optional
//      c-bound: firing
//      at c/alpha restores FDR <= alpha because E[M/c] <= 1. Absent bound == real, unpriced
//      inflation.
//   3. NAMED IN THE LITERATURE'S TERMS (2026-09-02, WORKLIST C61). Axis 3, `approximateEValue`,
//      states each row as an (epsilon, delta)-approximate e-value in the sense of Ramdas and Wang
//      2025, Definition 10.1: E[E ∧ t] <= 1 + epsilon + delta·t. The (epsilon, 0) case is exactly
//      "E/(1+epsilon) is an e-value", so a priced c-bound is epsilon = c − 1, and Theorem 10.24
//      gives e-BH on such inputs FDR <= alpha·(1+epsilon). The form also says what a plug-in
//      wealth IS: with a per-tick excess kappa/m from an m-sample calibration, E[M_T|H0] grows
//      like exp(kappa·T/m), so epsilon_T is unbounded in T and no constant prices it — only
//      m >> T does, which is the `mMuchGreaterThanN` assertion stated as a theorem condition.
//      knowledge stats/pages/ramdas-wang-2025.md §1.
import { DETECTOR_REGISTRY, type DetectorId } from './types/audit';
import {
  BETTING_E_PROCESS_ENVELOPE,
  MIXTURE_SUPERMARTINGALE_ENVELOPE,
  NUISANCE_ROBUST_BF_ENVELOPE,
  type ValidityEnvelope,
} from './detectors/validity-envelope';
import { SAFE_T_ENVELOPE } from './detectors/safe-t-e-value';
import { UI_MEAN_SHIFT_ENVELOPE } from './detectors/universal-inference-e-value';
import { SEQUENTIAL_UI_ENVELOPE } from './detectors/sequential-ui';
import { CONTRAST_NULL_ENVELOPE } from './per-shard/contrast';

/** Axis 1 — what the repeated-look guarantee is, if any. */
export type ValidityClass =
  | 'ville_anytime_valid'   // nonnegative supermartingale under H0; Ville bounds every look
  | 'bounded_priced'        // NOT an e-process; E[M|H0] violation measured, bounded, and priceable
  | 'classical_epoch'       // classical test per epoch; no anytime guarantee across looks
  | 'exact_finite_sample'   // conformal/randomization exactness per evaluation
  | 'heuristic'             // operational score or rule; no calibration claim
  | 'retracted'             // shipped with a validity claim later measured false
  | 'e_value_terminal';     // a genuine e-value at ONE pre-scheduled look (P(e >= 1/alpha) <= alpha by
                            // Markov; valid at data-dependent alpha, Ramdas–Wang 2025 Prop. 4.4); no
                            // guarantee under repeated looks — it is not an e-process

/** Axis 3 — the (epsilon, delta)-approximate e-value form of the row's statistic under H0
 *  (Ramdas–Wang 2025 Def. 10.1). Every form is a MEASURED or DERIVED statement with its source;
 *  'unrecorded' is the honest blank and does not mean epsilon = 0. */
export type ApproximateEValue =
  /** a genuine e-value in the stated regime (epsilon = delta = 0). */
  | { form: 'e_value'; note: string }
  /** (epsilon, 0) at a MEASURED horizon and calibration size: E/(1+epsilon) is an e-value there,
   *  FDR <= alpha·(1+epsilon) by Theorem 10.24. epsilon grows with the horizon unless stated. */
  | { form: 'epsilon'; epsilon: number; horizon: number; calibration_windows: number | 'exact';
      note: string; source: string }
  /** epsilon unbounded in the horizon: no constant prices it. `law` states the growth. */
  | { form: 'epsilon_growing'; law: string; kappa?: number; source: string }
  /** not an e-value by construction (a p-value, a rule, a classical test): Theorem 10.24 does
   *  not apply and the statistic must not enter an e-value budget as one. */
  | { form: 'not_e_value'; reason: string }
  | { form: 'unrecorded' };

export interface GuaranteeRow {
  /** Registry ids this row covers (prefix-matched against types/audit DETECTOR_REGISTRY). */
  idPrefixes: readonly string[];
  family: 'A' | 'B' | 'C' | 'D' | 'E';
  detector: string;
  implementation: string;
  validityClass: ValidityClass;
  /** Axis 2 — the regime in which E[e|H0] <= 1 holds. 'unrecorded' is the honest blank: no
   *  envelope object exists in code for this detector. It does NOT mean safe. */
  estimatedBaseline: Readonly<ValidityEnvelope> | 'unrecorded';
  /** How fires may count against an alpha budget under this row's class. */
  alphaPolicy:
    | 'ville_spend'                       // alpha spend is what Ville licenses
    | 'priced_spend_requires_c_bound'     // valid spend ONLY with e_value_inflation_bound set
    | 'classical_epoch_alpha'             // per-epoch alpha, no anytime composition
    | 'none';                             // spends no alpha
  /** What established the class: the measurement or decision, dated. */
  evidence: string;
  /** Axis 3 — see ApproximateEValue. */
  approximateEValue: ApproximateEValue;
}

export const GUARANTEE_TABLE: readonly GuaranteeRow[] = Object.freeze([
  {
    idPrefixes: ['mSPRT_', 'page_cusum_'],
    family: 'A',
    detector: 'Gaussian mixture supermartingale (Howard-Ramdas 2021)',
    implementation: 'detectors/family-a-mixture-supermartingale.ts',
    validityClass: 'ville_anytime_valid',
    estimatedBaseline: MIXTURE_SUPERMARTINGALE_ENVELOPE,
    alphaPolicy: 'ville_spend',
    evidence: 'ADR 0004 PR E envelope; plug-in invalidity Tessera ADR 0014 (E[e|H0] -> ~3e9 at n>>m).',
    approximateEValue: {
      form: 'epsilon_growing',
      law: 'E[M_n|H0] under an m-sample plug-in baseline grows without bound in n '
        + '(validity-envelope.ts: ~3e9 at n >> m); the per-tick rate is unmeasured for the '
        + 'mixture (the betting path measures kappa/m). Exact at oracle parameters (H0 battery '
        + 'N1 CLEARED); NaN on right-skewed and 8.5e46 on t3 increments (C23).',
      source: 'Tessera ADR 0014; knowledge stats/validity-premise-chain; detector-audit-sequential-2026-08-05',
    },
  },
  {
    idPrefixes: ['betting_e_process_'],
    family: 'A',
    detector: 'betting e-process (aGRAPA/ONS, Waudby-Smith-Ramdas)',
    implementation: 'detectors/betting-e-process.ts',
    validityClass: 'ville_anytime_valid',
    estimatedBaseline: BETTING_E_PROCESS_ENVELOPE,
    alphaPolicy: 'ville_spend',
    evidence: 'ADR 0004 PR E envelope; plug-in invalidity Tessera ADR 0008 (E[e|H0] -> ~1e8).',
    approximateEValue: {
      form: 'epsilon_growing',
      law: 'per-tick increment excess kappa/m under an m-sample calibration (the GRAPA loop '
        + 'converges on the calibration bias), so epsilon_T = exp(kappa·T/m) − 1: unbounded in T. '
        + 'Measured 1.029 / 1.009 / 1.002 per tick at m = 30 / 100 / 500; martingale exact at '
        + 'oracle parameters (0.9999956).',
      kappa: 0.8445,
      source: 'grapa-stability run-20260819T040000Z (C58); detector-audit-sequential-2026-08-05 (C23)',
    },
  },
  {
    idPrefixes: ['safe_t_e_value_'],
    family: 'A',
    detector: 'safe two-sample t e-value (right-Haar / GROW), terminal read at the end of a canary',
    implementation: 'detectors/safe-t-e-value.ts',
    validityClass: 'e_value_terminal',
    estimatedBaseline: SAFE_T_ENVELOPE,
    alphaPolicy: 'classical_epoch_alpha',
    evidence: 'C64 (d) valid-path power study (deploysignal studies/valid-path-power, run '
      + '2026-09-03T18182Z): with KNOWN phi, 1.0000 detection at the K1 canonical 1.5 sd on the '
      + '100-tick canary (floor 0.50), 0 of 524 null crossings at alpha = 0.05, exactly '
      + 'scale-invariant across the four corpus signals. Registered ship rule routed this '
      + 'construction (knowledge stats/valid-path-power-2026-09-03). Read ONCE per signal at the '
      + 'terminal tick: the e-value is not an e-process, so per-tick peeking is not licensed. '
      + 'Envelope: maxPhiValid 0.95; with an ESTIMATED phi the e-BH-relevant mean needs '
      + 'calibration >= ~100 (file header, ADR 0005).',
    approximateEValue: {
      form: 'e_value',
      note: 'sigma integrated out exactly: E[e|H0] = 1 at every calibration length with known phi '
        + '(APPROXIMATE_E_VALUE_BY_CONSTRUCTION.safe_t_e_value carries the out-of-envelope '
        + 'measurement, mean(e) = 9,710 at estimated phi = 0.9 from 100 samples).',
    },
  },
  {
    idPrefixes: ['contrast_null_'],
    family: 'A',
    detector: 'the contrast null: a mean-shift card on the standardized treatment − control residual of a pair (C81)',
    implementation: 'per-shard/contrast.ts (fitContrast / applyContrast, ported line for line from Tessera tools/contrast.ts)',
    validityClass: 'ville_anytime_valid',
    estimatedBaseline: CONTRAST_NULL_ENVELOPE,
    alphaPolicy: 'ville_spend',
    evidence: 'Study 2026-09-contrast-null (registered 2416bef before any code; run-20260905T061348Z, '
      + '21 cells x 500 replications x 3 variants, 0 exceptions; lockstep against Tessera 139,800 '
      + 'comparisons, 0 mismatches). REFUSED by the registered ship rule: P1 FAILED in 8 of 21 cells, '
      + 'P3 FAILED in 14 of 21, both by the estimated OFFSET of the contrast read against a 2,000-tick '
      + 'horizon (the plug-in n >> m regime), not by the shared component, which cancels exactly '
      + '(73,500 of 73,500 alert ticks identical between the shared-step and null variants). Mixture '
      + 'false alerts on iid pairs 0.34 / 0.18 / 0.03 per 1,000 ticks at fit 60 / 300 / 2000 against a '
      + 'contract of 0.025; the temporal path on the same units with a shared AR(1) component: 0.43 / '
      + '0.33 / 0.23. Nothing is admitted; the envelope records the numbers and the gate admits only '
      + 'under { mMuchGreaterThanN } or { trueBaseline }.',
    approximateEValue: {
      form: 'epsilon_growing',
      law: 'the contrast offset is a median of m fit ticks, so the residual carries a persistent '
        + 'shift of order 1/sqrt(m) in scale units and the mixture wealth grows with the horizon n '
        + 'as under any plug-in mean: epsilon_n is unbounded in n at fixed m; the false-alert rate on '
        + 'iid pairs fell 0.34 -> 0.18 -> 0.03 per 1,000 ticks as m went 60 -> 300 -> 2000 at n = 2000, '
        + 'independent of the fit\'s scale error (0.69 vs 0.65 across the scale split at m = 60).',
      source: 'validation/contrast-null run-20260905T061348Z (C81); knowledge stats/contrast-null-2026-09-05',
    },
  },
  {
    idPrefixes: [
      'kv_saturation', 'hbm_elevation', 'hbm_spill_roll', 'mfu_collapse', 'slowbleed',
      'collective', 'capacity', 'gpu_eff', 'compound_lat', 'tok_econ', 'behavioral',
      'eval_quality_drop', 'refusal_spike', 'output_len_drift', 'tool_call_degradation',
      'quality_warning',
    ],
    family: 'B',
    detector: 'structural signature rules (16)',
    implementation: 'DeploySignal engine/gates/_health-defs.ts (rule bodies; ids here for audit '
      + 'compat). Threshold machinery is THIS package\'s core.ts trend layer — _health-defs.ts '
      + 'imports trendStrength/effectiveThreshold from @johnpatrickwarren-oss/deploysignal-engine/core '
      + 'and sets every rule threshold through it. See HEURISTIC_CORE_GUARANTEE.',
    validityClass: 'heuristic',
    estimatedBaseline: 'unrecorded',
    alphaPolicy: 'none',
    evidence: 'Hand-tuned rules by design; measured against the shipped Ville arms 2026-08-04 '
      + '(deploysignal studies/drift-regime-sweep): no drift regime where a rule detects and the '
      + 'mixture portfolio does not.',
    approximateEValue: { form: 'not_e_value', reason: 'threshold rules; no expectation claim of any kind.' },
  },
  {
    idPrefixes: ['hotelling_t2_joint_vector'],
    family: 'C',
    detector: 'Hotelling T^2, chi-square variant (Wilson-Hilferty threshold)',
    implementation: 'detectors/hotelling.ts',
    validityClass: 'classical_epoch',
    estimatedBaseline: 'unrecorded',
    alphaPolicy: 'classical_epoch_alpha',
    evidence: 'Per-tick chi-square threshold; no wealth process.',
    approximateEValue: { form: 'not_e_value', reason: 'a per-tick p-value test; enters a budget only via a calibrator (Ramdas–Wang 2025 Prop. 2.5, Thm 11.5).' },
  },
  {
    idPrefixes: ['hotelling_t2_safe'],
    family: 'C',
    detector: 'safe-Hotelling (Grunwald GROW safe test)',
    implementation: 'detectors/_hotelling-safe.ts',
    validityClass: 'ville_anytime_valid',
    estimatedBaseline: 'unrecorded',
    alphaPolicy: 'ville_spend',
    evidence: 'Safe-test construction; E[e|H0] = 1 iff compiled parameters are the truth '
      + '(_hotelling-safe.ts:110-112) — axis-2 unrecorded, not established. The SHIPPED '
      + 'threshold is a bootstrap (1−alpha) quantile of max wealth, not 1/alpha '
      + '(sliding_buffer_threshold; median 3.6e76 × 1/alpha over 34,481 compiled cells, '
      + 'knowledge stats/ville-guarantee-is-empirical): a crossing-rate calibration on an '
      + 'unstated class (Ramdas–Wang 2025 Lemma 15.1), which licenses no e-value claim.',
    approximateEValue: { form: 'unrecorded' },
  },
  {
    idPrefixes: ['sequential_mmd_betting_e_process', 'sequential_mmd_e_process'],
    family: 'C',
    detector: 'sequential-MMD betting e-process (Shekhar-Ramdas 2023, Q67 v2 canonical)',
    implementation: 'detectors/family-c-betting-e-process.ts, detectors/sequential-mmd.ts',
    validityClass: 'ville_anytime_valid',
    estimatedBaseline: 'unrecorded',
    alphaPolicy: 'ville_spend',
    evidence: 'Betting construction on RFF witnesses; classical bootstrap-null retired at Q68. '
      + 'Construction premise REFUTED at exact parameters 2026-08-19 (C57): the streaming witness '
      + 'is not conditionally centered; detector retired from DeploySignal compiles (C21), '
      + 'certification REFUSE.',
    approximateEValue: {
      form: 'epsilon_growing',
      law: 'increment estimator 1.001303 / 1.001234 (corr / diag) at EXACT compiled parameters, '
        + 'the lambda·b channel; E[S_900|H0] ≈ 5, i.e. epsilon_900 ≈ 4 and growing with T.',
      source: 'family-c-witness-centering run 2026-08-19 (C57)',
    },
  },
  {
    idPrefixes: ['sequential_mmd'],
    family: 'C',
    detector: 'MMD classical bootstrap-null (retired; id kept for replay compat)',
    implementation: 'removed at Q68',
    validityClass: 'classical_epoch',
    estimatedBaseline: 'unrecorded',
    alphaPolicy: 'none',
    evidence: 'Q68 classical retirement; audit readers may still see the id in v1 replays.',
    approximateEValue: { form: 'not_e_value', reason: 'classical bootstrap-null p-value; removed.' },
  },
  {
    idPrefixes: ['spectral_peak_acf_'],
    family: 'D',
    detector: 'spectral peak-ACF, bootstrap_null variant',
    implementation: 'detectors/spectral.ts',
    validityClass: 'classical_epoch',
    estimatedBaseline: 'unrecorded',
    alphaPolicy: 'classical_epoch_alpha',
    evidence: 'Bootstrap quantile threshold. Known defect: at N bootstraps the threshold cannot '
      + 'resolve alpha_D finer than 1/N (AR(1) path N=500 -> 2e-3); finer alphas book alpha not delivered.',
    approximateEValue: { form: 'not_e_value', reason: 'a bootstrap-quantile p-value test per evaluation; no wealth process.' },
  },
  {
    idPrefixes: ['spectral_e_detector_'],
    family: 'D',
    detector: 'spectral e-detector (Shin-Ramdas-Rinaldo 2022, disjoint windows + priced c-bound)',
    implementation: 'detectors/spectral.ts',
    validityClass: 'bounded_priced',
    estimatedBaseline: 'unrecorded',
    alphaPolicy: 'priced_spend_requires_c_bound',
    evidence: 'H0 battery 2026-08-01: rolling windows FAR 0.576 vs nominal 0.05 at ORACLE '
      + 'parameters (increments share 29/30 samples; martingale-difference fails) -> reclassified '
      + 'heuristic. Disjoint windows (d3d6d06): FAR 0.0005, but E[M_T|H0] = 1.0636 (T=300), '
      + '1.1076 (T=900) at K=400-window calibration — refuted as an e-process under finite-K '
      + 'calibration at every K measured; exact-moment cells 1.0257 not-refuted / 1.1184 '
      + 'FAIL-marginal (family-d-emean run-20260818T222835Z; C54: state K beside T). Violation '
      + 'bounded. Priced c-bound (bb56070): firing at c/alpha restores FDR <= alpha. '
      + 'e_value_inflation_bound ABSENT means unpriced inflation.',
    approximateEValue: {
      form: 'epsilon',
      epsilon: 0.0636,
      horizon: 300,
      calibration_windows: 400,
      note: 'epsilon = c − 1 (Def. 10.1, delta = 0); 0.1076 at T = 900 (K = 400), 0.1184 at T = 900 '
        + 'at exact moments, 1.4934 at K = 100 / T = 900 — grows with T, shrinks with K, so the '
        + 'price is valid only up to the measured horizon at the stated K (SpectralInflationBound '
        + 'carries both, C54). FDR <= alpha·(1+epsilon) by Thm 10.24 when the bound is set.',
      source: 'family-d-emean run-20260818T222835Z (C54/C55)',
    },
  },
  {
    idPrefixes: ['mahalanobis_conformal_baseline'],
    family: 'E',
    detector: 'weighted-conformal Mahalanobis novelty',
    implementation: 'detectors/conformal.ts',
    validityClass: 'exact_finite_sample',
    estimatedBaseline: 'unrecorded',
    alphaPolicy: 'classical_epoch_alpha',
    evidence: 'Exactness is per evaluation and BY ASSUMPTION of the plug-in Gaussian model: the '
      + 'default calibration set is synthesized exact chi_p (no held-out real data — DeploySignal '
      + 'tools/calibrators/family-e.ts). The weighted_e_value variant is Ville-classed '
      + '(conformal.ts) under the same assumption; unweighted/weighted variants are per-tick '
      + 'threshold tests with no wealth process.',
    approximateEValue: {
      form: 'not_e_value',
      reason: 'the shipped kinds (unweighted / weighted) are per-tick conformal p-value tests, and '
        + 'the p is not established super-uniform (parametric-bootstrap calibration, '
        + 'knowledge stats/family-e-budget-ruling); the weighted_e_value kind is unmeasured '
        + '(unrecorded) and unreachable under the default compiler path.',
    },
  },
]);

/** The core.ts heuristic layer, covered explicitly (2026-08-22). core.ts ships a second
 *  statistical layer — TrendBuffer window summaries, trendStrength, effectiveThreshold,
 *  computeVerdict, WARMUP_CONFIG — that is NOT a registry detector, so the table above cannot
 *  reach it and test/guarantees.test.ts's totality check does not cover it. This entry is its
 *  guarantee row: heuristic, spends no alpha, and its constants have no derivation trace.
 *
 *  Constants (all hand-tuned): stable = cv < 0.04 && |slopeNorm| > 0.002 (core.ts:90);
 *  slopeScore = rawSlope/0.05, stabilityBonus 0.2 (linear falloff to cv 0.10), noisePenalty
 *  (cv-0.15)/0.15 capped 0.5 (core.ts:162-165, mirrored in summarizeWindow core.ts:145-149).
 *
 *  Provenance: vendored at pin deploysignal main@5a72371 (2026-05-16), sync policy
 *  vendored-at-pin, DO-NOT-modify-without-ADR (core.ts:1-5). No derivation exists in this repo
 *  or the knowledge wiki (checked 2026-08-21).
 *
 *  Production surface (traced 2026-08-21): the ONLY production caller is DeploySignal
 *  engine/gates/_health-defs.ts, i.e. the Family B structural rules — the row above. The layer
 *  does not modulate any alpha-spending detector. In-repo callers are
 *  test/core-trend-threshold.test.ts and type references only. */
export const HEURISTIC_CORE_GUARANTEE = Object.freeze({
  exports: Object.freeze(
    ['TrendBuffer', 'trendStrength', 'effectiveThreshold', 'computeVerdict', 'WARMUP_CONFIG'] as const,
  ),
  implementation: 'core.ts (vendored from DeploySignal engine/core.ts at main@5a72371, 2026-05-16)',
  validityClass: 'heuristic' as const,
  estimatedBaseline: 'unrecorded' as const,
  alphaPolicy: 'none' as const,
  evidence: 'Hand-tuned constants with no derivation trace; sole production caller is the Family B '
    + 'row (DeploySignal engine/gates/_health-defs.ts). Coverage added 2026-08-22 after external '
    + 'review flagged the layer as outside the guarantee table.',
  approximateEValue: { form: 'not_e_value', reason: 'heuristic trend layer; no expectation claim.' } as const,
});

/** Axis 3 for the constructions in ESTIMATED_BASELINE_GUARANTEES, keyed the same way. These are
 *  the portfolio's genuine e-values inside their envelopes, and the one CONSTANT epsilon on the
 *  record. */
export const APPROXIMATE_E_VALUE_BY_CONSTRUCTION: Readonly<Record<keyof typeof ESTIMATED_BASELINE_GUARANTEES, ApproximateEValue>> = Object.freeze({
  safe_t_e_value: {
    form: 'e_value',
    note: 'right-Haar / GROW: sigma integrated out exactly, an e-value at every calibration length '
      + 'with KNOWN phi; outside the envelope (estimated phi at 0.9 from a 100-sample window) '
      + 'mean(e) = 9,710 — knowledge stats/terminal-evalue-2026-08-02; maxPhiValid 0.95.',
  },
  universal_inference_e_value: {
    form: 'e_value',
    note: 'split LRT, an e-value with no regularity conditions (E[e|H0] ≈ 0.13–0.17: ~6× slack '
      + 'from the fixed split); valid at every phi, inert above maxPhiPowered 0.8.',
  },
  sequential_ui_e_process: {
    form: 'e_value',
    note: 'E[E_tau] <= 1 at every stopping time including near-unit-root (ADR 0025); the free-phi '
      + 'null absorbs small steps (valid and inert against +3 sd on clustersynth).',
  },
  nuisance_robust_bf_e_value: {
    form: 'epsilon',
    epsilon: 0.155,
    horizon: 0,
    calibration_windows: 'exact',
    note: 'RETRACTED: E[BF|H0] = (1+2x)/sqrt((1+x)(1+3x)) ≈ 1.155 at EVERY calibration length — the '
      + 'one constant epsilon in the portfolio (horizon 0 = single-shot). FDR <= 1.155·alpha if '
      + 'used as-is; deprecated for safe-t.',
    source: 'engine ADR 0005; knowledge stats/invalid-nuisance-robust-bf-e-value',
  },
  contrast_null: {
    form: 'epsilon_growing',
    law: 'REFUSED by its registered study: the contrast offset is estimated from m fit ticks and '
      + 'read against the horizon n, so the mixture wealth on the residual grows with n at fixed m '
      + '(0.34 / 0.18 / 0.03 false alerts per 1,000 ticks at m = 60 / 300 / 2000, n = 2000, iid pairs); '
      + 'the shared component cancels exactly. Admit only under mMuchGreaterThanN or trueBaseline.',
    source: 'validation/contrast-null run-20260905T061348Z (C81)',
  },
});

/** Estimated-baseline (axis-2) defaults and the retraction, keyed by construction rather than
 *  registry id — these are inputs a CONSUMER may route to the FDR path, not per-signal detectors. */
export const ESTIMATED_BASELINE_GUARANTEES = Object.freeze({
  safe_t_e_value: SAFE_T_ENVELOPE,
  universal_inference_e_value: UI_MEAN_SHIFT_ENVELOPE,
  sequential_ui_e_process: SEQUENTIAL_UI_ENVELOPE,
  /** RETRACTED 2026-07-02: E[BF|H0] ~= 1.155 at every calibration length. Kept so the retraction
   *  is visible where the guarantee table lives; see the envelope's own file header. */
  nuisance_robust_bf_e_value: NUISANCE_ROBUST_BF_ENVELOPE,
  /** REFUSED 2026-09-05 by study 2026-09-contrast-null (C81): the estimated offset is the plug-in
   *  n >> m price. Kept here so the refusal is visible where the guarantee table lives. */
  contrast_null: CONTRAST_NULL_ENVELOPE,
});

/** The guarantee row for a registry detector id, by prefix match. Returns undefined only for ids
 *  outside DETECTOR_REGISTRY; test/guarantees.test.ts proves totality over the registry. */
export function guaranteeFor(id: DetectorId): GuaranteeRow | undefined {
  // Longest-prefix wins so 'sequential_mmd_betting_e_process' does not fall through to the
  // retired 'sequential_mmd' row.
  let best: GuaranteeRow | undefined;
  let bestLen = -1;
  for (const row of GUARANTEE_TABLE) {
    for (const p of row.idPrefixes) {
      if ((id === p || id.startsWith(p)) && p.length > bestLen) { best = row; bestLen = p.length; }
    }
  }
  return best;
}

/** Machine-readable dump (WS2 shape: generated from code, echoable into audit artifacts).
 *  The core.ts heuristic layer (HEURISTIC_CORE_GUARANTEE) is appended as a trailing entry with
 *  `kind: 'heuristic_core'` — it is not a registry detector, so it carries no idPrefixes/family. */
export function guaranteeManifest(): string {
  const rows = GUARANTEE_TABLE.map((r) => ({
    ...r,
    estimatedBaseline: r.estimatedBaseline === 'unrecorded' ? 'unrecorded' : { ...r.estimatedBaseline },
  }));
  return JSON.stringify(
    [...rows, { kind: 'heuristic_core', ...HEURISTIC_CORE_GUARANTEE }],
    null,
    2,
  );
}

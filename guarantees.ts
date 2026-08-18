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

/** Axis 1 — what the repeated-look guarantee is, if any. */
export type ValidityClass =
  | 'ville_anytime_valid'   // nonnegative supermartingale under H0; Ville bounds every look
  | 'bounded_priced'        // NOT an e-process; E[M|H0] violation measured, bounded, and priceable
  | 'classical_epoch'       // classical test per epoch; no anytime guarantee across looks
  | 'exact_finite_sample'   // conformal/randomization exactness per evaluation
  | 'heuristic'             // operational score or rule; no calibration claim
  | 'retracted';            // shipped with a validity claim later measured false

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
    implementation: 'DeploySignal engine/gates/_health-defs.ts (no engine implementation; ids here for audit compat)',
    validityClass: 'heuristic',
    estimatedBaseline: 'unrecorded',
    alphaPolicy: 'none',
    evidence: 'Hand-tuned rules by design; measured against the shipped Ville arms 2026-08-04 '
      + '(deploysignal studies/drift-regime-sweep): no drift regime where a rule detects and the '
      + 'mixture portfolio does not.',
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
      + '(_hotelling-safe.ts:110-112) — axis-2 unrecorded, not established.',
  },
  {
    idPrefixes: ['sequential_mmd_betting_e_process', 'sequential_mmd_e_process'],
    family: 'C',
    detector: 'sequential-MMD betting e-process (Shekhar-Ramdas 2023, Q67 v2 canonical)',
    implementation: 'detectors/family-c-betting-e-process.ts, detectors/sequential-mmd.ts',
    validityClass: 'ville_anytime_valid',
    estimatedBaseline: 'unrecorded',
    alphaPolicy: 'ville_spend',
    evidence: 'Betting construction on RFF witnesses; classical bootstrap-null retired at Q68.',
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
  },
]);

/** Estimated-baseline (axis-2) defaults and the retraction, keyed by construction rather than
 *  registry id — these are inputs a CONSUMER may route to the FDR path, not per-signal detectors. */
export const ESTIMATED_BASELINE_GUARANTEES = Object.freeze({
  safe_t_e_value: SAFE_T_ENVELOPE,
  universal_inference_e_value: UI_MEAN_SHIFT_ENVELOPE,
  sequential_ui_e_process: SEQUENTIAL_UI_ENVELOPE,
  /** RETRACTED 2026-07-02: E[BF|H0] ~= 1.155 at every calibration length. Kept so the retraction
   *  is visible where the guarantee table lives; see the envelope's own file header. */
  nuisance_robust_bf_e_value: NUISANCE_ROBUST_BF_ENVELOPE,
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

/** Machine-readable dump (WS2 shape: generated from code, echoable into audit artifacts). */
export function guaranteeManifest(): string {
  return JSON.stringify(
    GUARANTEE_TABLE.map((r) => ({
      ...r,
      estimatedBaseline: r.estimatedBaseline === 'unrecorded' ? 'unrecorded' : { ...r.estimatedBaseline },
    })),
    null,
    2,
  );
}

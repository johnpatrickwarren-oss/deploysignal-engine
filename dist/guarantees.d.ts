import { type DetectorId } from './types/audit';
import { type ValidityEnvelope } from './detectors/validity-envelope';
/** Axis 1 — what the repeated-look guarantee is, if any. */
export type ValidityClass = 'ville_anytime_valid' | 'bounded_priced' | 'classical_epoch' | 'exact_finite_sample' | 'heuristic' | 'retracted' | 'e_value_terminal';
/** Axis 3 — the (epsilon, delta)-approximate e-value form of the row's statistic under H0
 *  (Ramdas–Wang 2025 Def. 10.1). Every form is a MEASURED or DERIVED statement with its source;
 *  'unrecorded' is the honest blank and does not mean epsilon = 0. */
export type ApproximateEValue = 
/** a genuine e-value in the stated regime (epsilon = delta = 0). */
{
    form: 'e_value';
    note: string;
}
/** (epsilon, 0) at a MEASURED horizon and calibration size: E/(1+epsilon) is an e-value there,
 *  FDR <= alpha·(1+epsilon) by Theorem 10.24. epsilon grows with the horizon unless stated. */
 | {
    form: 'epsilon';
    epsilon: number;
    horizon: number;
    calibration_windows: number | 'exact';
    note: string;
    source: string;
}
/** epsilon unbounded in the horizon: no constant prices it. `law` states the growth. */
 | {
    form: 'epsilon_growing';
    law: string;
    kappa?: number;
    source: string;
}
/** not an e-value by construction (a p-value, a rule, a classical test): Theorem 10.24 does
 *  not apply and the statistic must not enter an e-value budget as one. */
 | {
    form: 'not_e_value';
    reason: string;
} | {
    form: 'unrecorded';
};
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
    alphaPolicy: 'ville_spend' | 'priced_spend_requires_c_bound' | 'classical_epoch_alpha' | 'none';
    /** What established the class: the measurement or decision, dated. */
    evidence: string;
    /** Axis 3 — see ApproximateEValue. */
    approximateEValue: ApproximateEValue;
}
export declare const GUARANTEE_TABLE: readonly GuaranteeRow[];
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
export declare const HEURISTIC_CORE_GUARANTEE: Readonly<{
    exports: readonly ["TrendBuffer", "trendStrength", "effectiveThreshold", "computeVerdict", "WARMUP_CONFIG"];
    implementation: "core.ts (vendored from DeploySignal engine/core.ts at main@5a72371, 2026-05-16)";
    validityClass: "heuristic";
    estimatedBaseline: "unrecorded";
    alphaPolicy: "none";
    evidence: string;
    approximateEValue: {
        readonly form: "not_e_value";
        readonly reason: "heuristic trend layer; no expectation claim.";
    };
}>;
/** Axis 3 for the constructions in ESTIMATED_BASELINE_GUARANTEES, keyed the same way. These are
 *  the portfolio's genuine e-values inside their envelopes, and the one CONSTANT epsilon on the
 *  record. */
export declare const APPROXIMATE_E_VALUE_BY_CONSTRUCTION: Readonly<Record<keyof typeof ESTIMATED_BASELINE_GUARANTEES, ApproximateEValue>>;
/** Estimated-baseline (axis-2) defaults and the retraction, keyed by construction rather than
 *  registry id — these are inputs a CONSUMER may route to the FDR path, not per-signal detectors. */
export declare const ESTIMATED_BASELINE_GUARANTEES: Readonly<{
    safe_t_e_value: Readonly<{
        baseline: "unknown-mean-integrated";
        autocorrelation: "ar1-whitened";
        null: "mean-shift";
        variance: "stable";
        validUnderEstimatedBaseline: true;
        minCalibration: 3;
        maxPhiValid: 0.95;
        notes: string;
    }>;
    universal_inference_e_value: Readonly<{
        baseline: "unknown-mean-mle";
        autocorrelation: "ar1-any-phi";
        null: "mean-shift";
        variance: "unknown-mle";
        validUnderEstimatedBaseline: true;
        minCalibration: 6;
        maxPhiPowered: 0.8;
        notes: string;
    }>;
    sequential_ui_e_process: Readonly<{
        baseline: "unknown-mean-mle";
        autocorrelation: "ar1-any-phi";
        null: "mean-shift";
        variance: "unknown-mle";
        validUnderEstimatedBaseline: true;
        minCalibration: 3;
        notes: string;
    }>;
    /** RETRACTED 2026-07-02: E[BF|H0] ~= 1.155 at every calibration length. Kept so the retraction
     *  is visible where the guarantee table lives; see the envelope's own file header. */
    nuisance_robust_bf_e_value: Readonly<import("./detectors/nuisance-robust-bf-e-value").NuisanceRobustBFEnvelope>;
}>;
/** The guarantee row for a registry detector id, by prefix match. Returns undefined only for ids
 *  outside DETECTOR_REGISTRY; test/guarantees.test.ts proves totality over the registry. */
export declare function guaranteeFor(id: DetectorId): GuaranteeRow | undefined;
/** Machine-readable dump (WS2 shape: generated from code, echoable into audit artifacts).
 *  The core.ts heuristic layer (HEURISTIC_CORE_GUARANTEE) is appended as a trailing entry with
 *  `kind: 'heuristic_core'` — it is not a registry detector, so it carries no idPrefixes/family. */
export declare function guaranteeManifest(): string;
//# sourceMappingURL=guarantees.d.ts.map
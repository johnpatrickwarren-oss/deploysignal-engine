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
    /** Registry ids this row covers (prefix-matched by detector KIND, types/detector-registry.ts). */
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
    /** REFUSED 2026-09-05 by study 2026-09-contrast-null (C81): the estimated offset is the plug-in
     *  n >> m price. Kept here so the refusal is visible where the guarantee table lives. */
    contrast_null: Readonly<import("./per-shard/contrast").ContrastNullEnvelope>;
    /** ADR 0034: the onset-mixture e-value, gaussian increment (the bounded increment's envelope is
     *  ONSET_MIXTURE_BOUNDED_ENVELOPE, variance-robust; same plug-in centre premise). */
    onset_mixture: Readonly<ValidityEnvelope>;
    /** ADR 0036: the randomized twin — no baseline at all; validity rests on the pairing premise. */
    twin_rate: Readonly<ValidityEnvelope>;
    twin_sign: Readonly<ValidityEnvelope>;
}>;
/** The guarantee row for a detector id, by longest kind-prefix match. Returns undefined only for
 *  an id no registry can build; test/guarantees.test.ts proves totality over DeploySignal's
 *  instance and over a registry built for an arbitrary signal set (ADR 0033). */
export declare function guaranteeFor(id: string): GuaranteeRow | undefined;
/** Machine-readable dump (WS2 shape: generated from code, echoable into audit artifacts). */
export declare function guaranteeManifest(): string;
//# sourceMappingURL=guarantees.d.ts.map
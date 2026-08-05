import { type DetectorId } from './types/audit';
import { type ValidityEnvelope } from './detectors/validity-envelope';
/** Axis 1 — what the repeated-look guarantee is, if any. */
export type ValidityClass = 'ville_anytime_valid' | 'bounded_priced' | 'classical_epoch' | 'exact_finite_sample' | 'heuristic' | 'retracted';
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
}
export declare const GUARANTEE_TABLE: readonly GuaranteeRow[];
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
        notes: string;
    }>;
    universal_inference_e_value: Readonly<{
        baseline: "unknown-mean-mle";
        autocorrelation: "ar1-any-phi";
        null: "mean-shift";
        variance: "unknown-mle";
        validUnderEstimatedBaseline: true;
        minCalibration: 6;
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
/** Machine-readable dump (WS2 shape: generated from code, echoable into audit artifacts). */
export declare function guaranteeManifest(): string;
//# sourceMappingURL=guarantees.d.ts.map
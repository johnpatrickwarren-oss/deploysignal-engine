import { NUISANCE_ROBUST_BF_ENVELOPE } from './nuisance-robust-bf-e-value';
/** How the baseline the e-value tests against is obtained. */
export type BaselineKind = 'true' | 'plug-in' | 'unknown-mean-integrated';
export type AutocorrelationKind = 'iid' | 'ar1-whitened';
export type NullKind = 'mean-shift';
export type VarianceKind = 'stable' | 'robust';
/** The regime in which an e-value detector's E[e|H0] ≤ 1 validity holds. Ships as metadata so the
 *  engine never implies an FDR guarantee outside it (ADR 0004). */
export interface ValidityEnvelope {
    baseline: BaselineKind;
    autocorrelation: AutocorrelationKind;
    null: NullKind;
    variance: VarianceKind;
    /** THE honesty flag. True ⇒ E[e|H0] ≤ 1 holds even when the baseline is ESTIMATED (the nuisance-
     *  robust BF). False ⇒ the e-value is only valid with a TRUE baseline or m≫n (the plug-in betting /
     *  mixture e-values); feeding it to e-BH under an estimated baseline silently breaks FDR control. */
    validUnderEstimatedBaseline: boolean;
    /** Minimum calibration length for the by-construction validity to hold, if the detector has one. */
    minCalibration?: number;
    /** Free-text regime detail (the conditions, the failure mode, the valid-only-when). */
    notes?: string;
}
/** Plug-in betting e-process (`detectors/betting-e-process.ts`). Freezes a point baseline μ̂; under an
 *  estimated baseline E[e|H0] ≫ 1 (Tessera ADR 0008: →1e8). Pre-whitens AR(1) (ADR 0001). Valid ONLY
 *  with a true baseline or m≫n — gate out of the FDR path otherwise; prefer the nuisance-robust BF. */
export declare const BETTING_E_PROCESS_ENVELOPE: Readonly<ValidityEnvelope>;
/** Family-A Gaussian mixture supermartingale (`detectors/family-a-mixture-supermartingale.ts`). Plugs
 *  in the null mean; shares the plug-in invalidity in the under-powered regime (Tessera ADR 0014:
 *  E[e|H0] → ~3e9 at large n). Pre-whitens AR(1) (ADR 0002). Valid only with a true baseline or m≫n. */
export declare const MIXTURE_SUPERMARTINGALE_ENVELOPE: Readonly<ValidityEnvelope>;
/** Re-export the nuisance-robust BF envelope (ADR 0004 PR A) — the VALID-under-estimated-baseline
 *  e-value, the FDR-path default in the estimated-baseline regime. */
export { NUISANCE_ROBUST_BF_ENVELOPE };
/** Assertions a caller can make to admit a plug-in e-value to the FDR path within its validity regime. */
export interface FdrPathAssertions {
    /** The baseline fed to the e-value is the TRUE baseline (no estimation error). */
    trueBaseline?: boolean;
    /** The calibration window vastly exceeds the test horizon (m≫n), where plug-in estimation error is
     *  negligible. */
    mMuchGreaterThanN?: boolean;
}
/** Is an e-value with this envelope admissible to the FDR (e-BH) path? A valid-under-estimated-baseline
 *  e-value (the nuisance-robust BF) always is. A plug-in e-value (betting / mixture) is admissible ONLY
 *  if the caller asserts its validity regime (a true baseline, or m≫n) — otherwise E[e|H0] ≫ 1 and
 *  feeding it to e-BH silently breaks the FDR guarantee (Tessera ADR 0008/0014). */
export declare function isValidForFdrPath(env: ValidityEnvelope, assertions?: FdrPathAssertions): boolean;
/** Throw if an e-value with this envelope would be fed to the FDR path OUTSIDE its validity regime.
 *  Call this at the e-BH boundary so an invalid plug-in e-value cannot silently degrade FDR control. */
export declare function assertValidForFdrPath(env: ValidityEnvelope, assertions?: FdrPathAssertions): void;
//# sourceMappingURL=validity-envelope.d.ts.map
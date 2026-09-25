import { NUISANCE_ROBUST_BF_ENVELOPE } from './nuisance-robust-bf-e-value';
/** How the baseline the e-value tests against is obtained. */
export type BaselineKind = 'true' | 'plug-in' | 'unknown-mean-integrated' | 'unknown-mean-mle';
export type AutocorrelationKind = 'iid' | 'ar1-whitened' | 'ar1-any-phi';
export type NullKind = 'mean-shift';
export type VarianceKind = 'stable' | 'robust' | 'unknown-mle';
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
    /** What the statistic IS. Absent or 'e-value' ⇒ E[e|H0] ≤ 1 is the claim. 'e-detector' ⇒ a
     *  change-detection statistic with E∞[M_t] = t (Shin–Ramdas–Rinaldo 2022) whose guarantee is an
     *  average run length, never an e-value: the FDR path refuses it regardless of any assertion
     *  (ADR 0029, `detectors/e-sr-mean-shift.ts`). */
    statistic?: 'e-value' | 'e-detector';
    /** Minimum calibration length for the by-construction validity to hold, if the detector has one. */
    minCalibration?: number;
    /** Largest AR(1) φ at which E[e|H0] ≤ 1 still holds. Above it the detector is WRONG, not merely
     *  weak, and `assertValidForFdrPath` refuses. Absent ⇒ no measured validity bound in φ.
     *
     *  safe-t: 0.95. Measured exceedance 0.0355 at φ=0.95 and 0.1420 at φ=0.99 against α=0.05
     *  (knowledge/stats/power-per-cell-2026-08-05). */
    maxPhiValid?: number;
    /** Largest AR(1) φ at which the detector retains usable power. Above it it is VALID and INERT —
     *  it stops firing rather than starting to lie — so this does NOT gate the FDR path. It is
     *  reported, because a null battery cannot distinguish an inert detector from a working one
     *  (knowledge/WORKLIST C29).
     *
     *  universal inference: 0.8. Power 0.6270 at φ=0.6, 0.1810 at 0.8, 0.0270 at 0.9, 0.0000 at 0.99.
     *  The decay is smooth, which is an identifiability limit rather than a defect: as φ→1 an AR(1)
     *  null absorbs a sustained mean shift. */
    maxPhiPowered?: number;
    /** ADR 0035 — the SHAPE premise of the per-tick increment, beyond centre, scale and φ. An
     *  increment's E[g|F] ≤ 1 rests on a property of the standardised residual's LAW that whitening
     *  and standardisation do not deliver:
     *    'mgf'            — the Gaussian-LR increment exp(θr − θ²/2) needs E[exp(θr)] ≤ exp(θ²/2) at
     *                       the mixture's θ. A t3 or lognormal residual has no mgf; the shipped cap at
     *                       100 leaves the mean at 1.61 (t3) / 1.91 (lognormal σ 0.75), so E[M_T|H0]
     *                       grows like 1.6^T (h0-battery Amendment A6, inc-20260925T044059Z).
     *    'clip-mean-zero' — the linear bounded bet 1 + λ·clip(r)/3 needs E[clip(r)|F] = 0. Symmetric
     *                       tails give it exactly (A6: 1.0000 at every λ on t3); a SKEWED residual does
     *                       not — clipping the long side removes mass, and the wealths betting against
     *                       the skew carry a per-tick excess (A6: 1.0009 to 1.0083 for λ = −0.1 to
     *                       −0.9 on the lognormal).
     *  An envelope carrying a premise REFUSES unless the caller supplies `incrementMean` — the
     *  engine's increment estimator (fleet/calibration-monitor.ts:incrementEstimate) on a believed-null
     *  feed of this residual with the SAME increment family — whose interval CLEARS the card bound
     *  (upper95 < 1.0005), or asserts the premise as a promise (`lightTails` for 'mgf',
     *  `clipMeanZero` for 'clip-mean-zero') when the interval is inconclusive or absent. A measured
     *  REFUTATION (lower95 > 1.0005) refuses regardless of any promise.
     *  Absent ⇒ the premise is UNRECORDED for this envelope, not absent: the plug-in Gaussian
     *  wealths (betting, mixture supermartingale, contrast) carry the 'mgf' premise structurally and
     *  no increment-mean cell has measured them (knowledge WORKLIST C83). */
    tailPremise?: 'mgf' | 'clip-mean-zero';
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
/** Re-export the nuisance-robust BF envelope (ADR 0004 PR A). ⚠️ CORRECTED (2026-07-02): NO LONGER
 *  valid-under-estimated-baseline — E[BF|H0] ≈ 1.155 at every calibration length (the recentering
 *  breaks the proper-prior property; see that file's header). The FDR-path defaults in the
 *  estimated-baseline regime are safe-t (SAFE_T_ENVELOPE, ADR 0005) and the UI e-value
 *  (UI_MEAN_SHIFT_ENVELOPE, ADR 0010). */
export { NUISANCE_ROBUST_BF_ENVELOPE };
/** Assertions a caller can make to admit a plug-in e-value to the FDR path within its validity regime. */
export interface FdrPathAssertions {
    /** The baseline fed to the e-value is the TRUE baseline (no estimation error). */
    trueBaseline?: boolean;
    /** The calibration window vastly exceeds the test horizon (m≫n), where plug-in estimation error is
     *  negligible. */
    mMuchGreaterThanN?: boolean;
    /** Observed or estimated AR(1) φ of the series this e-value was computed on. Checked against
     *  `maxPhiValid`. Omitting it is NOT treated as φ=0 — an envelope carrying a φ bound refuses when
     *  φ is unknown, because "we did not measure it" is not evidence that it is small. */
    observedPhi?: number;
    /** Explicit acknowledgement that φ was not measured and the caller is proceeding anyway. Same
     *  shape as `trueBaseline` / `mMuchGreaterThanN`: an assertion the caller stands behind, greppable
     *  at every site that makes it, rather than a silent default. Use it only where the regime is
     *  known to be far from a unit root by other means. */
    phiUnmeasuredAccepted?: boolean;
    /** ADR 0035 — the standardised residual is light-tailed enough for the Gaussian-LR increment:
     *  its mgf exists at the mixture's bets (sub-Gaussian, or known by other means). Satisfies an
     *  envelope whose `tailPremise` is 'mgf' when `incrementMean` is absent or inconclusive. A
     *  promise, greppable at the site that makes it; the measurement is `incrementMean`. */
    lightTails?: boolean;
    /** ADR 0035 — the CLIPPED residual is conditionally mean-zero (a symmetric tail gives it; a
     *  skewed tail does not). Satisfies an envelope whose `tailPremise` is 'clip-mean-zero' when
     *  `incrementMean` is absent or inconclusive. */
    clipMeanZero?: boolean;
    /** ADR 0035 — the MEASURED per-tick increment mean on a believed-null feed of this residual, from
     *  the engine's increment estimator (fleet/calibration-monitor.ts:incrementEstimate) run with the
     *  SAME increment family as the e-value (Tessera ADR 0027 coherence): the C26 instrument, the one
     *  h0-battery Amendment A6 used. Scored as A6.2 scores it against the card bound
     *  INCREMENT_MEAN_BOUND: lower95 above it REFUTES the premise and refuses regardless of any promise;
     *  upper95 below it CLEARS it; anything else is inconclusive and falls back to the promise.
     *
     *  Why the Ville monitor's `passing` is NOT accepted here: ∏g drifts at E[log g], which stays
     *  negative under a heavy tail even when E[g] = 1.6 — the monitor with the Gaussian increment
     *  revoked 1.25% of t3 feeds and 4.25% of σ-0.75 lognormal feeds over 2000 ticks at α = 0.01, the
     *  bounded monitor 4% of lognormal feeds at 2000 ticks and 12% at 5000 (test/e-bh-guarded.test.ts,
     *  ADR 0035). That is A5's crossing-rate blindness at the monitor. The estimator sees the mean. */
    incrementMean?: {
        lower95: number;
        upper95: number;
    };
}
/** The card-falsifier bound every certified test-martingale card carries for the increment mean
 *  (validation/certification/lib/constants.mjs, h0-battery A3.4 / A6.2). */
export declare const INCREMENT_MEAN_BOUND = 1.0005;
/** ADR 0035 — does the caller satisfy the envelope's tail premise? An envelope without one is
 *  unconstrained here (UNRECORDED, not safe — see `tailPremise`). A measured refutation wins over a
 *  promise; a measured clearance needs no promise; an inconclusive or absent measurement needs the
 *  promise matching the premise. */
export declare function tailAdmissible(env: ValidityEnvelope, assertions?: FdrPathAssertions): boolean;
/** Is an e-value with this envelope admissible to the FDR (e-BH) path? A valid-under-estimated-baseline
 *  e-value (safe-t, the UI e-value) always is. Anything else — the plug-in betting / mixture e-values,
 *  and since the 2026-07-02 correction the nuisance-robust BF too — is admissible ONLY if the caller
 *  asserts its validity regime (a true baseline, or m≫n) — otherwise E[e|H0] > 1 and feeding it to
 *  e-BH silently breaks the FDR guarantee (Tessera ADR 0008/0014; BF: ≈1.155 at every cal length). */
export declare function isValidForFdrPath(env: ValidityEnvelope, assertions?: FdrPathAssertions): boolean;
/** φ side of the gate, separated so the failure can be reported distinctly from the baseline one.
 *  An envelope with no `maxPhiValid` is unconstrained in φ. One WITH a bound refuses on an unknown
 *  φ: silence is not evidence. */
export declare function phiAdmissible(env: ValidityEnvelope, assertions?: FdrPathAssertions): boolean;
/** Throw if an e-value with this envelope would be fed to the FDR path OUTSIDE its validity regime.
 *  Call this at the e-BH boundary so an invalid plug-in e-value cannot silently degrade FDR control. */
export declare function assertValidForFdrPath(env: ValidityEnvelope, assertions?: FdrPathAssertions): void;
//# sourceMappingURL=validity-envelope.d.ts.map
// detectors/validity-envelope.ts — validity envelopes as first-class, and the FDR-path gate.
//
// ADR 0004 PR E — "the single most important honesty fix." Every e-value detector ships a validity
// ENVELOPE describing the regime in which E[e|H0] ≤ 1 holds, and the engine refuses to imply a
// guarantee outside it. The load-bearing consequence: the plug-in betting / mixture e-values are
// INVALID under an estimated (plug-in) baseline — E[e|H0] ≫ 1 (Tessera ADR 0008/0014: →1e8 plug-in,
// →3e9 mixSM at large n) — so they must NOT be silently fed to e-BH as if valid. They remain useful
// where their regime holds (a TRUE baseline, or m≫n). This module makes that envelope explicit and
// provides the gate that keeps an out-of-envelope e-value out of the FDR path.
//
// The envelopes for the VENDORED detectors (betting-e-process, family-a-mixture-supermartingale) live
// HERE rather than in those files, so the vendored sources stay byte-identical to their upstream
// (SCOPING-MEMO-v0.3 § 9 sync policy). The nuisance-robust BF (ADR 0004 PR A) carries its own envelope
// in its own file (re-exported below) and is retrofitted onto this shared type.

import { NUISANCE_ROBUST_BF_ENVELOPE } from './nuisance-robust-bf-e-value';

/** How the baseline the e-value tests against is obtained. */
export type BaselineKind =
  | 'true'                    // a known, exact baseline (no estimation error)
  | 'plug-in'                 // a point estimate μ̂ frozen from a finite calibration window
  | 'unknown-mean-integrated' // the baseline mean is integrated out under a proper prior (right-Haar)
  | 'unknown-mean-mle';       // the mean is profiled out by an MLE over the null (universal inference)

export type AutocorrelationKind =
  | 'iid'
  | 'ar1-whitened'
  | 'ar1-any-phi';            // valid for any φ without whitening (UI / sequential UI)
//
// 2026-08-05: 'ar1-any-phi' is a claim about VALIDITY only, and for safe-t it was measured FALSE at
// the top of the range — exceedance 0.1420 against α=0.05 at φ=0.99
// (knowledge/stats/power-per-cell-2026-08-05). Two numeric bounds below make the regime explicit
// rather than leaving it to a union member's name.

export type NullKind = 'mean-shift';

export type VarianceKind =
  | 'stable'
  | 'robust'
  | 'unknown-mle';            // σ profiled out rather than plugged in

// 2026-08-02: the last member of each union was absent, so UI_MEAN_SHIFT_ENVELOPE and
// SEQUENTIAL_UI_ENVELOPE could not be passed to isValidForFdrPath at all (TS2345). They escaped
// notice because they are `as const` object literals that were never annotated with this type.
// Every envelope below is now annotated, so the next one that drifts fails at compile time.

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
  /** Free-text regime detail (the conditions, the failure mode, the valid-only-when). */
  notes?: string;
}

/** Plug-in betting e-process (`detectors/betting-e-process.ts`). Freezes a point baseline μ̂; under an
 *  estimated baseline E[e|H0] ≫ 1 (Tessera ADR 0008: →1e8). Pre-whitens AR(1) (ADR 0001). Valid ONLY
 *  with a true baseline or m≫n — gate out of the FDR path otherwise; prefer the nuisance-robust BF. */
export const BETTING_E_PROCESS_ENVELOPE: Readonly<ValidityEnvelope> = Object.freeze({
  baseline: 'plug-in',
  autocorrelation: 'ar1-whitened',
  null: 'mean-shift',
  variance: 'stable',
  validUnderEstimatedBaseline: false,
  notes: 'Plug-in point baseline μ̂; E[e|H0] ≫ 1 under an estimated baseline (Tessera ADR 0008 → ~1e8). '
    + 'Valid only with a TRUE baseline or m≫n. Use detectors/safe-t-e-value.ts (or the UI e-value for '
    + 'any-φ validity) in the estimated-baseline regime.',
});

/** Family-A Gaussian mixture supermartingale (`detectors/family-a-mixture-supermartingale.ts`). Plugs
 *  in the null mean; shares the plug-in invalidity in the under-powered regime (Tessera ADR 0014:
 *  E[e|H0] → ~3e9 at large n). Pre-whitens AR(1) (ADR 0002). Valid only with a true baseline or m≫n. */
export const MIXTURE_SUPERMARTINGALE_ENVELOPE: Readonly<ValidityEnvelope> = Object.freeze({
  baseline: 'plug-in',
  autocorrelation: 'ar1-whitened',
  null: 'mean-shift',
  variance: 'stable',
  validUnderEstimatedBaseline: false,
  notes: 'Plug-in null mean; E[e|H0] ≫ 1 in the under-powered regime n≫m (Tessera ADR 0014 → ~3e9). '
    + 'Valid only with a TRUE baseline or m≫n.',
});

/** Re-export the nuisance-robust BF envelope (ADR 0004 PR A). ⚠️ CORRECTED (2026-07-02): NO LONGER
 *  valid-under-estimated-baseline — E[BF|H0] ≈ 1.155 at every calibration length (the recentering
 *  breaks the proper-prior property; see that file's header). The FDR-path defaults in the
 *  estimated-baseline regime are safe-t (SAFE_T_ENVELOPE, ADR 0005) and the UI e-value
 *  (UI_MEAN_SHIFT_ENVELOPE, ADR 0010). */
export { NUISANCE_ROBUST_BF_ENVELOPE };

// Compile-time guarantee that the BF envelope (defined in its own file) satisfies the shared type.
// (A type-only check; erased at runtime, so no circular import — this module depends on the BF file,
// not vice-versa.)
const _bfEnvelopeSatisfiesShared: ValidityEnvelope = NUISANCE_ROBUST_BF_ENVELOPE;
void _bfEnvelopeSatisfiesShared;

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
}

/** Is an e-value with this envelope admissible to the FDR (e-BH) path? A valid-under-estimated-baseline
 *  e-value (safe-t, the UI e-value) always is. Anything else — the plug-in betting / mixture e-values,
 *  and since the 2026-07-02 correction the nuisance-robust BF too — is admissible ONLY if the caller
 *  asserts its validity regime (a true baseline, or m≫n) — otherwise E[e|H0] > 1 and feeding it to
 *  e-BH silently breaks the FDR guarantee (Tessera ADR 0008/0014; BF: ≈1.155 at every cal length). */
export function isValidForFdrPath(env: ValidityEnvelope, assertions: FdrPathAssertions = {}): boolean {
  return phiAdmissible(env, assertions)
    && (env.validUnderEstimatedBaseline
      || Boolean(assertions.trueBaseline || assertions.mMuchGreaterThanN));
}

/** φ side of the gate, separated so the failure can be reported distinctly from the baseline one.
 *  An envelope with no `maxPhiValid` is unconstrained in φ. One WITH a bound refuses on an unknown
 *  φ: silence is not evidence. */
export function phiAdmissible(env: ValidityEnvelope, assertions: FdrPathAssertions = {}): boolean {
  if (env.maxPhiValid === undefined) return true;
  if (assertions.observedPhi === undefined) return Boolean(assertions.phiUnmeasuredAccepted);
  return Math.abs(assertions.observedPhi) <= env.maxPhiValid;
}

/** Throw if an e-value with this envelope would be fed to the FDR path OUTSIDE its validity regime.
 *  Call this at the e-BH boundary so an invalid plug-in e-value cannot silently degrade FDR control. */
export function assertValidForFdrPath(env: ValidityEnvelope, assertions: FdrPathAssertions = {}): void {
  if (!phiAdmissible(env, assertions)) {
    throw new Error(
      `validity-envelope: this e-value holds only for |φ| ≤ ${env.maxPhiValid}; got `
      + `${assertions.observedPhi === undefined ? 'an UNMEASURED φ' : `φ=${assertions.observedPhi}`}. `
      + 'Above that bound E[e|H0] > 1 and the FDR guarantee does not hold — measured exceedance '
      + '0.1420 against α=0.05 at φ=0.99. Supply { observedPhi } within the bound, assert '
      + '{ phiUnmeasuredAccepted } if the regime is known far from a unit root by other means, or '
      + 'route this regime to a detector whose envelope covers it. None does above 0.95.',
    );
  }
  if (!isValidForFdrPath(env, assertions)) {
    throw new Error(
      `validity-envelope: a '${env.baseline}' e-value is INVALID under an estimated baseline `
      + '(E[e|H0] > 1) and must not enter the FDR path. Assert { trueBaseline } or '
      + '{ mMuchGreaterThanN }, or use the safe-t / universal-inference e-value instead.',
    );
  }
}

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
  | 'unknown-mean-mle'        // the mean is profiled out by an MLE over the null (universal inference)
  | 'randomized-twin';        // no baseline: a concurrent control arm under randomized routing (ADR 0036)

export type AutocorrelationKind =
  | 'iid'
  | 'ar1-whitened'
  | 'ar1-any-phi'             // valid for any φ without whitening (UI / sequential UI)
  | 'shared-cancels';         // any dependence SHARED by both arms cancels by conditioning (ADR 0036);
                              // arm-specific persistence is the pairing premise, not this axis
//
// 2026-08-05: 'ar1-any-phi' is a claim about VALIDITY only, and for safe-t it was measured FALSE at
// the top of the range — exceedance 0.1420 against α=0.05 at φ=0.99
// (knowledge/stats/power-per-cell-2026-08-05). Two numeric bounds below make the regime explicit
// rather than leaving it to a union member's name.

export type NullKind = 'mean-shift' | 'paired-order';

export type VarianceKind =
  | 'stable'
  | 'robust'
  | 'unknown-mle'             // σ profiled out rather than plugged in
  | 'none';                   // the statistic uses no scale (ADR 0036)

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
   *  Absent ⇒ the premise is UNRECORDED for this envelope, not absent. (ADR 0035 first said the
   *  betting e-process carries the 'mgf' premise; it does not — its increment 1 + λ_t·z_t is a
   *  bounded bet, premise 'clip-mean-zero'. Corrected by h0-battery Amendment A7, which measured
   *  both Family-A wealths: betting 1.00000 on symmetric tails and 1.00118 on a σ-0.75 lognormal
   *  where aGRAPA bets against the clipped mean; the mixture divergent on t3 and the lognormal.) */
  tailPremise?: 'mgf' | 'clip-mean-zero';
  /** ADR 0036 — the PAIRING premise of a canary-vs-control statistic. Its null mean is observed
   *  (the traffic share) or fixed (1/2), so nothing is estimated; what validity rests on instead is
   *  the design:
   *    'exchangeable-arms'              — randomized per-request routing with no arm-level effect on
   *                                       any tick. Persistent arm-specific state breaks this at any
   *                                       split (a cold canary fleet, a control pinned to a degraded
   *                                       host); a per-tick arm-level shock (iid, zero-mean,
   *                                       symmetric between arms) cancels exactly at canaryWeight
   *                                       0.5 but not at unequal weights. The rate kind's PROCEED
   *                                       null additionally needs one bad-event probability per arm
   *                                       per tick;
   *    'exchangeable-equal-weight-arms' — the above plus equal routing weights (the sign kind: a
   *                                       skewed tick statistic has different medians in arms of
   *                                       different size).
   *  Only ROLLBACK twin e-values are candidates for the FDR (e-BH) path; PROCEED e-values test a
   *  different null and must not be pooled with them.
   *  An envelope carrying one REFUSES unless the caller asserts `randomizedArms` (and
   *  `equalWeightArms` for the second). */
  pairingPremise?: 'exchangeable-arms' | 'exchangeable-equal-weight-arms';
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
  // h0-battery A7 (inc-20260925T174222Z): the increment 1 + λ_t·z_t, z clipped at ±3σ, is exactly
  // mean-one on every symmetric null (1.00000 ± 0.00005 on N(0,1) and t3) and 1.00118 on a σ-0.75
  // lognormal — aGRAPA learns the clipped mean the skew leaves (E[z] = −0.0092) and bets against it.
  tailPremise: 'clip-mean-zero',
  notes: 'Plug-in point baseline μ̂; E[e|H0] ≫ 1 under an estimated baseline (Tessera ADR 0008 → ~1e8). '
    + 'Valid only with a TRUE baseline or m≫n. Use detectors/safe-t-e-value.ts (or the UI e-value for '
    + 'any-φ validity) in the estimated-baseline regime. Tail premise clip-mean-zero (A7): exact under '
    + 'symmetric tails at oracle parameters (1.00000 on N(0,1) and t3), 1.00118 per tick on a skewed '
    + 'lognormal because the running-moment bet converges on the clipped mean — the gate asks for '
    + '{ clipMeanZero } or { incrementMean }.',
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
  // h0-battery A7 (inc-20260925T174222Z): the Gaussian mixture's per-tick ratio is exact on N(0,1)
  // (1.00002) and DIVERGENT on t3 and the lognormal (pooled means 1e25 and 8e11 at unit scale; the
  // increment has no finite mean there). On an AR(1) null the battery's marginal-σ convention runs it
  // at five times the true residual variance, where it is conservative (0.9983 at φ = 0.9).
  tailPremise: 'mgf',
  notes: 'Plug-in null mean; E[e|H0] ≫ 1 in the under-powered regime n≫m (Tessera ADR 0014 → ~3e9). '
    + 'Valid only with a TRUE baseline or m≫n. Tail premise mgf (A7): a Gaussian mixture on a residual '
    + 'without a moment generating function has an increment with no finite mean — divergent on t3 and '
    + 'on a σ-0.75 lognormal at unit scale — so the gate asks for { lightTails } or { incrementMean }.',
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
  incrementMean?: { lower95: number; upper95: number };
  /** ADR 0036 — canary and control receive requests by randomized per-request routing with no
   *  arm-level effect on any tick: persistent arm-specific state breaks this at any split, and a
   *  per-tick arm-level shock cancels only at canaryWeight 0.5, not at unequal weights. */
  randomizedArms?: boolean;
  /** ADR 0036 — the two arms carry equal routing weight. Needed by the 'sign' twin kind. */
  equalWeightArms?: boolean;
}

/** The card-falsifier bound every certified test-martingale card carries for the increment mean
 *  (validation/certification/lib/constants.mjs, h0-battery A3.4 / A6.2). */
export const INCREMENT_MEAN_BOUND = 1.0005;

/** ADR 0035 — does the caller satisfy the envelope's tail premise? An envelope without one is
 *  unconstrained here (UNRECORDED, not safe — see `tailPremise`). A measured refutation wins over a
 *  promise; a measured clearance needs no promise; an inconclusive or absent measurement needs the
 *  promise matching the premise. */
export function tailAdmissible(env: ValidityEnvelope, assertions: FdrPathAssertions = {}): boolean {
  if (env.tailPremise === undefined) return true;
  const m = assertions.incrementMean;
  if (m !== undefined) {
    if (m.lower95 > INCREMENT_MEAN_BOUND) return false;
    if (m.upper95 < INCREMENT_MEAN_BOUND) return true;
  }
  return env.tailPremise === 'mgf' ? Boolean(assertions.lightTails) : Boolean(assertions.clipMeanZero);
}

/** ADR 0036 — does the caller satisfy the envelope's pairing premise? An envelope without one is
 *  unconstrained here. */
export function pairingAdmissible(env: ValidityEnvelope, assertions: FdrPathAssertions = {}): boolean {
  if (env.pairingPremise === undefined) return true;
  if (!assertions.randomizedArms) return false;
  return env.pairingPremise === 'exchangeable-arms' || Boolean(assertions.equalWeightArms);
}

/** Is an e-value with this envelope admissible to the FDR (e-BH) path? A valid-under-estimated-baseline
 *  e-value (safe-t, the UI e-value) always is. Anything else — the plug-in betting / mixture e-values,
 *  and since the 2026-07-02 correction the nuisance-robust BF too — is admissible ONLY if the caller
 *  asserts its validity regime (a true baseline, or m≫n) — otherwise E[e|H0] > 1 and feeding it to
 *  e-BH silently breaks the FDR guarantee (Tessera ADR 0008/0014; BF: ≈1.155 at every cal length). */
export function isValidForFdrPath(env: ValidityEnvelope, assertions: FdrPathAssertions = {}): boolean {
  if (env.statistic === 'e-detector') return false;
  return phiAdmissible(env, assertions)
    && tailAdmissible(env, assertions)
    && pairingAdmissible(env, assertions)
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
  if (env.statistic === 'e-detector') {
    throw new Error(
      'validity-envelope: an e-DETECTOR statistic (E∞[M_t] = t, an average-run-length guarantee, '
      + 'not E[e|H0] ≤ 1) can never enter the FDR path. No assertion admits it (ADR 0029).',
    );
  }
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
  // The baseline refusal first (the older, more fundamental one), then the tail premise (ADR 0035).
  if (!(env.validUnderEstimatedBaseline || assertions.trueBaseline || assertions.mMuchGreaterThanN)) {
    throw new Error(
      `validity-envelope: a '${env.baseline}' e-value is INVALID under an estimated baseline `
      + '(E[e|H0] > 1) and must not enter the FDR path. Assert { trueBaseline } or '
      + '{ mMuchGreaterThanN }, or use the safe-t / universal-inference e-value instead.',
    );
  }
  if (!tailAdmissible(env, assertions)) {
    const need = env.tailPremise === 'mgf'
      ? 'a residual whose mgf exists at the bets (the Gaussian-LR increment): measured 1.61 on t3 and '
        + '1.91 on a σ-0.75 lognormal, so E[M_T|H0] grows like 1.6^T. Assert { lightTails }'
      : 'a conditionally mean-zero CLIPPED residual (the bounded bet): a skewed tail leaves the '
        + 'wealths betting against the skew at 1.0009-1.0083 per tick. Assert { clipMeanZero }';
    const m = assertions.incrementMean;
    const measured = m === undefined ? 'no increment mean was measured'
      : m.lower95 > INCREMENT_MEAN_BOUND
        ? `the measured increment mean REFUTES it (lower95 ${m.lower95} > ${INCREMENT_MEAN_BOUND}); no promise overrides a measurement`
        : `the measured interval [${m.lower95}, ${m.upper95}] is inconclusive at ${INCREMENT_MEAN_BOUND}`;
    throw new Error(
      `validity-envelope: this increment's E[g|H0] ≤ 1 needs ${need}, or supply { incrementMean } `
      + 'from the family-coherent increment estimator on a believed-null feed of this residual with '
      + `upper95 < ${INCREMENT_MEAN_BOUND} — ${measured} (h0-battery Amendment A6, inc-20260925T044059Z; ADR 0035).`,
    );
  }
  if (!pairingAdmissible(env, assertions)) {
    const need = env.pairingPremise === 'exchangeable-equal-weight-arms'
      ? '{ randomizedArms, equalWeightArms }'
      : '{ randomizedArms }';
    throw new Error(
      `validity-envelope: this twin e-value's null is the design, not an estimate — assert ${need} `
      + 'only where canary and control receive randomized per-request routing'
      + (env.pairingPremise === 'exchangeable-equal-weight-arms' ? ' at equal weights' : '')
      + ' and share everything under H0 but the version under test (ADR 0036).',
    );
  }
}

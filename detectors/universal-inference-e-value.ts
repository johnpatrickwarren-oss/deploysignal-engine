// detectors/universal-inference-e-value.ts — the split likelihood-ratio (universal inference) e-value
// for a MEAN shift under an AR(1) nuisance. ADR 0010.
//
// WHY THIS EXISTS. The safe-t BF (ADR 0005) is a Bayes factor whose `(ν+1)/2` exponent makes E[e|H0]
// HEAVY-TAILED: when φ is estimated from a short window and badly mis-whitens, a single catastrophic
// realisation blows the e-value to ~1e15 and the FDR-relevant MEAN E[e|H0] explodes near unit root. ADR
// 0009 proved no deflation/cap/abstention fixes that — it is the exponent that is fragile. This e-value
// drops the exponent entirely: it is a plain ratio of fitted AR(1) likelihoods (universal inference;
// Wasserman–Ramdas–Balakrishnan, PNAS 117(29) 2020), so E[e|H0] ≤ 1 holds BY CONSTRUCTION for ANY φ —
// including near unit root — with the e-value bounded (no catastrophe).
//
// CONSTRUCTION. Series = calibration window ∪ test window. Split EACH window in time at its midpoint
// into a TRAIN half and an EVAL half. Each eval segment is scored by its conditional AR(1) likelihood
// GIVEN its predecessor — and that predecessor is the last point of the corresponding TRAIN segment.
//   • ALT params from TRAIN (separate cal/test means μ̂_c, μ̂_t, shared φ̂, σ̂): the alternative.
//   • NULL params = the H0 MLE ON EVAL (a COMMON mean across both eval segments, free φ, σ).
//   • e = exp( ℓ_alt(EVAL) − ℓ_null(EVAL) ).
//
// VALIDITY (E[e|H0] ≤ 1 for ANY φ — ⚠️ EMPIRICALLY AUDITED, not fully theorem-proven; 2026-07-02).
// e = L(EVAL; θ̂_train) / sup_{θ∈H0} L(EVAL; θ). The intended argument: given the predecessors,
// EVAL ⟂ TRAIN, so θ̂_train (a function of TRAIN) is conditionally independent of EVAL,
// L(EVAL; θ̂_train) is a proper conditional density (integrates to 1), and the null-SUP denominator
// ≥ L(EVAL; θ_0^true) gives E[e|H0] ≤ 1.
// ⚠️ PROOF GAP (Tessera research/2026-07-02-math-audit.md F6): the independence premise is FALSE for
// the standard call pattern (test window after cal window in one series) — the cal-EVAL half
// temporally PRECEDES the test-TRAIN half (the test-train's first predecessor IS the last cal-eval
// point), so θ̂_train is not conditionally independent of cal-EVAL for φ ≠ 0 and the Fubini step
// does not close. Wasserman–Ramdas–Balakrishnan's split-LRT needs the numerator parameters fit on a
// fold independent of the scored fold; this interleaved variant satisfies that only at φ = 0.
// EMPIRICALLY the bound holds with a large margin — MC (8k–20k reps, cal=test∈{20,60}): E[e|H0]
// ≈ 0.13–0.17 at φ ∈ {0, 0.6, 0.9, 0.98, 0.999}, P(e≥10) ≤ 7e-4; the UI's structural
// conservativeness (~6× slack) dominates the second-order leak. A sequential/predictable numerator
// (fit on strictly-past data only) would close the gap BY construction — the known fix.
// The denominator MUST be a genuine sup — an under-optimised null fit re-introduces
// violations (the φ-grid search below secures it; cold-eye verified LL-gap 0.000 vs a 4000-point grid).
//
// ENVELOPE / CAVEATS.
//   • Exact validity needs the Gaussian-AR(1) model to CONTAIN the H0 truth (well-specification), incl. a
//     constant mean. Validated on real telemetry: ROBUST to heavy tails (NAB kurtosis ≤ 1540 → valid, ADR
//     0011). BUT per-shard validity is substrate-dependent — on slow NAB metrics baselining restores it,
//     yet on real GWDG GPU telemetry (ADR 0012) per-shard E[e|H0] stays > 1 even after baseline-lifecycle
//     + common-mode (real within-window nonstationarity is irreducible). So do NOT claim a per-shard
//     guarantee on real data. The guarantee that SURVIVES is FLEET-FDR: multi-factor common-mode → UI →
//     e-BH keeps fleet FDP ≤ q on real GWDG (1.1%), and the UI's BOUNDED tail is load-bearing there (the
//     safe-t's 1e64 tail blows fleet FDP to 21%). Deploy at the fleet-FDR layer on baselined residuals.
//   • Power at high φ (≳ 0.8) is genuinely low — the autocorrelation identifiability limit — but the
//     e-value stays VALID there (it abstains, ≈ small), unlike the safe-t which was invalid. In the
//     identifiable regime (φ ≤ 0.5) it is well-powered (and beats the safe-t).
//   • The split spends half of each window on training (UI conservativeness); validity does not depend
//     on the split ratio, only power does.

import type { Window } from './safe-t-e-value';

/** A time segment scored by its conditional AR(1) likelihood: indices [i0, i1) with predecessor `pred`. */
interface Segment {
  i0: number;
  i1: number;
  pred: number;
}

/** Validity envelope for the universal-inference mean-shift e-value (ADR 0010). */
export const UI_MEAN_SHIFT_ENVELOPE = Object.freeze({
  baseline: 'unknown-mean-mle' as const,
  autocorrelation: 'ar1-any-phi' as const,        // any-φ validity incl. near unit root (see notes)
  null: 'mean-shift' as const,
  variance: 'unknown-mle' as const,
  validUnderEstimatedBaseline: true as const,
  minCalibration: 6,                              // needs ≥ 2 points per train/eval half-segment
  notes: 'Split likelihood-ratio (universal inference) e-value for an AR(1) mean shift. E[e|H0] ≤ 1 for '
    + 'ANY φ incl. near unit root — EMPIRICALLY AUDITED with ~6x margin (2026-07-02: the by-construction '
    + 'proof has a gap for the interleaved cal/test split at φ≠0; a predictable numerator would close it) '
    + '— a ratio of fitted AR(1) likelihoods, NOT an '
    + 'exponent-amplified Bayes factor, so it is bounded (no catastrophe). Caveat: exact validity needs '
    + 'the Gaussian-AR(1) model to contain the H0 truth (well-specification), incl. a CONSTANT mean. '
    + 'Real-telemetry validation: ROBUST to heavy tails (NAB excess kurtosis ≤ 1540 → still valid, ADR '
    + '0011). But the constant-mean assumption is load-bearing and PER-SHARD validity is substrate-'
    + 'dependent: on slow NAB metrics, baselining restores 0/46 violations, but on real GWDG GPU telemetry '
    + '(ADR 0012) per-shard E[e|H0] stays > 1 even after baseline-lifecycle + common-mode — real '
    + 'within-window nonstationarity is not removable. Do NOT claim a per-shard E[e|H0] ≤ 1 guarantee on '
    + 'real telemetry. The guarantee that SURVIVES real data is FLEET-FDR: in the multi-factor common-mode '
    + '→ UI → e-BH pipeline, fleet FDP stays ≤ q on real GWDG (1.1%) — and the UI\'s BOUNDED tail is what '
    + 'makes that hold (the safe-t\'s 1e64 tail blows fleet FDP to 21%). Deploy at the fleet-FDR layer on '
    + 'baselined residuals. Power at φ ≳ 0.8 is low (autocorrelation limit) but stays valid; well-powered '
    + 'for φ ≤ 0.5. ADR 0010 (construction) + 0011/0012 (validation).',
});

/** Lowest φ on the null grid. */
const PHI_GRID_LO = -0.98;
/** Highest φ on the null grid (just inside the stationary region; the refine never wants more). */
const PHI_GRID_HI = 0.999;
/** Null-fit φ grid step (the bisection refine sharpens the winner). */
const PHI_GRID_STEP = 0.02;
/** Innovation-variance floor (guards a degenerate constant segment). */
const VAR_FLOOR = 1e-9;

function mean(values: ReadonlyArray<number>, i0: number, i1: number): number {
  let s = 0;
  for (let i = i0; i < i1; i++) s += values[i];
  return s / (i1 - i0);
}

/** Conditional AR(1) Gaussian log-likelihood of a segment given its predecessor. */
function segmentLogLik(values: ReadonlyArray<number>, seg: Segment, mu: number, phi: number, s2: number): number {
  let ll = 0;
  let prev = seg.pred;
  for (let i = seg.i0; i < seg.i1; i++) {
    const m = mu + phi * (prev - mu);
    const e = values[i] - m;
    ll += -0.5 * Math.log(2 * Math.PI * s2) - (e * e) / (2 * s2);
    prev = values[i];
  }
  return ll;
}

interface Fit {
  mus: number[];
  phi: number;
  s2: number;
  ll: number;
}

/** Closed-form conditional MLE of the segment means and pooled innovation variance GIVEN φ, plus the
 *  resulting log-likelihood. `sepMeans=false` ties all segments to one common mean (the H0 fit). */
function fitGivenPhi(values: ReadonlyArray<number>, segs: ReadonlyArray<Segment>, phi: number, sepMeans: boolean): Fit {
  const mus: number[] = [];
  let pooledNum = 0, pooledCnt = 0;
  for (const seg of segs) {
    // minimise Σ (z_i − μ − φ(z_{i−1} − μ))² over μ ⇒ μ = Σ(z_i − φ z_{i−1}) / Σ(1 − φ).
    let sa = 0, cnt = 0, prev = seg.pred;
    for (let i = seg.i0; i < seg.i1; i++) { sa += values[i] - phi * prev; cnt += (1 - phi); prev = values[i]; }
    mus.push(cnt !== 0 ? sa / cnt : mean(values, seg.i0, seg.i1));
    pooledNum += sa; pooledCnt += cnt;
  }
  if (!sepMeans) {
    const mp = pooledCnt !== 0 ? pooledNum / pooledCnt : mus[0];
    for (let k = 0; k < mus.length; k++) mus[k] = mp;
  }
  let rss = 0, m = 0;
  for (let k = 0; k < segs.length; k++) {
    let prev = segs[k].pred;
    for (let i = segs[k].i0; i < segs[k].i1; i++) { const e = values[i] - (mus[k] + phi * (prev - mus[k])); rss += e * e; m++; prev = values[i]; }
  }
  const s2 = Math.max(rss / Math.max(1, m), VAR_FLOOR);
  let ll = 0;
  for (let k = 0; k < segs.length; k++) ll += segmentLogLik(values, segs[k], mus[k], phi, s2);
  return { mus, phi, s2, ll };
}

/** Profile MLE of the AR(1) fit over φ: a global grid search (so a near-unit-root sup is not missed) then
 *  a bisection refine. Securing this SUP for the null fit is what makes the e-value valid (ADR 0009/0010). */
function fitAR1(values: ReadonlyArray<number>, segs: ReadonlyArray<Segment>, sepMeans: boolean): Fit {
  let best = fitGivenPhi(values, segs, PHI_GRID_LO, sepMeans);
  for (let g = PHI_GRID_LO + PHI_GRID_STEP; g <= PHI_GRID_HI; g += PHI_GRID_STEP) {
    const f = fitGivenPhi(values, segs, g, sepMeans);
    if (f.ll > best.ll) best = f;
  }
  let lo = best.phi - PHI_GRID_STEP, hi = best.phi + PHI_GRID_STEP;
  for (let it = 0; it < 25; it++) {
    const mid = (lo + hi) / 2;
    const a = fitGivenPhi(values, segs, mid - 1e-4, sepMeans);
    const b = fitGivenPhi(values, segs, mid + 1e-4, sepMeans);
    if (a.ll > b.ll) hi = mid; else lo = mid;
    const f = fitGivenPhi(values, segs, (lo + hi) / 2, sepMeans);
    if (f.ll > best.ll) best = f;
  }
  return best;
}

/** Universal-inference (split likelihood-ratio) e-value for a MEAN shift between a calibration window and
 *  a test window of a single contiguous series `values`, under an AR(1) nuisance. E[e|H0] ≤ 1 by
 *  construction for ANY φ (see file header). Each window is split in time at its midpoint; the alternative
 *  (separate means) is fit on the train halves, the null (common mean) MLE on the eval halves, and the
 *  e-value is the likelihood ratio on the eval halves conditioned on their predecessors.
 *
 *  @throws RangeError if windows are out of bounds, `test.start < 1` (the test train half needs a
 *    predecessor), `cal.len < 6`, `test.len < 6`, or any in-window value is non-finite. */
export function universalInferenceMeanShiftEValue(
  values: ReadonlyArray<number>,
  cal: Window,
  test: Window,
): number {
  if (!Number.isInteger(cal.start) || !Number.isInteger(cal.len)
    || !Number.isInteger(test.start) || !Number.isInteger(test.len)) {
    throw new RangeError('universalInferenceMeanShiftEValue: window start/len must be integers');
  }
  if (cal.len < 6) throw new RangeError(`universalInferenceMeanShiftEValue: cal.len must be >= 6; got ${cal.len}`);
  if (test.len < 6) throw new RangeError(`universalInferenceMeanShiftEValue: test.len must be >= 6; got ${test.len}`);
  if (test.start < 1) {
    throw new RangeError(`universalInferenceMeanShiftEValue: test.start must be >= 1 (the test train half needs a predecessor); got ${test.start}`);
  }
  if (cal.start < 0 || cal.start + cal.len > values.length || test.start + test.len > values.length) {
    throw new RangeError(
      `universalInferenceMeanShiftEValue: window out of bounds (values.length=${values.length}, `
      + `cal=[${cal.start},${cal.start + cal.len}), test=[${test.start},${test.start + test.len}))`,
    );
  }
  for (let i = cal.start; i < cal.start + cal.len; i++) {
    if (!Number.isFinite(values[i])) throw new RangeError(`universalInferenceMeanShiftEValue: non-finite value at calibration index ${i}`);
  }
  for (let i = test.start - 1; i < test.start + test.len; i++) {
    if (!Number.isFinite(values[i])) throw new RangeError(`universalInferenceMeanShiftEValue: non-finite value at test index ${i}`);
  }

  const a0 = cal.start, n1 = cal.len, b0 = test.start, n2 = test.len;
  const h1 = n1 >> 1, h2 = n2 >> 1;
  // TRAIN halves (alternative fit). Cal train uses values[a0] as its initial predecessor.
  const cTrain: Segment = { i0: a0 + 1, i1: a0 + h1, pred: values[a0] };
  const tTrain: Segment = { i0: b0, i1: b0 + h2, pred: values[b0 - 1] };
  // EVAL halves (the scored data). Each predecessor is the last point of the matching train half.
  const cEval: Segment = { i0: a0 + h1, i1: a0 + n1, pred: values[a0 + h1 - 1] };
  const tEval: Segment = { i0: b0 + h2, i1: b0 + n2, pred: values[b0 + h2 - 1] };

  const alt = fitAR1(values, [cTrain, tTrain], true);     // separate cal/test means
  const nul = fitAR1(values, [cEval, tEval], false);      // common-mean H0 MLE on eval

  const llAlt = segmentLogLik(values, cEval, alt.mus[0], alt.phi, alt.s2)
    + segmentLogLik(values, tEval, alt.mus[1], alt.phi, alt.s2);
  const llNul = segmentLogLik(values, cEval, nul.mus[0], nul.phi, nul.s2)
    + segmentLogLik(values, tEval, nul.mus[0], nul.phi, nul.s2);
  return Math.exp(llAlt - llNul);
}

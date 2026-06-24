// fleet/e-bh-conditional-calibration.ts — e-BH-CC: boosting e-BH via conditional calibration.
//
// ADR 0006. A self-contained, by-construction-valid realisation of Lee & Ren, "Boosting e-BH via
// conditional calibration" (arXiv:2404.17562) for the case our engine is in: the per-shard e-values are
// functions of a PIVOTAL statistic (the safe-t / BF of a t-statistic, whose H0 law is nuisance-free), so
// the conditional null of e_j is KNOWN. That collapses the paper's Monte-Carlo machinery (its §3.2.2
// anytime-valid online scheme, which we deliberately do NOT use — it is anti-conservative when the
// conditional null is under-sampled) to a closed-form, exact rule.
//
// THE CONSTRUCTION. e-BH rejects j when e_j ≥ m/(q·|R̂_j|); the boosted e-value is
//   e_j^b := (m/(q·|R̂_j(e)|)) · 1{ ĉ_j·e_j ≥ m/(q·|R̂_j(e)|) },   R̂_j(e) := R(e) ∪ {j}   (Lee-Ren Eq. 5)
// with ĉ_j = sup{c : φ_j(c) ≤ 0}, φ_j(c) = E[ (m/(q·|R̂_j(ẽ)|))·1{c·ẽ_j ≥ m/(q·|R̂_j(ẽ)|)} − ẽ_j ]. j
// fires iff ĉ_j ≥ thrObs/e_j ⟺ φ_j(thrObs/e_j) ≤ 0 ⟺ E[firstTerm(thrObs/e_j)] ≤ E[ẽ_j].
//
// WITH A KNOWN NULL the firing threshold is exactly ẽ* = e_j (for ẽ ≥ e_j the boosted indicator is on and
// thr(ẽ) = m/(q·|R̂_j(ẽ)|) is ≤ thrObs because |R̂_j| is non-decreasing in ẽ; for ẽ < e_j it is off). Hence
//   E[firstTerm(thrObs/e_j)] = ∫_{ẽ ≥ e_j} thr(ẽ) dF(ẽ) ≤ thrObs · P(ẽ_j ≥ e_j | H0).
// So a SUFFICIENT (rigorously valid) firing rule is the closed form
//
//     FIRE j  ⟺  thrObs · P(ẽ_j ≥ e_j | H0) ≤ E[ẽ_j | H0].
//
// VALIDITY (provable, no simulation): firing under this rule ⟹ E[firstTerm] ≤ thrObs·P(ẽ_j≥e_j) ≤ E[ẽ_j],
// i.e. our firing set ⊆ the exact-φ firing set, so e_j^b ≤ e_j^b(exact) pointwise and E[e_j^b|H_j] ≤ 1 by
// Lee-Ren Theorem 1. The rejection set is a DETERMINISTIC SUPERSET of plain e-BH (Lee-Ren Theorem 2): a
// plain rejection has e_j ≥ m/(q·|R|), so by Markov P(ẽ_j≥e_j) ≤ E[ẽ_j]/e_j ≤ q·|R|/m, whence
// thrObs·P(ẽ_j≥e_j) ≤ E[ẽ_j] and j fires. The POWER gain comes from using the EXACT null tail probability
// P(ẽ_j≥e_j) rather than the conservative Markov bound the raw e-value rests on.
//
// CALLER CONTRACT: supply the null SURVIVAL function P(ẽ_j ≥ x | H0) of each per-shard e-value (KNOWN for
// our pivotal e-values: e.g. the safe-t BF is a function of |t|, so P = P(|t_ν| ≥ BF^{-1}(x))), and the
// null mean E[ẽ_j | H0] (= 1 for a proper e-value; the default). If the supplied survival OVER-states the
// true tail (conservative), validity is preserved; an UNDER-stated tail would break FDR — when unsure,
// over-state. There is NO sampling and NO calibration sample size: the rule is exact given the survival.

import { eBenjaminiHochberg, EBenjaminiHochbergOutput } from './e-bh';

/** The null survival function of hypothesis `j`'s e-value: `P(ẽ_j ≥ x | H_j)`. KNOWN in closed form for
 *  our pivotal e-values. Must be a valid (non-increasing in `x`, in [0,1]) survival; over-stating the
 *  tail stays conservative, under-stating it breaks FDR. */
export type NullSurvival = (j: number, x: number) => number;

export interface EBHConditionalCalibrationOptions {
  /** `E[ẽ_j | H_j]` — the null mean of each e-value. A proper e-value has E ≤ 1; default 1. A smaller
   *  (correct) value makes the boost more conservative. */
  nullMean?: number;
}

/** |R̂_j(e with e_j := x)| = |e-BH(·).selected ∪ {j}|. */
function rHatSize(eValues: number[], j: number, x: number, qLevel: number): number {
  const prev = eValues[j];
  eValues[j] = x;
  const sel = eBenjaminiHochberg(eValues, qLevel).selected;
  eValues[j] = prev;
  return sel.includes(j) ? sel.length : sel.length + 1;
}

/** e-BH with conditional-calibration boosting (Lee-Ren), closed-form for a KNOWN per-shard null. Returns
 *  the boosted rejection set: a deterministic SUPERSET of plain `eBenjaminiHochberg(eValues, qLevel)` with
 *  FDR ≤ qLevel preserved under arbitrary dependence. Exact — no Monte-Carlo, no sample-size cliff.
 *
 *  @param eValues       observed per-shard e-values.
 *  @param qLevel        FDR target in (0, 1].
 *  @param nullSurvival  the KNOWN null survival `P(ẽ_j ≥ x | H_j)` of each e-value (see the file header).
 *  @throws Error/RangeError on empty input or bad qLevel (mirrors eBenjaminiHochberg). */
export function eBHConditionalCalibration(
  eValues: ReadonlyArray<number>,
  qLevel: number,
  nullSurvival: NullSurvival,
  opts?: EBHConditionalCalibrationOptions,
): EBenjaminiHochbergOutput {
  const m = eValues.length;
  if (m === 0) throw new Error('eBHConditionalCalibration: empty input array');
  if (!(qLevel > 0 && qLevel <= 1)) throw new RangeError(`eBHConditionalCalibration: qLevel must be in (0,1]; got ${qLevel}`);
  const nullMean = opts?.nullMean ?? 1;
  // A valid e-value has E[ẽ|H0] ≤ 1, so nullMean ∈ (0, 1]. A value > 1 would over-state the budget and
  // break FDR (it is never correct for a proper e-value); reject it rather than trust it (cold-eye).
  if (!(nullMean > 0 && nullMean <= 1)) throw new RangeError(`eBHConditionalCalibration: nullMean must be in (0,1]; got ${nullMean}`);

  const work = eValues.slice(); // scratch for the leave-one-in recomputation
  const boosted = new Array<number>(m);
  for (let j = 0; j < m; j++) {
    const thrObs = m / (qLevel * rHatSize(work, j, eValues[j], qLevel)); // m/(q·|R̂_j(e)|)
    const tail = nullSurvival(j, eValues[j]);                            // P(ẽ_j ≥ e_j | H0)
    if (!(tail >= 0 && tail <= 1)) {
      throw new RangeError(`eBHConditionalCalibration: nullSurvival(${j}, ·) must be in [0,1]; got ${tail}`);
    }
    // FIRE ⟺ thrObs·P(ẽ_j ≥ e_j) ≤ E[ẽ_j]. The boosted value sits exactly at its e-BH threshold m/(q·r);
    // a tiny relative nudge counteracts the float round-trip (k·m/(q·r) rounds below m/q at the boundary,
    // which would otherwise reject nothing). The nudge is ~6 orders above float error, ~7 below any
    // statistical error (E[e^b] rises by 1e-9 ⇒ FDR ≤ q·(1+1e-9)).
    boosted[j] = thrObs * tail <= nullMean ? thrObs * (1 + 1e-9) : 0;
  }
  return eBenjaminiHochberg(boosted, qLevel);
}

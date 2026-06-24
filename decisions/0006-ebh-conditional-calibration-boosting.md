# ADR 0006 — e-BH power: drop threshold-sharpening, adopt conditional-calibration boosting (closed-form)

- **Date:** 2026-06-24
- **Status:** Accepted (read from primary sources; a self-contained, by-construction-valid implementation)
- **Builds on:** ADR 0005 (safe-t e-value; the literature deep-dive). Resolves Thread D (e-BH & betting
  SOTA) of that dive by reading the actual papers, which CORRECTED the summary-level plan.

## Context

The deep-dive summary (ADR 0005) listed two Thread-D power optimizations for the e-BH FDR path: the
Blier-Wong–Wang threshold sharpening and Lee–Ren conditional-calibration boosting. Both touch the FDR
guarantee, so we read the actual theorems before implementing.

## What the papers actually say (the summary was partly wrong)

- **Threshold sharpening — DROPPED.** Blier-Wong–Wang (arXiv:2408.11307) Theorem 2(i) gives the factor-2
  improvement for a single e-value's Type-I control, but **Proposition 5** is a NEGATIVE result for the
  e-BH PROCEDURE: `B^AD = 1` — **no threshold improvement is possible under arbitrary dependence**, which
  is exactly the regime our fleet e-BH relies on (correlated drift). Gains need PRDS / log-concave
  survival (Props 6–7), which the authors call "restrictive… exploration." The summary's "verified ×2/×e"
  conflated the single-e-value bound with the e-BH-under-dependence case. Not applicable to us.
- **Boosting — ADOPTED.** Lee–Ren (arXiv:2404.17562) Theorem 1: boosted e-values are valid e-values given
  the conditional null `e | S_j`; Theorem 2: the boosted e-BH rejection set is a DETERMINISTIC SUPERSET
  under arbitrary dependence. The paper's §3.2.2 Monte-Carlo implementation is **anti-conservative when
  the conditional null is under-sampled** (we measured a sharp FDR cliff: pure-null FDR ≈ 0.40 at 100
  resamples, ≤ 0.03 only at ≥ 400, and the exact online construction is *deferred* to Luo et al. 2022 +
  the anytime-valid CS literature — not specified in the paper itself).

## Decision — a self-contained closed-form realisation (no Monte-Carlo)

Our per-shard e-values are functions of a PIVOTAL statistic (the safe-t / BF of a t-statistic), so the
conditional null of `e_j` is KNOWN. That collapses the paper's MC machinery to an exact rule. The boosted
e-value is `e_j^b = (m/(q·|R̂_j(e)|))·1{ĉ_j·e_j ≥ m/(q·|R̂_j(e)|)}` (Lee-Ren Eq. 5); `j` fires iff
`E[firstTerm(thrObs/e_j)] ≤ E[ẽ_j]`. With a known null the firing threshold is exactly `ẽ* = e_j` (above
it the boosted indicator is on and `thr(ẽ) = m/(q·|R̂_j(ẽ)|) ≤ thrObs` since `|R̂_j|` is non-decreasing in
`ẽ`), so

    E[firstTerm(thrObs/e_j)] = ∫_{ẽ≥e_j} thr(ẽ) dF(ẽ)  ≤  thrObs · P(ẽ_j ≥ e_j | H0),

giving the closed-form rule implemented in `fleet/e-bh-conditional-calibration.ts`:

    FIRE j   ⟺   thrObs · P(ẽ_j ≥ e_j | H0) ≤ E[ẽ_j | H0]   (default E[ẽ_j]=1),   then e_j^b = thrObs.

**Validity (provable, no simulation).** Our firing set ⊆ the exact-φ firing set (the upper bound makes the
condition stricter), so `e_j^b ≤ e_j^b(exact)` pointwise and `E[e_j^b|H_j] ≤ 1` by Lee-Ren Theorem 1 ⇒
e-BH FDR ≤ q under arbitrary dependence. **Superset (Theorem 2):** a plain rejection has `e_j ≥ m/(q|R|)`,
so by Markov `P(ẽ_j≥e_j) ≤ E[ẽ_j]/e_j ≤ q|R|/m`, whence the rule fires. **Power:** the gain comes from
using the EXACT null tail probability `P(ẽ_j≥e_j)` instead of the conservative Markov bound the raw
e-value rests on.

**This is a deliberate, documented deviation from the paper's §3.2.2 MC scheme** — it is exact (no resample
size, no cliff), deterministic, fast (O(m) e-BH calls), and *we can prove it ourselves*, which is more
trustworthy for us than reconstructing a betting confidence-sequence spread across three papers.

**Not novel — a known tactic.** With `E[ẽ_j]=1` the rule is `P(ẽ_j ≥ e_j | H0) ≤ q·|R̂_j|/m`, i.e. the
e-value's EXACT p-value (its null survival) clearing a BH-style threshold. This is the standard
exact-e-to-p calibration: plain e-BH implicitly uses the conservative universal calibrator `1/e` (`e_j ≥
m/(q|R|)` ⟺ `1/e_j ≤ q|R|/m`), and by Markov `P(ẽ≥e) ≤ 1/e`, so the exact survival is uniformly tighter
and recovers the wasted power. We claim no novelty — this is the known-null / pivotal specialisation of
Lee-Ren's conditional calibration. The one property that matters and is NOT shared by naive BH-on-p: the
boosted objects are still valid e-values, so e-BH on them keeps FDR control under ARBITRARY dependence
(BH-on-p needs PRDS / a `log m` penalty). The cold-eye verified this empirically — FDR ≤ q under
equicorrelation up to ρ=0.95.

## Validation (Gaussian-LR e-value with known survival; full suite 181 pass / 0 fail)

- **Superset:** 0 violations (Theorem 2) — confirmed over 5,000 cold-eye trials + 6.7M `|R̂_j|`
  monotonicity checks (the proof's load-bearing step), 0 failures.
- **FDR ≤ q (Theorem 1) — runs AT the budget, never over.** Under heavy independent simulation (m=50,
  up to 100k trials): pure-null FDR ≈ 0.049 / 0.096 / 0.180 at q = 0.05 / 0.1 / 0.2; at m=1 the bound is
  achieved with EQUALITY (FDR = q, confirming no hidden slack). Holds under ARBITRARY dependence
  (equicorrelated ρ up to 0.95 — FDR decreases with ρ). A brute-force integration of the exact-φ rule
  matched the closed form with 0 mismatches. (Do not read FDR as having headroom — it sits at q.)
- **Power:** plain 0.34 → boosted 0.69 (≈ 2.03×) — the full gain, exact, no sample-size dependence.
- **Exact / deterministic:** identical inputs give identical outputs; over-stating the null tail stays
  valid (rejects a subset); with the Markov survival `1/x` it reduces EXACTLY to plain e-BH.

## Caller contract & scope

The caller supplies the KNOWN null survival `P(ẽ_j ≥ x | H0)` of each per-shard e-value (for the safe-t,
a function of `P(|t_ν| ≥ ·)`) and `E[ẽ_j|H0]` (= 1 default). Over-stating the tail is conservative;
under-stating it would break FDR — when unsure, over-state. Wiring the safe-t's exact survival into the
fleet verdict path is a follow-on (the survival requires the Student-t CDF; out of scope here, where the
boosting operator itself is the deliverable).

## Net

Thread D is closed against the real theorems: threshold-sharpening is **out** (Prop 5), boosting is **in**
as a self-contained, provably-valid, full-power operator. With the safe-t (ADR 0005), the genuinely-open
frontier remains: integrating the AR(1) φ out (the calibration floor), multi-factor common-mode, and a
principled robust e-process.

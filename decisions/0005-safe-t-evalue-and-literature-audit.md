# ADR 0005 — close the e-betting gaps: the safe-t e-value, the literature audit, and the open-research boundary

- **Date:** 2026-06-24
- **Status:** Accepted (research-driven; safe-t implemented in this ADR's PR, audits resolved, open items named)
- **Builds on:** ADR 0004 (the nuisance-robust evidence stack, v0.4.0-pre). Driven by a verified deep-dive
  of the 2021–2026 e-value / testing-by-betting / anytime-valid literature (24/25 adversarially-verified
  claims; primary sources cited below).

## Context

ADR 0004 PR A shipped a nuisance-robust two-sample Bayes-factor e-value but with a known weakness: it
plugs in the innovation variance `s²` (which also sets the prior scale `τ²=25s²`), so `E[BF|H0] ≤ 1`
holds only empirically for calibration length ≳ 100 — we hard-gate `cal.len ≥ MIN_CALIBRATION_FOR_VALIDITY
= 100`; below it `E[e|H0]` explodes (~6.7 at cal=50, ~1e252 at cal=5). A literature deep-dive was run to
see whether this and our other punted items are already solved.

## What the literature already solves (and what it does not)

**Thread A — unknown variance (our weakness #1): SOLVED.** The named construction is the **right-Haar /
group-invariance Bayes factor**, a.k.a. the **safe t-test**. For a scale-invariant location-scale model
the **GROW** (growth-rate-optimal) e-statistic equals the likelihood ratio of the *maximal invariant*,
which equals the Bayes factor with the **improper right-Haar prior `1/σ` on the scale under BOTH
hypotheses** and any proper prior on the standardized effect size. It is **GROW-optimal among all
e-statistics**, anytime-valid, with Type-I control **uniform over every σ** (not on-average). Integrating
the variance out — rather than plugging in `s²` — is exactly what fixes our blow-up: the plug-in violates
the scale-invariance the Haar construction exploits.
- Grünwald, de Heide, Koolen, *Safe Testing*, JRSS-B 86(5):1091, 2024 (arXiv:1906.07801) — GRO e-variables
  are Bayes factors with special priors; the one-sample safe t-test is a worked example.
- Pérez-Ortiz, Lardy, de Heide, Grünwald, *Annals of Statistics* 52(4), 2024 (arXiv:2208.07610) — among
  all e-statistics, the LR of the maximal invariant is GROW and equals a right-Haar Bayes factor;
  amenability holds for location-scale families.
- Hendriksen, de Heide, Grünwald, *Bayesian Analysis* 16(3):961, 2021 (arXiv:1807.09077) — `σ` under the
  improper `1/σ` prior under both hypotheses gives a BF robust to optional stopping for *all* `σ>0`.

**Thread D — e-BH & betting SOTA: adoptable.** (i) **Conditional-calibration boosting** (Lee–Ren 2024,
arXiv:2404.17562) turns e-values into boosted e-values whose e-BH rejection set is a deterministic
**superset** at the same level (free power), preserving the arbitrary-dependence FDR — but it needs the
**conditional null tractable**, which a *parametric* safe-t gives and Tukey-centered residuals do not.
(ii) **Improved thresholds** (Blier-Wong–Wang, *Annals*, arXiv:2408.11307): the `1/α` cutoff is sharpenable
by ~2 (unimodal e-density) or ~e (unimodal-symmetric log-e) for small α. (iii) **aGRAPA** is the
asymptotically efficient betting strategy (Wang–Ramdas 2026, arXiv:2605.30485; Waudby-Smith–Ramdas
arXiv:2010.09686) — relevant only if we add a streaming variant. **Refuted (0-3):** Li–Zhang *weighted*
e-BH does **not** retain FDR under arbitrary dependence — the arbitrary-dependence-safe booster is Lee–Ren.

**Thread B — factor-model fleet (our weakness #2): SPLIT.** The combination sub-problem is solved — the
**only admissible merge of arbitrarily-dependent e-values is a weighted arithmetic average**; the product
is valid only under independence/sequentiality (Vovk–Wang 2021 arXiv:1912.06116; Wang 2025
arXiv:2409.19888). Cross-filtration e-*processes* require **adjusters** (Choe–Ramdas, JRSS-B 2026,
arXiv:2402.09698). But the **multi-factor anytime-valid e-value itself is not off-the-shelf**: the
`(r+1)`-th covariance eigenvalue spikes under loading/factor changes (Barigozzi–Trapani, arXiv:1708.02786)
but has no known null distribution and needs randomization — adopt the model, build the wrapper.

**Thread C — principled robust e-process: GENUINELY OPEN.** No confirmed off-the-shelf robust/contaminated
e-process (Huber-contamination safe test, robust-betting e-value with breakdown guarantees) surfaced. The
nearest adjacent result links M-estimation to anytime validity (Wang–Ramdas 2026) but does not deliver a
contamination-robust e-value. Our Tukey-biweight center remains an ad-hoc-but-working robustification.

**Cross-cutting — our terminal-BF instinct is validated.** Holmes–Walker (2026, arXiv:2602.13872) make any
fixed-sample test anytime-valid while preserving the statistic, largely avoiding the ~2N power penalty of
betting/e-process methods.

## Audit of the shipped code (the three correctness checks)

- **#2 — product-vs-average merge: CLEAN.** `fleet/combine.ts` already documents the Vovk–Wang result —
  `combineAverage` is the arbitrary-dependence-safe merge, `combineProduct` is independence-only — and the
  e-BH FDR surface consumes per-shard e-values directly (it does **not** product-combine). No live caller
  passes `combineProduct` (grep-confirmed: the only references are docs). *Enhancement, not a bug:* Wang
  2025 says the admissible merge is a *weighted* average; our uniform `combineAverage` is a valid special
  case — a weighted variant could add power (deferred).
- **#3 — AR(1) whitening preserves location-scale invariance: SOUND.** Under `x → a + b·x`, the estimator
  `computePerSignalAr1Phi` is invariant (its lag-1/variance ratio is location- and scale-invariant), and
  the whitened residual transforms as `r → a(1−φ) + b·r` — a location-scale transform with the *same* scale
  `b`; the common location `a(1−φ)` cancels in the two-sample mean-difference. So the invariance the safe-t
  needs holds — and PR F verified the safe-t is exactly affine-invariant, fixing the `s²` plug-in.
  *Caveat (upgraded by the PR F finding):* `φ` itself remains a plug-in nuisance, and it is **first-order at
  short calibration** (not second-order as ADR 0004 assumed) — it is the actual driver of the calibration
  floor; integrating `φ` out is the primary open item below.
- **#4 — filtration audit: SOUND.** Our e-values are **terminal** (fixed-window), fed to e-BH as marginal
  e-values; the Choe–Ramdas cross-filtration adjuster issue applies to sequential e-*processes*, not to
  terminal e-values + e-BH. In-sample cross-sectional centering keeps each per-shard e-value conservative
  (the O(1/N) self-pull shrinks shard `i`'s residual toward 0; ADR 0004 PR B measured null E[e]≈0.055).
  *Note for the future:* a streaming/e-process fleet variant **would** need an adjuster.

## Decision

1. **PR F (this ADR) — adopt the safe-t e-value, AND a corrected diagnosis of the floor.** Added a
   right-Haar two-sample t-test e-value (`detectors/safe-t-e-value.ts`): the common mean and the variance
   are integrated out (the variance under the improper `1/σ` Haar prior), with a proper prior on the
   standardized effect size, as a closed form in the two-sample t-statistic. **Verified:** the e-value is
   EXACTLY invariant to an affine transform `a + b·x` (the right-Haar property), and with iid/known-φ
   residuals `E[e|H0] ≤ 1` at EVERY calibration length including cal=5 — so the **innovation-variance
   plug-in is genuinely fixed** (the catastrophic ~1e252-at-cal=5 of ADR 0004 PR A is gone).
   - **CORRECTION (the load-bearing finding):** the safe-t does **NOT** remove the calibration floor for
     the e-BH path, and the floor was **misattributed**. With the DEFAULT estimated φ, short-calibration
     `φ̂` mis-whitens the large test window; the t-stat tail fattens and the large-ν exponent amplifies it,
     so `E[e|H0]` (the MEAN, which e-BH FDR needs ≤ 1) still exceeds 1 below cal ≈ 100. (The exceedance is
     heavy-tail-driven so its mean is seed-unstable — it shows STABLY in tail probabilities, P(e≥k) running
     ~10–15× the oracle-φ rate at cal=50; both safe-t and plug-in are ~OK only from cal≈100.) The residual
     floor is the **AR(1) φ plug-in, not the variance.** So we **KEEP `MIN_CALIBRATION_FOR_VALIDITY`** on the plug-in BF
     and gate the safe-t at the math minimum (cal ≥ 3) while documenting that the default-estimated-φ e-BH
     floor is ~100. A caller supplying a known/well-estimated φ is valid at cal ≥ 3.
   - Net: the safe-t is the principled, GROW-optimal variance handling (adopt it), it is dramatically
     better at extreme-small cal (27 vs 1e252 at cal=5) and σ-exact, and it is the tractable-conditional-
     null substrate that PR G's boosting needs. But the headline "remove the floor" did not pan out — the
     floor is the φ nuisance, now precisely located.
2. **PR G — e-BH boosting + sharper threshold (Thread D).** Add Lee–Ren conditional-calibration boosting
   (best paired with the parametric safe-t's tractable conditional null) and the Blier-Wong–Wang threshold
   sharpening if our e-value densities qualify.
3. **Deferred enhancement:** a weighted `combineAverage` (Wang 2025).

## The open-research boundary (NOT solved in the literature)

- **Integrating the AR(1) `φ` nuisance out — now the BINDING constraint on the calibration floor (PR F
  finding).** The location-scale safe-t fixes the variance nuisance but not `φ`; with `φ` estimated from a
  short window the e-BH floor stays ~100. A principled fix is a prior/mixture over `φ` (integrate it out
  like the variance), or a HAC-style effective-sample-size / SE inflation that accounts for residual
  autocorrelation. The literature deep-dive found **no off-the-shelf anytime-valid e-value that integrates
  an AR(1) nuisance out** — this is the sharpest, highest-value open item, and it is what actually gates
  short fresh-calibration epochs (the lifecycle regime).
- **Multi-factor / heterogeneous-loading common-mode (weakness #2):** the `(r+1)`-eigenvalue break-signal
  exists but is not a packaged anytime-valid e-value (no null distribution; needs randomization).
- **A principled robust / contaminated e-process** to replace the ad-hoc Tukey center (with breakdown
  guarantees): no off-the-shelf construction exists.

The variance-nuisance gap (Thread A) now matches the known GROW/right-Haar solution; what remains genuinely
open is the φ nuisance (newly localized as the real floor), the multi-factor common-mode, and a principled
robust e-process.

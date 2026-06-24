# ADR 0007 — open-frontier research findings (φ nuisance, multi-factor common-mode, robust e-process)

- **Date:** 2026-06-24
- **Status:** Research findings (exploratory — prototypes validated empirically; NOT yet productionised). Records
  what advanced, what the working constructions are, and what remains genuinely open, so future work builds
  on the partial wins and avoids the dead-ends.
- **Builds on:** ADR 0005 (safe-t; the φ-floor finding), ADR 0004 PR B (contamination-robust scalar
  common-mode), ADR 0006 (the e-betting deep-dive's three genuinely-open items).

## #1 — integrate the AR(1) φ nuisance out (the real calibration floor) — SUBSTANTIAL PROGRESS

The safe-t (ADR 0005) fixed the variance nuisance but the floor is the φ plug-in: estimated φ from a short
cal window mis-whitens, the t-stat tail fattens, and the large-ν exponent amplifies it, so `E[e|H0] > 1`
below cal ≈ 100. Three constructions tested (synthetic AR(1), E[e|H0] and P(fire) across true φ):

- **Joint Bayesian φ-integration** (mixture/ratio of φ-integrated marginals over a φ-grid): **FAILS** — blows
  up at high φ (E[e]≈3e53 at φ=0.9). The mixture is dominated by the wrong-φ terms, whose near-unit-root
  blow-up overwhelms the H0 φ-posterior weighting. A clean negative result: this natural construction does
  NOT give uniform-over-φ validity.
- **Full-series shift-robust φ̂** (estimate φ from all N within-window-demeaned residuals, not cal-only):
  **operational FP fixed** — `P(fire) ≤ 0.002` at every cal/φ — but the MEAN `E[e]` (what e-BH FDR needs)
  still blows up at high φ + larger cal (the exponent amplifies residual φ-error into a heavy tail).
- **HAC effective-d.o.f. correction** (deflate the effective sample size by the AR(1) mean-variance-inflation
  factor `(1−φ)/(1+φ)`): **UNIFORMLY VALID** — `E[e|H0] ≤ 1` and `P(fire) = 0` at EVERY cal and φ, including
  φ = 0.95 near-unit-root. **The validity floor and the near-unit-root problem are solvable.** Cost: it
  over-corrects power toward zero.

**Synthesis.** A HAC-style correction yields a uniformly-φ-valid e-value — a real advance from "no known
construction." The open sub-problem is the **power/validity calibration**: the simplest HAC factor is too
conservative, and part of the high-φ power loss is **fundamental** (strong autocorrelation → small effective
sample size → a valid test must be low-power; the plug-in only had "power" by being invalid). Next: derive
the least-conservative valid deflation (the validity margin is large, ~10×, so there is room), and route
genuine near-unit-root to the existing self-normalized fallback. Status: validity SOLVED, power calibration
OPEN-but-tractable.

## #2 — multi-factor / heterogeneous-loading common-mode — CLEAN DIRECTIONAL WIN

PR B's scalar common-mode assumes a homogeneous loading (every shard responds to the shared factor with
gain 1). On a **heterogeneous-loading** fleet (gain λ_i ~ U[0.2,1.8]) the scalar center leaks the factor:

- **Scalar common-mode (PR B):** FDP **0.624** (≫ q) — confirms weakness #2 is real.
- **Multi-factor residualisation** (level demean + estimate the loading λ̂_i from the calibration window +
  a per-tick Tukey-robust factor score, project out `λ̂_i·F̂[t]`): FDP **0.147**, power **1.000**.

The multi-factor extension is clearly the right generalisation (FDP 0.62 → 0.15, full power). It does not
yet fully control FDP ≤ q (0.147 vs 0.10) — residual from estimating the loadings/factor scores — but that
is a refinement (better robust factor estimation, possibly r > 1, account for loading-estimation error),
not a dead-end. Status: APPROACH VALIDATED, refinement to FDP ≤ q is engineering; closest to productionising.
(Barigozzi–Trapani's (r+1)-eigenvalue spike is the companion signal for *choosing* r / detecting factor
changes; not needed for the residualisation itself.)

## #3 — principled robust / contaminated e-process — LEAST PROGRESS, STILL OPEN

PR B's Tukey-biweight center is ad-hoc (no e-value / breakdown guarantee). A principled **median-of-means**
center (9 blocks; provable ~½-of-blocks breakdown) was tested vs Tukey and the plain median:

- 10% faults: Tukey **0.021**, plain median **0.014**, **MoM 0.101** (worse).

MoM is WORSE — averaging within blocks amplifies fault contamination before the median, lowering breakdown.
This reconfirms PR B: the demean + a plain robust center (median) is already near-optimal among simple robust
centers; fancier ones do not help. A genuinely **principled robust e-VALUE** (with breakdown guarantees,
beyond an ad-hoc robust center) remains unsolved — MoM doesn't deliver it and the deep-dive (ADR 0006 Thread
C) found no off-the-shelf construction. Status: OPEN; the existing Tukey/median center is the pragmatic best.

## Recommendation

- **#2** is the most ready to productionise — finish the robust factor estimation to bring FDP ≤ q, then a
  `fleet/multi-factor-common-mode.ts` PR generalising PR B. High value (closes weakness #2).
- **#1** — derive the least-conservative valid HAC deflation (validity is in hand; recover power), pair with
  the near-unit-root fallback. The highest-value floor item.
- **#3** — remains genuine open research; keep the existing median/Tukey center; revisit if a robust-betting /
  breakdown-guaranteed e-value appears in the literature.

Prototypes for all three are validated in the session scratchpad; none are engine code yet.

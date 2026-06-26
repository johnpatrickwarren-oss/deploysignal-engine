# ADR 0014 — automatic factor-rank selection for multi-factor common-mode

- **Date:** 2026-06-25
- **Status:** **Proposed — v2 (scoping, estimator revised after cold-eye + empirical verification).** v1's
  recommended rank-counting rule (parallel analysis on *independently*-deflated robust energy) was cold-eyed
  and **broke** — it systematically *under*-selected (the FDR-unsafe side) on the true-r≥2 fleets it exists
  to serve. v2 replaces it with a **sequential common-deflation-path null**, which was then *empirically
  verified* to eliminate the under-selection and bias all residual error onto the FDR-safe (over-selection)
  side. The surrounding design (asymmetry tiebreak, calibration-window selection, r̂=0 fallback) was
  cold-eye-confirmed sound. A confirmatory cold-eye on v2 (chiefly the over-selection power cost) is advisable
  before implementation, but the core estimator is now verified, not asserted. No engine code yet.
- **Builds on:** ADR 0008 (`fleet/multi-factor-common-mode.ts` — the operator whose `factors` this selects),
  ADR 0012 (the empirical fleet-FDR this protects), ADR 0013 (the negative result that re-pointed effort
  *here*: making residual inflation homogeneous is the legitimate route to fleet-FDR, not per-shard
  recalibration).
- **Frontier item:** engine work item 2. Feeds item 3 (structured/hierarchical FDR).

## Problem

`multiFactorRobustResiduals(X, calLen, {factors: r})` removes `r` common-mode factors before the per-shard
e-value + e-BH. ADR 0008's FDP ≤ q guarantee is **conditional on `r` matching the true factor rank**, and the
only aid today is `factorDeflationEnergy` — a scree the *operator eyeballs for an elbow*. That is
operator-dependent, unauditable, and at Tessera's target scale (10²–10⁵ shards, real heterogeneous loadings:
cooling zone, power rail, network fabric, batch job) the rank is unknown and will be mis-set. The failure is
**asymmetric and the dangerous side is silent**:

- **`r` too small (under-select)** → residual factor leakage → **FDP inflates (measured 0.25 at true r=2,
  fit r=1; 0.62 with no factor model)** → the fleet-FDR guarantee BREAKS. *FDR-unsafe.*
- **`r` too large (over-select)** → extra factors fit and remove the fault structure → **power silently
  collapses to ~0**. *FDR-safe but blind.*

So a fixed default (`r=1`) is a latent FDR violation on any fleet with >1 real factor, and naive
over-selection trades the violation for undetectable faults. **The selector's job is not just "pick r" — it
must exploit this asymmetry and surface when the choice is power-compromised.**

## The asymmetry is the design (recommendation)

Because under-selection is *unsafe* and over-selection is merely *weak*, the selector should:

1. Estimate the rank with a tuning-free, robust, self-calibrating rule (below);
2. **break ties and ambiguity toward the LARGER `r`** — never round down into the FDR-unsafe regime;
3. emit a **rank-ambiguity / reduced-power diagnostic** when the spectrum has no clean gap (the fleet is
   "factor-ambiguous"), so the operator knows detection power is uncertain *rather than* trusting a silent
   collapse. This is the validity-envelope / self-diagnosis theme (item 5), here as a first-class output.

This keeps ADR 0008's honest register: auto-rank does **not** add a new guarantee. It makes the existing
*"FDP ≤ q conditional on r = true rank"* condition **self-determined and checkable** instead of an operator
guess, and refuses to fail silently on the unsafe side.

## Options considered

- **Eigenvalue-ratio (Ahn–Horenstein 2013):** `r̂ = argmax_k μ_k/μ_{k+1}`. Tuning-free, designed for
  approximate factor models. But it reads the *classical* sample-covariance eigenvalues — inconsistent with
  the engine's **robust** (Tukey) factor fit, and not robust to the contamination ADR 0008 is built for.
- **Bai–Ng IC / Onatski ED:** classical, penalty- or threshold-tuned, Gaussian-leaning. Same robustness
  mismatch; more knobs.
- **Parallel analysis (Horn) on INDEPENDENTLY-deflated robust energy — v1, BROKEN.** Compute
  `factorDeflationEnergy` on the real data and on a circular-shift null; keep factor `k` iff real energy
  exceeds the null's 95th percentile. *Cold-eyed and rejected:* factor `k`'s real energy (measured after
  deflating k−1 **real** factors) is not comparable to the null's factor `k` (measured after deflating k−1
  **null** factors). The dominant first factor's shadow plus near-unit-root coherence inflating the null band
  for k≥2 crush the real weak second factor below threshold → **systematic under-selection (19/20 on true-r=2
  at the 95th-pctile null, 18/20 even at a median null)** — the FDR-unsafe direction. Not a quantile-tuning
  issue; structurally wrong. Eigenvalue-ratio on the same sequence is also out (the robust energy sequence is
  **non-monotone** in the noise floor, so `argmax` of the ratio is unstable).
- **Sequential common-deflation-path null — RECOMMENDED (v2, empirically verified).** Fix the comparability
  flaw: at step `k`, deflate the real first k−1 factors to get the current residual `D_{k-1}`, then test
  whether one more **real** factor on `D_{k-1}` removes more energy than one factor on a **circular-shifted
  copy of the same `D_{k-1}`** (B draws → 95th-pctile band). Accept and advance the path iff it clears the
  band; else stop. Real and null now run down the *same* deflation path, so they are comparable. Still robust
  (`fitOneFactor`), self-calibrating, and reuses the existing machinery.

## Verified error profile (v2, vs the broken v1)

Faithful reimplementation of `fitOneFactor`/`robustSlope`/`robustLocation`; 20 seeded ADR-0008-model fleets
(n=40, t=180, cal=120, heterogeneous loadings U[0.2,1.8], near-unit-root drift factors, AR(1) idiosyncratic):

| true r | v1 (broken) r̂ | v2 (sequential) r̂ |
|---|---|---|
| 0 | `{0:20}` | `{0:19, 1:1}` |
| 1 | `{1:20}` | `{1:14, 2:5, 5:1}` |
| **2** | **`{1:20}` (always unsafe)** | **`{2:12, 3:8}` (never under)** |
| 3 | `{1:18, 2:2}` | `{3:10, 4:8, 5:2}` |
| 2, weak f₂ (0.6×) | `{1:20}` | `{2:15, 3:4, 4:1}` |
| 2, near-unit-root idio (φ=0.9) | `{1:20}` | `{1:1, 2:7, 3:1, 4:6, 5:5}` |

**Reading:** v2 eliminates the systematic under-selection; essentially all residual error is **over**-selection
(FDR-safe per ADR 0008 / cold-eye attack #1, costs only power). The exceptions are 1/20 at r=0 (harmless —
removes a spurious factor where scalar would do) and 1/20 under at φ=0.9 idiosyncratic (the genuinely-hard
near-unit-root regime → the ambiguity flag's job). **Verified, not asserted** (`rank-fix-test.mjs`).

**The cost is real:** the over-selection bias means a power tax that grows with true rank (true-r=3 exact only
~50%) and is heavy under near-unit-root idiosyncratic noise (r̂ variance 1–5). This is the v2→implementation
cold-eye's main target, and the reason the ambiguity flag is not optional.

## Design sketch

A new export, roughly:

```
selectFactorRank(X, calLen, { maxFactors, nNull?, quantile?, subsample? })
  → { rank: number, energies: number[], nullBand: number[], ambiguous: boolean }
```

with these load-bearing choices (each a cold-eye target):

1. **Select on the CALIBRATION window only.** The rank must be estimated where H0 holds. Estimating on the
   full series lets a coherent *fault* masquerade as a factor (the exact coherence pathology ADR 0013 named)
   → over-selection that absorbs the fault. Use `X[:, 0:calLen]`; apply the chosen `r` to the full-series
   residual fit as today.
2. **Autocorrelation-preserving null.** A plain i.i.d. time-permutation null compares against a *white* null,
   but real residuals are AR(1) (ADR 0001/0002) — that would over-detect. The null must **preserve each
   shard's marginal temporal structure while destroying cross-shard phase alignment** — a per-shard
   independent **circular time-shift** (or stationary block bootstrap). This isolates *cross-sectional* common
   structure from per-shard autocorrelation. (If this null is wrong, the rank is wrong → the single most
   important thing for the cold-eye to break.)
3. **Over-selection tiebreak + ambiguity flag** as above (`ambiguous = true` when the top real energy is
   within the null band, i.e. no factor clearly clears chance, or when eigenvalue-ratio and parallel analysis
   disagree).
4. **Scale.** Rank is a low-dimensional property; at N=10⁵ estimate it on a random **subsample of shards**
   (a few ×10³) — `subsample` — and bound the added variance. The B null draws × robust IRLS is the cost
   driver; subsampling + a modest B (e.g. 50) keeps it tractable. `log()` the subsample size (no silent caps).

Wiring: keep the explicit `factors: number` path unchanged (no breaking callers); add a `factors: 'auto'`
convenience that calls `selectFactorRank`, and surface `{rank, ambiguous}` through `fleet/guarantee.ts` /
the validity envelope so the verdict records *which* rank was used and whether it was ambiguous.

## Failure modes (for the cold-eye to hammer)

1. **Null correctness (dominant).** Does the circular-shift null actually hold the AR(1) marginal while
   killing the factor? Construct a no-factor AR(1) fleet → selector must return `r̂ = 0` (and `r=0` must be a
   legal, handled outcome: it means "scalar/no common-mode" — note `multiFactorRobustResiduals` currently
   requires `factors ≥ 1`, so `r̂=0` needs a defined fallback, e.g. route to the scalar `contaminationRobustResiduals`).
2. **Fault contamination of the rank.** Even on the calibration window, a fault that begins *in* calibration,
   or a near-stationary degradation, can inflate apparent rank. Quantify the contamination fraction at which
   `r̂` over-counts, and confirm the over-selection tiebreak keeps it FDR-safe (not power-dead).
3. **The asymmetry claim itself.** ADR 0008 asserts over-selection is FDR-safe (only power collapses).
   *Verify* it — construct true-r=1 data, fit r=3, confirm FDP stays ≤ q (only power drops). If over-selection
   can *also* inflate FDP in some regime, the "round up when unsafe" rule is wrong and must change.
4. **Subsample stability** at large N: does `r̂` from a 2k-shard subsample match the full-fleet `r̂`?
5. **Weak / closely-spaced factors:** two factors of similar energy → does the rule resolve them or merge?
   (Merging → under-select → unsafe. Bias toward splitting.)

## Validation plan

- **Known-rank synthetic** (true r ∈ {0,1,2,3}, heterogeneous loadings, SNR sweep, fault fraction sweep):
  `r̂` recovery rate; **FDP(auto-r) ≈ FDP(oracle-r) ≤ q**, and auto-r beats both fixed `r=1` (under → FDP↑)
  and fixed large `r` (over → power→0). Confirm the over-selection-is-safe asymmetry (#3) explicitly.
- **Fault-contamination robustness:** calibration-window selection vs (wrong) full-series selection.
- **Scale/cost:** `r̂` accuracy and runtime vs N (10³→10⁵) with subsampling; report what subsampling drops.
- **Real GWDG re-run** (`scratchpad/gwdg-fleet-full.mjs`): does auto-r pick the operator's manual scree rank?
  Does fleet-FDP stabilize across metrics (the heterogeneity ADR 0012 didn't fully control)?
- **FAIR-scale (dependency):** needs the realistic clustersynth substrate with *multiple real factors*
  (cooling/power/network/batch) and labeled minority faults — built separately. Synthetic + GWDG do not block.

## Scope & sequencing

- **In:** `selectFactorRank` (parallel-analysis-on-robust-energy + eigenvalue-ratio cross-check, calibration
  window, autocorr-preserving null, over-selection tiebreak, ambiguity flag, subsample), the `factors:'auto'`
  wiring, `r̂=0`→scalar fallback, and verdict surfacing. One PR, gated on its own cold-eye.
- **Out:** time-varying / regime-changing rank (Barigozzi–Trapani — explicitly out of scope per ADR 0008),
  and *per-group* rank (different ranks per rack/pod) — that is **item 3** (structured FDR over the topology),
  which should consume this fleet-level selector as its per-group primitive.

## Carry-forward

- This is the legitimate version of what ADR 0013 tried to fake: homogeneous residual inflation (correct
  rank) cancels in the e-BH ranking, which is what actually protects fleet-FDR. Auto-rank makes that condition
  hold without an operator guess; it does not make the fleet guarantee a *theorem* (still needs the open
  per-shard-valid-under-nonstationarity e-value).
- If real fleets are persistently "factor-ambiguous" (no clean gap), the honest output is the diagnostic flag
  + the over-selection-safe rank — i.e. FDR preserved, power explicitly reported as uncertain.

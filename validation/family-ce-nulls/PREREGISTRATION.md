# Pre-registration — Family C MMD betting e-process and Family E weighted-e-value under H₀

**Registered 2026-08-03, engine `v0.6.6-pre`, before any run of `harness/run.mjs`.**
Nothing below was written after seeing a result, with one disclosed exception recorded in §9.

---

## 1. Why this study exists

`validation/h0-battery/harness/detectors.mjs` scores four detectors and names five it does not.
Two of the five are named for the same reason:

- `family_C_mmd_betting` — "Requires a compiled baseline pool … that this harness does not build.
  The non-Gaussian-null cell registered in PREREGISTRATION §3 needs that pool and is deferred with
  it."
- `family_E_conformal` — "The forced weighted_e_value kind needs a 20k-draw calibration bundle this
  harness does not build."

Both detectors self-gate on compiled fields. `evaluateFamilyCBettingEProcess` returns `null` unless
the cell carries `betting_e_process_params`; `evaluateFamilyE` routes to the weighted-e-value
evaluator only when `ConformalParams.kind === 'weighted_e_value'`. Neither can be driven from the
h0-battery's `{ mu, sigma, phi, alpha }` synthetic config. This study builds the bundles with the
shipped calibrators and measures the two detectors under H₀.

## 2. What is measured, and against what

The detectors under measurement are this repo's `dist/detectors/family-c-betting-e-process.js` and
`dist/detectors/conformal.js` at the run's `git_sha`. The calibrators are the shipped ones,
`../deploysignal/tools/calibrators/_family-c-build.js#buildFamilyCPerCell` and
`../deploysignal/tools/calibrators/family-e.js#buildFamilyEPerCell`, called directly — not
reimplemented.

Those calibrator modules import `generateBaselinePool`, `baselinePoolSeed` and the RFF feature map
out of `deploysignal/node_modules/@johnpatrickwarren-oss/deploysignal-engine`. `bundle.mjs#verifyProvenance`
byte-compares that copy against this repo's `dist/detectors/` for the five shared modules on every
run and throws if they differ. If it ever throws, the calibration-time P-side pool and the
runtime-regenerated one are no longer the same object and the measurement is void.

**No detector is modified.** Δ log M is read off `state.log_S_t` (Family C) and `state.M`
(Family E) immediately before and after each evaluator call. That is exact and requires no
instrumentation inside the detector.

## 3. Two facts about reachability, registered before the run because they bear on how the
result reads

**(a) The `auto` compiler path does not produce the Family C MMD detector on a clean baseline.**
`chooseCovarianceMethod` picks `mcd` at p=11, n≥200. The REPLY-50 D6b low-variance auto-skip then
demotes a baseline with LW shrinkage λ < 0.1 and outlier fraction < 5% back to Ledoit-Wolf. The D7
gate in `buildFamilyCPerCell` stamps `mmd_params` only when the method is `mcd` or `mrcd`, and
`stampEMmdAndBettingParams` returns early with `betting_e_process_params = null` when `mmd_params`
is absent. So on a well-behaved synthetic baseline the detector is not compiled at all. This study
sets `covariance_method_override: 'mcd'` to bring it into existence. Every Family C number here is
therefore conditional on an operator having overridden the covariance method.

**(b) The `auto` path cannot reach `weighted_e_value` either.** With span ≥ 7 the calibrator
proposes `halflife = min(span/2, 14)`, so `λ·span = 2·log 2 = 1.3863` for every span ≤ 28 and grows
beyond it. `expectedESSUnderUniformAge` at `λs = 1.3863` returns `0.86558·M`, against
`FAMILY_E_ESS_THRESHOLD = 0.9`; larger `λs` returns less. The gate therefore fails at every span,
and only `force_weighted_e_value` emits the kind. `harness/bundle.mjs#essGateProfile` recomputes
this from the shipped constants and the result is written into every run manifest.

**(c) What the Family E calibrator does with the covariance.** `buildFamilyEPerCell` computes
`choleskyLocal(famC.covariance)` as a positive-definiteness guard, returns `null` if it fails, and
then never uses `L`. Scores are drawn as `√Σᵢ wᵢ²`, `w ~ N(0,I)` — an exact χ_p sample, independent
of the cell. Weights come from `ageDays = rng()·span`: synthetic ages, drawn independently of the
scores they weight. Consequence registered in advance: two cells with different covariances but the
same cell key produce byte-identical calibration bundles. The harness asserts nothing about this;
it is stated so that a null result on the Gaussian arm is not read as evidence the Cholesky is
being used.

## 4. The nulls

Every arm is a null. Baseline history and live traffic are drawn from the **same** law, so nothing
changes at any tick and every fire is a false alarm.

The generative model is stated on the Family C relative-deviation vector
`r_i = (x_i − μ_i)/μ_i`, p = 11 signals in `FAMILY_C_SIGNALS` order, emitted as raw rows
`x_i = μ_i(1 + r_i)`. `r = L·u` with `L L^T = Σ`.

| id | `u` law | Σ | role |
|---|---|---|---|
| `HC-gauss-corr` | N(0,1) | ρ^\|i−j\|, ρ=0.3, sd 0.05 | control |
| `HC-mix-corr` | mixture | same Σ, same mean | treatment |
| `HC-gauss-diag` | N(0,1) | diagonal, sd 0.05 | control |
| `HC-mix-diag` | mixture | diagonal | treatment — every marginal exactly bimodal |

The mixture is `½N(−a, s²) + ½N(+a, s²)` with `a = 0.9`, `s² = 1 − a²`, so mean 0 and variance 1 —
**identical first two moments to the Gaussian it is paired with, differing only in shape.**
Ashman's D = 4.13 (D > 2 is the usual clean-separation line); excess kurtosis −1.31. That is exactly
the case `sequential-mmd.ts` names in its own header — "bimodality emergence, variance inflation
without mean-shift" — and exactly the shape `z = L·w, w ~ N(0,I)` cannot represent.

On the correlated arms the Cholesky rotation mixes coordinates, which can wash bimodality out of
later marginals. `nulls.mjs#shapeDiagnostics` records per-coordinate sample excess kurtosis for all
four arms into the manifest so the reader can see how much survives. The diagonal arm exists so
there is one cell where the claim "visibly bimodal" needs no argument.

## 5. Design

N = 2000 trajectories × T = 300 ticks per arm, matching the h0-battery. Trajectories are split
across **10 independently compiled bundles** (200 each), each from its own 600-row baseline drawn
from the arm's law, so the reported rates average over compile-time randomness — Σ̂ estimation
error, the 500-point P-side pool realisation, and the 20,000-draw calibration sample — rather than
conditioning on one lucky compile.

α is scored at 0.05 and 0.01 and reported descriptively at the shipped 1e-4, the h0-battery's
convention. For Family C, α sets only the threshold `1/α` and does not touch the wealth recursion,
so one run scores every α from the trajectory's max `log_S_t`. For Family E, α enters the dynamics
(`e_t = 1 + 1{tail} − α`, cutoff `α·total_weight`), so each α is a separate pass over the same data.

## 6. Endpoints

**Primary — the increment estimator.** Per tick record `Δ log M`; the estimand is
`E[exp(Δ log M)]`. Per trajectory take the mean over its ticks; across the N trajectories report
the mean, sd, se, a two-sided 95% CI and a one-sided 95% lower bound. Clustering at the trajectory
keeps within-trajectory dependence out of the standard error.

> **A detector is REFUTED as a supermartingale iff the one-sided 95% lower bound on
> `E[exp(Δ log M)]` exceeds 1.**

`E[M_T]` is heavy-tailed and its sample mean is unstable — the same cell measured 0.72 and 1.17 at
N=4000 under different seeds on 2026-08-03. `exp(Δ log M)` is local and does not compound, so its
mean is far better behaved. `E[M_T]` is reported alongside, at the same N, precisely so the
difference between the two estimators is visible rather than argued.

**Secondary — the crossing rate.** Fraction of trajectories with `sup_t M_t ≥ 1/α`. Wilson
one-sided 95% lower bound; P1 fails iff that bound exceeds α. Same convention as the h0-battery.

**Reported, scored by nothing:** per-block increment means over ticks [0,10), [10,50), [50,150),
[150,300) — the ONS bet starts at λ₀ = 0, so the first factor is exactly 1 and a pooled mean is
diluted by the warm-up; the worst single tick index by one-sided lower bound; the Family E
indicator rate; and per-bundle calibration metadata.

**Vacuous-pass guard (P2).** A quiet control must not pass by being inert. Family C is given a ×2
variance inflation at tick 100 with no mean shift — the shape it exists to catch. Family E is given
a +3σ per-coordinate mean shift at tick 100. Detection within the trajectory at α = 0.05, threshold
0.50, N = 500.

## 7. Registered predictions

Numbered so a wrong one is findable later. **P-C2, P-C3 and P-E2 are the ones I expect to fail.**

- **P-C1.** Family C on both mixture arms is **REFUTED**: one-sided lower bound on
  `E[exp(Δ log M)]` above 1. Mechanism: the RFF witness is
  `F_t = φ(x_t)·(μ_P^φ − μ_Q^φ)`, and `μ_P^φ` is the mean embedding of a Gaussian pool while
  `μ_Q^φ` converges to the mean embedding of the true (bimodal) law. Their difference is a fixed
  nonzero vector, so `E[F_t]` is a nonzero constant the ONS bettor can find the sign of. Expected
  magnitude 1.005 to 1.05.
- **P-C2.** Family C **false-alarms on a healthy non-Gaussian null**: crossing rate ≥ 0.50 at
  α = 0.05 on `HC-mix-diag`, and ≥ 0.20 at α = 0.01. At the shipped α = 1e-4 (log threshold 9.21)
  I predict **below 0.10**, and I have low confidence in that last figure.
- **P-C3.** Family C on the **Gaussian controls** crosses at or below nominal (P1 not-refuted at
  both scored α) but the increment estimator still comes out **above 1**, possibly refuted at
  N = 2000. Mechanism: `μ_P^φ` is a 500-point Monte Carlo mean under `N(0, Σ̂)` while the live law is
  `N(0, Σ_true)`, so `E[F_t]` is small but not zero even when the null family is right. If the
  control is refuted too, the mixture arms measure a *bigger* violation, not the only one — and the
  correct reading is that the reference pool is the problem in both cases.
- **P-E1.** Family E's increment estimator equals `1 + P(indicator) − α` exactly, so this endpoint
  reduces to whether the weighted tail cutoff fires at rate α.
- **P-E2.** `P(indicator) > α` on the **Gaussian** arms, so Family E is refuted there. Mechanism:
  calibration scores are exact χ_p, but the live score is `√(rᵀΣ̂⁻¹r)` with Σ̂ the MCD estimate from
  600 rows. Trimming and estimation error make the live score stochastically larger than χ_p. This
  is the prediction I am least sure of — the direction depends on MCD's consistency correction, and
  if the correction is right the effect could go either way or vanish.
- **P-E3.** `P(indicator) < α` on the **mixture** arms, so Family E is *conservative* exactly where
  Family C fails. Mechanism: Family E reads only the radius. With Σ matched, `s² = ‖u‖²` where the
  `uᵢ` are iid standardised mixture draws, and `Var(uᵢ²) = 2 + excess kurtosis = 0.688` against 2
  for a Gaussian. Lighter radial tail ⇒ the upper-α tail is hit less often.
- **P-E4.** Family E's `HC-*-corr` and `HC-*-diag` results agree to within noise at the same `u`
  law, because `s² = ‖u‖²` regardless of Σ and the calibration bundle does not depend on Σ at all.
- **P2 guard.** Both detectors detect at ≥ 0.50. If Family C misses a ×2 variance inflation, its
  quiet Gaussian control is uninformative and the whole Family C reading is downgraded.

## 8. What this study does not establish

Restated from `../h0-battery/PREREGISTRATION.md §2` because it is the part most likely to be lost in
citation.

- **It does not show either detector is an e-process.** A surviving cell is "not refuted at these
  nulls". Simulation cannot establish `E[e|H₀] ≤ 1`.
- **Every null is synthetic**, and the baseline is synthetic too. Real per-shard telemetry is not
  represented.
- **The Family C result is conditional on `covariance_method_override: 'mcd'`** — see §3(a).
- **The Family E result is conditional on `force_weighted_e_value`** — see §3(b).
- The increment estimator averages conditional means over ticks. Exceeding 1 refutes the
  supermartingale property; not exceeding 1 does not prove it holds at every tick. The per-tick
  profile and the worst tick are reported for that reason.

## 9. Disclosure

While wiring the adapter on 2026-08-03, before this document was written, a single unreplicated
pilot trajectory was run at T = 300 on each of a Gaussian and a bimodal baseline. It produced
`log S_T = 0.039` and `log S_T = 5.10` respectively. That observation informed the direction and
the magnitude range stated in P-C1 and P-C2; it is disclosed here rather than presented as an
independent prediction. Nothing was observed for Family E beyond `M_T = (1 − 1e-4)³⁰⁰`, which is
the arithmetic consequence of the indicator never firing at α = 1e-4 over 300 ticks and carries no
information about the scored α.

A mechanical smoke test of `harness/run.mjs` at N = 8, T = 30 may be run after this file is
committed, to check that it does not crash. Its numbers are not usable at that N and will not be
reported.

## 10. Run discipline

`--mode live` writes under `results/live/`; `--mode sim` writes under `results/sim/`. There is no
flag that places a sim run under `results/live/`. A run directory is never reused. The manifest
stamps the engine version, both repos' git SHAs, the node version, the seed, the ESS-gate
recomputation, the mixture constants, the per-arm shape diagnostics, and the provenance check.

---

## 11. Addendum, registered 2026-08-03 after the main run — the attribution arm

**Written after seeing `run-20260804T054546Z` and registered before the arm it describes is run.**
The main run refuted Family C on the Gaussian controls as well as the mixture arms, which P-C3
allowed for. That makes one attribution question worth answering, and it does not change any
endpoint above.

The Gaussian-arm violation has two candidate causes, and they have different consequences:

1. **Σ̂ estimation error** — the P-side pool is drawn from `N(0, Σ̂)` with Σ̂ the MCD estimate from
   600 baseline rows, while the live law is `N(0, Σ_true)`. This shrinks with baseline size and is
   an operator-side problem: compile on more history.
2. **The 500-point pool itself** — `μ_P^φ` is a Monte Carlo mean over
   `BASELINE_POOL_SIZE = 500` draws, so it misses `E[φ]` by `O(1/√500)` no matter how good Σ̂ is.
   `BASELINE_POOL_SIZE` is a module constant in `sequential-mmd.ts` and
   `FAMILY_C_BETTING_BASELINE_POOL_SIZE` in the calibrator. This does not shrink with more history
   and is not operator-reachable.

**Arm.** `HC-gauss-corr` and `HC-gauss-diag` recompiled at `--baseline-n 10000`, everything else
identical, N = 2000 × T = 300. At n = 10,000 the Σ̂ error is ~4× smaller in sd than at n = 600.

**Registered prediction (A1).** The violation **persists at substantially the same magnitude** —
`E[exp(Δ log M)]` stays within ±0.002 of the n=600 figure and its one-sided lower bound stays above
1. That would attribute it to cause 2, the fixed 500-point pool, and mean the Gaussian-arm result
is a property of the detector rather than of my baseline size.

**What would refute A1.** `E[exp(Δ log M)]` falling to within noise of 1. That would attribute the
Gaussian-arm result to cause 1, make it a calibration-sample-size problem rather than a detector
problem, and leave the mixture arms as the only detector-level finding.

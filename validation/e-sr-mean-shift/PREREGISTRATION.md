# Pre-registration — the e-SR mean-shift detector's ARL and delay against the shipped detectors (`2026-09-e-sr-delay`)

- **Study id:** `2026-09-e-sr-delay`
- **Register:** `knowledge/WORKLIST.md` C66 (design) and the build item that succeeds it;
  design page `knowledge/stats/pages/e-sr-mean-shift-design.md`.
- **Discipline:** `knowledge/methodology/pre-registration-discipline`;
  `knowledge/methodology/harness-discipline`; protocol Amendment v1.C66 (the two endpoints
  this study measures carry no verdict authority for any existing card).
- **Status: REGISTERED, NOT RUN.** The system under study, `detectors/e-sr-mean-shift.ts`, does
  not exist at this commit. This file is committed before it so that no endpoint, band or
  grid below can be chosen after a number is seen. The build commit must not edit this file;
  a change is an amendment, appended and dated.

## 1. The system, from the design page

Per tick, on the standardized AR(1)-whitened residual `r_t`:
`L_t(λ) = exp(λ r_t − λ²/2)`; `M_t(λ) = L_t(λ)(M_{t−1}(λ) + 1)`, `M_0(λ) = 0`;
`M_t = (1/16) Σ_λ M_t(λ)` over `Λ = ±{0.25·12^{k/7} : k = 0..7}`; alarm at the first `t` with
`M_t ≥ 1/α_ARL`. Companion CUSUM recursion per λ for the onset estimate (not scored here).
Claim: `E∞[N*] ≥ 1/α_ARL` for every conditionally mean-zero sub-Gaussian(1) pre-change law
(SRR Thm 2.4, Prop. 2.3, Def. 2.9).

## 2. Common design

- Substrates: the h0-battery's `NULLS` + `N8_COMBINED` and its `DETECTORS` adapters, imported
  unchanged, plus an adapter for the new module in the same `make(cfg) → {step, logM}` shape.
  Trajectory construction and injection: `validation/arl-delay/harness/run.mjs` (copied
  verbatim; the comparators run on the **same seeds and draws** as the e-SR in every cell).
- `α_ARL ∈ {10⁻², 10⁻³}`; the comparators (Family A betting, Family A mixture) run at the same
  numeric α as their per-run α, which is the only way to put one threshold `1/α` on both. The
  shipped `α = 10⁻⁴` is run as descriptive for all three.
- `N = 2,000` per cell; seeds `20260904 + 7919·i + SALT[arm]`, `SALT = {H1: 0, H2: 1_000_003,
  H3: 2_000_003, H4: 3_000_003, H5: 4_000_003}`.
- Every hypothesis below is HELD/FAILED on its own bar; reported quantities are labelled.

## 3. Hypotheses

**H1 — ARL at oracle parameters (validity).** Nulls N1, N3-p03, N3-p06, N3-p09 (oracle μ, σ,
φ; the sub-Gaussian cells). `T = 20/α_ARL` (2,000 and 20,000). Endpoint `arl0_T` (T-censored,
as `validation/arl-delay/PREREGISTRATION.md` §1). **HELD iff `arl0_T ≥ 1/α_ARL` in all 8
cells.** Registered prediction: HELD, with `arl0_T ∈ [1/α_ARL, 3/α_ARL]` (the `log(1/α)`
threshold is conservative, SRR §5). Reported beside it: `p_alarm_T`, and the same on N5, N6
(outside the sub-Gaussian class; no claim).

**H2 — delay does not grow with the onset (the design's reason to exist).** N1, K1 step
`+1.5σ`, `α_ARL = 10⁻³`, onsets `ν ∈ {200, 1,000, 2,000}`, `T = ν + 800`. Endpoint: the
conditional mean delay `E_ν[N* − ν | N* > ν]`, censored at 800, for the e-SR and for the two
Family A comparators on identical trajectories. **HELD iff both:** (a) e-SR at `ν = 2,000` ≤
1.5 × e-SR at `ν = 200`; (b) e-SR at `ν = 2,000` ≤ 0.5 × Family A mixture at `ν = 2,000`.
Registered predictions from the constructions: e-SR ≈ 10–15 ticks at every ν (Thm 4.3 bound
13); the mixture's single-onset statistic needs `(S_ν + 1.5k)² ≥ 2(ν + k)(log(1/α) + ½ log(ν + k))`,
i.e. `k ≈ 138` at `ν = 2,000` against `k ≈ 34` at `ν = 200` at `α = 10⁻³`
(`knowledge/stats/arl-delay-2026-09-03` measured the ν = 200 cell at α = 0.05 before this
registration). The betting e-process is reported; no closed form.

**H3 — delay at canonical against the source's bound.** N1, `ν = 200`, `α_ARL = 10⁻³`,
`δ ∈ {0.75σ, 1.5σ, 3σ}`, `T = 1,000`. **HELD iff** the e-SR's conditional mean delay is at or
below the Theorem 4.3 bound the harness computes from the registered grid
(`g_α/D + V/D² + 1` with `g_α = inf_η [η log(1/α) + log(1 + log_η 144)]`, `D = δ²/2`,
`V = δ²`; ≈ 49 / 13 / 4) in all three cells. A FAIL means the implementation is not the
construction the bound is proved for.

**H4 — the estimation price (reported, two registered inequalities).** N2-m30, N2-m100,
N2-m500 at `α_ARL = 10⁻³`, `T = 20,000`. Reported `arl0_T`. **Registered:** (a) `arl0_T`
monotone non-decreasing in m; (b) `arl0_T` at m = 30 < `1/α_ARL` (the ARL claim does not
survive a 30-draw baseline — the Family A pattern in run-length units). HELD/FAILED on (a)–(b).

**H5 — structural: the statistic is the SR sum and not an e-value (harness gate).** N1 at
oracle parameters, `T = 1,000`, no threshold: the trajectory mean of `M_1000` lies in
`[0.8·1000, 1.2·1000]` (`E∞[M_t] = t` exactly for a martingale increment). A FAIL is an
implementation defect and a harness stop. This is also the number that must appear in the
module's header beside "never enters e-BH".

## 4. Ship rule (registered before the build)

- H1, H2, H3, H5 HELD → the module is wired as a **non-budget-participating** detector on the
  change-point surface (alarm tick, onset estimate, `M_t`), with an ADR, a claim card of class
  `e_detector`, and `assertValidForFdrPath` rejecting it by name. The card's S2/S3 floors are a
  further protocol amendment, not this study.
- H1 FAILED → nothing ships; the module stays exported with the refutation in its header; the
  design page records the number and flips to `contested`.
- H2 FAILED → the design's reason to exist is refuted; module exported, unwired; the design
  page's reversal clause fires.
- H3 FAILED with H1/H2 HELD → the implementation is fixed test-first against the bound, this
  file amended, and the study re-run in full.
- H4 is reported whatever it reads; (a)/(b) FAILED is filed, not acted on.

## 5. Stop conditions and boundary

- Non-finite `M_t` in any cell: stop, record, fix test-first (log-domain accumulation is the
  registered implementation; overflow is a defect).
- The study is T1 (house synthetic nulls). It says nothing about real traces; falsifier 2 of
  `knowledge/methodology/threshold-free-observability` needs a T3 run this study does not
  supply.
- No Lorden/Pollak worst-case delay; three onsets, one post-change law per cell.
- The comparators' numbers at `α_ARL` are not their certified operating point; they are here so
  one threshold is compared on identical draws, and are labelled counterfactual per protocol
  S0 field 4.

## 6. Outputs

`validation/e-sr-mean-shift/results/live/run-<UTC>/`: `manifest.json`, `h1.json` … `h5.json`,
`REPORT.md` rendered by an `analysis/report.mjs` and pinned by `analysis/check_report.mjs`
(the `arl-delay` pattern). Cells carry `detector_id`, never `detector` (Amendment v1.C66,
C66.4).

## Amendment A1 — 2026-09-03, before any run: H5's instrument was not measurable as registered

H5 registered "the trajectory mean of `M_1000` lies in `[800, 1200]`". Writing the module's unit
test showed that instrument cannot read the quantity it names: for `λ = 3` a 150-tick product of
increments has log-sd `3·sqrt(150) ≈ 37`, and the sample mean of 3,000 such trajectories read
**64 against an expectation of 150** — the terminal-mean trap the wiki already records
(`knowledge/stats/pages/terminal-mean-is-not-measurable.md`; the C63 session's lesson (1) was the
same error on a 30-fold product). `E∞[M_t] = t` is exact by linearity once `E[L_t(λ) | F_{t−1}] = 1`
and the recursion is the SR sum; the claim does not move, the instrument does.

**H5 as amended** (two harness gates, N1 at oracle parameters, `N = 2,000`, `T = 1,000`, seeds as
registered for H5):

- **H5a — the increment estimator per λ.** For each of the 16 grid points, the mean of
  `L_t(λ) = exp(λ r_t − λ²/2)` over all `N·T = 2·10⁶` (trajectory, tick) pairs lies within
  `1 ± 3·se`, `se` the sample standard deviation over the same pairs divided by `sqrt(N·T)`.
  HELD iff all 16 hold.
- **H5b — `E∞[M_T] = T` where it is measurable.** On the restricted grid `λ ∈ {+0.25, −0.25}`
  (a valid e-detector in its own right, Prop. 2.3) with `T = 20`, the trajectory mean of `M_20`
  lies in `[0.8·20, 1.2·20]`; and it exceeds 5 (an e-value would average at most 1). HELD iff both.

A FAIL on either remains an implementation defect and a harness stop. No other hypothesis, band,
seed, grid or size moves. The full-grid trajectory mean of `M_1000` is still reported, labelled
as the unmeasurable quantity, so the trap is visible in the run record.

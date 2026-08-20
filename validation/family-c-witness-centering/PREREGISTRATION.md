# Pre-registration — magnitude of the Family C witness-centering defect at exact parameters (WORKLIST C57)

- **Study id:** `2026-08-family-c-witness-centering`
- **Register:** WORKLIST C57 (brief in `knowledge/PROMPTS.md` §C57, 2026-08-19). Closes on this
  study's REPORT.md reaching engine `main`, whatever the verdicts.
- **Discipline:** `knowledge/methodology/pre-registration-discipline`; harness rules per
  `knowledge/methodology/harness-discipline`; instrument classes per the C26 table
  (`stats/n8-combined-stress-2026-08-18` §C26).
- **Engine:** current `main` (sha in the run manifest). System under study:
  `dist/detectors/family-c-betting-e-process.js` driven through the shipped evaluator, with
  `dist/detectors/_family-c-betting-witness.js` and `dist/detectors/family-c-rff.js` as the
  witness path. Never a reimplementation.
- **Standing context this study must not disturb.** The detector is retired from deploysignal
  compiles (C21) and its certification card is REFUSE. This is evidence hygiene for the
  `ville_anytime_valid` label and the premise-chain page — nothing here re-prices, re-cards, or
  revives anything. Cells carry no stage-readable fields; the certification re-score after the
  run must show 15/15 verdicts identical.

Committed before the harness exists. Every band below is frozen here.

## 1. The question

`stats/validity-premise-chain` (C34) derived that the streaming RFF witness is not conditionally
centered even when the compiled reference is exactly the truth:

```
E[F_t | F_{t−1}] = ⟨μ₀, μ_P^φ − μ̂_{Q,t−1}⟩ = b_t ≠ 0 a.s.   (μ_P^φ = μ₀ exactly)
```

with `b_t` F_{t−1}-measurable, the ONS bet learned from past `F`s that encode the sign of `b`,
and the clamp two-sided — so `E[e_t|F_{t−1}] = 1 + λ_{t−1}b_t > 1` is reachable. That is a
derivation with no magnitude. This study measures the magnitude at exact parameters, plus the
mechanism (`λ·b`) and the clamp channel, on H₀ data where the compiled reference law is true by
construction.

**Exact parameters** means: the closed-form mean embedding of `N(0, Σ_true)`
(`μ_P^φ[i] = √(2/D)·exp(−½ωᵢᵀΣ_true ωᵢ)·cos(bᵢ)`, the family-c-pool §3 closed form) with
`Σ_true` the generative covariance of the deviation stream — never an MCD/MRCD estimate, whose
opposite-signed biases (`stats/contamination-2026-08-04`) would confound the centering
measurement. The live projection `liveVectorFamilyC` returns the generative deviation exactly
when live metrics are synthesized from the compiled mean vector (the family-ce-nulls harness
convention), so the compiled mean cancels and the embedding is the entire reference the witness
reads. Prior evidence at this condition is post-hoc only: family-c-pool's X1 arm measured
increment estimator 1.002019 (corr) / 1.001878 (diag) at N=2000, T=300, labelled
"needs its own registration before it counts as evidence". This is that registration.

## 2. Substrate, arms, cell ids (registered forward, C43)

Substrate: the two Gaussian CONTROL nulls of `validation/family-ce-nulls/harness/nulls.mjs`
(`HC-gauss-corr`, `HC-gauss-diag`) — H₀ true by construction, `Σ_true` known in closed form
(`bundle.mjs` `covarianceCorr`/`covarianceDiag`). Calibration bundles are built with the shipped
calibrator exactly as in family-c-pool (600 baseline rows per bundle, 10 bundles per cell,
`covariance_method_override: 'mcd'`) — the bundle supplies only hyperparameters to the exact
arms (bandwidth via median heuristic, `rff_seed`, `rff_dim = 256`, `alpha = 1e-4`,
`lambda_max = 0.5`); its estimated `Σ̂` and mean vector are not consumed by the exact-parameter
witness (mean cancels in projection; embedding overridden).

| cell id | path | `μ_P^φ` / P-side reference | N × T | carries |
|---|---|---|---|---|
| `EXACT-corr-T900`, `EXACT-diag-T900` | RFF | **closed form under `Σ_true`** (`N_P = ∞`) | 4000 × 900 | **E1–E5 (primary)** |
| `REPA2-corr-T300`, `REPA2-diag-T300` | RFF | closed form under compiled `Σ̂` — family-c-pool arm A2, seeds/sizes/loop verbatim | 2000 × 300 | E0 anchor (instrument identity) |
| `LEG500-corr-T300`, `LEG500-diag-T300` | legacy kernel | MC pool `N_P = 500` (shipped size) drawn from `Σ_true` | 2000 × 300 | E6 (descriptive) |
| `LEG8000-corr-T300`, `LEG8000-diag-T300` | legacy kernel | MC pool `N_P = 8000` from `Σ_true` | 1000 × 300 | E6 (descriptive) |

Every reported number states its reference condition beside it (the C54 lesson): `μ_P^φ`
provenance and pool size, baseline rows (600), bundle count (10), `rff_dim`, and the Q-side
running count implied by the tick. A Family C figure without its reference condition is
under-specified.

Seeds. New cells: per-stream splitmix64 (`validation/family-d-emean/harness/seed.mjs`), triple
`(cellIdx, bundle, traj)` with `traj = 0` reserved for the bundle's baseline rows; scheme in the
manifest. The REPA2 cells alone reproduce family-c-pool's mulberry32 scheme verbatim
(`SEED = 20260803`, `baseSeed = SEED + 1000003·b + id.length·7919`, trajectory seed
`SEED + 7919·done + 31·b`) — their purpose is instrument identity, not fresh inference, and the
original scheme is required to reproduce the committed numbers.

## 3. Instrument (C26: test martingale → increment estimator)

- **Validity instrument:** per-trajectory mean of `e_t = exp(Δ log S_t)` summarised across
  trajectories with one-sided 95% bounds — the family-c-pool convention, verbatim. Verdict rule
  verbatim from family-c-pool §6: REFUTED iff the one-sided 95% lower bound exceeds 1; CLEARED
  iff the one-sided 95% upper bound is below 1.0005; else inconclusive.
- **Terminal `E[S_T]` is reported, scored by nothing** (`stats/terminal-mean-is-not-measurable`;
  the C26 class table). Reported with p50/p99/max and `top1_share`.
- **Mechanism channel:** per tick the harness reads the detector's own state before the
  evaluator call (`ons_lambda`, `q_running_phi_sum`, `q_count`) and computes
  `b_t = ⟨μ₀, μ₀⟩ − ⟨μ₀, q_sum/q_count⟩` (at `q_count = 0`, `b_1 = ‖μ₀‖²` exactly) with `μ₀`
  the closed-form embedding, and `F_t` by calling the dist witness
  (`computeRffWitness`) on the same pre-state. Recorded: pooled `mean(λ_{t−1}·b_t)`, pooled
  `mean(λ_{t−1}·(F_t − b_t))`, pooled `mean(F_t − b_t)`.
- **Clamp channel, separately:** fraction of ticks with `ons_lambda` pinned at exactly
  `+λ_max` and at exactly `−λ_max` (signed occupancy), and wealth-factor floor events
  (`|e_t − 10⁻¹²| < 10⁻¹⁸`, the family-c-pool H3 counter).
- Block means of `e_t` over ticks [1,10], (10,50], (50,150], (150,300], (300,600], (600,900].
- Crossing rates at α = 0.05 (descriptive) and at the shipped `bp.alpha = 10⁻⁴` threshold
  (descriptive). Log-domain wealth throughout; no bare catch — any caught failure increments a
  printed counter that is part of the result.

## 4. Endpoints, bands frozen

**E0 — executability (NOT-EXECUTABLE gate).** All three must pass or nothing is scored:

1. **Replication anchor:** `REPA2-corr-T300` reproduces the committed family-c-pool A2
   increment-estimator mean 1.006732 within ±0.0003, and `REPA2-diag-T300` reproduces 1.006659
   within ±0.0003 (`validation/family-c-pool/results/live/run-20260804T062626Z`).
2. **Determinism:** 10 paired re-drives per cell id (same seed triple twice) produce
   bit-identical per-tick `log_S_t` sequences; 0 mismatches.
3. **Witness consistency:** over all instrumented ticks with wealth factor above the floor and
   `|λ_{t−1}| > 10⁻⁹`, `max |(e_t − 1) − λ_{t−1}·F_t| < 10⁻⁹` — the harness's `F_t` is the
   detector's.

**E1 — the magnitude (primary, scored).** On `EXACT-*-T900`: the increment estimator with the
§3 verdict rule. The derivation predicts **REFUTED on both cells** — a positive-magnitude
supermartingale violation at exact parameters. The magnitude is the headline number, reported
with its reference condition.

**E1b — anchor consistency (scored, informative either way).** The increment estimator computed
on the tick-window [1, 300] of the EXACT cells lies within ±0.0010 of the X1 post-hoc value for
its covariance shape (corr: [1.001019, 1.003019]; diag: [1.000878, 1.002878]). HELD confirms the
post-hoc number under registration; REFUTED means the post-hoc figure was not confirmatory —
either outcome is recorded, neither voids the run.

**E2 — mechanism (scored).** On each EXACT cell: (i) pooled `mean(λ_{t−1}·b_t)` has one-sided
95% lower bound > 0 — the sign-known bias is converted to wealth; (ii) the accounting identity:
pooled `mean(λ_{t−1}·(F_t − b_t))` lies within ±3 standard errors of 0, i.e. the excess is the
`λ·b` channel and not something else; (iii) pooled `mean(F_t − b_t)` within ±3 se of 0 (the
conditional-mean identity, Monte Carlo form).

**E3 — clamp channel (scored on sign).** On each EXACT cell: occupancy of `+λ_max` exceeds
occupancy of `−λ_max` (the early bias is positive: `b_1 = ‖μ₀‖² > 0` deterministically, and the
ONS bet learns from positively-biased early payoffs). Occupancy magnitudes are reported
descriptively whatever the sign verdict.

**E4 — persistence at horizon (scored, informative either way).** On each EXACT cell: the block
mean of `e_t` over ticks (600, 900] has one-sided 95% lower bound > 1. HELD means the excess is
sustained at deployment-scale horizons (the family-c-pool P6 plateau shape); REFUTED means the
defect decays as `μ̂_Q` concentrates and the cumulative inflation is bounded — the C57 question
answered in the benign direction. Neither outcome voids anything.

**E5 — terminal (reported, scored by nothing).** `E[S_300]`, `E[S_900]`, p50/p99/max,
`top1_share`, crossing rates per §3.

**E6 — legacy path (descriptive, no scored verdict).** Increment estimator with bounds on the
four LEG cells, pool size stated beside every number; the Jensen-gap direction via pooled
`mean(F_t)` under H₀. *Inference, recorded in advance:* the kernel-of-empirical-mean is locally
concave around the Q mean, biasing the Q-side kernel up and `F_t` down, so I expect negative
`mean(F_t)` and `−λ_max` occupancy exceeding `+λ_max` on the legacy cells — stated as
expectation, not scored, because the exact-parameter condition cannot be constructed for a
pooled P-side and the pool's MC error is a confound the LEG8000 cells only shrink.

## 5. Registered expectations (not verdicts)

From the derivation and the post-hoc X1: E1 REFUTED at roughly 1.002 per tick; E2 all three
held; E3 positive-sign occupancy; E4 genuinely open — the derivation says `b_t` shrinks at
`O_p(t^{−1/2})` but the family-c-pool blocks rose to a plateau instead of decaying, and which
force wins at t ∈ (600, 900] is exactly what this study exists to measure. If E1 comes back
CLEARED the premise-chain page's §Family C is refuted in its magnitude claim and gets corrected
— that is a publishable outcome, not a failure.

## 6. Sizes, output, census

- Sizes as the §2 table. All cells: 10 bundles; bundle-level metadata (bandwidth, `‖μ₀‖²`,
  override distances) recorded once per bundle.
- Append-only `results/live/run-<UTC>/` refusing an existing directory; `results/sim/` is
  git-ignored shakedown space, never cited. Manifest: git sha, engine version, node version,
  command, seed scheme, billing line (no model calls; pure simulation — recorded after checking
  `env | grep -i anthropic` is empty).
- Cells carry **no stage-readable fields** (no `exceedance`, `mean_e`, `detection_rate`,
  `rate_e_ge_20`, `fault_class`). Detector id `family_C_mmd_betting_e_process` (the
  family-c-pool convention), `control: 'witness-centering'` disambiguator. Corpus census
  2434 → **2442** (+8 cells, one registered append), arithmetic recorded in
  `validation/certification/test/collect.test.mjs`; certification re-score must show 15/15
  verdicts identical.

## 7. One attempt

Sim-mode shakedown allowed (git-ignored, never cited); one live run. Mid-run instrument defect:
preserve the run unscored, fix test-first, full re-run under this unchanged registration, defect
named in the superseding manifest (the family-d-emean A1.5.4 disposition).

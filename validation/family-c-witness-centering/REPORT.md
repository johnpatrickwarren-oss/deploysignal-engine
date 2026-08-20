# Report — the witness-centering defect has a magnitude: ~1.3×10⁻³ per tick at exact parameters, and it is the λ·b channel

- **Study id:** `2026-08-family-c-witness-centering` (WORKLIST C57). **Run:**
  `results/live/run-20260820T025417Z` — one attempt. Engine `a80149c` (sources identical to
  `main@72a434e`; the intervening commits are this study's prereg and harness), engine version
  `0.6.6-pre`, deploysignal `e5e13c0` (calibrator input only), node v25.9.0. Pre-registration
  committed at `7d33173`, Amendment A1 at `7c446de`, both before any harness code existed.
- **Executability (E0): PASSED, and the anchor is exact.** The REPA2 cells reproduce
  family-c-pool's committed A2 increment means to six digits (1.006732 vs 1.006732 corr;
  1.006659 vs 1.006659 diag; gate was ±0.0003) — through the Amendment A1 stamp reconstruction,
  so the reconstruction is verified against numbers produced by the pre-retirement calibrator.
  Determinism: 0 mismatches over 80 paired drives. Witness consistency: max
  |(e_t − 1) − λ_{t−1}F_t| = 4.5×10⁻¹⁵ over ~2.5×10⁷ instrumented ticks. Caught failures: 0;
  floor events: 0; suppressed ticks: 0.
- **Every scored endpoint came out as registered.** Verdicts as computed; no band moved.

## Endpoints

| E | claim | registered bar | measured | verdict |
|---|---|---|---|---|
| E1 | the RFF witness is not a supermartingale increment even at exact parameters | REFUTED iff lower95 > 1 | inc **1.001303** [L95 1.001279] corr, **1.001234** [L95 1.001211] diag (N=4000, T=900, μ_P^φ closed form under Σ_true) | **REFUTED, as the derivation predicted** |
| E1b | the post-hoc X1 figure, under registration | window-[1,300] inc within ±0.001 of 1.002019 / 1.001878 | **1.001912** / **1.001815** | **HELD** |
| E2 | the excess IS the λ·b channel | mean(λb) L95 > 0; mean(λ(F−b)) and mean(F−b) within ±3 se of 0 | λb **1.303×10⁻³** [L95 1.280×10⁻³] corr, **1.235×10⁻³** diag — matching the E1 excess to within its own residual; both residuals within 0.5 se and 1.0 se | **HELD** |
| E3 | the two-sided clamp is occupied on the bias's sign | +λ_max occupancy > −λ_max | **0.2055 vs 0.1819** corr, **0.2088 vs 0.1796** diag | **HELD** |
| E4 | the excess persists at horizon | block (600,900] mean L95 > 1 | **1.000886** [L95 1.000865] corr, **1.000835** diag | **HELD** |

**E5 (reported, scored by nothing — C26 test-martingale class).** Terminal wealth at exact
parameters: `E[S_300]` = 2.02 / 1.94, `E[S_900]` = **4.98 / 4.55** (corr / diag; p99 at T=900:
33.7 / 31.3; max 248 / 213; top1_share 0.012 / 0.012). Crossing at α = 0.05 (threshold 20):
0.10% / 0.03% by T=300, **2.60% / 2.53% by T=900**. Crossing at the shipped α = 10⁻⁴ threshold
(10⁴): 0 / 0 at both horizons. Reference condition for every number in this paragraph:
μ_P^φ = closed-form embedding of N(0, Σ_true) (N_P = ∞), rff_dim 256, 600 baseline rows × 10
bundles supplying only the median-heuristic bandwidth.

**E6 (descriptive — the legacy kernel path, pool law N(0, Σ_true)).** The Jensen gap is not
small and its sign is the registered expectation's: mean F under H₀ is **−0.271** (N_P = 500)
and **−0.272** (N_P = 8000) on corr (diag −0.266 / −0.269), the bet pins at **−λ_max on ~97.8%
of ticks** at both pool sizes, and the increment estimator reads **1.1353** (N_P = 500) /
**1.1361** (N_P = 8000) corr, 1.1330 / 1.1346 diag — a per-tick violation two orders larger
than the RFF path's, unchanged by a 16× pool, so it is the kernel-of-empirical-mean
construction, not pool Monte Carlo error. No scored verdict, per registration: a pooled P-side
admits no exact-parameter construction.

## What the magnitude means

1. **The construction defect is real and measured.** At exactly true compiled parameters the
   increment estimator refutes the supermartingale property at z ≈ +92 (corr). The
   `ville_anytime_valid` label's link-2 premise fails for this detector by measurement, not
   only by derivation: Ville's inequality is consumed on a process whose H₀ wealth has positive
   drift.
2. **The mechanism is exactly the derived one.** The excess 1.3025×10⁻³ and the measured
   E[λ_{t−1}b_t] = 1.3034×10⁻³ differ by −8.5×10⁻⁷ (corr), which is the measured λ(F−b)
   residual itself, 0.4 se from zero; the F−b identity residual is 0.8 se from zero. Nothing
   outside the λ·b channel contributes.
3. **The clamp channel converts, but the exploitation is bidirectional and mild on this path.**
   λ sits at a clamp boundary on ~39% of ticks (0.206 at +0.5 vs 0.182 at −0.5), with the
   positive side ahead as the sign of b₁ = ‖μ₀‖² (~0.57) predicts. The legacy path shows the
   same mechanism saturated: sign-known negative bias, 98% at −λ_max.
4. **The excess decays with horizon but does not die.** Block means fall 1.0032 → 1.00089 from
   ticks [11,50] to (600,900], still REFUTED-grade at the last block. Cumulatively that is
   `E[S_900] ≈ 5` — the wealth process inflates by ~5× over 900 H₀ ticks at exact parameters —
   and a 2.6% α = 0.05 crossing rate by T=900 against a nominal 5% Ville budget that should
   bound it for ALL time. At the shipped 10⁴ threshold, no crossing was observed by T=900
   (N=4000); the exact-parameter defect alone is too slow to reach 9.21 log-units at this
   horizon — deployment-scale false fires need the estimation-layer excess on top
   (family-c-pool A2: 3.3× larger per tick, 13.2% crossing at threshold 20 by T=300, reproduced
   here to six digits).

## Scope — what this does not establish

- **Nothing here re-prices, re-cards, or revives the detector.** It is retired (C21) and
  REFUSE-carded; the certification re-score after this run's cells landed shows 15/15 verdicts
  identical (commit alongside this report).
- The magnitude is for THIS cell geometry: d = 11 signals, rff_dim 256, bandwidth ≈ 0.226
  (median heuristic), Gaussian controls. `b₁ = ‖μ₀‖²` scales with the embedding norm, so other
  bandwidths move the constant.
- The legacy-path numbers are descriptive; its running-max normalization (active at n > 10)
  and pooled P-side mean the exact-parameter condition cannot be constructed there.
- E4 registered persistence as "L95 > 1 in (600,900]"; the block sequence is consistent with
  slow decay toward 1, and the asymptotic rate (does Σ b_t·λ_t converge?) is not measured —
  horizons past 900 are unregistered.
- No real telemetry; the detector compiles on zero real cells (family-c-reachability).

## Machine check

`node analysis/check_report.mjs` pins every number above to the canonical run's artifacts and
exits 1 on drift.

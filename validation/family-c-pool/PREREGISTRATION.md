# Pre-registration — is the 500-draw reference pool why Family C is refuted on its own control?

**Registered 2026-08-03, before any arm was run.** Engine `v0.6.6-pre`. Wiki item
`knowledge/WORKLIST.md` C13; the finding under test is `knowledge/stats/family-ce-nulls-2026-08-03`.

Append-only. Results go in `results/`, one directory per run. If a code defect is found after a
result is filed, the result is superseded by a new run and both stay.

## 1. Why this study exists

On 2026-08-03 the Family C `sequential_mmd_betting_e_process` was refuted as a supermartingale **on
its Gaussian control** — the arm where the synthesized pool's premise is exactly true, nothing drifts,
and the live law is the compiled law:

| arm | baseline rows | `E[exp(Δ log M)]` (95% lower) | crossing @ α=0.05 |
|---|---|---|---|
| Gaussian, correlated Σ | 600 | 1.006840 (1.006735) | 0.1365 |
| Gaussian, diagonal Σ | 600 | 1.006561 (1.006462) | 0.1055 |
| Gaussian, correlated Σ | 10,000 | 1.008288 (1.008187) | 0.2635 |
| Gaussian, diagonal Σ | 10,000 | 1.008072 (1.007976) | 0.2245 |

Sixteen-fold more baseline history made it **worse**, which rules out `Σ̂` estimation error. The
term that does not shrink with baseline history is `μ_P^φ`, a Monte Carlo mean over
`FAMILY_C_BETTING_BASELINE_POOL_SIZE = 500` synthetic draws. That attribution is **inferred from a
contrast and some algebra, and has never been measured.** This study measures it.

## 2. Two corrections to how C13 was written, registered before the run

**C13 said the sweep requires changing the detector. It does not.** Both statements below were
checked against the code on 2026-08-03.

1. `betting_e_process_params.baseline_sample_size` exists in the schema
   (`types/families/c.ts:257`) and the runtime honours it
   (`detectors/family-c-betting-e-process.ts:226-227`) — **but only on the legacy streaming-witness
   path.** In RFF mode the runtime never builds a pool; it consumes the precomputed
   `baseline_rff_mean` vector and the comment at `:220-222` says so. Setting `baseline_sample_size`
   in a compiled bundle therefore does nothing to what this study is about.
2. The vector that matters is built **at calibration time**, consumer-side, at
   `deploysignal/tools/calibrators/_family-c-build.ts:304-325`: a `FAMILY_C_BETTING_BASELINE_POOL_SIZE`
   pool from `generateBaselinePool`, mapped through the RFF feature map, averaged, stamped.

**Consequence for the design.** The sweep does not patch either repo's shipped code. The harness
compiles a bundle exactly as it does today, then **recomputes `baseline_rff_mean` in place** from the
same `rff_seed`, `rff_dim` and cell covariance at a different `N_P`. One vector in one compiled
artifact, and nothing else in either repo changes. This also means the study can be run entirely in
this repo, where the `family-ce-nulls` harness already lives.

## 3. The feature map, and the closed form the decisive arm needs

Verified at `detectors/family-c-rff.ts:126-175` and `detectors/sequential-mmd.ts:162-184`:

- `φ_i(x) = √(2/D) · cos(ωᵢᵀx + bᵢ)`, with `ω_{i,j} ~ N(0, σ⁻²)`, `b_i ~ U(0, 2π)`, `D = 256`.
- The pool is `z = L·w`, `w ~ N(0, I)` — a **zero-mean** deviation vector, `z ~ N(0, Σ)`. The code
  calls it "relative-deviation vector around the origin".

So `ωᵢᵀz ~ N(0, ωᵢᵀΣωᵢ)`, and since `E[cos(Z + b)] = e^{−v/2} cos b` for `Z ~ N(0, v)`:

```
μ_P^φ[i]  =  √(2/D) · exp(−½ ωᵢᵀΣωᵢ) · cos(bᵢ)
```

**Exact. No Monte Carlo.** It costs `O(D·d²)` once per cell against `O(N_P·D·d)` for the 500-draw
pool it would replace, so at `d < 500` the exact vector is also the cheaper one. Whether it is the
*right* one is what arm A2 tests.

## 4. The three hypotheses

- **H1 — pool Monte Carlo error.** `μ̂_P = μ_P + ε` with `E‖ε‖² = O(1/N_P)`. The witness
  `F_t = φ(x_t)ᵀ(μ̂_P − μ̂_Q,t−1)` then carries a **fixed** conditional offset `≈ μ_Pᵀε` that no amount
  of live data averages away, and ONS finds its sign. Optimal-bet log-wealth gain goes as the square
  of the offset, so **excess ∝ 1/N_P**, and it is **constant in `t`** after warm-up.
- **H2 — the running Q mean.** `E[F_t | F_{t−1}] = μ_Pᵀ(μ_P − μ̂_Q,t−1)`, which is zero on average
  over `μ̂_Q` but not conditionally, and ONS can track it. Since `Var(μ̂_Q,t) = O(1/t)`, H2 predicts an
  excess that **decays as `1/t`**.
- **H3 — the wealth clamp.** `wealth_factor` is floored at `LOG_FACTOR_FLOOR = 1e-12`
  (`detectors/_family-c-betting-state.ts:15`), which truncates losses and would break the
  supermartingale property outright. With `λ_max = 0.5` this needs `|F_t| > 2`; under H₀ it should
  never bind.

**Prior evidence already favours H1 over H2, registered here so it cannot be claimed afterwards.**
The 08-03 per-block increment means on the mixture arm run 0.9955 → 1.01070 → 1.01348 → 1.01354 over
ticks [0,10) [10,50) [50,150) [150,300). That is a rise to a **plateau**, not a `1/t` decay. H2
predicts decay. So H1 is the standing hypothesis and A2 is built to kill it.

## 5. Design

Gaussian control arms only — `HC-gauss-corr` and `HC-gauss-diag` from `../family-ce-nulls/harness/`,
reused verbatim. The mixture arms are not run: they are refuted for a second, uncontested reason
(the reference law is Gaussian and the data is not), so they cannot discriminate these hypotheses.

N = 2000 trajectories × T = 300 ticks × 10 bundles per arm, matching the study this extends.

| Arm | `baseline_rff_mean` built from | Purpose |
|---|---|---|
| **A0** | `N_P = 500` (shipped) | replication gate |
| **A1a/b/c** | `N_P = 2,000 / 8,000 / 32,000` | the scaling exponent |
| **A2** | the closed form of §3 | **decisive** |

A0 is a gate, not a result. If it does not reproduce the 08-03 numbers the harness has drifted and
nothing else is run.

## 6. Endpoints

**Primary — the increment estimator**, identical to `../family-ce-nulls` §6 so the numbers compose:
per tick record `Δ log M`, take the per-trajectory mean, report mean / sd / se / two-sided 95% CI /
one-sided 95% bound clustered at the trajectory.

> **REFUTED as a supermartingale iff the one-sided 95% lower bound on `E[exp(Δ log M)]` exceeds 1.**
> **CLEARED iff the one-sided 95% upper bound falls below 1.0005.**

The two-sided rule is new here and deliberate: this study can succeed by failing to refute, so it
needs a threshold at which "not refuted" means something. 1.0005 is one fourteenth of the measured
excess. It is also about the same size as the increment estimator's own reseed spread on Family A
(4.4×10⁻⁴ to 6.9×10⁻⁴, `knowledge/stats/terminal-mean-is-not-measurable`), so it is the tightest
threshold this instrument can honestly carry — not a comfortable margin, and a CLEARED verdict here
means "indistinguishable from 1 at the estimator's noise floor", nothing stronger.

**Secondary — the scaling exponent.** Ordinary least squares of `log(mean − 1)` on `log N_P` across
A0 and A1a–c, with its 95% CI. Four points, so the CI will be wide and is reported as such.

**Reported, scored by nothing:** the crossing rate at α ∈ {0.05, 0.01, 1e-4}; per-block increment
means on the same tick partition; count of ticks where the H3 clamp binds; wall-clock to build
`baseline_rff_mean` per arm; and `E[M_T]` alongside, per
`knowledge/stats/terminal-mean-is-not-measurable`, so the two estimators stay visibly different.

## 7. Registered predictions

Numbered so a wrong one is findable. **P4 is the one I expect to fail.**

- **P1.** A0 reproduces 1.006840 (corr) and 1.006561 (diag) to within ±0.0003.
- **P2.** The excess scales as `1/N_P`: fitted exponent **−1.0 ± 0.25**. Point predictions for the
  correlated arm — `N_P = 2,000` → **1.00171**, `8,000` → **1.00043**, `32,000` → **1.00011**.
- **P3 — decisive.** A2 is **CLEARED**: upper 95% bound below 1.0005 on both Gaussian arms.
- **P4.** A2's crossing rate at α=0.05 falls below 0.05 on both arms. I expect this to fail even if
  P3 holds: clearing the supermartingale property at this precision does not bound the crossing rate,
  and `knowledge/stats/terminal-evalue-2026-08-02` already records a cell where a 0.016 crossing rate
  sat on an `E[e]` of 9,710. Registered anyway because the gap between the two is the interesting part.
- **P5.** The H3 clamp binds **zero times** across every arm.
- **P6.** A2's per-block means are flat after warm-up rather than decaying — H2 leaves no residue.

**What would refute H1.** A2 still refuted, i.e. lower bound above 1 with the exact mean embedding
in place. Then the pool is exonerated, the C13 line in the wiki is wrong and must be rewritten, and
the live hypothesis becomes H2 or something not yet named. **A fitted exponent near −0.5 instead of
−1** also refutes the stated mechanism while keeping the pool implicated, and would mean the bettor
extracts the offset linearly rather than quadratically — a worse story, because it decays more slowly.

## 8. What this study does not establish

- **It cannot clear Family C for use.** The mixture arms stay refuted whatever happens here, at
  0.896 on healthy bimodal data. A pool fix addresses the Gaussian control only. The detector's
  stated purpose — bimodality Hotelling misses — is untouched by every arm of this study.
- **It says nothing about real telemetry.** Every null is synthetic and every baseline is
  synthesized. ADR 0012 measured per-shard `E[e|H₀]` of 24/9/9 on real GWDG data; nothing here would
  find that.
- **It does not answer C14.** Whether the detector is reachable from a default compile is a separate
  count over a real corpus. Every arm here runs under `covariance_method_override: 'mcd'`.
- **A cleared A2 is not a shipping decision.** It would make the closed form a candidate fix; whether
  the analytic embedding is correct for *non*-Gaussian compiled cells is a question this study does
  not pose, and §3's derivation assumes the pool law is exactly `N(0, Σ)`.
- **Marginal, not conditional.** `E[exp(Δ log M)] ≤ 1` marginally is implied by the supermartingale
  property, not equivalent to it. Refuting is sound; clearing bounds one number.

## 9. Disclosure

I wrote the code under test, I wrote the study that produced the finding, and I wrote the hypothesis
being tested. H1 is my own attribution from 2026-08-03 and I am the one who would be right if A2
clears. That is why A2 is registered as decisive with a numeric threshold and a stated falsifier
before any arm runs, and why A0 is a gate that can stop the study.

## 10. Run discipline

1. This file is committed before the harness is written.
2. A0 runs first. If P1 fails, stop and file the failure; no other arm runs.
3. Arms run in one invocation per arm; no arm is re-run on a different seed to pick a better number.
   If a seed is changed, both results are filed.
4. Predictions are scored verbatim against §7, including the ones that fail.
5. The wiki page is written from `results/`, not from memory, and it names how many of P1–P6 held.

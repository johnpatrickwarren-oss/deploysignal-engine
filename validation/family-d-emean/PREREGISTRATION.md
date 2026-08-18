# Pre-registration — is the fixed Family D path an e-process?

- **Study id:** `2026-08-family-d-emean`
- **Engine pin:** `v0.6.6-pre` at `d3d6d06` (disjoint-window evaluation).
- **Discipline:** `knowledge/methodology/pre-registration-discipline`.

Committed before any run.

## 1. The question

`d3d6d06` moved Family D's measured **crossing rate** from 0.5760 to 0.0005. It did **not** establish
`E[M_T | H₀] ≤ 1`, which is the property that makes the wealth an e-process and the hypothesis e-BH
requires.

`knowledge/stats/terminal-evalue-2026-08-02` measured safe-t at a **0.016 crossing rate with
`E[e] = 9,710`** on the same cell. The two quantities disagreed by four orders of magnitude. Markov
links them one way only: `P(M ≥ 1/α) ≤ α·E[M]`, so a clean crossing rate does not license the mean.

**Restoring Family D's α on the crossing-rate measurement alone would repeat the error that study
documented.** This measures the property directly.

## 2. Primary endpoint — E1

Under H₀ (iid Gaussian, oracle `μ₀`/`σ₀`, disjoint evaluation), for `T ∈ {300, 900}` ticks:

```
E[M_T]   over N = 4000 independent trajectories
```

**E1 FAILS iff the one-sided 95% lower confidence bound on `E[M_T]` exceeds 1.** Failing only on
evidence, as in both companion studies.

*The mean is the primary here, deliberately and against the companion battery's choice.* `E[M] ≤ 1`
is the definition of the object; the crossing rate is a consequence. The terminal study registered
the consequence and could not see the failure. That error is not repeated.

## 3. Secondary — E2, E3, reported not scored

- **E2** — p99 and max of `M_T`. Where the mass sits; a mean near 1 with a p99 in the thousands is a
  different object from a mean near 1 with a p99 near 1.
- **E3** — the same quantities on the **rolling** path, as the known-bad control.

## 4. Not-executable

The rolling path must show `E[M_T] ≫ 1` at both horizons. It measured a 0.576 crossing rate, so its
mean cannot be ≤ 1. If the control comes back clean, the harness is wrong and no cell is scored.

## 5. Registered expectation

The wealth increments are `z_t = r·u − ½r²` with `u` right-skewed and bounded rather than `N(0,1)`,
worth **~1.0023 per independent draw** (measured 2026-08-01). Disjoint evaluation gives 10 updates in
300 ticks and 30 in 900, so I expect `E[M_300] ≈ 1.023` and `E[M_900] ≈ 1.071` — **above 1, and E1 to
FAIL at both horizons**, marginally.

*If that is what happens, the honest conclusion is that Family D is not an e-process even on disjoint
windows, its α should stay at zero, and the remaining question is whether the ~2.3%-per-window
inflation is worth pricing as a `c`-bound rather than fixing.*

---

# Amendment A1 — 2026-08-18. First committed execution; the calibration-size axis (C54/C55)

Appended, not edited. §§1–5 stand verbatim; this amendment is committed before the harness exists.

**Why this study runs now.** The numbers §5 predicted were measured on 2026-08-03 (`1.0636` /
`1.1076`) and shipped into `types/families/d.ts:86-107`, `test/spectral-inflation-bound.test.ts`,
`guarantees.ts` and two wiki pages — but the producing harness and results were never committed
(`WORKLIST` C55; verified at `main@4c8953d`: this directory holds one file). Separately, batch C's
review established `c(T, K) ≈ exp(skew·n + n²r²/2K)` — the bound is not well-formed without the
calibration-window count `K` beside the horizon `T` (C54); its K-sweep read `E[M_900]` from 16.6 at
`K = 25` down to 1.17 at exact moments, none of it committed. This execution produces the committed
artifact and states `K` on every cell.

## A1.1 — Execution pin

Executed at current `main` (sha in the run manifest), not the original `v0.6.6-pre @ d3d6d06` pin.
The full diff of `detectors/spectral.ts` between `d3d6d06` and `main@4c8953d` is: the optional
c-deflation threshold (`e_value_inflation_bound ?? 1`, absent ⇒ `1/α` as at the pin) plus comments.
The wealth update `z_t = r·u − ½r²`, the ADR 0026 log-domain accumulation, and
`peakACF` are unchanged. The harness leaves `e_value_inflation_bound` unset and ignores firing —
`E[M_T]` is a property of the unstopped path and the detector does not reset on fire — so the
measured object is behaviour-identical at either sha.

Instrument: the committed adapter cadence of `validation/h0-battery/harness/detectors.mjs`
(`W = 30`, `LO = 3`, `HI = 10`, `betting_delta = 0.3·σ₀`, disjoint evaluation ⇒ wealth updates at
ticks 60, 90, … — 9 updates at `T = 300`, 29 at `T = 900`, matching the committed table), driven
through `dist/detectors/spectral.js`, never a reimplementation.

## A1.2 — The calibration axis, registered forward (C54)

`μ₀`/`σ₀` are the null moments of the windowed statistic `peak|ACF|`, which has no closed form, so
"oracle" (§2) is operationalized as a calibration mode. Every reported cell states
`(T, wealth_updates, K, cal_mode)`. Cell ids are registered here, forward, per the C43 lesson
(the id names the generating condition):

| cell id | generator | evaluation | calibration | carries |
|---|---|---|---|---|
| `N1-exact-T300`, `N1-exact-T900` | iid Gaussian | disjoint | **exact-shared**: one seeded draw of `K = 66,666` disjoint windows (1,999,980 ticks), computed once, full precision in the manifest | **E1 (primary)**, E2 |
| `N1-ptK100-T300/-T900`, `N1-ptK400-T300/-T900` | iid Gaussian | disjoint | **per-trajectory**: a fresh `K ∈ {100, 400}`-window sample per trajectory (the h0-battery/bootstrap-overshoot condition-A shape) | descriptive |
| `N1-sharedK100-T300/-T900`, `N1-sharedK400-T300/-T900` | iid Gaussian | disjoint | **shared-draw**: `D = 100` independent `K`-window draws; per draw `N = 1,000` trajectories; across-draw mean / sd / p05 / p95 of `Ê[M_T]` reported (the C51.4 floor `D ≥ 100` honored) | descriptive |
| `N7-rolling-T300`, `N7-rolling-T900` | iid Gaussian | **rolling (every tick)** | exact-shared | **E3 control** |

"Exactness" of the exact-shared mode, two guards, both bars set before any run:

1. **Analytic residual**: the calibration-error inflation term is `≈ n²r²/2K` in log `c` with
   `n = 29`, `r = 0.3` ⇒ `75.69/2K`; at `K = 66,666` that is `5.7 × 10⁻⁴` — reported beside the
   primary cells as the exactness bound.
2. **Replication guard**: a second, independently-seeded `K = 66,666` calibration must agree with
   the first within `|Δμ̂₀| < 2 × 10⁻³` and `|Δσ̂₀|/σ̂₀ < 0.02`. Disagreement ⇒ NOT-EXECUTABLE
   (instrument defect), nothing scored.

## A1.3 — Sizes, seeds, reporting

- `N = 4,000` trajectories per cell (exact, per-trajectory, and control cells); horizons
  `{300, 900}` nested as snapshots of one trajectory. Shared-draw cells: `D = 100 × N = 1,000`.
- Seeded LCG from `validation/h0-battery/harness/nulls.mjs`; base seed `20260818`; the seed scheme
  (per-cell offsets, per-trajectory stride 7919, disjoint ranges) is recorded in the manifest.
- Per cell: `E[M_T]` with a one-sided 95% lower confidence bound (normal approximation on the
  across-trajectory mean), `p50`/`p99`/`max` of `M_T` (E2), `top1_share` (the largest single
  trajectory's weight in the mean — the bootstrap-overshoot degeneracy diagnostic), the crossing
  rate at the shipped threshold `1/α_D = 10⁴` (descriptive), and `control_state` (the batch-C C4
  proposal, emitted forward). All wealth accumulation in the log domain; means via log-sum-exp.
- Append-only `results/live/run-<UTC>/`; refuses an existing directory; manifest records git sha,
  engine version, seeds, command, node version. `results/sim/` is git-ignored shakedown space; a
  sim run is never cited.

## A1.4 — Endpoints, unchanged; the control made mechanical

- **E1** verbatim from §2, scored on `N1-exact-T300` / `N1-exact-T900` only: FAIL iff the 95%
  lower bound on `E[M_T]` exceeds 1. §5's expectation stands: FAIL at both horizons, marginally.
- **E2** reported per §3 on the same cells.
- **E3 / NOT-EXECUTABLE** (§4, made mechanical): the rolling control `N7-rolling-T300` must read a
  95% lower bound on `E[M_300]` **> 10** (the uncommitted 2026-08-03 reading was `6.6 × 10²³`; the
  bar sits far below it and far above 1). Below the bar ⇒ the harness is wrong, no cell is scored.

## A1.5 — Dispositions, frozen before the run

1. **Committed-constant comparison.** The exact cells vs the committed `1.0636` (T=300) and
   `1.1076` (T=900): CONSISTENT iff the committed value lies inside the run's two-sided 95% CI.
   If consistent, this run becomes the constants' backing artifact and the type/test/wiki
   annotations cite it with `K` stated. If not, the disagreement is recorded as a dated
   contradiction — both values kept, neither resolved — and **the committed constants are not
   rewritten by this study**: repricing a shipped detector is a detector-owner decision, and the
   shipped path is separately mis-specified (C53, the compiler/runtime statistic mismatch).
   Either way the C54 type change (K beside T in `SpectralInflationBound`) proceeds.
2. **The secondary grid carries no verdicts.** The shared-draw cells exist to say which
   calibration condition the committed numbers are consistent with; that reading is descriptive.
3. **No certification artifact moves.** No card is edited or re-frozen; the corpus census
   assertion (`validation/certification/test/collect.test.mjs`) is updated with the arithmetic
   recorded, per the batch-C pattern, because `collect.mjs` pools every
   `validation/*/results/live/` cell.
4. **One attempt.** A mid-run instrument defect: preserve the run unscored, fix test-first,
   re-run in full under this unchanged amendment, defect named in the superseding manifest.

# Report — the sign kind with a margin (`2026-10-twin-sign-margin`, ADR 0037, T1 + T3 replay)

- **Run:** `results/run-20260929T202805Z/` (`harness/run.mjs`, R = 1000, α = 0.05, B = 0.0678),
  engine `1685402` on `wt/sign-margin` (0.12.2-pre + ADR 0037 unreleased; on `main` after the rebase-merge of PR #112 the same tree is `faab27f`, the registration `7f4ad91`, the dist commit `a435580`, the run commit `9fd994a`), Node v25.9.0, replay
  input DeploySignal `studies/twin-aa-real/results/runs/` (44 files, main `a9c2aa1`). Smoke at
  R = 20 in `results/smoke-20260929T202743Z/` before the sweep. Registered before code
  (`23454c1`), no amendment. Verdicts as computed; no bar moved.
- **Tree at run time:** the manifest lists six compiled files under `dist/` as modified — the
  outputs of `npx tsc` on the committed source `1b15577`, committed unchanged in the next commit
  (`4c5647a`; a further `npx tsc` leaves the tree clean). No source file was modified.
- **Ship rule: MET.** E1, E2, E3 and E4 hold. E5 is reported without a verdict.

## Endpoints

| Endpoint | Registered | Observed | Verdict |
|---|---|---|---|
| E1 validity with a margin (m 0.02) | false rollback ≤ 0.0678 in every V cell with m > 0 | δ 0: 0.0000; δ 0.005: 0.0010; δ 0.01: 0.0000; δ 0.018: 0.0370 | **PASS** |
| E2 the mechanism (m 0, δ 0.01) | false rollback ≥ 0.90 | 1.0000 (median tick 31; 0.769 by tick 60) | **PASS** |
| E3 power (m 0.02, Δ 0.08 = 4× margin) | rollback by tick 60 ≥ 0.95 | 1.000 (median tick 8) | **PASS** |
| E4 proceed | Δ 0.01: proceed ≥ 0.90 and rollback ≤ B; Δ 0.08: proceed ≤ 0.05 | proceed 1.0000 (median 17), rollback 0.0020; proceed 0.0000 | **PASS** |
| E5 replay of the 44 real runs | reported | m 0: 12/44; m 0.10: 2/44; m 0.25: 0/44; m 0.50: 0/44 | reported |

Reported cells: Δ 0.03 (1.5× margin) rollback 1.0000 over 300 ticks, 0.782 by tick 60, median 31;
Δ 0.04 (2×) 1.000 by tick 60, median 11.

**Predictions.** P1 held (0.000–0.037; the δ = 0.9-margin cell sits at about half the bar, so the
premise clause stays "smaller than the margin"). P2 held (1.000). P3 held (median 8 at 4×; the 2×
power of 1.000 by 60 is above the predicted 0.6–0.9 and the 1.5× power of 0.78 is above the
predicted < 0.5: the generator's noise is smaller relative to the margin than the prediction
assumed). P4 held (median proceed tick 17). **P5 not held:** the replay gives 2, 0 and 0 rollbacks
at m = 0.10, 0.25, 0.50 against the predicted 6, 3, 1. The prediction used the T3 report's
canary-worse-share proxy (share ≥ 0.65 over the ticks the unmargined session used); the gate needs
the margined share to carry the wealth past 2/α within 60 ticks under the Bonferroni split, which
fewer runs do. The unmargined replay reproduces the T3 report's 12/44 exactly, run for run.

## A registration error, stated

§3 labels `V-m0-d0` "twin-null P1-sign reproduced". §1's generator carries arm-level AR(1) state
(σ_arm 0.1, φ 0.5) in every cell, so that cell reproduces twin-null's **P2** (sign, w 0.5, φ 0.5,
σ 0.1: 0.165 there), not P1 (σ_arm 0: 0.025). Measured 0.1440 (median tick 56), within noise of P2.
The cell is outside E1 and the ship rule as registered; `endpoints.json`'s
`twin_null_P1_reproduced: FAIL` is that mislabel and is left as written. The consequence is the
opposite of a weakness: every margined cell runs on the same arm-level noise that gives the
unmargined kind 0.144, and holds at 0.000–0.037.

## What this establishes, and what it does not

Established (T1 on the twin-null generator): a `sign` metric with a relative margin keeps its
rollback bound under a persistent arm-level offset up to 0.9 of the margin and under AR(1)
arm-level noise that breaks the unmargined kind; a regression at twice the margin fires within
about 11 ticks; a sub-margin regression proceeds. On the 44 real p99 series, a 10% relative margin
leaves 2 of the 12 unmargined rollbacks and a 25% margin none (post-hoc replay, no verdict).

Not established: T3 validity with a margin (a re-registered real-service A/A with a declared
margin is the test); the margin's cost under missingness; an absolute margin beyond unit tests;
any rule for choosing the margin.

# Pre-registration — the sign kind with a margin (`2026-10-twin-sign-margin`, ADR 0037)

- **Study id:** `2026-10-twin-sign-margin`
- **What it serves:** ADR 0037's claim that a `sign` metric with a declared margin keeps its
  rollback bound under a persistent arm-level offset smaller than the margin, detects a regression
  well past the margin within a 60-tick bake, and clears a sub-margin regression on the proceed
  side; and a labelled replay of the real-service p99 pairs that motivated it.
- **Tier:** T1 (synthetic, oracle generator) for E1–E4; the replay (E5) is a T3 post-hoc re-score
  and carries no verdict.
- **Engine:** the commit on `wt/sign-margin` that carries this file and ADR 0037, before any
  implementation; engine `0.12.2-pre` + ADR 0037 unreleased.
- **Status: REGISTERED, NOT RUN.** A later change is an amendment, appended and dated.

## 0. Disclosures

- The margin scan that motivated this study was computed after the T3 A/A's verdicts were known
  (DeploySignal `studies/twin-aa-real/REPORT.md` §3: runs with canary-worse share ≥ 0.65 fall
  15 → 8 → 6 → 3 → 1 → 0 at relative margins 0, 0.05, 0.10, 0.25, 0.50, 1.00 over 44 runs). The
  replay cell (E5) re-scores those same 44 series through the implemented metric at three of those
  margins; its numbers are therefore not a test of anything and are reported without a verdict.
- Nothing in this study has been run. No harness exists at registration.
- Scope: `detectors/twin-contrast.ts`'s sign e-processes only, as in `2026-09-twin-null`; the gate
  (`per-shard/twin-gate.ts`) is not exercised except in the replay, which steps DeploySignal's
  stored tick bodies through `stepTwinGate` exactly as the T3 runner did (two metrics, Bonferroni
  N = 2, max_ticks 60, α_rollback 0.05, α_proceed 1e-12).

## 1. Generator (synthetic cells)

The `2026-09-twin-null` generator (`validation/twin-null/harness/run.mjs`, §1 there), sign kind,
w = 0.5, with two additions: a **persistent relative offset** δ on the canary and a **relative
regression** Δ on the canary, both scaled by the shared level so that they compare cleanly with a
relative margin:

- shared level L_t = 100 · s_t · (3 on t ∈ [800, 900), else 1), s_t = 1 + 0.5 sin(2πt / 1440);
- per arm: value = L_t + 10 · a_t + 30 · ℓ / √max(n, 1), a_t AR(1) with σ_arm 0.1, φ 0.5
  (per arm, independent), ℓ the centered lognormal (σ 0.75), n the arm's requests
  (N_t ~ Poisson(2000 · s_t), split at w by the binomial normal approximation as in twin-null);
- canary value += (δ + Δ) · L_t.

Seed per cell i: `lcg(20261001 + 7919·i)`, one stream across its replications, cells in the order
of §3. Metric spec: `{ kind: 'sign', worse: 'higher', tolerance: 0.1, margin: { relative: m } }`
with m per cell. α = 0.05 for both e-processes (single metric, no Bonferroni). Horizon T = 2000
ticks for validity cells (Ville over the horizon), T = 300 for power and proceed cells; R = 1000
replications per cell.

Noise scale, for the reader: at n ≈ 1000 the per-arm noise term has standard deviation about 1 on
a level of 100, so a relative margin of 0.02 is about two noise standard deviations and a
persistent offset of 0.01 is about one.

## 2. Bars

A/A bar as in twin-null: **B = α + 2.58 · √(α(1−α)/R)** = 0.05 + 2.58 · 0.00689 = **0.0678** at
R = 1000 (at most 67 false rollbacks in 1000). Power bar 0.95. Proceed bars: false proceed ≤ α_P
(0.05) on a supra-margin regression; proceed rate ≥ 0.90 by T = 300 on a sub-margin regression.

## 3. Cells

| Group | Cell | m | δ | Δ | T | Reads |
|---|---|---|---|---|---|---|
| V | V-m0-d0 | 0 | 0 | 0 | 2000 | twin-null P1-sign reproduced |
| V | V-m0.02-d0 | 0.02 | 0 | 0 | 2000 | false rollback ≤ B |
| V | V-m0.02-d0.005 | 0.02 | 0.005 | 0 | 2000 | false rollback ≤ B (offset ¼ margin) |
| V | V-m0.02-d0.01 | 0.02 | 0.01 | 0 | 2000 | false rollback ≤ B (offset ½ margin) |
| V | V-m0.02-d0.018 | 0.02 | 0.018 | 0 | 2000 | false rollback ≤ B (offset 0.9 margin) |
| M | M-m0-d0.01 | 0 | 0.01 | 0 | 2000 | the mechanism: false rollback WITHOUT a margin |
| P | P-m0.02-r0.03 | 0.02 | 0 | 0.03 | 300 | power at 1.5× margin (reported) |
| P | P-m0.02-r0.04 | 0.02 | 0 | 0.04 | 300 | power at 2× margin (reported) |
| P | P-m0.02-r0.08 | 0.02 | 0 | 0.08 | 300 | power at 4× margin ≥ 0.95 by tick 60 |
| Q | Q-m0.02-r0.01 | 0.02 | 0 | 0.01 | 300 | sub-margin: proceed ≥ 0.90 by 300; rollback ≤ B |
| Q | Q-m0.02-r0.08-proceed | 0.02 | 0 | 0.08 | 300 | false proceed ≤ α_P |
| E5 | replay-m0.10, -m0.25, -m0.50 | 0.10, 0.25, 0.50 | real | real | 60 | reported, no verdict |

Replay input: the 44 executable runs' per-window tick bodies from DeploySignal
`studies/twin-aa-real/results/runs/AA-l<lane>-r<k>-<UTC>.jsonl` (`type: 'window'`, `scored_tick`,
`body.observations`), the same 60 scored ticks the runner sent, both metrics as the T3 registration
declared, with the p99 spec gaining `margin: { relative: m }`. Output per margin: the number of the
44 runs whose scored session ends `rollback`, and its tick.

## 4. Endpoints

- **E1 (validity with a margin).** Every V cell with m = 0.02: false rollback ≤ B (0.0678).
- **E2 (the mechanism is in the generator).** M-m0-d0.01: false rollback ≥ 0.90. If it is below
  0.50 the generator does not carry the T3 mechanism and the study is NOT EXECUTABLE for E1's
  claim about it (E1 is then reported as a synthetic result only).
- **E3 (power).** P-m0.02-r0.08: rollback by tick 60 in ≥ 0.95 of replications. P-r0.03 and
  P-r0.04: reported with their median rollback tick.
- **E4 (proceed).** Q-m0.02-r0.01: proceed by T = 300 in ≥ 0.90 of replications and rollback ≤ B;
  Q-m0.02-r0.08-proceed: proceed in ≤ 0.05 of replications over T = 300.
- **E5 (replay).** Reported: rollbacks of 44 at each margin, with ticks. No verdict.

**Ship rule:** E1, E2, E3 and E4 hold. Then ADR 0037 ships in `v0.13.0-pre`.

## 5. Predictions (registered)

- P1: E1 holds; point figures 0.02–0.04 at δ = 0 and δ = 0.005, rising toward B at δ = 0.018
  (about one noise standard deviation of headroom left at s_t = 1, less at the seasonal trough
  because the margin scales with L_t while the noise term does not). If δ = 0.018 exceeds B and
  δ = 0.01 does not, the ADR's premise clause is restated as "offset at most about half the
  margin" and the study is reported as such; that is not a failure of E1's other cells.
- P2: E2 holds at about 1.00 (a persistent one-σ offset without a margin, cf. T3's 0.27 with
  smaller and mixed-direction offsets and the mini's 1.00 on busy cores).
- P3: E3 holds; median rollback tick under 20 at 4× margin; power at 2× margin 0.6–0.9, at 1.5×
  below 0.5.
- P4: E4 holds; the sub-margin proceed lands within 100 ticks.
- P5 (replay, no verdict): 6, 3 and 1 rollbacks of 44 at m = 0.10, 0.25, 0.50, matching the share
  scan; the ticks are later than the unmargined runs'.

## 6. Not measured

The `rate` kind (unchanged); unequal weights (the gate refuses sign there); missingness under a
margin (the ½ penalty is unchanged, but its power cost with a margin is not measured); an
absolute margin (same code path, one branch, covered by unit tests only); the margin's effect on
the Bonferroni split beside a rate metric; any real service other than the replay's; a margin
chosen by any rule (this study assumes a declared one).

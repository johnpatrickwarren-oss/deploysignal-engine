# Pre-registration — the `rate` kind's detection time under random fault arrivals at the real cells' traffic (`2026-10-twin-rate-random-arrivals`)

- **Study id:** `2026-10-twin-rate-random-arrivals`
- **What it serves:** DeploySignal `studies/twin-fault-shapes/REPORT.md` §3 says its faults are
  evenly spaced per process, so the measured tick spreads (38–42 at ×1.5; 25–26 at ×2) understate
  what a randomly arriving fault of the same rate would show, and "at ×1.5 under random arrivals
  some runs would cross 60 ticks; this study does not say how many". This study says how many,
  synthetically, at the real cells' traffic. ADR 0001 §5 (DeploySignal) cites the figure.
- **Tier:** T1, synthetic, oracle generator, through the engine's gate (`per-shard/twin-gate.ts`,
  `stepTwinGate`) with the real cells' configuration. It measures the detector's arithmetic on a
  stated generator; it is not a power measurement of the real service.
- **Engine:** `v0.13.0-pre` at `de25786`, the pin the real cells ran on. No engine code changes.
- **Status: REGISTERED, NOT RUN.** Committed alone, before any harness. A later change is an
  amendment, appended and dated.

## 0. Disclosures

- The real cells' results are known: `AB-5xx-1.5` 20 of 20 at ticks 38, 39 ×5, 40 ×6, 41 ×5, 42 ×3
  (median 40; planner 44); the first study's `AB-5xx` (×2) 20 of 20 with the rate detector first in
  16 at ticks 25 ×8 and 26 ×8 (the sign detector first in 4 at 11–14, before the margin existed).
  The deterministic cells below (§3, D) exist to show the generator reproduces those; their
  predictions are therefore not predictions and are marked as reproduction checks.
- The null here is random arrivals, which is the `rate` kind's modelled null (`detectors/twin-contrast.ts`
  line 9 onward: Fisher noncentral conditional on the totals). The real service's evenly spaced
  faults are under-dispersed relative to it, so the real A/As measured the rate kind on an easier
  null than this study's. `2026-09-twin-null` measured validity under Poisson/binomial generation
  already; the N cell here repeats that at the real traffic and is a check, not news.
- Nothing has been run. No harness exists at registration.

## 1. Generator

One tick = one minute of the real lanes: total requests across the two arms N_t ~ Poisson(2440),
split to the canary by Binomial(N_t, ½) (the lanes' equal weights; real per-arm counts 1,169–1,302
per tick). Two metrics, as the real cells declared them:

- `http_5xx`: `{ kind: 'rate', worse: 'higher', tolerance: 0.2 }`. Control fault probability
  p = 0.005 per request; canary p · ρ with ρ per cell. Two arrival models:
  - **random (R):** events per arm ~ Binomial(n_arm, p_arm) each tick, independent across ticks;
  - **deterministic (D), the real service's mechanism:** each arm is 4 processes; the arm's requests
    are split across its processes by Multinomial(n_arm, ¼ each); each process keeps a running
    request count n and faults request n when ⌊n · f + ½⌋ > ⌊(n − 1) · f + ½⌋ with f its fault
    fraction (`studies/twin-aa-real/infra/service/server.mjs`), counters persisting across ticks
    within a run. Faults per arm per tick are then within ±1 of n_arm · f.
- `p99_latency`: `{ kind: 'sign', worse: 'higher', tolerance: 0.15, margin: { relative: 0.10 } }`,
  fed equal arm values (76 ms both) every tick so it is inside the band and scores 0, as the real
  cells' latency detector did (rollback e-value 1.0 throughout). It is present only so the
  Bonferroni split (N = 2, rollback threshold 40) matches the real gate.

Gate config: `canaryWeight 0.5, alphaRollback 0.05, alphaProceed 1e-12, alphaSrm 0.001, maxTicks 60`
(DeploySignal `studies/twin-aa-real-2/harness/run-real.mjs` `twinArm`). No warm-up (the real
runner's 15 warm-up ticks are not scored). A replication ends at the first terminal verdict or at
tick 60 (`extend`/`inconclusive` = not detected).

Seed per cell i: `lcg(20261003 + 7919·i)` (the `twin-null` generator's LCG), one stream across the
cell's replications, cells in §3 order. R = 10,000 replications per cell.

## 2. Bars and figures

- Null bar: B = α + 2.58 · √(α(1−α)/R) = 0.05 + 2.58 · 0.00218 = **0.0556** (at most 556 false
  rollbacks in 10,000).
- Reproduction band for D cells: median rollback tick within ±3 of the real cell's (37–43 at
  ×1.5; 22–29 at ×2) and detection by 60 in ≥ 0.99.
- Reported figures per cell: share detected by tick 60; rollback tick median, interquartile range,
  90th and 99th percentiles among detections; share of replications still undecided at 60; false
  proceeds; sample-ratio halts.

## 3. Cells

| Cell | Arrivals | ρ (odds ratio) | Reads |
|---|---|---|---|
| N-R | random | 1.0 | false rollback by 60 ≤ B (check) |
| D-1.5 | deterministic | 1.5 | reproduction: median in 37–43, detection ≥ 0.99 |
| D-2.0 | deterministic | 2.0 | reproduction: median in 22–29, detection ≥ 0.99 |
| R-1.5 | random | 1.5 | **the figure**: share detected by 60, tick distribution |
| R-2.0 | random | 2.0 | the figure at ×2 |
| R-1.2 | random | 1.2 | reported (the declared tolerance's own size; detection by 60 expected low) |

## 4. Endpoints

- **E1 (null at this traffic).** N-R false rollback ≤ B. If it fails, the generator or the gate is
  wrong for this traffic and nothing else is interpreted; `2026-09-twin-null` is re-read.
- **E2 (the generator reproduces the real cells).** D-1.5 and D-2.0 inside their reproduction
  bands. If either is outside, the study is NOT EXECUTABLE for the comparison claim: the R cells are
  then reported as a synthetic result only, not as "what the real cells would have shown under
  random arrivals".
- **E3 (the figure).** R-1.5, R-2.0, R-1.2 reported as §2 lists. No bar; this is the measurement
  the fault study said it lacked. The one claim it supports is the sentence that replaces the
  fault study's "this study does not say how many" in ADR 0001 §5 and the wiki.

No ship rule: the study ships no code.

## 5. Predictions (registered)

- P1: E1 holds; point figure 0.02–0.04 (the paired bet's learning cost keeps it under α at 60).
- P2 (reproduction checks, not predictions): D-1.5 median 40 ±2, D-2.0 median 25–27, both ≥ 0.99.
- P3 (the figure): R-1.5 detected by 60 in **0.45–0.75**, median tick among detections 35–50, 90th
  percentile beyond 60 (undecided); R-2.0 detected by 60 in ≥ 0.90, median 24–32; R-1.2 detected by
  60 in under 0.15. Reasoning: the wealth's drift per tick is the same as under D, its variance is
  not — under D the per-tick share X is nearly constant, under R it carries the binomial spread of
  two counts of about 6 and 9, so the crossing time spreads around the same centre.
- If R-1.5's detection by 60 is below 0.45, the planner's 44 ticks is a median under near-constant
  counts and an optimistic figure for a real random fault; that is reported as the consequence, not
  adjusted for.

## 6. Not measured

Latency regressions (the sign kind is held inside its band); faults that are bursty or correlated
across ticks; load-dependent faults; unequal weights; missingness; any traffic other than the real
cells' 2,440 requests per tick; the real service (a Fargate task is not the generator's process
model beyond its fault counter); the planner's accuracy at other rates.

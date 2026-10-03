# Report — the `rate` kind's detection time under random fault arrivals at the real cells' traffic (`2026-10-twin-rate-random-arrivals`, T1)

- **Registration:** `PREREGISTRATION.md` at `d1827a2`, alone, before the harness (`ecb1901`). No amendment.
  Verdicts as computed; no bar moved.
- **Run:** `results/run-20261003T045238Z/` — engine `0.13.0-pre` at `ecb1901` (the `de25786` detector and
  gate trees, unchanged), Node v25.9.0, R = 10,000 per cell, T = 60, seeds `lcg(20261003 + 7919·i)`.
- **Verdicts:** E1 PASS, E2 PASS, E3 reported.

## 0. The headline

The fault study's sentence "at ×1.5 under random arrivals some runs would cross 60 ticks; this study does
not say how many" is answered: **6.6% of 10,000** (657) at the real cells' traffic, with the median
detection at tick 43 against the deterministic cells' 40. At ×2, none cross; median 26 against 25.

| Cell | Arrivals | ρ | Detected by 60 | Rollback tick: median, IQR, p90, p99, range | Verdict |
|---|---|---|---|---|---|
| N-R | random | 1.0 | 0 of 10,000 | — | **E1 PASS** (bar 0.0556) |
| D-1.5 | counter | 1.5 | 1.000 | 40, 40–41, 41, 42, 38–43 | **E2 PASS** (band 37–43; real cell 38–42, median 40) |
| D-2.0 | counter | 2.0 | 1.000 | 25, 25–26, 26, 26, 24–26 | **E2 PASS** (band 22–29; real cell 25–26) |
| R-1.5 | random | 1.5 | **0.934** | **43**, 38–49, 54, 60, 21–60 | reported |
| R-2.0 | random | 2.0 | 1.000 | 26, 24–29, 31, 36, 17–42 | reported |
| R-1.2 | random | 1.2 | 0.056 | 54, 49–58, 59, 60, 31–60 | reported |

Every rollback in every cell fired on `http_5xx` alone; 0 sample-ratio halts, 0 proceeds, in 60,000
replications. Mean faults per arm per tick: control 6.0–6.1 in every cell; canary 9.1–9.2 at ×1.5,
12.1–12.2 at ×2, 7.3 at ×1.2 (the real cells: 6.07–6.15 control, 9.17 at ×1.5).

## 1. Readings

**E2 first.** The counter generator lands the real cells' tick distributions (median 40 with range
38–43 against the real 38–42; 25 with 24–26 against the real 25–26), so the comparison between the D
and R columns is a comparison the real cells license.

**The figure (E3).** Randomising the arrivals moves the ×1.5 median by three ticks and widens the
spread from 38–43 to 21–60: a quarter of runs detect after tick 49, a tenth after 54, and 6.6% are not
decided when the 60-tick bake ends. At ×2 the same widening (17–42) stays inside the bake. At ×1.2,
the declared tolerance's own size, a one-hour bake detects 5.6%; that effect is below what this bake
is for.

**Prediction P3 was wrong in the pessimistic direction.** I registered 0.45–0.75 detected by 60 at
×1.5; the result is 0.934. The reasoning behind the range (the same drift, more variance) was right
about the shape and wrong about the size: the binomial spread of counts near 6 and 9 is smaller
relative to the drift than I allowed for. The median range (35–50) and the p90-beyond-60 clause
held (p90 54, p99 60). P1 (0.02–0.04 false rollback) was also wrong: the point figure is 0, the
paired bet's learning cost keeping the null wealth below 40 in every one of 10,000 60-tick runs.

**The planner.** `ticksToDetect` gives 44 at ×1.5 and 26 at ×2 for this traffic (`per-shard/twin-planning.ts`).
Under random arrivals those are the medians to within a tick (43, 26), so the planner's figure is a
median under either arrival model, and the fault study's §3 worry that it is "an optimistic figure for
a real random fault" does not hold at these sizes: the bake sized at the planner's figure detects
about half the runs by then under either model, and the question is the spread, which the planner
does not give. For a ×1.5 regression to be detected in 95% of runs at this traffic the bake needs
more than 60 ticks; this study does not say how many more (T = 60 was registered).

## 2. Consequences

- DeploySignal ADR 0001 §4 ("Not claimed") may replace its unquantified sentence with: at the real
  cells' traffic and a ×1.5 target-error regression, random fault arrivals leave about 6.6% of
  60-tick bakes undecided (T1 figure, this study); at ×2, none.
- The real A/As measured the `rate` kind on an under-dispersed null (evenly spaced faults); the N-R
  cell shows 0 false rollbacks in 10,000 at the modelled null at this traffic, so nothing in the real
  A/A result depended on the under-dispersion for the `rate` kind. The `sign` kind is not addressed.

## 3. Not measured

Latency regressions (the sign metric was held inside its band); bursty, correlated or
load-dependent faults; unequal weights; missingness; traffic other than 2,440 requests per tick;
bakes longer than 60 ticks (how many ticks a 95% detection of ×1.5 needs); the real service.

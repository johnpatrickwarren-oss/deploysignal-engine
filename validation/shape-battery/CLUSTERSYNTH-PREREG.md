# Pre-registration — the shape detector on clustersynth telemetry

**Registered 2026-08-05 before the harness was written.** First evaluation of the shape-kurtosis
detector on telemetry it did not generate.

## Why clustersynth, and what it does and does not buy

Five GPU counters — `gpu_temp_c`, `power_w`, `sm_util`, `hbm_bw_gbps`, `nvlink_tx_gbps` — the
telemetry category public request traces lack entirely (`knowledge/stats/family-c-reachability-2026-08-04`:
all four real corpora carry 1–3 request-level signals, none of them fleet telemetry).

It is built so a detector cannot be graded against its own assumptions: `REALISM-PLAN.md` states the
harness "never imports Tessera's detection code", and it imports none of DeploySignal's either.
Structurally it has the three properties my synthetic nulls test **one at a time**, present together:
heterogeneous per-(shard,counter,factor) loadings, OU processes at per-counter physical timescales
(temperature slow, `sm_util` sub-second), and opt-in Student-t heavy tails.

**What it does not buy, in the harness's own words** (`EVALUATION.md`): *"code-level independence …
is real, but statistical independence is not … Scores here demonstrate internal consistency at
scale, not performance on out-of-family (real-cluster) telemetry."* That caveat was written about
Tessera's detector and applies here with at least equal force. **This is out-of-sample within a model
family, not real-cluster validation**, and no result below may be reported otherwise.

## Design

`buildScenario` → `realizeShard` per GPU, giving 5 counter series per shard. p=5, so this compiles
where Family C could not — the score is per-coordinate and needs no fixed signal count.

Baseline = first 600 ticks per shard, live = the remainder. Calibration is the **MCD-trimmed
empirical** path, which the contamination arm established as required. W=30, α=0.05.

| arm | scenario |
|---|---|
| **C1** | healthy, `faults: false`, default nonstationarity |
| **C2** | healthy, `heavyTails: { df: 5 }` |
| **C3** | healthy, nonstationarity off — isolates whether diurnal/thermal drift is what bites |
| **C4** | power: healthy baseline, live coordinates replaced by a moment-matched bimodal mixture at the midpoint |

Instrument: test-martingale class — increment estimator with the standard rule, plus the crossing
rate.

## Registered predictions

- **P1 — the one that matters.** C1 is **refuted**. The synthetic battery fed the detector one
  departure at a time; clustersynth presents correlated factors, per-counter serial dependence and
  nonstationarity simultaneously, and the empirical calibration is built from a 600-tick window that
  cannot capture a diurnal cycle. Registered range: crossing rate above 0.20.
- **P2.** C3 (nonstationarity off) is **materially better than C1** — at least 5× lower crossing —
  identifying drift rather than correlation as the binding problem.
- **P3.** C2 (heavy tails) is **no worse than C1**. The empirical calibration inherits the tails,
  which is exactly what the N6 arm showed it fixes.
- **P4.** C4 retains power above 0.50 wherever C1's false-alarm rate is below 0.10. If the detector
  is refuted on healthy data, power is not meaningful and will be reported but not scored.

**What would make this a stop.** P1 holding *and* P2 failing: the detector would then be broken by
realistic telemetry for a reason the synthetic battery cannot isolate, and wiring it would be
premature regardless of the earlier clean arms.

## What this cannot establish

- **Not real-cluster performance**, per `EVALUATION.md` above.
- **p=5, not 11.** A different, smaller multivariate problem than Family C's.
- **clustersynth's own fault types** (`mean_shift`, `drift`, `variance_collapse`, `detachment`) are
  **not** shape faults at matched moments; C4 injects one rather than using them, so C4 is synthetic
  inside an otherwise independent generator.
- **I have not verified how much of `REALISM-PLAN.md` is implemented**; its status line reads
  "proposed" with Tier 0 landed.

## Disclosure

I built the detector and am choosing the harness to test it on. P1 is registered as refutation
because that is what I expect, and a clean C1 would be the surprising outcome.

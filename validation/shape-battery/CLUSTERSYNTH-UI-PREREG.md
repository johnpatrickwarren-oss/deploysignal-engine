# Pre-registration — universal inference and sequential UI on clustersynth telemetry

**Registered 2026-08-05 before the harness was written.** Tests `WORKLIST` C27 against the two
detectors the audit could not refute.

## Why

`stats/detector-audit-terminal-2026-08-05` and `-arm3-` found universal inference refuted in **no
cell of either arm**, and sequential UI refuted in none. C27 holds that every such clearance is
evidence about **isolated** departures only: N1–N7 varies one thing per cell, and
`stats/shape-clustersynth-2026-08-05` showed a detector clearing that battery and then firing on
82% of healthy clustersynth shards.

Both envelopes make an explicit any-φ claim. `UI_MEAN_SHIFT_ENVELOPE`: *"E[e|H0] ≤ 1 for ANY φ incl.
near unit root"*. `SEQUENTIAL_UI_ENVELOPE`: *"E[E_τ] ≤ 1 at every stopping time for ANY φ incl. near
unit root — BY CONSTRUCTION"*. clustersynth's OU counters span `tauIdio` 0.5s to 120s at `dt_s = 30`,
so this tests those claims against dependence they were not tuned on.

## Design

Both detectors are **univariate**, so each runs per counter — 5 instances per shard. Healthy
scenarios only (`faults: false`); every fire is a false alarm.

Per C26, the instrument follows the class:

| detector | class | scored |
|---|---|---|
| `universal_inference_e_value` | **terminal** | exceedance `P(e ≥ 1/α)`; mean reported, unscored |
| `sequential_ui_e_process` | **e-process** | stopped mean and crossing rate; **increment not applicable** |

Arms: healthy; heavy-tailed (`df=5`); nonstationarity off. α=0.05, 120 shards.

## Registered predictions

- **P1.** Universal inference **holds** — exceedance ≤ 0.05 on every counter. Stated as my prior in
  conversation before this file: its conservatism is structural, a split-LRT Chernoff bound with `a`
  fixed at 1, not a tuned quantity.
- **P2.** Sequential UI **holds** — crossing ≤ 0.05 on every counter.
- **P3.** If either fails, it fails on the **slow** counters (`gpu_temp_c`, `tauIdio = 120s`) before
  the fast ones (`sm_util`, `0.5s`), because sustained autocorrelation is the stress.
- **P4.** Neither is worse under heavy tails than at baseline. Both envelopes disclose a heavy-tail
  caveat (ADR 0011), so this is the registered check of it rather than an assumption.

**What would be the significant result.** P1 failing. Universal inference is the portfolio's only
detector refuted nowhere and the natural anchor for any rebuild. If it fires on healthy telemetry
from a generator it was not tuned against, the portfolio has **no** validated detector and C27
generalises to everything measured this week.

## What this cannot establish

- **Not real-cluster performance** — `../../../clustersynth/EVALUATION.md` states the harness's
  telemetry is not statistically independent of the model family detectors assume.
- **Univariate per counter.** No cross-counter structure is exercised; that is a different test.
- **Nulls only.** Power is not measured here.

## Disclosure

I predicted in conversation that UI would hold, before writing this. P1 is registered as the outcome
that would undermine the strongest positive finding of the week — one I have leaned on repeatedly.

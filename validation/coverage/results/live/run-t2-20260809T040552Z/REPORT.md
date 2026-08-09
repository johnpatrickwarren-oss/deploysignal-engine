# T2 arm `run-t2-20260809T040552Z` — the A-placement confound, measured

Dated **2026-08-08**, written after the whole-branch review and added to this run directory
without touching its committed `summary.json` or `manifest.json` (committed at `e62af91`). It
exists because the reading this run was given in
`../run-20260809T035934Z/REPORT.md` §4 (lines 86-90) — *"this coordinate's live span is not
exchangeable with its own reference, which is precisely the contiguity question this arm exists to
answer"* — **needs a confound named beside it, and the confound is decisive.**

## The probe, reproduced here rather than taken on report

The review delegated this probe and did not verify it independently. It is reproduced below from
the registered substrate, with its method and seeds, and it **REPRODUCES EXACTLY** — including the
first shard's individual `p` values, digit for digit.

**Method.** The registered T2 substrate and geometry, nothing else changed:
`cs.buildScenario({family:'gb200', pods:1, seed:20260855, window:{steps:9600, dt_s:30},
faults:false})`, `sc.gpuIds.slice(0,120)`, `cs.realizeShard(sc.seed, gid, sc.ctx, sc.graph,
sc.applier, undefined, undefined)`; geometry `W = 150`, `nA = 2250`, `m = 45`; live slice ticks
`9000..9600` → 4 windows of 150, **identical in both arms of the probe**. The SAME 9,000 reference
ticks are split two ways:

```
first-A   A = reference[0 .. 2250)      B = reference[2250 .. 9000)     <- what the harness does
last-A    A = reference[6750 .. 9000)   B = reference[0 .. 6750)        <- A moved to the end
both      2,250 + 45*150 = 9,000 exactly; live windows identical
```

Script: `a-placement-probe.mjs` in the task scratchpad. The crossing check recomputes the wealth as
`sum_w log(kappa*p_w^(kappa-1)) >= log 20`; it returns **8** crossings for `gpu_temp_c` under
`first-A`, which is exactly the 8 of 600 this run's pooled row records, so the recomputation agrees
with the harness's registered any-prefix rule on this substrate.

## What it reads

`gpu_temp_c`, shard `cluster-0-pod-0-rack-0-tray-0-gpu-0` — the review's claimed values, reproduced:

| A placement | window 1 | window 2 | window 3 | window 4 |
|---|---|---|---|---|
| **first-A** (the harness) | `0.0435` | `0.0217` | `0.0217` | `0.0435` |
| **last-A** | `0.9783` | `0.9130` | `0.8478` | `0.9783` |

**And the whole-arm reading, which is stronger than the single shard and is this document's own:**

| coordinate | crossings under first-A | crossings under last-A | shards whose mean `p` changes side |
|---|---|---|---|
| `gpu_temp_c` | **8 / 120** | **0 / 120** | 112 / 120 |
| `power_w` | 0 / 120 | 0 / 120 | 118 / 120 |

**Every one of this run's eight crossings disappears when `A` is moved to the other end of the same
reference window.** `power_w` crosses under neither placement, but its `p` values still flip side
(first-A `0.74/0.61/0.52/0.52` → last-A `0.33/0.22/0.15/0.15` on the first shard, 118 of 120 shards
flipping), so the dependence on `A`-placement is **universal on this substrate and not confined to
the coordinate that crossed.**

## The confound, named

**A `p` that inverts when the reference segment is taken from the end of the window instead of the
beginning is measuring temporal drift in the reference, not the live span's exchangeability with
it.** `gpu_temp_c` warms across the scenario: live windows sit far from an early-`A` ECDF and close
to a late-`A` one. So:

- **The `0.0133` pooled crossing rate and the `2.028722` `gpu_temp_c` increment mean are
  artifacts of A-PLACEMENT on non-stationary telemetry.** They are real numbers about this
  construction on this substrate, and they are **not** an answer to K6.12's contiguity question.
- **`../run-20260809T035934Z/REPORT.md` §4's contiguity reading is therefore over-claimed** and is
  corrected here rather than there (that file is committed and is not edited): the deviation it
  attributes to non-exchangeability of the live span is at least as well explained by where `A` was
  cut, and the 8 → 0 flip is the evidence.
- **K6A.1.11 disclaimed A-placement on IID evidence** — v2.K6A Table 4 measured `x` flat across
  `n_A ∈ [2,000, 100,000]`, so the amendment concluded *"the ratio, not the absolute A-size, is
  what is preserved."* That is a statement about A's SIZE under an iid draw. **It licenses nothing
  about A's POSITION in a non-stationary series**, and this probe is the first measurement of that.

## Registered consequences, and what is not claimed

The **T2 stop condition still cleared on its registered instrument** (pooled Wilson LB `0.007528`
≤ α) and no endpoint moves. Nothing here is a new endpoint: this is a diagnostic on a committed run,
carrying no verdict, in the shape §11 rule 3 requires.

**Named not-done**, because each is a registration and not an append: a registered rule for where
`A` is cut on a non-stationary T2 substrate (first, last, or interleaved); a re-reading of K6.12's
contiguity question under a placement that is not confounded; and whether the T1 arm — whose
held-out draw is iid by construction, so this confound cannot arise there — needs any change at all
(it does not, on this evidence).


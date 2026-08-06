# Pre-registration — the power arm the sequential audit never had

**Registered 2026-08-05 before the harness was written or any arm run.** Closes `WORKLIST` C29 for
the sequential detectors. Engine pin and SHAs in the run manifest.

## Why

`validation/detector-audit/harness/run-sequential.mjs` contains **zero power references**: it scored
`E[exp(Δ log M)]` and a crossing rate under H₀ and nothing else. So every CLEARED verdict in
`knowledge/stats/detector-audit-sequential-2026-08-05` is untested for inertness.

That is not hypothetical. `knowledge/stats/clustersynth-ui-2026-08-05` found sequential UI **valid
and inert** — refuted in no null and with zero power — and `knowledge/stats/power-per-cell-2026-08-05`
found universal inference inert at φ=0.9 behind a pooled figure of 0.7016. Both had been recorded as
clean.

**What is at stake beyond the detectors.** `WORKLIST` C23 concludes the Family A detectors are
*"sound constructions with an unsound plug-in step"*, on the evidence that they are **CLEARED at
oracle parameters**. CLEARED was validity-only. **A construction that never fires is not sound, it is
vacuous** — so if Family A betting is inert at N1, C23's diagnosis is wrong, and with it the three
remediation routes built on it.

## Substrate

`knowledge/methodology/pages/test-substrates.md` routes detector-validity questions to the
**oracle-parameter batteries**. This is the paired power arm for one of them, so it runs on the same
nulls — `validation/h0-battery/harness/nulls.mjs` N1–N7, unchanged — and reuses
`h0-battery/harness/detectors.mjs` adapters. No new noise model, no new fixtures.

## Design

Detectors: `family_A_betting_e_process`, `family_A_mixture_supermartingale`,
`family_D_spectral_e_detector` — the three the sequential audit scored.

For each (detector, null) cell: a step injected at tick 100 of a 300-tick trajectory, at two sizes.

| size | why |
|---|---|
| **3σ** | the house bar. `h0-battery` §5's vacuous-pass guard uses 3σ with a 0.50 floor, so results pair with it directly |
| **0.75σ** | δ\* from `knowledge/stats/effect-size-sweep-2026-08-04`, the located detection boundary. The 3σ bar is generous and C29's whole point is that generous bars hide inertness |

N=2000 × T=300, seeded per `SEED + 7919·i`, same scheme as the validity arm.

**Endpoint.** Detection rate = fraction of trajectories crossing `1/α` at α=0.05 at any tick.

> **POWERED iff detection ≥ 0.50 at 3σ. INERT iff < 0.50 at 3σ.**
> The 0.75σ rate is scored on the same bar and reported alongside; a cell powered at 3σ and inert at
> 0.75σ is reported as **boundary-inert**, which is a distinct outcome from either.

## NOT-EXECUTABLE conditions

Void the instrument rather than scoring the hypothesis:

1. **Saturation.** If the 3σ arm returns detection ≥ 0.99 in **every** cell of every detector
   including those the validity arm REFUTED, the injection cannot discriminate and the 3σ endpoint is
   reported unscored. The 0.75σ arm then carries the study.
2. **Numerical failure.** Family A mixture returned `NaN` at N5 and `8.5×10⁴⁶` at N6 in the validity
   arm. Those are defects, not measurements; if the power arm reproduces them, those cells are marked
   NOT-EXECUTABLE and excluded from scoring rather than counted as inert.
3. **Adapter refusal.** Any cell where the adapter cannot accept an injected step is recorded as
   not-executable with the reason, never as a zero.

## Registered predictions

- **P1 — the one that decides C23.** `family_A_betting_e_process` is **POWERED at N1**. Prior: it is
  a betting e-process built to accumulate wealth, structurally unlike UI's Chernoff bound. **Stated
  with its own caveat:** that is the identical reasoning I used to be confident sequential UI covered
  near-unit-root, and it was wrong.
- **P2.** Family A betting is POWERED in every cell it was CLEARED in — N1, N3 (all φ), N5, N6, N7.
- **P3.** `family_D_spectral_e_detector` is POWERED at 3σ in most cells. It was REFUTED throughout
  the validity arm, and a detector that over-fires is wrong rather than inert; a powered-and-refuted
  cell is the expected shape.
- **P4 — the one I expect to fail.** At **0.75σ**, at least one cell that is CLEARED on validity is
  **INERT**. If no cell is boundary-inert, the generous-bar concern C29 rests on does not bite for
  these detectors, and C29 should be narrowed to the terminal and e-process classes where it has
  already been demonstrated.

## Falsifiers accepted in advance

- **P1 failing** ⇒ C23's "sound constructions" diagnosis is withdrawn, and its three remediation
  routes are re-opened rather than ranked.
- **P4 failing** ⇒ C29 is narrowed, not generalised.

## What this cannot establish

- **One fault shape** — a mean step. Nothing here measures power against variance or distributional-
  shape faults, which is the capability Family C was retired for.
- **Oracle and estimated parameters both appear** (the nulls carry them), but no real telemetry does.
- **Detection rate is not the same as detection latency**; a detector firing at tick 299 scores
  identically to one firing at 101.

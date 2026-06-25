# ADR 0012 — universal-inference e-value on REAL GWDG GPU telemetry: per-shard fails, fleet-FDR holds

- **Date:** 2026-06-25
- **Status:** Validation findings (no code change beyond envelope-note correction + this record).
  **Refines ADR 0011** — the NAB single-series result was too optimistic about *per-shard* validity;
  real GPU-node telemetry is harder, and the honest line lands where Tessera ADR 0007 already put it.
- **Substrate:** the real **GWDG GPU Node Telemetry** dataset (Zenodo 19052367, re-fetched: 21
  node-incident files, DCGM per-GPU metrics, tidy schema). Per node the 4–8 GPUs are a real fleet with a
  genuine shared common-mode (node power/thermal/driver). The incident hits at the end of each file, so
  the healthy prefix is H0. 16 usable node-fleets, ~178 healthy fleet-windows, ~710 GPU-shard evals
  (cal=120, test=60, q=0.1), via the engine's ACTUAL `multiFactorRobustResiduals` + `eBenjaminiHochberg`.

## Findings

**1. Per-shard `E[e|H0] ≤ 1` is NOT achievable on real GPU telemetry — even fully preprocessed.**
Raw per-shard means are astronomically inflated (GPU_TEMP 3.6e9, POWER 6e5, UTIL 2.5e8). Multi-factor
common-mode removes the *shared* drift and cuts that by orders of magnitude (→ 181 / 2.2e5 / 2922), and
adding a per-shard temporal baseline (causal trailing average — the baseline-lifecycle's job) cuts it
again (→ **24 / 9 / 9**) and bounds the tail (max e ~1e4 vs raw 2.5e12) — but **none reach ≤ 1**. Real
per-shard telemetry carries within-window nonstationarity (thermal ramps, load swings, periodic
structure) that no fixed baseline removes. This is exactly Tessera ADR 0007 / [[project_tessera_guarantee_finding]]:
**the per-shard FP/validity guarantee does not survive real nonstationarity — for ANY fixed-baseline
e-process, the UI included.** (ADR 0011's "0/46 NAB series violate" reflected NAB's slow, cleanly-detrendable
metrics; it does not generalise to GPU telemetry. Per-shard validity on real data is substrate-dependent
and must not be claimed in general.)

**2. Fleet-FDR `FDP ≤ q` HOLDS — and the UI's bounded tail is what makes it hold.** Across every metric
and preprocessing level, `P(any false fire)` over healthy fleet-windows stays **0.6–4.5% ≤ q = 10%**. The
decisive contrast, real GWDG GPU_UTIL, full preprocessing:
- **UI e-value: fleet FDP = 1.1%**, max single e = 3.8e3 (bounded).
- **safe-t: fleet FDP = 20.8% ≫ q**, max single e = **1.07e64** — a single catastrophic per-shard e-value
  forces an e-BH rejection, so the safe-t's exponent fragility destroys the FLEET guarantee too.
So the UI e-value's structural win (ADR 0010 — bounded, no `(ν+1)/2` blow-up) is **load-bearing at the
fleet level**: it is what lets the cross-shard e-BH ranking control false discoveries on real data.

**Honesty on the FDR theorem.** e-BH's FDR ≤ q theorem *requires* per-shard `E[e_j|H0] ≤ 1`, which (finding 1)
fails on real telemetry. So fleet FDP ≤ q here is **empirical, not a theorem**: it holds because the residual
per-shard inflation is largely common-mode (cancels in the ranking) and the UI's bounded tail prevents the
single-shard catastrophic fires that would otherwise trigger spurious discoveries (as the safe-t's do).

## Verdict
- The guarantee that **survives contact with real telemetry is FLEET-FDR, not per-shard** — precisely
  Tessera's design thesis. On real GWDG the UI-e-value fleet pipeline (multi-factor common-mode → UI →
  e-BH) keeps FDP ≤ q; the safe-t does not.
- **Deploy** the UI e-value at the fleet-FDR layer (its intended home), on common-mode + baseline-lifecycle
  residuals. Do **not** market a per-shard `E[e|H0] ≤ 1` guarantee on raw or even baselined real telemetry.
- The ADR 0010 *construction* guarantee (any-φ, bounded, by construction) stands as a MODEL property and is
  what makes the empirical fleet result hold; it is not a free per-shard guarantee on real data.

## Carry-forward
- Fleet FDP ≤ q is empirical here; a *provable* fleet-FDR statement on nonstationary real data needs either
  a per-shard e-value valid under nonstationarity (open — cf. a robust/weighted e-process) or an e-BH
  variant tolerant of common-mode-inflated nulls. Genuine open research.
- Larger real fleets (these node-fleets are 4–8 GPUs) would tighten the fleet-FDP estimate.
- Harnesses: `scratchpad/gwdg-fleet-run.mjs`, `gwdg-fleet-full.mjs`, `gwdg-contrast.mjs`, `fleet-gwdg.mjs`.

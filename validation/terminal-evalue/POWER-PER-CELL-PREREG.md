# Pre-registration — un-pool the terminal study's power control

**Registered 2026-08-05 before the change.** Answers `WORKLIST` C29 for the terminal detectors.

## The defect

`harness/run.mjs:72` computes the power control **inside** the per-null loop but accumulates it into
a single `det._pow` array, reported at line 102 as one pooled rate. safe-t's recorded **0.9610** is
therefore an average over N1, N2-m30/100/500, N3, N4, N5 and N6. **A cell in which the detector is
inert is invisible in that number.**

This matters because `stats/clustersynth-ui-2026-08-05` found sequential UI valid and inert, and
`WORKLIST` C23's cheapest recommended fix — mine, twice — is to **route the estimated-baseline regime
to safe-t**. That recommendation rests on safe-t holding at N2, and "holding" was measured as
validity only.

## Change

Record power per `(detector, null)` cell rather than pooling. No other change; the null endpoints,
seeds and cells are untouched, so the validity columns must reproduce exactly.

## Registered predictions

- **P1.** safe-t's power is **≥ 0.50 in every N2 cell**. My prior, and the reason C23 named it. If it
  fails, C23's routing recommendation is wrong and I made it twice on validity evidence alone.
- **P2.** Power is **not uniform across cells** — it falls with `m` at N2 (a shorter calibration
  makes the null wider) and is lowest at N4-p09, the near-unit-root cell.
- **P3.** universal inference has **lower power than safe-t in every cell**, being a Chernoff bound
  with `a` fixed at 1. Its pooled rate was 0.7030 against safe-t's 0.9610.
- **P4.** The validity columns reproduce to the digit, confirming the change is inert with respect to
  everything already reported.

## What this cannot establish

- **One fault shape** — a +3σ mean shift, which is what these detectors are built for. It says
  nothing about shape faults.
- **Synthetic nulls only.**

# Project state

**Last updated:** 2026-06-24 · **by:** John Warren (with Claude)

## What this is
`@johnpatrickwarren-oss/deploysignal-engine` — the statistical-detector engine (Family A/C/D/E
detectors, e-processes, hierarchical e-value combination, e-BH FDR, topology adapters), consumed by
DeploySignal and Tessera as a pinned git dependency.

## Done
- **ADR 0004 PR D — baseline-lifecycle drift-trigger** (`per-shard/baseline-lifecycle.ts`). Promotes
  Tessera's epoch-level re-record trigger (ADR 0011) — the baseline-MAINTENANCE half of the charter
  ("when is the baseline stale?"). The engine owns only the DECISION machine: `freshBaselineLifecycle` +
  `updateBaselineLifecycle(state, fired) → {reRecord}` consume a stream of consumer-supplied alarms and
  emit `reRecord` when the trailing alarm RATE (≥rateThreshold within window, past cooldown) marks the
  baseline stale. The consumer supplies the alarms and does the actual re-record (re-pull/shadow/cutover);
  no betting e-process or calibration leaks into the engine module (charter split).
  - **Key finding preserved (tested):** per-fire RUN-LENGTH cannot tell drift from a fault (both fire at
    run-length ~9); the working signal is sustained alarm RATE. The machine triggers on count-within-window,
    not consecutiveness — pinned by a rate-not-run-length test.
  - **Documented divergence:** the engine CLEARS the alarm window on re-record (fresh epoch); verified
    byte-identical to the Tessera reference at the default cooldown≥window (0 mismatches / 2905 random
    cases) and strictly safer for cooldown<window (no re-record storms).
  - End-to-end (engine betting e-process, 40 trials): on slow drift static piles up 153 alarms, the
    lifecycle re-records ~8.8×/trial and cuts to 50 (33%); a SHARP fault is still detected 100% (its
    first alarm precedes the rate trigger). Caveat documented: re-record trades latency for FP
    suppression (ADR 0006 masking); continuous within-epoch change degenerates toward adaptive → fleet's
    job (PRs A/B), not a single-shard scheme.
- **AR(1) pre-whitening on the betting e-process path.** The betting detector was the one Family A
  detector not consuming the `ar1_phi` field (the others — mixture-supermartingale, Page-CUSUM,
  ar-p, seasonal — already pre-whiten). Under autocorrelated H0 this left its Ville bound broken
  (AR(0.9) null fire-rate >30% at α=0.01). Now `updateBettingState` consumes `ar1_phi` (default 0,
  backward-compatible), mirroring the mixture-supermartingale pattern. See
  `decisions/0001-betting-eprocess-ar1-prewhitening.md`.
- Full suite 123 pass / 0 fail (incl. 5 new tests: phi=0 identity, last_x_centered storage, AR(0.9)
  FPR collapse, power retained, iid sanity).

## In flight
- ADR 0004 promotion: PRs A (#21), B (#22), C (#23) all SHIP via cold-eye. PR D (this branch, off main)
  under cold-eye. PR E (validity-envelope metadata across all e-values + relabel the plug-in
  betting/mixture as conditionally-valid) is the last and is cross-cutting.

## Next
- Land PRs A–D; then PR E (the cross-cutting honesty fix — gate the plug-in e-values out of the FDR
  path unless their validity regime is asserted; surface guarantee conditions in the fleet verdict).
- Tag an engine pre-release after PR E; Tessera bumps its pin and migrates its `tools/*` to thin
  validation harnesses over the promoted APIs (ADR 0004 migration step 6).

## Pointers
- Decisions: `decisions/` (ADR 0004 scopes the promotion; ADR 0001 betting-path)
- Added (PR D): `per-shard/baseline-lifecycle.ts`, `test/adr-0004-pr-d-baseline-lifecycle.test.ts`
- Source of truth (Tessera): `tools/lifecycle-monitor.ts` (PR D, ADR 0011 — the decision machine only;
  the betting e-process + calibration stay consumer-side)
- NOTE: PRs A/B/C carry their own STATE Done-entries on their branches; reconcile at merge.

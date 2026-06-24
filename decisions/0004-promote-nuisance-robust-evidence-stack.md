# ADR 0004 — the engine/consumer charter + promoting the nuisance-robust evidence stack (accurate, conditional, by-construction FP/FDR)

- **Date:** 2026-06-24
- **Status:** Proposed (scoping handoff — authored from Tessera; not yet implemented here)
- **Provenance:** validated in Tessera as `tools/{nuisance-robust-evalue,contamination-robust-fleet,fault-discriminator}.ts` (Tessera ADRs 0013/0015/0016), each cold-eyed. All are Tessera-original, marked `NOT vendored`, built to be promoted here once proven. This ADR scopes the promotion; it does not implement it.

## Goal (and the honest framing)

Make `deploysignal-engine` the **consolidated, domain-agnostic statistical evidence engine** that all the consumer repos (Tessera + others) build on — with an FP/FDR guarantee that is *real but conditional and by construction*, not an unconditional promise. Two things this ADR establishes: (1) a standing **charter** for what belongs in the engine vs a consumer (below), so future promotions across all repos follow one rule; (2) the specific **promotion** of the nuisance-robust evidence stack validated in Tessera. The Tessera arc (ADRs 0001–0016) established precisely what is and isn't guaranteeable:

- **FP/FDR ≤ q is achievable BY CONSTRUCTION** = a *valid* per-shard e-value (E[e|H0] ≤ 1) + a contamination-robust fleet common-mode + e-BH. The engine already has e-BH; it is missing the *valid e-value* and the *robust common-mode*.
- **FD (detection) is NOT unconditionally guaranteeable** — only characterizable: detection ≥ X for effect ≥ δ (a power/MDE curve). Any "guaranteed FD" without a minimum-effect qualifier is an overclaim.
- The guarantee carries **conditions** (mean-shift null + stable variance; AR(1) whitening; fault-fraction < robust breakpoint ~20%; genuine common-mode coupling). The "accurate" part of the engine is that these conditions are **first-class and auditable per detector**, not buried.

## Charter — the engine/consumer dividing line (the governing rule for ALL consumer repos)

`deploysignal-engine` is the consolidated, domain-agnostic statistics layer. Multiple repos (Tessera and others) consume it for their own problem sets. The standing rule for what lives here vs in a consumer:

> **Anything that CONSTRUCTS or MAINTAINS a baseline, or DETECTS statistically significant deviation from it — with its validity and false-discovery accounting — lives in the engine. Everything domain-specific lives in the consumer.**

| **Engine** (here — domain-agnostic, shared) | **Consumer** (per repo — problem-specific) |
|---|---|
| Baseline **construction**: seasonal/2D decomposition, AR(1) whitening, per-shard level, robust fleet common-mode, the m≫n discipline | **Data plane**: loaders, adapters, topology/metric sources, the event/deploy feed |
| Baseline **maintenance**: lifecycle re-record / drift-trigger (when is the baseline stale?) | **Domain semantics**: what a "fault" means here, benign/fault labels, actions, thresholds-of-concern |
| **Deviation detection**: valid e-values (BF), distributional-signature detectors (variance/trend/collapse), Page-CUSUM, … | **Orchestration** wiring specific to the problem |
| **Evidence accounting**: per-detector validity envelopes, e-BH FDR, hierarchical combination | |

**Boundary test.** The engine answers: *"is there a statistically significant deviation from the baseline, of what type, with what evidence and validity?"* The consumer answers: *"given my domain's events and what counts as a fault, what does that mean and what do I do?"*

**The one genuinely split case — benign/fault discrimination:** the statistical *typing* of a deviation (mean-shift vs a variance/trend/collapse signature) is engine; the semantic *labeling* (benign vs fault) and the event *source* are consumer; the generic escalation *mechanism* ("an unexplained significant deviation escalates," with the event channel as an injected interface) may live in the engine as an optional policy, but the feed and the fault definition do not. See Tier 3.

## Current engine state (what already exists — do NOT re-promote)

- `fleet/e-bh.ts` → `eBenjaminiHochberg(...)` — the FDR operator. **Already here.** (Tessera's `tools/fleet-fdr.ts:eBH` is a reimplementation → dedupe by consuming this.)
- `fleet/combine.ts` → `combineProduct`/`combineAverage`/`updateFleetEProcessState` — hierarchical e-value combination. Already here.
- `detectors/betting-e-process.ts`, `detectors/family-a-mixture-supermartingale.ts` — e-values **proven INVALID under estimated (plug-in) baselines** (Tessera ADR 0008/0014: E[e|H0] → 1e8 plug-in, → 3e9 mixSM at large n). They are valid only with a true baseline or m≫n. The engine currently ships these without a documented validity envelope — that is the accuracy gap.
- `detectors/self-normalized-e-process-fallback.ts` — handles the near-unit-root / conditional-exemption regime (variance scale). Complementary to the BF (which handles the unknown MEAN). Document when each applies.
- AR(1) whitening (`ar1Phi` / `computePerSignalAr1Phi`, Kendall-corrected, ADR 0002) — already here; the promoted BF should use it natively.

## What to promote (tiered, with source → target → API)

### Tier 1 — the missing VALID per-shard e-value (the #1 gap)

**Nuisance-robust two-sample Bayes-factor e-value.** Source: Tessera `tools/nuisance-robust-evalue.ts:nuisanceRobustEValue`. Target: `detectors/nuisance-robust-bf-e-value.ts`.

```ts
// E[BF|H0] ≤ 1 BY CONSTRUCTION (a proper-prior Bayes factor) — valid under an UNKNOWN baseline mean
// (integrated out, never plugged in) and AR(1) autocorrelation (whitened). The valid replacement for
// the plug-in betting / mixture e-values in the estimated-baseline regime.
export function nuisanceRobustBFEValue(
  values: ReadonlyArray<number>,
  cal: { start: number; len: number },
  test: { start: number; len: number },
  opts?: { tauMult?: number; ar1Phi?: number },   // tauMult default 25; phi default = engine ar1 estimate
): number;
// Validity envelope (must ship as metadata): mean-shift null, SAME innovation variance cal/test,
// AR(1)-whitened. A variance change is OUT of scope here — that is the distributional-signature
// detector's job (Tier 2), which is the natural complement.
```

Generalize Tessera's `(values, m, n)` (which fixes cal=[0,m)) to arbitrary windows (cf. Tessera `bf-lifecycle.ts:bfWin`). Use the engine's native AR(1) for `phi` (Tessera used a mirror).

### Tier 1 — the contamination-robust fleet common-mode (the fleet guarantee piece)

Source: Tessera `tools/contamination-robust-fleet.ts:{robustCenter,perShardLevel,robustResiduals}`. Target: `fleet/common-mode.ts` (+ a generic `robustLocation` in a stats util, e.g. alongside `_linalg.ts`).

```ts
// Redescending Tukey-biweight M-estimator (IRLS, median start, MAD scale). True outliers → weight 0,
// so a MINORITY of faulty shards is rejected (breakdown ~ fault-fraction < ~20% empirically).
export function robustLocation(xs: ReadonlyArray<number>, c?: number): number;

// Per-shard level demean (so faults become cross-sectional outliers — the step plain median/trimmed
// centers lack) + per-tick robust cross-section. R[i][t] = X[i][t] − ℓ̂_i − c_t.
export function contaminationRobustResiduals(X: ReadonlyArray<ReadonlyArray<number>>, calLen: number): number[][];
```

The pipeline `contaminationRobustResiduals → nuisanceRobustBFEValue (per shard) → eBenjaminiHochberg` is the FP/FDR-by-construction guarantee. **Condition:** the common-mode is a per-tick SCALAR (homogeneous loading) and the fault fraction is under the robust breakpoint; heterogeneous loadings need a multi-factor extension (future).

### Tier 1 — baseline MAINTENANCE: the lifecycle re-record / drift-trigger

Per the charter, deciding *when a baseline is stale and must be re-recorded* is domain-agnostic baseline management and belongs here, not in each consumer. Source: Tessera `tools/lifecycle-monitor.ts` (Tessera ADR 0011). Target: `per-shard/baseline-lifecycle.ts` (alongside `runtime.ts`/`warm-start.ts`).

```ts
// Drift is detected at the EPOCH level, not per-fire: Tessera ADR 0011 found a per-fire run-length
// discriminator FAILS (benign drift and faults both fire at run-length ~9). The working signal is a
// SUSTAINED elevated alarm RATE → re-record the baseline. Beats both a static baseline (drift FP) and
// a trailing-adaptive one (which MASKS slow faults — ADR 0006); the re-record/adaptive masking tradeoff
// is the standing caveat. Degenerates toward adaptive under continuous within-epoch change → that
// residual is the fleet's job (the common-mode + valid e-value above).
export interface BaselineLifecycleState { /* alarm-rate window, current baseline epoch, … */ }
export function freshBaselineLifecycle(opts?: { window?: number; rateThreshold?: number }): BaselineLifecycleState;
export function updateBaselineLifecycle(state: BaselineLifecycleState, fired: boolean): { reRecord: boolean };
```

This closes the baseline-CONSTRUCTION/MAINTENANCE half of the charter (construction — seasonal/AR(1)/level/common-mode — is already here or above). **Condition / honest caveat:** re-recording trades detection latency for FP suppression (the ADR 0006 masking tradeoff); the trigger is epoch-level, so a single sharp fault is caught by the e-value, not the lifecycle. The consumer supplies *what* counts as an alarm and *what* re-record means operationally (re-pull data, shadow, cutover); the engine supplies *when*.

### Tier 2 — distributional-signature detectors (complete the FD side + the BF's blind spot)

Source: Tessera `tools/fault-discriminator.ts:faultSignature`. Target: `detectors/distributional-signature.ts`.

```ts
// Evidence of a change OTHER than a clean mean step — directly covers the BF's same-variance scope limit.
export function distributionalSignature(values, cal, test): {
  fRatio: number;        // innovation-variance ratio (SDC / bit-flip)
  trendT: number;        // OLS slope t-stat on WHITENED innovations (degradation). MUST whiten —
                         // raw autocorrelated values inflate the t-stat ~400× → spurious trends.
  collapseSigma: number; // one-sided DOWNWARD drop in cal-σ (detachment); upward changes invisible.
  hasSignature: boolean;
};
```

### Tier 3 — keep in the APPLICATION (Tessera / DS), do NOT promote

- The **benign/fault classifier + event-gating** (`classify`, `classifyWithEvent`): policy that depends on an app-specific deploy/schedule event feed. Its mean-only-fault catch rate is *assumed* via the event model, not a measured engine capability. Keep the POLICY app-side; expose the event channel through the existing `ds-integration`/`events` surface. (Promote the signature SCORES, not the routing policy.)
- Real-telemetry loaders, topology adapters, shadow/replay harnesses, reports → Tessera.

## The accuracy upgrade: validity envelopes as first-class

The defining change for "accurate evidence engine": **every e-value detector ships its validity envelope as metadata**, and the engine refuses to imply a guarantee outside it.

- Add a documented envelope to each e-value: `{ baseline: 'true' | 'plug-in', autocorrelation: 'iid' | 'ar1-whitened', null: 'mean-shift' | ..., variance: 'stable' | 'robust' }` and the regime where E[e|H0] ≤ 1 holds.
- **Label the plug-in betting + mixture e-values as INVALID under estimated baselines** (valid only with a true baseline or m≫n) — they remain useful in those regimes but must not be silently fed to e-BH as if valid. This is the single most important honesty fix; the Tessera arc found these are the actual source of the real-data guarantee failure.
- Surface the assembled guarantee's CONDITIONS in the fleet verdict output (fault-fraction-vs-breakpoint, common-mode-coupling assumption, MDE for the FD claim).

## The guarantee, assembled (what the engine can then claim)

```
contaminationRobustResiduals(X)            // fleet common-mode removed, robustly
  → nuisanceRobustBFEValue(per shard)       // VALID per-shard e-value
  → eBenjaminiHochberg(e-values, q)         // FDR ≤ q  ── BY CONSTRUCTION, conditional on:
                                            //   fault-fraction < breakpoint (~20%), scalar common-mode,
                                            //   mean-shift null + stable variance (else add the
                                            //   distributional-signature detector)
+ distributionalSignature(per shard)        // FD for variance/trend/collapse faults; power characterized
                                            //   per effect-size δ (NOT an unconditional FD guarantee)
```

FP/FDR: **guaranteed ≤ q by construction, within the stated envelope.** FD: **characterized power for effect ≥ δ.** The mean-only fault (a fault identical to a benign mean step) is irreducibly indistinguishable without the app event channel — name this limit in the API docs.

## Migration plan (for the engine session + the Tessera pin bump)

1. Engine PR A: `detectors/nuisance-robust-bf-e-value.ts` + tests (port Tessera's validity tests: E[e|H0] ≤ 1 at multiple scales, power 1.0; the same-variance scope test). Cold-eye.
2. Engine PR B: `fleet/common-mode.ts` + `robustLocation` + tests (the demean rank-flip, redescending rejection, FDP ≤ q on the synthetic fleet, the ~20% breakpoint). Cold-eye.
3. Engine PR C: `detectors/distributional-signature.ts` + tests (the trend-whitening fix is load-bearing — pin the valid null). Cold-eye.
4. Engine PR D: `per-shard/baseline-lifecycle.ts` + tests (epoch-level drift-trigger beats static + adaptive; the re-record/masking caveat). Cold-eye.
5. Engine PR E: validity-envelope metadata on all e-values + relabel the plug-in betting/mixture as conditionally-valid; surface guarantee conditions in the fleet verdict.
6. Tag a new engine pre-release; bump Tessera's pin (`#v0.3.4-pre` → new); migrate Tessera to consume `eBenjaminiHochberg` (drop `fleet-fdr.ts:eBH`), the promoted BF, `contaminationRobustResiduals`, and the baseline-lifecycle; Tessera's `tools/*` become thin validation harnesses over the engine APIs (re-run them as the cross-check; reports must stay idempotent).

Respect the vendoring/extract policy (SCOPING-MEMO-v0.3 § 9); the `self-normalized-e-process-fallback` sync policy stands — do not modify it, only document its relation to the BF.

## Open questions for the engine session

- **Window API:** fixed `(cal, test)` two-sample BF vs a streaming/anytime BF e-process (the engine's other e-values are streaming `update*State`). The two-sample BF is terminal; decide whether to also offer an incremental variant.
- **Where does `robustLocation` live** — a shared stats util vs `fleet/`? It is generic.
- **Multi-factor common-mode** (heterogeneous loadings) — scope now or defer? (Tessera flagged it as the next lever.)
- **Do the plug-in e-values get deprecated or just envelope-labeled?** Recommend: keep, but gate them out of the FDR path unless their validity regime (true baseline / m≫n) is asserted.

## Non-goals

Real-cluster validation, topology adapters, the event feed itself, and the benign/fault routing policy — these stay in the application layer. This ADR moves the STATISTICAL PRIMITIVES and the validity-accounting, not the orchestration or the data plane.

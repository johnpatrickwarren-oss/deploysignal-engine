# ADR 0020 — the instrumented-telemetry ingestion contract (L2 → L1 boundary)

- **Date:** 2026-06-25
- **Status:** **Accepted.** Defines how a PRODUCT supplies measured common-mode factor telemetry to the ENGINE,
  so the engine's instrumented common-mode (ADR 0018) has a clean, validated input. The contract is a thin
  types + alignment + resolution layer; it ingests no raw telemetry itself.
- **Builds on:** ADR 0018 (`instrumentedCommonModeResiduals` takes `factorSignals` + integer `membership`),
  ADR 0019 (engine owns mechanism + schema; product owns data + semantics).

## Why a contract

ADR 0018 proved localisation works only with MEASURED factors, and ADR 0019 put the mechanism in the engine.
The missing piece is the **boundary**: products have factor telemetry in wildly different shapes (a CDU temp
at 5-min cadence, a scheduler event log, per-switch counters at 1-s) and refer to factors by domain ids
(`cdu-0`, `power-feed-3`), while the engine wants a dense `[factor][tick]` matrix on the analysis grid plus
integer membership. Without a defined contract every product re-invents alignment + id-mapping (and gets the
grid subtly wrong). This ADR fixes the interface.

## The contract

The PRODUCT is responsible for **resampling** its raw factor streams onto the analysis grid (same `t0`, `dt`,
`ticks` as the shard matrix `X`) — domain-specific (which interpolation, how to fill gaps) and therefore L2.
It hands the engine:

- **`FactorTelemetry`** — `{ signals: number[factor][tick], factorIds: string[], t0, dt, ticks }`: the
  measured factors already aligned to the grid; `signals[k]` length must equal `ticks` and match the shard
  matrix's grid.
- **`membershipByFactorId`** — per shard, the factor ids it loads on (its domains: its CDU, its feed, its
  pod/rail, its job), as STRINGS (the product's natural vocabulary).

The ENGINE provides (L1, this module — `baseline/factor-telemetry.ts`):

- **`validateFactorTelemetry(ft, ticks)`** — checks grid consistency (every signal length === ticks, finite),
  unique factor ids, sane `t0`/`dt`.
- **`resolveFactorMembership(factorIds, membershipByFactorId)`** — maps string-id membership to the integer
  `membership` arrays `instrumentedCommonModeResiduals` consumes (unknown id ⇒ error; a shard may load on zero
  factors). Pure lookup; no semantics.
- **`alignToGrid(samples, t0, dt, ticks, opts)`** — an OPTIONAL convenience for the common case: resample an
  irregular `(timestamp, value)` stream to the grid by previous-sample-hold or linear interpolation, with an
  explicit max-gap-to-fill (beyond which it leaves NaN for the product to handle). Products with bespoke
  resampling skip it.

So the data flow is: product resamples → `FactorTelemetry` + string membership → `resolveFactorMembership` →
`instrumentedCommonModeResiduals(X, calLen, ft.signals, membership)`.

## Boundary discipline

- Grid alignment is the PRODUCT's job (L2): only it knows the right resampling/gap policy for its telemetry.
  The engine validates the result and offers `alignToGrid` for the simple case — it never reaches back to a
  raw source.
- Factor ids are the product's vocabulary; the engine resolves them to indices and otherwise treats them
  opaquely.
- Missing/degenerate factors are surfaced (validation throws; `alignToGrid` leaves NaN past the max gap) — the
  engine does not silently fabricate a factor (garbage factor in → garbage common-mode out, ADR 0018).

## Honest scope

This is the input contract, not new detection. It does not change the ADR 0018 ceilings: with incomplete
instrumentation the un-instrumented common-mode leaks; with noisy factors (~30%) localisation degrades. The
contract makes the *good-instrumentation* path clean and uniform across the several products the engine is
vended to.

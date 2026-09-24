# ADR 0033 — The library boundary: detectors and their use criteria on one side, consumer-shaped adapters on the other

- **Date:** 2026-09-23
- **Status:** ACCEPTED, step 1 of 4 shipped in v0.7.0-pre. Steps 2–4 are consumer PRs, listed
  below with their owners.
- **Register:** knowledge `stats/engine-consumer-charter` (the rule this enforces);
  `stats/detector-portfolio-current` (the use criteria); `methodology/engine-library-boundary`
  (the survey behind this ADR and the sequencing).

## The finding

The README and the engine/consumer charter both call this package a shared statistical library.
A survey on 2026-09-23 of what it ships found the intent was stated and not enforced:

- **Two consumers had shaped two layers.** Tessera-original modules (`fleet/`, `topology/`,
  `ds-integration/`, `events/`, `l0/`, `loader.ts`; file headers say so) were imported only by
  Tessera. DeploySignal-shaped modules (`types/audit.ts`'s registry keyed by the six LLM-serving
  signals plus 16 Family B heuristics with no engine implementation, `core.ts`'s `TrendBuffer` /
  `computeVerdict` / `TOTAL_TICKS = 32`, `o0/`, `signal-classes.ts`'s default map, the NAB tools)
  were imported by DeploySignal.
- **The use criteria existed and no consumer read them from the engine.** `guaranteeFor` had zero
  callers in Tessera, Tessera-RNG and DeploySignal, and `guarantees.ts` was not in the package
  export map at all, so a `moduleResolution: node16` consumer could not reach it. The guarded e-BH
  had one consumer caller (DeploySignal); Tessera called the ungated one 18 times, Tessera-RNG once.
- **The layering inside the library was inverted in four places.** Seven detectors imported
  `shouldSuppress` from the L0 adapter; two detectors imported from `fleet/`; `baseline/` imported
  `median` from `fleet/`; `types/` imported implementation types from `per-shard/` and `detectors/`
  and six adapter types by inline `import()`.
- **The registry could not name a non-DeploySignal detector.** The guarantee table is keyed by the
  registry, so a Tessera-RNG path-class had no id to ask "what does this guarantee?" about.
- **Duplication ran both ways.** Tessera keeps seven statistical tools the engine ports line for
  line (`contrast`, `mixture-evalue`, `nuisance-robust-evalue`, `calibration-monitor`,
  `emitter-contract`, `per-shard-whitening`, `bf-lifecycle`) and imports the engine's
  `per-shard/contrast` zero times; DeploySignal keeps a 62-file local `engine/` tree with its own
  guarantee table, last touched 2026-09-04.
- Tessera-RNG is the clean consumer: 18 files, 13 subpaths, every one of them detectors, fleet
  combination or types.

## Decision (step 1, this release)

1. **Two trees, named.** The LIBRARY is `detectors/`, `fleet/`, `per-shard/`, `baseline/`,
   `types/`, `guarantees.ts`, `signal-classes.ts`, `verdict-groups.ts` and the resampler. The
   ADAPTERS are `adapters/topology/` (with `topology-overlay.ts`, `hardware-topology-source.ts`),
   `adapters/ds-integration/`, `adapters/events/`, `adapters/l0/`, `adapters/o0/`,
   `adapters/loader.ts`, `adapters/core.ts` — moved on disk, unchanged in content. Every old import
   subpath (`./core`, `./topology/*`, `./l0/*`, `./ds-integration`, ...) still resolves, through
   `exports` for node16 consumers and `typesVersions` for classic-resolution consumers, so the
   consumer pin bump is pin-only. New code imports `./adapters/*`.
2. **The boundary is a test.** `test/library-boundary.test.ts` reads every library source file and
   fails on: a runtime import from the library into `adapters/`; a type-only import into `adapters/`
   outside a frozen six-entry allowlist (DeploySignal's orchestration hooks on
   `types/orchestration.ts` and `types/verdict.ts`, which leave at step 3); any import from
   `detectors/` or `baseline/` into `fleet/`; any import from `types/` outside `types/` and
   `signal-classes.ts`.
3. **The four inversions are fixed, each by moving a definition down and re-exporting it where it
   was.** `shouldSuppress` / `familiesToSuppress` → `detectors/_suppression.ts`; `BOUND_CLIP` /
   `BOUND_LAMBDAS` / `gBounded` → `detectors/_bounded-bet.ts`; the log-mean-exp arithmetic of
   `combineAverage` → `detectors/_evidence.ts:logMeanExp` (verbatim; `combineAverage` and
   `groupAverageEValue` now share it); `median` → `detectors/_linalg.ts`; `WelfordState` →
   `types/primitives.ts`; `MixtureSupermartingaleState` → `types/families/a.ts`. No arithmetic
   changed; the 430-test suite is unchanged in count and outcome.
4. **The registry is generic.** `types/detector-registry.ts` separates KIND (engine-owned:
   `page_cusum`, `betting_e_process`, `safe_t_e_value`, `contrast_null`, ...) from SIGNAL
   (consumer-owned). `detectorRegistryFor({ signals })` builds a consumer's registry;
   `guaranteeFor(id: string)` resolves any id it can build by longest kind-prefix, and the test
   proves totality over an arbitrary signal set. `DETECTOR_REGISTRY` and `DetectorId` are now
   DeploySignal's instance, built from `LEGACY_DEPLOYSIGNAL_SIGNALS` /
   `LEGACY_DEPLOYSIGNAL_FAMILY_D_SIGNALS` / `LEGACY_DEPLOYSIGNAL_HEURISTICS` in `types/audit.ts`,
   held equal to the pre-0.7.0 literal list id for id and in order by a test.
5. **The use criteria are reachable.** `./guarantees` joins the export map. The README names
   `fleet/e-bh-guarded` as the consumer entry point for an FDR claim and the ungated
   `eBenjaminiHochberg` as the harness path.

## What this step does not do — the remaining DeploySignal-shaped surface inside the library, named

`types/metrics.ts` (`Metrics` fields are the six signals), `types/policy.ts`,
`types/orchestration.ts` and `types/verdict.ts` (the six allowlisted hooks), `signal-classes.ts`'s
default class map, the detectors' default signal list (`FAMILY_A_PRIMARY_SIGNALS`, now an alias of
`LEGACY_DEPLOYSIGNAL_SIGNALS`), the `tools/` NAB harness, and `fleet/verdict-consumer.ts`. Each is
recorded here so the next step is a list, not a survey.

## Steps 2–4 (consumer PRs, in order)

2. **Tessera** (owner: Tessera). Delete the seven `tools/` statistical modules and import the
   engine's `per-shard/contrast`, `fleet/calibration-monitor`,
   `detectors/nuisance-robust-bf-e-value`; route FDR claims through `eBenjaminiHochbergGuarded`.
   The engine's `test/contrast.test.ts` lockstep then has nothing to compare against and is retired
   in the same release.
3. **DeploySignal** (owner: DeploySignal). Move the three `LEGACY_DEPLOYSIGNAL_*` lists, `core.ts`,
   `o0/`, `l0/schema-continuity`, `loader.ts` and the orchestration hook types into its own tree;
   retire the local `engine/` duplicate and its guarantee table in favour of `./guarantees`.
4. **Tessera** takes `adapters/topology/`, `adapters/ds-integration/`, `adapters/events/`,
   `adapters/l0/counter-rate-transform`. `adapters/` is then empty and deleted; the aliases in
   `exports` / `typesVersions` go with it. That release is the major.

## Reversal

Everything in step 1 is a move with a re-export or an alias. Reverting is the reverse move; no
consumer sees a different number.

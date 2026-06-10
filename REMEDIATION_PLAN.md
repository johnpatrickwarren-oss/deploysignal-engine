# Remediation Plan — deploysignal-engine

- **Date:** 2026-06-10
- **Commit reviewed:** `16feac9` ("refactor: decompose all source god-files & god-functions (0/0) (#14)", default branch `main`)
- **Reviewer scope:** full source tree (detectors, fleet, topology, l0, o0, events, ds-integration, per-shard, tools, types), package/config metadata, committed `dist/`, test suite.

## Summary

The repository is in good mechanical health: `tsc` (TypeScript 6.0.3, `strict: true`) compiles cleanly, the full test suite passes (**93/93 tests**, `node --test dist/test/*.test.js`, ~0.6 s), and the committed `dist/` output was verified to be byte-identical to a fresh rebuild at this commit. The statistical core (Welford, Levinson-Durbin, e-BH, mixture supermartingales, BFS attribution) is carefully written and well-commented. The real problems cluster at the **edges**: the DS→Tessera HTTP event consumer rejects the `chaos_experiment` event class that its own contract defines and performs no actual authentication; all three published CLI `bin` entries are broken (no shebang); the repo ships under a declared Apache-2.0 license with **no LICENSE file**; there is **no CI workflow at all**; and several docs/metadata surfaces (README install/build instructions, CHANGELOG, package-lock version) are stale leftovers from the repo's extraction out of the Tessera monorepo. A handful of correctness issues (threshold-discount applied twice in `core.ts`, Slurm hostlist zero-padding, zero-elapsed division in the counter-rate transform, unit mismatch in the ITS pre/post comparison) also warrant fixes.

No committed secrets, no unsafe `eval`, no path-traversal sinks were found. `Math.random` appears only in one test fixture.

---

## Findings

### Critical

*None found.* (The two top High findings below would be Critical in a production-exposed deployment; the event consumer binds to `127.0.0.1` by default, which is the only mitigating factor.)

### High

**H1. Event consumer rejects the contract-valid `chaos_experiment` event class**
- Files: `ds-integration/event-consumer.ts:60-66` vs `ds-integration/event-contract.ts:37-43`, `ds-integration/freeze-hook-factory.ts:45`, `events/event-feed.ts:16`
- Problem: `VALID_EVENT_CLASSES` enumerates only 5 classes (`firmware_push`, `model_redeploy`, `env_change`, `config_change`, `capacity_change`). The wire contract `DeployEventPayload.event_class` is explicitly a **6-value** union including `'chaos_experiment'` (JSDoc: "DeploySignal emits a `chaos_experiment` event when an Anvil chaos run starts so Tessera's freeze-hook activates"). `mapEventClassToKind` and `ClusterEventKind` both support it.
- Evidence: a valid `chaos_experiment` POST is rejected with HTTP 400 `invalid event_class` and the freeze hook never activates for chaos experiments — exactly the integration the contract was extended for. The compile-time `never` exhaustiveness check in `freeze-hook-factory.ts` cannot catch this because the consumer uses a runtime `Set`, not the type union.
- Remediation: add `'chaos_experiment'` to `VALID_EVENT_CLASSES`; derive the set from a single shared constant (e.g. export a `DEPLOY_EVENT_CLASSES` array from `event-contract.ts` and build both the type and the runtime set from it); add a consumer test that POSTs each contract class.

**H2. Event consumer performs shape-only "authentication" and has no request body limit**
- File: `ds-integration/event-consumer.ts:69-87` (`validateAuthHeaders`), `:239-241` (body buffering)
- Problem: any request with a non-empty `x-ds-instance-id` and any string starting with `Bearer ` is accepted — there is no token verification hook at all. A successful POST activates the freeze hook (`freeze-hook-factory.ts`), which **pauses per-shard baseline accumulation** — i.e. an unauthenticated detection-suppression vector. Additionally, the request body is buffered with no size cap (memory exhaustion on a hostile/looping client).
- Evidence: `if (typeof auth !== 'string' || !auth.startsWith('Bearer '))` is the entirety of the check.
- Remediation: accept an injected token validator (or shared-secret comparison via `crypto.timingSafeEqual`) in `DsEventConsumerOpts` and reject mismatches with 401; enforce a max body size (e.g. 64 KiB) and destroy the request when exceeded. Document the `127.0.0.1` default-bind as a security assumption.

**H3. All three published CLI bins are broken (missing shebang)**
- Files: `package.json:20-24` (`bin` block) → `dist/tools/run-nab-validation.js:1`, `dist/tools/run-nab-per-dataset.js:1`, `dist/tools/fit-production-substrate.js:1`
- Problem: the `bin` targets begin with `"use strict";` — no `#!/usr/bin/env node` line. npm's bin shims execute the file directly on Unix; without a shebang the shell tries to interpret the JS and fails. tsc does not add shebangs.
- Evidence: `head -1 dist/tools/run-nab-validation.js` → `"use strict";`.
- Remediation: add `#!/usr/bin/env node` as the first line of the three `tools/*.ts` entrypoints (tsc preserves shebangs) or add a postbuild step that prepends it; verify with `npm pack` + local install.

**H4. No LICENSE file despite Apache-2.0 declaration; README license link is broken**
- Files: repo root (no `LICENSE*` present), `package.json:5` (`"license": "Apache-2.0"`), `README.md:78` (`see [\`../LICENSE\`](../LICENSE) (Tessera root)`)
- Problem: in the standalone repo, `../LICENSE` does not exist; the public repo distributes code with a declared but absent license text. Apache-2.0 requires the license text to accompany distribution.
- Remediation: commit the Apache-2.0 LICENSE file at the repo root and fix the README link.

### Medium

**M1. `effectiveThreshold` applies the trend-strength factor twice**
- File: `core.ts:167-179`
- Problem:
  ```ts
  const strength = trendStrength(t, direction || 'rise');
  const discount = trendDiscount * strength;
  return baseThreshold - discount * strength;
  ```
  The effective discount is `trendDiscount · strength²`. The variable naming (`discount` already includes `strength`) strongly indicates the intended return is `baseThreshold - discount`. With `strength ∈ [0,1]`, squaring systematically under-discounts thresholds for moderate trends (e.g. strength 0.5 → 25% of intended discount).
- Remediation: confirm against the upstream DeploySignal pin (`main@5a72371`); if it is a transcription bug, change to `baseThreshold - discount` (with ADR per the vendoring policy) and add a unit test pinning the formula. No test currently covers this function.

**M2. Slurm hostlist expansion zero-pads ranges, diverging from Slurm semantics**
- File: `topology/slurm-source.ts:195-198`
- Problem: `padWidth = Math.max(startStr.length, endStr.length)` then `String(i).padStart(padWidth, '0')`. Slurm expands `node[1-10]` to `node1 … node10` (padding only when the range is written with leading zeros, e.g. `[01-10]`). This code produces `node01 … node10` for `[1-10]`.
- Evidence: any topology.conf using unpadded ranges that cross a digit boundary yields node IDs that don't match real hostnames; `attributeCommonMode` then **silently skips** fired-shard events for those hosts (failure mode F4 at `topology/common-mode-attribution.ts:161`), so common-mode candidates silently disappear.
- Remediation: pad to `startStr.length` only when `startStr` has a leading zero (or equivalently use `startStr.length` only if `startStr.startsWith('0')`); add expansion test cases `[1-10]`, `[01-10]`, `[08-12]`.

**M3. Counter-rate transform divides by unvalidated elapsed time**
- File: `l0/counter-rate-transform.ts:100, 127, 149`
- Problem: `actual_elapsed_seconds = next.ts_seconds - prev.ts_seconds` is used as a divisor with no guard. Duplicate timestamps (elapsed = 0) yield `Infinity`/`NaN`; out-of-order samples (elapsed < 0) yield negative rates with `missed_scrape_inferred = false`. These values propagate directly into TrendBuffer/detector state.
- Remediation: when `actual_elapsed_seconds <= 0`, return `value: null` with a quality flag (mirroring the reset path), and document the invariant. Add unit tests for the zero/negative-elapsed cases.

**M4. ITS pre/post comparison mixes units (events vs distinct shards)**
- File: `events/event-conditional-attribution.ts:103-106` vs `:109-119`
- Problem: `pre_window_count` counts **fired events** (a single shard firing 3× pre-window counts 3) while the post-window measurement counts **distinct shards**. The surfacing filter `memberCount - preCount < minDelta` therefore compares mismatched units, and the doc comment on `pre_window_count` ("Count of fired shards within the pre-window") is wrong about what the code does. A noisy single shard pre-window can suppress a genuine multi-shard post-event elevation.
- Remediation: dedupe the pre-window by `shard_node_id` (`new Set(...).size`) to match the post-window unit, or change the doc + field name to `pre_window_event_count` if event-counting is intended. Add a test with a repeat-firing shard in the pre-window.

**M5. No CI workflow exists**
- Files: `.github/` absent entirely
- Problem: the repo has a working `npm test` (build + 93 tests, <1 s) but nothing runs it on push/PR. Vendored comments reference past CI cascades (`detectors/_q72-trace.ts` Linux-vs-Darwin divergence), so platform CI has historically caught real bugs in this code. There is also no guard that the committed `dist/` stays in sync with sources (verified in sync at this commit, but only by manual rebuild).
- Remediation: add `.github/workflows/ci.yml` running `npm ci && npm test` on ubuntu + macos, plus a `git diff --exit-code dist/` step after build to enforce dist freshness.

**M6. README / packaging metadata stale and internally inconsistent**
- Files: `README.md:17-37, 72-78`, `package.json:3,16-19`, `package-lock.json:3`, `CHANGELOG.md`
- Problems (all verified):
  - README install section tells consumers to depend on `git+ssh://git@github.com/johnpatrickwarren-oss/tessera.git#...` and says "The `directory` field in this package's `repository` block points pnpm/npm at the `engine/` subdirectory" — but `package.json`'s `repository` block has **no `directory` field** and points at the standalone `deploysignal-engine` repo.
  - README build section says "from Tessera repo root: `pnpm exec tsc` … emits `johnpatrickwarren-oss-deploysignal-engine-0.1.0-pre.tgz`" — wrong repo, wrong tool (`devDependencies` are npm-managed here), wrong version (package is `0.3.1-pre`).
  - `package-lock.json` still records version `0.3.0-pre`; a plain `npm install` rewrites it (dirties the working tree). Lockfile was not regenerated for the `0.3.1-pre` bump.
  - `CHANGELOG.md` has no entry for `v0.3.1-pre` (latest entry `v0.3.0-pre`), though the release commit/tag exists (`8ccbd18`).
- Remediation: rewrite README Install/Build for the standalone repo (`npm install`, `npm run build`, correct tarball name); regenerate the lockfile; add the `v0.3.1-pre` CHANGELOG entry.

**M7. CSV parsers accept malformed data silently**
- Files: `tools/fit-production-substrate.ts:163-183`, `tools/_nab-validation-loading.ts:42-62`
- Problem: `values.push(parseFloat(f[valIdx]))` with no `Number.isFinite` check. A single malformed row (short row → `undefined` → `NaN`) silently poisons every downstream statistic — `mean`, `σ²`, `φ` all become `NaN`, and `fitProductionSubstrate` will happily write a substrate JSON full of `null`s (JSON serializes NaN as null), which `loadProductionSubstrate`'s schema check may then reject far from the root cause — or worse, partially pass. An empty CSV also crashes with an unhelpful `TypeError` (`lines[0]` undefined).
- Remediation: skip-or-throw on non-finite parsed values (with row number in the error), and guard the empty-file case. For the calibrator (an offline tool writing production-consumed artifacts) throwing is appropriate.

### Low

**L1. `event-feed.ts` header says "5-event-class" but defines 6** — `events/event-feed.ts:4,10-16`. Update the comment (the 6th, `chaos_experiment`, was added later). Related to H1.

**L2. Per-detector resampler count/ids inconsistency** — `_per-detector-resampler-counts.ts:149-158`: for `family_D_spectral`, `count` excludes `kv_cache` events but `ids` are inflated from the whole `family_D` category (includes kv_cache cells), so `ids.length` can exceed `count`. Also the `signalFilter` parameter is dead — when supplied, `inflateFromCategory` emits nothing (`if (!signalFilter)` guards the only push). And `cellKeyStr.split('-')` produces `day_of_week: NaN` for hour-only cell keys. Document or fix the stub semantics.

**L3. `summarizeWindow` vs `TrendBuffer.get` divergence on degenerate input** — `core.ts:119-133` returns `cv: 0` for empty/zero-mean windows while `get()` returns `cv: 1`; the doc comment claims the two "agree bit-for-bit" on shared fields. Align the degenerate-case defaults or amend the comment.

**L4. Consumer response claims `freeze_hook_activated: true` unconditionally** — `ds-integration/event-consumer.ts:267-274`: the 202 response asserts activation even when no `'activate'` subscriber is attached. Harmless at R66 (standalone adapter) but the response contract (`event-contract.ts:69-74`) implies a real activation. Either wire the flag to subscriber feedback or set it `false` with a doc note.

**L5. `fit-production-substrate` CLI silently ignores unknown flags** — `tools/fit-production-substrate.ts:198-222` has no `default:` arm (contrast `run-nab-validation.ts:103` which throws on unknown `--flags`). A typo like `--ar-p-max-orde 5` silently changes calibration behavior. Add the same throw.

**L6. `OtelServiceGraphV1` abort-listener leak + unpropagated context** — `topology-overlay.ts:230-234`: the `abort` listener added to the upstream signal is never removed after fetch completes (accumulates on a long-lived signal); `TopologyEnricher.enrich` (`:318`) never passes a `FetchContext`, so the enricher cannot propagate cancellation. Remove the listener in `finally`; thread an optional ctx through `enrich`.

**L7. npm package ships test files** — `package.json:8-15` `files` globs (`dist/**/*.js`) include `dist/test/*.test.js`. Exclude `dist/test/**` from `files`.

**L8. K8s source does not dedupe node names** — `topology/k8s-source.ts:92-148`: duplicate `metadata.name` entries (possible in hand-built fixtures) emit duplicate `host:` node IDs and duplicate GPU shards. Add a seen-set like the zone handling.

**L9. dist/ committed without an enforcement mechanism** — verified in sync at `16feac9`, but nothing prevents future drift (see M5's `git diff --exit-code dist/` suggestion).

## Test-suite results

- `npx tsc` — clean (TypeScript 6.0.3, strict mode, zero diagnostics).
- `node --test dist/test/*.test.js` — **93 passed, 0 failed, 0 skipped** (594 ms).
- Committed `dist/` verified identical to fresh rebuild (only `package-lock.json` dirtied by `npm install`, see M6; restored).
- One test (`q70-self-normalized-fallback.test.ts:246`) is opportunistic — it self-skips unless a NAB checkout exists at `../NAB` or `NAB_CSV` is set; it did not run here.

---

## Prioritized remediation checklist

- [ ] **H1** Add `chaos_experiment` to `VALID_EVENT_CLASSES` in `ds-integration/event-consumer.ts`; derive the runtime set and the type union from one shared constant; add a per-class consumer POST test.
- [ ] **H2** Add real token verification (injected validator / `timingSafeEqual`) and a request-body size cap to `DsEventConsumer`.
- [ ] **H3** Add `#!/usr/bin/env node` shebangs to `tools/run-nab-validation.ts`, `tools/run-nab-per-dataset.ts`, `tools/fit-production-substrate.ts`; rebuild dist; verify via `npm pack` install.
- [ ] **H4** Commit the Apache-2.0 LICENSE file; fix the README license link.
- [ ] **M1** Resolve the `effectiveThreshold` strength-squared discount against the upstream pin; fix + pin with a unit test (ADR per vendoring policy).
- [ ] **M2** Fix Slurm hostlist range padding to match Slurm semantics; add `[1-10]` / `[01-10]` expansion tests.
- [ ] **M3** Guard `actual_elapsed_seconds <= 0` in `transformPair`; return null-value sample; add tests.
- [ ] **M4** Make `pre_window_count` count distinct shards (or rename/redocument); add repeat-firing-shard test.
- [ ] **M5** Add GitHub Actions CI (`npm ci && npm test` on ubuntu + macos; `git diff --exit-code dist/` after build).
- [ ] **M6** Rewrite README Install/Build for the standalone repo; regenerate `package-lock.json` at `0.3.1-pre`; add the `v0.3.1-pre` CHANGELOG entry.
- [ ] **M7** Validate parsed CSV values (`Number.isFinite`) and empty-file handling in both CSV parsers.
- [ ] **L1** Fix the "5-event-class" comment in `events/event-feed.ts`.
- [ ] **L2** Reconcile `family_D_spectral` count/ids attribution and remove or implement the dead `signalFilter` parameter; guard the cell-key parse.
- [ ] **L3** Align `summarizeWindow` / `TrendBuffer.get` degenerate-case `cv` defaults (or correct the comment).
- [ ] **L4** Make the consumer's `freeze_hook_activated` response field truthful.
- [ ] **L5** Throw on unknown flags in `fit-production-substrate` CLI.
- [ ] **L6** Remove the upstream-abort listener after fetch; thread `FetchContext` through `TopologyEnricher.enrich`.
- [ ] **L7** Exclude `dist/test/**` from the npm `files` globs.
- [ ] **L8** Dedupe K8s node names in `parseNodeListToSnapshot`.
- [ ] **L9** (covered by M5's dist-freshness CI step.)

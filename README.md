# @johnpatrickwarren-oss/deploysignal-engine

A statistical detector library. It ships sequential detectors, each with the validity envelope
that states the regime in which its guarantee holds; e-value combination and e-BH / e-BY
false-discovery control that refuse an input outside its envelope; per-shard baseline maths; and a
guarantee table assembled from those envelopes rather than asserted in prose.

Five repositories pin it as a git dependency at a release tag: DeploySignal, Tessera, Tessera-RNG,
Ballast and Anvil. The rule for what lives here is the engine/consumer charter (ADR 0019; knowledge
wiki `stats/engine-consumer-charter`): anything that *constructs a baseline or detects deviation
from it, with its validity accounting* belongs here; the domain data-plane and policy stay with the
consumer. **The current version is in [`CHANGELOG.md`](CHANGELOG.md)**; prose copies of the number
have gone stale before.

## Two trees

The package is two trees, and `test/library-boundary.test.ts` enforces the line between them from
the import graph on every CI run (ADR 0033).

**The library** — consumer-agnostic. Nothing here imports from `adapters/` at runtime.

| Directory | What it holds |
|---|---|
| `detectors/` | The detectors, one module each, and their `ValidityEnvelope` objects. Underscore-prefixed modules are internal helpers. |
| `fleet/` | Combination and error control: `combine` (product / average merges), `e-bh`, `e-bh-guarded`, `e-by`, the common-mode and localization variants, `calibration-monitor`. |
| `per-shard/` | Welford accumulator, warm start, per-shard runtime, baseline re-record timing, the pair contrast. |
| `baseline/` | Seasonal and multivariate baselines, robust covariance, the covariate residualizer, factor telemetry. |
| `types/` | The type surface, including the generic detector registry. |
| `guarantees.ts` | The guarantee table: every detector kind's validity class, envelope, alpha policy and evidence. |
| `signal-classes.ts` | The four-class signal taxonomy and its variance-stabilizing transforms. |

**The adapters** — consumer-shaped, shipped unchanged pending migration into the consumer that
owns each (ADR 0033 steps 2–4). Old import paths still resolve.

| Path | Owner it leaves for | What it is |
|---|---|---|
| `adapters/topology/`, `adapters/topology-overlay.ts`, `adapters/hardware-topology-source.ts` | Tessera | Slurm, K8s, NVLink, Neuron and TPU topology sources; BFS common-mode attribution |
| `adapters/ds-integration/`, `adapters/events/` | Tessera | The Tessera↔DeploySignal contract, freeze hook, event feed |
| `adapters/l0/counter-rate-transform.ts` | Tessera | L0 ingestion contract |
| `adapters/l0/schema-continuity.ts`, `adapters/o0/`, `adapters/loader.ts`, `adapters/core.ts` | DeploySignal | Schema continuity, reversibility and lifecycle events, compiled-config loader, the heuristic runtime (`TrendBuffer`, `computeVerdict`) |

**DeploySignal-shaped surface still inside the library, by name:** `types/metrics.ts`,
`types/policy.ts`, the six type-only orchestration hooks on `types/orchestration.ts` and
`types/verdict.ts` (allowlisted in the boundary test), `signal-classes.ts`'s default class map, the
detectors' default signal list (`FAMILY_A_PRIMARY_SIGNALS`), `tools/` (the NAB harness), and the
`LEGACY_DEPLOYSIGNAL_*` lists in `types/audit.ts`. ADR 0033 lists these so the next step is a
list, not a survey.

## Use criteria — how a consumer decides what to run

The library ships the criteria alongside the detectors. They are code, and consumers are expected
to call them rather than restate them.

- **`detectors/validity-envelope.ts`** — `ValidityEnvelope`: baseline kind, autocorrelation kind,
  variance kind, and `validUnderEstimatedBaseline`, the flag that says whether E[e|H0] ≤ 1 survives
  a plug-in baseline. A detector without an envelope object is *unrecorded*, which does not mean
  safe.
- **`fleet/e-bh-guarded.ts`** — `eBenjaminiHochbergGuarded` is the entry point for an FDR claim. It
  refuses a detector id with no envelope and a detector outside its regime unless the caller
  asserts the premise at the call site (`{ mMuchGreaterThanN }`, `{ trueBaseline }`). The ungated
  `eBenjaminiHochberg` in `fleet/e-bh.ts` is for measurement harnesses computing an observed FDP
  against labelled truth.
- **`guarantees.ts`** — `guaranteeFor(id)` returns the row for any detector id: `validityClass`
  (`ville_anytime_valid`, `bounded_priced`, `e_value_terminal`, `classical_epoch`,
  `exact_finite_sample`, `heuristic`, `retracted`), the live envelope object or `'unrecorded'`,
  the alpha policy, the dated evidence, and the (ε, δ)-approximate e-value form (Ramdas–Wang 2025
  Def. 10.1). `guaranteeManifest()` dumps the table for audit artifacts. The README does not
  restate the rows; the table is the list.
- **`validation/certification/`** — the certification cards and the four-stage verdict
  (USE / ADVISORY / REFUSE / NOT_EXECUTABLE) per the protocol at the wiki's
  `methodology/detector-certification-protocol`.
- **`signal-classes.ts`** — which transform a signal needs before a Gaussian detector sees it.

A registry for your own signals, and the row for each id:

```ts
import { detectorRegistryFor } from '@johnpatrickwarren-oss/deploysignal-engine/types/audit';
import { guaranteeFor } from '@johnpatrickwarren-oss/deploysignal-engine/guarantees';

const registry = detectorRegistryFor({ signals: ['rtt_p99', 'path_loss'] });
// registry.A → ['mSPRT_rtt_p99', 'mSPRT_path_loss', 'page_cusum_rtt_p99', ...]
const row = guaranteeFor('betting_e_process_rtt_p99');
// row.validityClass === 'ville_anytime_valid'; row.estimatedBaseline.validUnderEstimatedBaseline === false
```

`DETECTOR_REGISTRY` and `DetectorId` are DeploySignal's instance of the same builder and exist for
its audit-record compatibility; a new consumer does not import them.

## Install

Consumed via git dependency at a release tag (no npm registry publish):

```json
{
  "dependencies": {
    "@johnpatrickwarren-oss/deploysignal-engine": "git+https://github.com/johnpatrickwarren-oss/deploysignal-engine.git#<tag>"
  }
}
```

Subpath imports are the API: `…/detectors/betting-e-process`, `…/fleet/e-bh-guarded`,
`…/guarantees`, `…/types/audit`, `…/adapters/topology/slurm-source`. Both `node16` and classic
`node` module resolution are supported (`exports` and `typesVersions` carry the same map).

## Build and test

```bash
npm install
npm run build    # tsc → dist/ (committed; CI fails if it differs from a fresh rebuild)
npm test         # tsc + node --test dist/test/*.test.js
npm run test:cert   # certification harness
```

`test/contrast.test.ts` holds `per-shard/contrast.ts` in lockstep against Tessera's compiled
tools when a Tessera checkout is reachable as a sibling; it is skipped otherwise.

## Validation and studies

`validation/` holds the pre-registered studies, batteries and the certification harness — over
two thousand tracked files, and most of the repository's commit activity. Each study directory
carries its own `PREREGISTRATION.md` and append-only `results/`. The register of studies, their
endpoints and verdicts is the wiki's `methodology/study-ledger`. The default test substrate is the
oracle-parameter H0 battery (`validation/h0-battery`) and the shape battery
(`validation/shape-battery`); see the wiki's `methodology/test-substrates` for the routing.

## NAB and substrate tools

`tools/` carries the NAB validation harness (`ds-engine-nab-validate`, `ds-engine-nab-per-dataset`)
and the production-AR substrate calibrator (`ds-engine-fit-substrate`). The NAB acceptance floors
are recorded as failing (wiki `stats/nab-validation-2026-07-17`, re-run 2026-08-18); the artifact
must not be cited as passed.

## Provenance

The detector files were extracted from DeploySignal `main@5a72371` on 2026-05-16 and have evolved
here since; this package is canonical for the detector maths and DeploySignal is a consumer. The
`VENDORED FROM DeploySignal` headers on those files are history, not authority. Per-file
provenance at extraction time is in Tessera's `coordination/VENDORING-MANIFEST.md`. Decisions are
in [`decisions/`](decisions/) (ADRs 0001–0033); the knowledge wiki at `~/concord/knowledge` is the
entry point for what the detectors guarantee, what has been retracted, and what is contested.

## License

Apache-2.0 — see [`LICENSE`](LICENSE).

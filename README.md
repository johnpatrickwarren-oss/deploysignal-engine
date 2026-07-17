# @johnpatrickwarren-oss/deploysignal-engine

Statistical detector engine vendored from [DeploySignal](https://github.com/johnpatrickwarren-oss/deploysignal) at SHA `5a72371`, with Tessera-evolved deltas.

**Status:** extraction complete and consumption migration (R91/R92) closed — Tessera and DeploySignal both consume this package via git-dependency at a release tag. Current version: see [`CHANGELOG.md`](CHANGELOG.md) (prose copies of version numbers in this README have gone stale before; the changelog is the source of truth). Per-file vendoring provenance (which files match DeploySignal SHA `5a72371` vs carry Tessera-evolved deltas) is tracked in [`tessera/coordination/VENDORING-MANIFEST.md`](https://github.com/johnpatrickwarren-oss/tessera/blob/main/coordination/VENDORING-MANIFEST.md).

## What this package is — and is not

**This is a shared statistical library, not DeploySignal's runtime or a deployment-verification
service.** Two products consume it as a pinned git dependency: [DeploySignal](https://github.com/johnpatrickwarren-oss/deploysignal)
(pre-promotion deploy gating) and [Tessera](https://github.com/johnpatrickwarren-oss/tessera)
(steady-state cluster observation). The charter split (ADR 0019) is: **mechanism + schema live here;
data, semantics, and policy live in the products.** Concretely, the following are product
responsibilities by design and do not exist in this repo: telemetry ingestion, baseline *lifecycle*
management (candidate creation, review/approval, promotion — this repo supplies only the re-record
*timing trigger* in `per-shard/baseline-lifecycle.ts` and the event-driven freeze-hook), durable
service state, and product-profile calibration orchestration (each product's profile and
signal-semantics calibration regimes; the generic substrate-fitting CLI `fit-production-substrate`
documented below *does* live here). Some ADRs here reference DeploySignal tools
(`tools/calibrate`, `tools/run-shadow-compare`, `tools/curate-baseline-*`) — those live in the
DeploySignal repo and are deliberately not vendored; see the 2026-07-16 addendum in
[`decisions/0019`](decisions/0019-baseline-creation-belongs-in-the-engine.md). The `ds-integration/`
directory is the *Tessera-side* implementation of the bidirectional DS↔Tessera contract (Tessera→DS
verdict-group feed + DS→Tessera deploy-event consumer/freeze-hook), not a DeploySignal service
surface.

What ships here:

- Family A/C/D/E statistical detectors (mixture-supermartingale, betting e-process, hotelling, page-cusum, conformal, sequential MMD, spectral; the self-normalized fallback is **deprecated** — retained for tests only, see the caveat in `detectors/self-normalized-e-process-fallback.ts`)
- Ville-bounded any-time-valid hypothesis tests, with an honest validity boundary: under *estimated* (plug-in) baselines the per-shard `E[e|H0] ≤ 1` requirement is not achievable on real telemetry, so the anytime-valid guarantee holds at the fleet e-BH/FDR layer, not per individual shard stream (ADRs 0011/0012)
- Hierarchical per-shard / fleet e-value combination + e-BH FDR
- Topology BFS-on-undirected attribution (Slurm, K8s, NVLink, Neuron, TPU adapters)
- DeploySignal integration interface contract (`engine/ds-integration/`)
- L0 contract (counter-rate transform, missed-scrape catchup, wraparound handling)
- Per-shard runtime (Welford accumulator, warm-start, residual updates)

## Install

This package lives in its own repository and is consumed via git-dependency (no npm registry publish yet). Consumer's `package.json`:

```json
{
  "dependencies": {
    "@johnpatrickwarren-oss/deploysignal-engine": "git+https://github.com/johnpatrickwarren-oss/deploysignal-engine.git#<commit-or-tag>"
  }
}
```

Pin to the latest release tag from [`CHANGELOG.md`](CHANGELOG.md) rather than a branch (tag == `package.json` version as of `v0.6.1-pre`).

## Build

```bash
npm install
npm run build   # tsc → emits dist/
npm test        # tsc + node --test dist/test/*.test.js
npm pack        # emits johnpatrickwarren-oss-deploysignal-engine-<version>.tgz
```

The committed `dist/` is kept byte-identical to a fresh rebuild (enforced by CI).

## NAB validation tools

```bash
# Per-dataset calibrated NAB validation (default config)
node dist/tools/run-nab-per-dataset.js \
  --nab-repo ~/concord/NAB --out report.json

# Optional opt-in calibration paths:
#   --ar-p-calibration       multi-lag AR(p) Yule-Walker + AIC order selection
#   --seasonal-decomposition seasonal-naive (per-phase mean subtraction)
#   --no-smoothing           disable SLICE 6 anomaly-likelihood smoothing
#   --no-prewhitening        disable SLICE 5 AR(1) pre-whitening
#   --use-hac-inflation      SLICE 4 HAC long-run variance (legacy)
```

## Production-AR substrate calibrator (Phase E SLICE 10)

For offline calibration against a representative production window
(decouples calibration from runtime; produces a portable substrate
JSON consumable by the engine and external consumers):

```bash
# Fit a substrate from a production CSV
node dist/tools/fit-production-substrate.js \
  --csv production-data.csv \
  --signal-name p99_latency \
  --out substrate.json \
  --ar-p --seasonal --spectral
```

Substrate schema: see `types/production-ar-substrate.ts`. Consumer
loader: `tools/load-production-substrate.ts`.

## Authoritative documentation

Canonical engine semantics live in the DeploySignal repository. Tessera-evolved deltas are tracked as per-file SHA pins (vendored-with-deltas vs vendored-at-pin).

## License

Apache-2.0 — see [`LICENSE`](LICENSE).

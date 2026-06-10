# @johnpatrickwarren-oss/deploysignal-engine

Statistical detector engine vendored from [DeploySignal](https://github.com/johnpatrickwarren-oss/deploysignal) at SHA `5a72371`, with Tessera-evolved deltas.

**Status:** Tessera Phase 5 SLICE 3 round 1 (R90) extraction — package boundary + types-barrel decoupling + verifiable tarball. Consumption migration (Tessera-internal + DS-side) lands in R91-R92. **Do not consume from external projects until R91/R92 close.**

## What this package is

- Family A/C/D/E statistical detectors (mixture-supermartingale, betting e-process, hotelling, page-cusum, conformal, sequential MMD, self-normalized fallback, spectral)
- Ville-bounded any-time-valid hypothesis tests
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

Pin to a release tag (e.g. `#v0.3.1-pre`) rather than a branch.

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

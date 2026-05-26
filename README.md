# @johnpatrickwarren-oss/deploysignal-engine

Statistical detector engine vendored from [DeploySignal](https://github.com/johnpatrickwarren-oss/deploysignal) at SHA `5a72371` and Tessera-evolved per [VENDORING-MANIFEST.md](../coordination/VENDORING-MANIFEST.md) (lives one directory up from this README inside the Tessera repository).

**Status:** Tessera Phase 5 SLICE 3 round 1 (R90) extraction — package boundary + types-barrel decoupling + verifiable tarball. Consumption migration (Tessera-internal + DS-side) lands in R91-R92. **Do not consume from external projects until R91/R92 close.**

## What this package is

- Family A/C/D/E statistical detectors (mixture-supermartingale, betting e-process, hotelling, page-cusum, conformal, sequential MMD, self-normalized fallback, spectral)
- Ville-bounded any-time-valid hypothesis tests
- Hierarchical per-shard / fleet e-value combination + e-BH FDR
- Topology BFS-on-undirected attribution (Slurm, K8s, NVLink, Neuron, TPU adapters)
- DeploySignal integration interface contract (`engine/ds-integration/`)
- L0 contract (counter-rate transform, missed-scrape catchup, wraparound handling)
- Per-shard runtime (Welford accumulator, warm-start, residual updates)

## Install (R91+)

For first-cycle consumption (R91/R92), this package is consumed via git-dependency (no npm registry publish in R90 chain). Consumer's `package.json`:

```json
{
  "dependencies": {
    "@johnpatrickwarren-oss/deploysignal-engine": "git+ssh://git@github.com/johnpatrickwarren-oss/tessera.git#<commit-or-tag>"
  }
}
```

The `directory` field in this package's `repository` block points pnpm/npm at the `engine/` subdirectory inside the Tessera repository.

## Build

```bash
# from Tessera repo root:
pnpm exec tsc            # emits engine/dist/
cd engine && pnpm pack   # emits johnpatrickwarren-oss-deploysignal-engine-0.1.0-pre.tgz
```

## NAB validation tools

```bash
# Per-dataset calibrated NAB validation (default config)
node dist/tools/run-nab-per-dataset.js \
  --nab-repo ~/concord/NAB --out report.json

# Optional opt-in calibration paths (see coordination/PHASE-E-CLOSE.md
# for empirical guidance on when each applies):
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

Canonical engine semantics live in the DeploySignal repository. Tessera-evolved deltas (per-file SHA pins; vendored-with-deltas vs vendored-at-pin) are tracked in [`coordination/VENDORING-MANIFEST.md`](../coordination/VENDORING-MANIFEST.md).

## License

Apache-2.0 — see [`../LICENSE`](../LICENSE) (Tessera root).

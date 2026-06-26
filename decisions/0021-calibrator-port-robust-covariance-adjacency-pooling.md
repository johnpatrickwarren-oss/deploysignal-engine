# ADR 0021 — calibrator port: robust covariance (MCD/Ledoit-Wolf) + adjacency pooling into the engine

- **Date:** 2026-06-25
- **Status:** **Accepted (executes the ADR 0019 migration).** Promotes the proven baseline-calibration
  numerics from the original DeploySignal product-tools into the engine L0/L1, so consumers stop re-deriving
  them.
- **Builds on:** ADR 0019 (baseline-creation belongs in the engine; migration step 2 = port the calibrator
  guts), ADR 0020 (ingestion contract).

## What was ported

- **L0 — `baseline/robust-covariance.ts`** (ported VERBATIM, computation unchanged, from DeploySignal
  `tools/calibrators/_family-c-covariance.ts` + `_family-c-mcd.ts` + `_shared.ts`): seeded PRNG, lower-
  triangular Cholesky (PSD gate), column mean, sample covariance, Mahalanobis², Wilson-Hilferty χ²₀.₉₇₅,
  Ledoit-Wolf shrinkage, Croux–Haesbroeck consistency factor, and FastMCD (cStep / initial-subset /
  concentrate / reweight). Engine entry: `robustCovariance(rows, opts)` → robust mean/cov + `outlierFraction`,
  via FastMCD → reweight → consistency correction, with a Ledoit-Wolf fallback for small/degenerate samples
  (the MRCD-ish path: `n < 5p`).
- **L1 — adjacency pooling in `baseline/seasonal-baseline.ts`**: a sparse context bin now pools the raw samples
  of bins within `±poolRadius` (optionally `cyclic`, e.g. hour-of-day) and recomputes the clean-null before
  falling back to the global aggregate — so a thin hour borrows from adjacent hours, not the whole-fleet mean.

## One deliberate improvement over the verbatim port

The reweighting now uses the **consistency-corrected** MCD covariance for the χ²₀.₉₇₅ cutoff (and a separate
reweight-coverage factor `c_{0.975}` on the final cov) — the standard RMCD. The DS code applied the
consistency factor only to the final cov, leaving the cutoff on the raw (under-estimated) MCD cov, which
**over-flags ~18% of clean Gaussian data**. With the corrected cutoff, clean data trims ≈2–3% and
`outlierFraction` is a meaningful diagnostic. (Validated: clean recovery within tolerance; 12% injected gross
outliers rejected with the robust variance staying near truth while the contaminated sample variance blows up.)

## Note

The consistency factor uses the Wilson-Hilferty approximation (matches the original engine and the canonical
Croux–Haesbroeck value at p=11 ≈ 1.24; it diverges from the table for small p — a known WH limitation, and
small-p cells route to Ledoit-Wolf anyway). The full multivariate per-cell baseline *compiler* (Family-C cells
consuming `robustCovariance`) is the next L1 increment; this ADR ships the load-bearing estimator + pooling.
Suite green.

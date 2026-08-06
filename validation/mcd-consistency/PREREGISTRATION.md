# Pre-registration — is MCD's covariance inflated, and is it two defects that partly cancel?

**Registered 2026-08-04, before any arm was run.** Engine `v0.6.6-pre`; the estimator under test is
consumer-side, `deploysignal/tools/calibrators/_family-c-mcd.ts`. Wiki item `WORKLIST.md` C15,
raised post-hoc by `knowledge/stats/family-c-pool-2026-08-04`.

Append-only. Results in `results/`, one directory per run.

## 1. Why this study exists

Two independent studies measured the same thing without looking for it. `family-ce-nulls-2026-08-03`
found `trace(Σ̂)/trace(Σ_true)` = **1.131**, not shrinking between n=600 and n=10,000, while
diagnosing why Family E fires 240× too little. `family-c-pool-2026-08-04` found **1.110** on the same
cells, and measured that substituting the true Σ removes **70% of Family C's excess and all of its
false alarms**. One number, two detectors, opposite symptoms.

That result was **post-hoc and explicitly not confirmatory**. This registration exists to make it
count, and to test a specific mechanism read off the code rather than inferred from the symptom.

## 2. The mechanism, stated before measuring

`buildFamilyCPerCellMCD` (`_family-c-mcd.ts:296-320`) runs three steps:

```ts
const mcd = fastMCD(rawZ, mcdAlpha, …);          // α = FASTMCD_DEFAULT_ALPHA = 0.75
const rw  = mcdReweight(rawZ, mcd.mean, mcd.cov); // keeps d² ≤ χ²_{p,0.975}
const correctedCov = rw.cov × consistencyCorrectionFactor(mcdAlpha, p);
```

**H-A — the correction is computed at the wrong coverage.** Croux–Haesbroeck `c_{p,α}` makes the
**raw h-subset** estimate consistent. It is applied here to the **reweighted** estimate, whose
coverage is 0.975. The right factor for that quantity is `c_{p,0.975}`. At p=11 that is 1.240 applied
where 1.034 belongs — a 1.200× over-inflation on its own.

**H-B — the reweighting cutoff uses an uncorrected covariance.** `fastMCD` returns the raw h-subset
covariance with **no** correction applied (the correction lives in the caller), and `mcdReweight`
uses that covariance to compute the Mahalanobis distances it thresholds at `χ²_{p,0.975}`. A
covariance biased low by `1/c_{p,0.75}` inflates every `d²` by `c_{p,0.75}`, so the effective cutoff
on the true scale is `χ²_{p,0.975}/1.240` and **far more than 2.5% is trimmed**. That biases `rw.cov`
further down, partially masking H-A.

**The two-defect model, at p=11:** retained fraction `F_{χ²_11}(21.920/1.240)` = **0.9106**; the
correct factor for a 0.9106-coverage truncation is **1.0974**; net inflation `1.2402/1.0974` =
**1.1301**. The independently measured value is **1.131**.

*This is the reason to measure before changing anything.* The defects push in opposite directions, so
**fixing either one alone makes the estimator worse than it is today.**

## 3. Design

Pure estimator study. No detector, no e-process, no trajectories. Draw `n` rows from `N(0, Σ)` with
`Σ` known by construction, run the estimator, compare `Σ̂` to `Σ`. 200 replicates per cell.

`Σ` is the same `ρ^|i−j|`, `ρ=0.3`, `sd=0.05` family the Family C studies use, restricted to the
first `p` coordinates.

**Grid:** `p ∈ {3, 5, 8, 11, 15}` × `n ∈ {600, 10000}`, plus the four variants:

| variant | raw MCD corrected before reweighting? | factor applied after |
|---|---|---|
| **V0** | no (shipped) | `c(0.75, p)` |
| **V1** | no | `c(0.975, p)` — fixes H-A only |
| **V2** | yes | `c(0.75, p)` — fixes H-B only |
| **V3** | yes | `c(0.975, p)` — fixes both |

Built from the shipped exports `fastMCD`, `mcdReweight`, `consistencyCorrectionFactor`, so V0 is the
shipped path reassembled rather than re-implemented, and must match `buildFamilyCPerCellMCD` exactly.

## 4. Endpoints

**Primary — `trace(Σ̂)/trace(Σ_true)`**, mean over replicates with a two-sided 95% CI.

> **BIASED iff the 95% CI excludes 1. CONSISTENT iff the CI contains 1 and is narrower than ±0.02.**

**Secondary — the retained fraction** from `mcdReweight`, mean over replicates. This is the direct
test of H-B and it is the measurement that distinguishes the two-defect model from a single defect.

**Reported, scored by nothing:** the full relative Frobenius error `‖Σ̂−Σ‖_F/‖Σ‖_F`; the ratio of
largest to smallest eigenvalue of `Σ̂Σ⁻¹` (an inflation that is uniform across directions is a
different defect from one that distorts shape); and a V0-vs-`buildFamilyCPerCellMCD` parity check.

## 5. Registered predictions

Numbered so a wrong one is findable. **P4 is the one I am least sure of.**

- **P1.** V0 retained fraction at p=11 is **0.911 ± 0.02**, not the intended 0.975. This is the
  load-bearing prediction for H-B; if the retained fraction comes out at 0.975, H-B is dead and the
  net inflation must be explained by H-A alone.
- **P2.** V0 `trace` ratio at p=11, n=600 is **1.130 ± 0.02**, reproducing the 1.131 and 1.110
  already measured by two other studies.
- **P3.** V0 is **n-independent**: |ratio(n=10,000) − ratio(n=600)| < 0.02 at every p. Both defects
  are functions of `(p, α)` alone, so nothing about sample size touches them.
- **P4.** V0 inflation **falls as p rises**: 1.236 (p=3), 1.190 (p=5), 1.152 (p=8), 1.130 (p=11),
  1.111 (p=15). The shape is a stronger claim than any single value, and the small-p end is where
  fastMCD's own finite-sample behaviour is most likely to break the model.
- **P5.** V3 is **CONSISTENT** — CI contains 1, half-width < 0.02, at every p.
- **P6 — the one that matters operationally.** Both partial fixes are **worse than shipped**. V1
  under-estimates at **0.942** (p=11) and V2 over-estimates at **1.200**. If either partial fix comes
  out at 1.00, the two-defect model is wrong.

**What would refute the whole model.** V0 retained fraction near 0.975 *and* V3 not consistent. Then
the inflation is neither of the two named defects and the next candidate is `fastMCD`'s h-subset
search itself.

## 6. What this study will not establish

- **Nothing about MRCD.** `buildFamilyCPerCellMRCD` deliberately receives no correction, and
  `family-c-reachability-2026-08-04` found that **every** compiled cell in the corpus is MRCD, not
  MCD. So the defect measured here is on a path that the corpus does not currently take, and fixing
  it changes nothing that ships until the MCD/MRCD routing changes.
- **Nothing about Family E's 240×.** That a shrunk `s_t` would follow from an inflated `Σ̂` is
  arithmetic; that it accounts for the observed factor is a separate measurement.
- **It does not license the post-hoc oracle-Σ result.** That arm stays exploratory whatever happens
  here; this study tests the *mechanism*, not the detector consequence.
- Gaussian data only. MCD exists for contaminated data, and contamination is not varied.

## 7. Disclosure

I wrote the mechanism in §2 by reading the code, and I derived every number in §5 from it before
running anything. If P1 and P2 both land, that is a model fitted to a symptom I already knew
(1.131 was measured on 2026-08-03) — the check against that is P4 and P6, which predict shapes and
signs the earlier measurements never saw.

## 8. Run discipline

1. This file is committed before the harness is written.
2. The V0 parity check runs first. If V0 does not match `buildFamilyCPerCellMCD`, stop.
3. Predictions scored verbatim against §5, including the failures.
4. The wiki page is written from `results/` and names how many of P1–P6 held.

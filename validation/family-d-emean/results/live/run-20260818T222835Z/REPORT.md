# run-20260818T222835Z — E1 splits: FAIL at T=900, not-refuted at T=300; the K-structure stands

Governed by `../../../PREREGISTRATION.md` §§1–5, Amendment A1 (2026-08-18, `35a8011`), and the A1
correction append (committed `bd4893e`, before this run). Supersedes `run-20260818T220621Z` for the
seed-scheme defect named in correction item 2 — declared in this run's manifest (C1.6 shape,
detector-scoped); the superseded run is preserved byte-for-byte and its REPORT stands as that
instrument's reading. One attempt of the corrected instrument:
`node harness/run.mjs --mode live --supersedes run-20260818T220621Z`, 12 cells, ~55 s.

## 1. E1, as computed

Exact-shared calibration (`K = 66,666`; analytic residual `5.677e-4` in log c; replication guard
PASS at `|Δμ̂₀| = 3.676e-5`, `Δσ̂₀/σ̂₀ = 4.200e-4`), `N = 4,000`:

| cell | updates | `E[M_T]` | 95% lower | E1 verdict |
|---|---|---|---|---|
| `N1-exact-T300` | 9 | **1.025668** | 0.991482 | **not-refuted** |
| `N1-exact-T900` | 29 | **1.118376** | **1.007807** | **FAIL** |

§5 registered a marginal FAIL at both horizons (predicted 1.023 / 1.071). T=300 lands on the
prediction and cannot refute; T=900 fails, marginally — the lower bound clears 1 by 0.008.

**The verdict is seed-sensitive at this N, and both runs say so together.** The superseded
instrument read `E[M₉₀₀]` = 1.0336 (CI [0.9342, 1.1330]); this instrument reads 1.1184
(CI [0.9866, 1.2501]). The intervals overlap broadly — the two readings are 1.2 SE apart — and
the FAIL/not-refuted flip is the registered rule scoring a knife-edge quantity as computed, not a
contradiction between the instruments. What survives either draw: the point estimate sits above 1
at both horizons in both runs, and every finite-K cell refutes decisively (§2). `top1_share` on
the T=900 exact cell is 0.0340 — one trajectory carries 3.4% of the mean — so the normal-
approximation bound is itself working on a heavy right tail; that fragility is stated rather than
adjusted for, per the frozen rule.

## 2. The calibration-size axis (C54)

| condition | `E[M_300]` (95% lower) | `E[M_900]` (95% lower) |
|---|---|---|
| exact-shared, `K = 66,666` | 1.025668 (0.991482) | 1.118376 (1.007807) |
| per-trajectory, `K = 400` | 1.036690 (**1.001546**) | 1.176537 (**1.067571**) |
| per-trajectory, `K = 100` | 1.049501 (**1.014526**) | 2.493354 (**1.853845**) |

The ordering exact < K=400 < K=100 holds at both horizons, as `c(T, K) ≈ exp(skew·n + n²r²/2K)`
requires; per-trajectory `K = 100` at T=900 (2.493354) sits above the bootstrap-overshoot
harness's 1.7018–1.9517 range — across-seeding spread on the same condition, consistent with the
shared-draw bands below.

**A single shared calibration draw cannot price a c-bound.** Across `D = 100` shared draws:

| condition | across-draw mean | sd | p05–p95 of `Ê[M_900]` |
|---|---|---|---|
| shared-draw, `K = 400` | 1.188981 | 0.659671 | 0.449951 – 2.416335 |
| shared-draw, `K = 100` | 2.220744 | 2.602248 | 0.200766 – 9.591274 |

(Nearest-rank percentiles, per correction item 3.)

## 3. The committed constants (A1.5.1): CONSISTENT at both horizons

| horizon | committed | measured (exact) | two-sided 95% CI | verdict |
|---|---|---|---|---|
| T=300 | 1.0636 | 1.025668 | [0.984933, 1.066404] | **CONSISTENT** |
| T=900 | 1.1076 | 1.118376 | [0.986625, 1.250128] | **CONSISTENT** |

The constants are not rewritten (A1.5.1); this run is their backing artifact, with `K` stated. At
T=900 the committed 1.1076 now sits *below* the measured point (1.1184) — the conservative-side
framing of the superseded report does not survive this draw and is retired: what the two runs
jointly support is that 1.1076 is **consistent with the exact-moment condition** and that any
tighter statement about its bias direction is inside seed noise at `N = 4,000`.

Which condition the 2026-08-03 measurement ran remains unresolvable: 1.0636 / 1.1076 sit inside
the CIs of the exact cells and of the per-trajectory `K = 400` cells (T=300: [0.994814, 1.078566];
T=900: [1.046696, 1.306378]). The batch-C review's uncommitted exact-moment reading of 1.17 at
T=900, outside the superseded run's CI, is *inside* this run's [0.9866, 1.2501] — the discrepancy
recorded there does not survive the corrected instrument and is withdrawn as a finding against
that sweep.

## 4. Control and guards

- **Rolling control** (`N7-rolling-T300`): `log₁₀ E[M_300] = 21.6296` (bar > 1), shipped-threshold
  crossing rate `0.28875` (bar > 0.2) — **PASS** (A1.4 as corrected). `top1_share = 0.9908`.
- **Replication guard**: PASS (§1 numbers).
- Disjoint cells' shipped-threshold crossing rate: 0 everywhere.

## 5. What this run does not do

- **It does not establish the direction of the exact-moment bias at T=300** (not-refuted), and its
  T=900 FAIL is marginal (lower bound 1.0078) on a heavy-tailed mean.
- **It does not reprice anything**: constants stand, α stays 0.
- **It says nothing about the shipped path** (C53: the compiler supplies max-statistic moments;
  every cell here standardizes single-window peaks by that statistic's own moments).
- **It measures no power.**
- The seed-scheme fix was verified by construction and unit tests (`tests/seed-scheme.test.mjs`),
  not by measuring the superseded run's realized overlap; the superseded run's readings are
  retained above as that instrument's output, uncorrected.

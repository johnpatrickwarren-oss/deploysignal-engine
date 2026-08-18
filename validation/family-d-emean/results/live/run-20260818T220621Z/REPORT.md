# run-20260818T220621Z — E1 not-refuted at exact moments; the inflation on record is a calibration-size effect

Governed by `../../../PREREGISTRATION.md` §§1–5 and Amendment A1 (2026-08-18), both committed
before the harness existed (`35a8011`), with the control bar corrected before any execution
(`80ba651`). One attempt, as registered: `node harness/run.mjs --mode live`, 12 cells, ~16 s.
First committed execution of this study — the 2026-08-03 numbers this directory's constants ship
under had no committed harness or results until this run (C55).

## 1. The headline: E1 did not fail

Under exact-shared calibration (`K = 66,666` windows; analytic residual `5.677e-4` in log c;
replication guard PASS at `|Δμ̂₀| = 1.576e-4`, `Δσ̂₀/σ̂₀ = 2.466e-3`):

| cell | updates | `E[M_T]` | 95% lower | E1 verdict |
|---|---|---|---|---|
| `N1-exact-T300` | 9 | **1.022889** | 0.987714 | **not-refuted** |
| `N1-exact-T900` | 29 | **1.033602** | 0.950192 | **not-refuted** |

§5 registered an expectation of a marginal FAIL at both horizons (1.023 / 1.071 predicted). The
point estimates land almost exactly on the T=300 prediction and below the T=900 one, and neither
lower bound exceeds 1 — so **this run cannot refute `E[M_T] ≤ 1` at exact null moments.**
Not-refuted is not established: the point estimates sit above 1, and the run's own CIs contain
both the §5 predictions and the committed constants. What the verdict does do is relocate the
committed FAIL: **the refutation on record (2026-08-03, lower bounds 1.0257 / 1.0244) is a
finite-K measurement, and this run reproduces a decisive refutation only under finite-K
calibration** (§2). "Family D is not an e-process even on disjoint windows" needs a K qualifier
wherever it is quoted.

## 2. The calibration-size axis (C54), measured with committed code

| condition | `E[M_300]` (95% lower) | `E[M_900]` (95% lower) |
|---|---|---|
| exact-shared, `K = 66,666` | 1.022889 (0.987714) | 1.033602 (0.950192) |
| per-trajectory, `K = 400` | 1.052231 (**1.018179**) | 1.369469 (**1.078325**) |
| per-trajectory, `K = 100` | 1.096003 (**1.055601**) | 1.973845 (**1.585252**) |

Every finite-K cell's lower bound exceeds 1: **under estimated calibration the process is refuted
as an e-process at every K measured, at both horizons, while the exact-moment cells cannot refute
it.** The ordering is the batch-C review's mechanism (`c(T, K) ≈ exp(skew·n + n²r²/2K)`) in
direction and roughly in magnitude, now on committed code; the per-trajectory `K = 100` cell at
T=900 (1.973845) also reproduces the bootstrap-overshoot harness's 1.7018–1.9517 range, which is
what withdrew the 2026-08-10 "contradiction".

**A single shared calibration draw is close to worthless as a pricing measurement.** Across
`D = 100` draws of one shared calibration:

| condition | across-draw mean | sd | p05–p95 of `Ê[M_900]` |
|---|---|---|---|
| shared-draw, `K = 400` | 1.320872 | 0.840322 | 0.522763 – 2.770883 |
| shared-draw, `K = 100` | 1.704040 | 1.631089 | 0.237731 – 5.409627 |

A `c` measured from one shared `K = 400` draw at T=900 can read anything from ~0.5 to ~2.8 at the
90% band. Any historical single-draw reading — including whichever produced the committed
constants — is a draw from a distribution this wide.

## 3. The committed constants (A1.5.1): CONSISTENT, on the conservative side

| horizon | committed | measured (exact) | two-sided 95% CI | verdict |
|---|---|---|---|---|
| T=300 | 1.0636 | 1.022889 | [0.980975, 1.064802] | **CONSISTENT** |
| T=900 | 1.1076 | 1.033602 | [0.934213, 1.132992] | **CONSISTENT** |

Per the frozen disposition, this run becomes the constants' backing artifact, with `K` stated.
Both committed values sit above this run's point estimates — the conservative side for a
deflation bound: pricing with a `c` larger than the true `c` keeps `E[M/c] ≤ 1` and costs fire
time, not validity. The constants are not rewritten (A1.5.1; repricing is a detector-owner
decision, and the shipped path is separately mis-specified — C53).

Which condition the 2026-08-03 measurement ran is not resolvable here: 1.0636 / 1.1076 are inside
the CIs of both the exact cells and the per-trajectory `K = 400` cells (T=300: [1.011656,
1.092806]; T=900: [1.022550, 1.716389]), and its own provenance note says "estimated from 400
windows" while the batch-C review classed it as exact-moment. Both remain possible; the run
records the ambiguity rather than adjudicating it.

**One discrepancy, recorded not resolved:** the batch-C review's uncommitted K-sweep read
`E[M_900]` = 1.18 at `K = 400` and 1.17 at exact moments. 1.17 is outside this run's exact-cell
CI (upper 1.132992). That sweep is a reimplementation with no committed artifact; this run is
committed code driving the shipped detector. The direction-of-doubt rule says the uncommitted
instrument carries it, but nothing here proves which is right.

## 4. Control and guards

- **Rolling control** (`N7-rolling-T300`): point `log₁₀ E[M_300] = 20.3928` (bar > 1) and
  shipped-threshold crossing rate `0.28625` (bar > 0.2) — **PASS** on the corrected A1.4 bar.
  `top1_share = 0.9940`: the mean is one trajectory, which is why the original
  lower-confidence-bound bar was replaced pre-execution. The committed 0.576 false-alarm rate is
  at `α = 0.05` (threshold 20); this run's 0.28625 is at the shipped `1/α_D = 10⁴` — different
  thresholds, deliberately not compared.
- **Replication guard** on the exact calibration: PASS (§1 numbers).
- Disjoint cells' crossing rate at the shipped threshold: 0 everywhere, all conditions — the
  inflation at issue never approaches `10⁴` on healthy data; it is a mean property, not a
  crossing property.

## 5. What this run does not do

- **It does not establish that Family D is an e-process** at exact moments — not-refuted at
  `N = 4,000`, with point estimates above 1.
- **It does not reprice anything.** `types/families/d.ts` constants stand; the α allocation
  stays 0.
- **It says nothing about the shipped path.** The compiler supplies moments of a per-trajectory
  MAX statistic (C53); every cell here standardizes single-window peaks by that statistic's own
  moments. Neither this run's numbers nor the committed constants describe shipped-config wealth.
- **It measures no power** and injects no alternative.
- **The exact-vs-committed comparison has limited power**: at `N = 4,000` the run cannot
  distinguish 1.0336 from 1.1076 at T=900.

# Pre-registration — is the bootstrap threshold over-corrected?

- **Study id:** `2026-08-bootstrap-overshoot`
- **Engine pin:** `v0.6.6-pre`.
- **Discipline:** `knowledge/methodology/pre-registration-discipline`.

Committed before any run.

## 1. The question

Family A betting and Family C safe-Hotelling replace the analytical `1/α` with a bootstrap `(1−α)`
quantile of max wealth. Measured across compiled configs, those shipped thresholds sit at median
**2.4×10⁴** and **3.6×10⁷⁶** times `1/α` (`knowledge/stats/ville-guarantee-is-empirical`).

Family D's directly measured inflation is **c ≈ 1.06**.

**Is the bootstrap calibrated for the worst regime and then applied in every regime, including those
where the detector is already valid?** If so it is buying nothing there and costing power.

## 2. Primary endpoint — B1

`E[M_T | H₀]` at T = 300, N = 4000, for each detector under:

| null | regime |
|---|---|
| N1 | iid Gaussian, **oracle** parameters — both detectors hold here (H₀ battery: 0.031, 0.028) |
| N3-p09 | AR(1) φ=0.9, **oracle** φ — betting holds (0.022), safe-Hotelling fails (0.380) |
| N4-p09 | AR(1) φ=0.9, **estimated** φ — both fail (0.397, 0.656) |

**B1 reports the implied `c` per cell.** No pass/fail: this is a measurement of how much correction
each regime actually needs, against how much the shipped threshold applies.

## 3. The comparison — B2

`overshoot = shipped_threshold_ratio / measured_c` per cell, where `shipped_threshold_ratio` is the
median 2.4×10⁴ (betting) and 3.6×10⁷⁶ (safe-Hotelling) already measured.

## 4. Registered expectation

At **N1 and N3-oracle**, where the H₀ battery measured nominal crossing rates, I expect `c` near 1 —
so an overshoot of roughly the full 2.4×10⁴ and 3.6×10⁷⁶. At **N4**, where both fail, I expect `c`
large enough to justify real correction, though not necessarily that much.

*If that holds, the bootstrap is worst-case calibration applied uniformly, and the power cost in the
common regime is the full overshoot.*

## 5. Control

The rolling Family D path must reproduce `E[M] ≫ 1` as in the companion study, or the harness is
wrong.

// fleet/common-mode.ts — the contamination-robust fleet common-mode.
//
// Promoted per ADR 0004 (engine/consumer charter + nuisance-robust evidence stack); validated in
// Tessera as tools/contamination-robust-fleet.ts (Tessera ADR 0015, cold-eyed). This is the fleet half
// of the FP/FDR-by-construction pipeline:
//
//     contaminationRobustResiduals(X)            // fleet common-mode removed, robustly  ← THIS FILE
//       → nuisanceRobustBFEValue(per shard)       // valid per-shard e-value (ADR 0004 PR A)
//       → eBenjaminiHochberg(e-values, q)         // FDR ≤ q by construction (fleet/e-bh.ts)
//
// WHY A ROBUST CENTER. Fleet-relative detection removes a shared cross-shard common-mode so a
// shard-specific fault stands out. But a faulty shard's onset is itself correlated across the faulty
// subset, so a plain per-tick MEAN/MEDIAN center is CONTAMINATED by the faults (Tessera ADR 0012:
// realized FDP 0.72–0.77 ≫ q). A plain trimmed mean does not fix it either, because the fault is
// confounded with each shard's baseline LEVEL — a faulty-but-low-level shard sits mid-pack, so
// value-rank trimming removes the wrong shards.
//
// CONSTRUCTION. (1) Remove each shard's calibration LEVEL ℓ̂_i (median over the healthy calibration
// window), so the faults become genuine cross-sectional OUTLIERS rather than mid-pack. (2) On the
// level-adjusted cross-section at each tick, estimate the common-mode c_t with a REDESCENDING
// Tukey-biweight M-estimator: unlike Huber's soft downweight (a δ-σ outlier keeps weight ∝ 1/δ), the
// biweight gives any point beyond C·scale weight EXACTLY 0 — so a minority of faulty shards is fully
// rejected and the center is not biased toward them. (3) Residual R[i][t] = X[i][t] − ℓ̂_i − c_t.
//
// VALIDITY ENVELOPE / CONDITIONS (must travel with the fleet verdict — ADR 0004):
//   - SCALAR common-mode: c_t is a per-tick scalar (homogeneous factor loading). Heterogeneous loadings
//     leave residual common-mode → a multi-factor model is the future extension.
//   - MINORITY faults: the redescending center has a finite breakdown — empirically ~20% of shards
//     (Tessera ADR 0015). Past it the faulty subset can capture the center and FDR control is lost.
//   - GENUINE coupling: removing a common-mode only helps when the fleet HAS substantial shared
//     common-mode; on a low-coupling fleet it mostly removes noise and can mildly worsen FP. Apply
//     fleet-relative detection only to genuinely coupled fleets (Tessera ADR 0015 real-GWDG finding).
//   - MASKED faults: a shard faulted THROUGH its calibration window has the fault absorbed into ℓ̂_i
//     (a cold-start/lifecycle case — see ADR 0004 Tier 1 baseline-lifecycle, PR D).
//
// e-BH (Wang–Ramdas) controls FDR under ARBITRARY cross-shard dependence, so sharing one c_t across
// shards is fine; and c_t is estimated IN-SAMPLE (shard i included), but its O(1/N) self-pull only
// shrinks shard i's own residual toward 0 — CONSERVATIVE for false firing.

/** Tukey-biweight tuning constant: 95% efficiency at the Gaussian; the ψ-function redescends to 0
 *  beyond C·scale. (Tessera ADR 0015 TUKEY_C.) */
export const TUKEY_C = 4.685;

const IRLS_TOL = 1e-9;
const IRLS_MAX_ITER = 50;

/** Median of a sample (0 for an empty sample, matching the Tessera reference). */
function median(xs: ReadonlyArray<number>): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const n = s.length;
  return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2;
}

/** Median absolute deviation about `center`, scaled by 1.4826 → a Gaussian-consistent σ estimate. */
function mad(xs: ReadonlyArray<number>, center: number): number {
  return median(xs.map((x) => Math.abs(x - center))) * 1.4826;
}

/** Redescending (Tukey-biweight) M-estimator of location: IRLS from a high-breakdown median start with
 *  a fixed MAD scale. Any point beyond `c`·scale gets weight exactly 0, so a minority of gross outliers
 *  is fully rejected (breakdown toward the theoretical ≈50%, vs Huber's leakage that biases the center
 *  under heavy contamination). Returns the median for an empty sample or a fully-rejected (pathological)
 *  cross-section.
 *
 *  @param xs    the sample (a per-tick cross-section of level-adjusted shard values, in the fleet use).
 *  @param c     biweight tuning constant; defaults to {@link TUKEY_C}. Must be > 0. */
export function robustLocation(xs: ReadonlyArray<number>, c: number = TUKEY_C): number {
  if (!(c > 0)) throw new RangeError(`robustLocation: c must be > 0; got ${c}`);
  if (xs.length === 0) return 0;
  let mu = median(xs);
  const scale = Math.max(mad(xs, mu), 1e-9);
  for (let it = 0; it < IRLS_MAX_ITER; it++) {
    let wsum = 0, wxsum = 0;
    for (const x of xs) {
      const u = (x - mu) / scale / c;
      const w = Math.abs(u) < 1 ? (1 - u * u) ** 2 : 0; // Tukey biweight: 0 beyond c·scale
      wsum += w; wxsum += w * x;
    }
    if (wsum === 0) break; // all points rejected (pathological) — keep the median start
    const next = wxsum / wsum;
    const converged = Math.abs(next - mu) < IRLS_TOL * scale;
    mu = next;
    if (converged) break;
  }
  return mu;
}

/** Per-shard level (fixed effect) ℓ̂_i = MEDIAN over the healthy calibration window [0, calLen) of each
 *  shard's row. (A median, not the Tukey {@link robustLocation} — the per-shard level only needs the
 *  median's breakdown, and the cross-sectional contamination is handled by the robust center.) */
export function perShardLevel(X: ReadonlyArray<ReadonlyArray<number>>, calLen: number): number[] {
  return X.map((row) => median(row.slice(0, calLen)));
}

/** Contamination-robust residual matrix: R[i][t] = X[i][t] − ℓ̂_i − c_t, where ℓ̂_i is the per-shard
 *  calibration level and c_t is the redescending (Tukey-biweight) common-mode of the level-adjusted
 *  cross-section at tick t. Feed each residual row to {@link nuisanceRobustBFEValue} then e-BH for the
 *  FP/FDR-by-construction pipeline (see file header + envelope/conditions there).
 *
 *  `X` is a shards×ticks matrix (every row the same length, all values finite); `calLen` is the healthy
 *  calibration window used for the per-shard level. The cross-sectional center is computed over ALL ticks.
 *
 *  @throws RangeError if `X` is empty, rows are ragged, any value is non-finite, or `calLen` is not in
 *    1..ticks. (Finiteness is guarded here — like the sibling {@link nuisanceRobustBFEValue} — so a NaN
 *    does not propagate silently through the residual matrix into the e-value.) */
export function contaminationRobustResiduals(
  X: ReadonlyArray<ReadonlyArray<number>>,
  calLen: number,
): number[][] {
  const n = X.length;
  if (n === 0) throw new RangeError('contaminationRobustResiduals: X must have at least one shard');
  const t = X[0].length;
  if (t === 0) throw new RangeError('contaminationRobustResiduals: shard rows must be non-empty');
  for (let i = 0; i < n; i++) {
    if (X[i].length !== t) {
      throw new RangeError(`contaminationRobustResiduals: ragged matrix — row ${i} has length ${X[i].length}, expected ${t}`);
    }
    for (let j = 0; j < t; j++) {
      if (!Number.isFinite(X[i][j])) {
        throw new RangeError(`contaminationRobustResiduals: non-finite value at [${i}][${j}]`);
      }
    }
  }
  if (!Number.isInteger(calLen) || calLen < 1 || calLen > t) {
    throw new RangeError(`contaminationRobustResiduals: calLen must be an integer in 1..${t}; got ${calLen}`);
  }

  const lvl = perShardLevel(X, calLen);
  const R: number[][] = X.map(() => new Array<number>(t));
  const colAdj = new Array<number>(n);
  for (let j = 0; j < t; j++) {
    for (let i = 0; i < n; i++) colAdj[i] = X[i][j] - lvl[i];
    const c = robustLocation(colAdj);
    for (let i = 0; i < n; i++) R[i][j] = colAdj[i] - c;
  }
  return R;
}

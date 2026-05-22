/** Architect Phase 3.A default RFF dimension. Increase to 512 / 1024
 *  per halt-criterion (b) escalation if FPR convergence at D=256
 *  insufficient. */
export declare const RFF_DEFAULT_DIM = 256;
/** Mulberry32 — small, fast, deterministic seeded PRNG. Pure 32-bit
 *  unsigned-integer arithmetic; cross-platform safe (no FP libm
 *  variance for state evolution). Returns a function that yields
 *  uniform doubles in [0, 1) on each call. Period 2³².
 *
 *  Reference: github.com/bryc/code/blob/master/jshash/PRNGs.md#mulberry32
 *  (public domain). */
export declare function mulberry32(seed: number): () => number;
/** Generate `count` standard-normal samples from the seeded uniform
 *  PRNG via the Box-Muller transform. Box-Muller produces samples in
 *  pairs (n1, n2) per uniform pair (u1, u2); we materialize the full
 *  array up front so callers can index deterministically without
 *  worrying about pair-truncation when `count` is odd. */
export declare function boxMullerNormals(rng: () => number, count: number): Float64Array;
/** RFF feature-map prerequisites — ω matrix (D × d) and b vector (D)
 *  derived deterministically from a seed integer. Pre-cell seed
 *  guarantees calibrator-time and runtime-time agreement on the
 *  feature map without persisting the full matrices in the compiled
 *  config (D×d×n_cells = ~3 MB for our scale; rejected as schema
 *  bloat per architect Phase 3.A pick). */
export interface RffFeatureMap {
    /** ω matrix; ω[i] ∈ R^d sampled from N(0, σ⁻²·I_d). Outer index i
     *  ∈ [0, D); inner index j ∈ [0, d). */
    omega: number[][];
    /** b vector; b[i] sampled from U(0, 2π). */
    b: number[];
    /** D — number of Fourier features. */
    D: number;
    /** d — input dimension. */
    d: number;
    /** Bandwidth σ used to set ω_i scale. Stored for audit visibility;
     *  caller passes this same value at applyRffFeatureMap (kernel
     *  approximation depends on σ — must match calibration-time σ). */
    bandwidth: number;
}
/** Compute the RFF feature map (ω matrix + b vector) deterministically
 *  from `seed`. The same seed produces byte-identical output across
 *  platforms (Mulberry32 + Box-Muller use only IEEE-754 standard libm
 *  operations on finite inputs — empirically verified at Q72 SLICE 2
 *  Phase 3.C cross-platform-determinism gate).
 *
 *  ω_{i,j} ~ N(0, σ⁻²) — equivalently, ~ N(0,1) / σ.
 *  b_i      ~ U(0, 2π). */
export declare function computeRffFeatureMap(seed: number, D: number, d: number, bandwidth: number): RffFeatureMap;
/** Apply the RFF feature map: φ(x) = sqrt(2/D) · [cos(ω₁ᵀx + b₁), …,
 *  cos(ω_DᵀX + b_D)]. Returns a freshly-allocated Float64Array of
 *  length D. Caller can convert to number[] if needed (kept as
 *  Float64Array for cross-platform-bit-stable summation and inner
 *  products). */
export declare function applyRffFeatureMap(x: number[], fm: RffFeatureMap): Float64Array;
/** Compute the mean of φ(x) over a baseline pool. Used at calibration
 *  time to compute μ_P^φ = (1/N_P) Σ_i φ(X_{P,i}); the calibrator
 *  persists this vector in `cell.betting_e_process_params.baseline_rff_mean`
 *  so the runtime detector skips re-evaluating the P-side at every
 *  tick.
 *
 *  Returns Float64Array of length fm.D. Empty pool returns zeros. */
export declare function rffMeanOverPool(pool: ReadonlyArray<ReadonlyArray<number>>, fm: RffFeatureMap): Float64Array;
/** Inner product of two Float64Arrays of equal length D. Used for
 *  the runtime witness: F_t = φ(x_t) · (μ_P^φ - μ_Q^φ). */
export declare function rffDot(a: Float64Array | ReadonlyArray<number>, b: Float64Array | ReadonlyArray<number>): number;
/** Derive a 32-bit unsigned-integer seed from the cell key — used by
 *  the calibrator + runtime to deterministically generate the RFF
 *  feature map for a given cell. Mirrors the existing `baselinePoolSeed`
 *  pattern from sequential-mmd.ts. Hash construction: string concat
 *  cell-key components, then Java-style String.hashCode (cumulative
 *  31·h + char) → mask to 32-bit unsigned.
 *
 *  NOTE: hash collisions across distinct cell keys are tolerable
 *  because the seed only feeds RFF feature map generation; collisions
 *  produce the SAME feature map for distinct cells, which is
 *  statistically benign (the cells already share RBF bandwidth from
 *  the same calibrator pass). */
export declare function rffCellSeed(cellKey: {
    hour_of_day: number;
    day_of_week?: number;
    tier?: string;
}): number;
//# sourceMappingURL=family-c-rff.d.ts.map
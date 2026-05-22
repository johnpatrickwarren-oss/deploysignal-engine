/** Four-class taxonomy covering DeploySignal's six Family A signals
 *  + extensible to future signals. Each class implies a forward
 *  transform applied symmetrically at compile time (to baseline
 *  samples) and at runtime (to live observations) before standard
 *  z-score derivation.
 *
 *  - `gaussian_like`        — identity transform; standard betting
 *    pipeline. Latency-style signals. Default for unclassified
 *    signals.
 *  - `bounded_probability`  — logit transform; rate-style signals
 *    in [0, 1] that saturate at boundary. Logit maps (0, 1) →
 *    (−∞, +∞); resulting σ² is well-conditioned in logit-space.
 *  - `heavy_tail`           — log transform; multiplicative-process
 *    values (cost, tokens). Log compresses the tail; resulting
 *    distribution is approximately Gaussian for typical multiplicative
 *    data.
 *  - `counts`               — Anscombe stabilizer 2·√(x + 3/8); maps
 *    Poisson(λ) → ≈ N(2√λ, 1) for moderate λ. Future signals like
 *    `error_count`. */
export type SignalClass = 'gaussian_like' | 'bounded_probability' | 'heavy_tail' | 'counts';
/** Logit-transform boundary clip. Chosen to keep
 *  `log(eps / (1 − eps)) ≈ −20.7` (well within float64 range; not
 *  catastrophic FP loss). Spec open-Q 3 — tunable post-empirical-test;
 *  architect-default 1e-9 with regression tests. */
export declare const LOGIT_BOUNDARY_EPS = 1e-9;
/** Log-transform floor. Avoids `log(0)` on signals that may legitimately
 *  hit zero (rare cost samples, idle-period tokens). */
export declare const LOG_FLOOR_EPS = 1e-9;
/** Logit transform: x ∈ (0, 1) → (−∞, +∞).
 *  Boundary clipping prevents `log(0)` / `log(∞)` at saturation;
 *  inverse-operation (sigmoid) produces back-mapped value within
 *  [eps, 1 − eps]. */
export declare function logitTransform(x: number): number;
/** Log transform: x ∈ [0, +∞) → (−∞, +∞).
 *  Floor clipping handles legitimate zeros without producing −∞. */
export declare function logTransform(x: number): number;
/** Anscombe variance-stabilizing transform for Poisson-like counts.
 *  `f(x) = 2 · √(max(0, x) + 3/8)` — handles x = 0 explicitly via the
 *  `max(0, …)` guard so negative inputs (which shouldn't occur on a
 *  count signal but defensively might via FP rounding) don't produce
 *  NaN. */
export declare function anscombeTransform(x: number): number;
/** Class-appropriate forward transform dispatcher. Single function
 *  call; O(1) per tick per signal at runtime; runtime cost negligible.
 *  Unknown / non-enumerated class falls back to identity transform —
 *  defensive default for forward-compat with future class additions
 *  loaded from a CompiledConfig that this code revision didn't ship. */
export declare function transformForClass(x: number, cls: SignalClass): number;
/** Default signal-class assignment per spec table. Operators can
 *  override per-deploy via `CompiledConfig.signal_classes`; absence
 *  = lookup in this map; absence in this map = `'gaussian_like'`. */
export declare const DEFAULT_SIGNAL_CLASSES: Record<string, SignalClass>;
/** Resolve the class for a given signal: caller-supplied override map
 *  → DEFAULT_SIGNAL_CLASSES → 'gaussian_like'. Centralizes the
 *  three-tier lookup so calibrator and runtime dispatcher share
 *  byte-identical resolution. */
export declare function resolveSignalClass(signal: string, overrides?: Record<string, SignalClass>): SignalClass;
//# sourceMappingURL=signal-classes.d.ts.map
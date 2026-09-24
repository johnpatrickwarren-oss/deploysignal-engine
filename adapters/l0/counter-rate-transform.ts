// engine/l0/counter-rate-transform.ts — Tessera Phase 2 SLICE 3.A.5 (R25).
//
// L0 contract for Tessera ingestion: defines the explicit guarantees the L0
// layer makes to downstream consumers (TrendBuffer at engine/core.ts:27-100;
// per-shard detector cascade; fleet-merge consumer at
// engine/fleet/verdict-consumer.ts; Wave 2 WU-01/02/03 ingestion adapters).
//
// Six invariants (Q-R25-SPEC.md § 1.2):
//   1. Rate-domain output for counter signals (delta / actual_elapsed_seconds);
//      gauge / ratio / latency_quantile / categorical_rate pass through.
//   2. actual_elapsed_seconds derived per-pair from sample timestamps (first-class).
//   3. Missed-scrape-then-catchup detection: elapsed > expected × (1 + jitter)
//      flags slope_quality 'degraded' + missed_scrape_inferred = true; no
//      interpolation (rejected per PRD — creates false structure surviving
//      the degraded flag).
//   4. DCGM 32-bit counter wraparound: when counter_width = 32 AND next < prev
//      AND prev > UINT32_MAX × wrap_threshold_ratio, emit corrected rate via
//      (UINT32_MOD − prev + next) / elapsed; wraparound_handled = true.
//   5. Reset-vs-wrap disambiguation: any other next < prev → value = null,
//      reset_detected = true. Downstream consumers MAY signal continuity-break
//      to L0 schema-continuity layer (analogous to inherited 'breaking'
//      classification at engine/l0/schema-continuity.ts).
//   6. Metadata propagation: every RateSample carries slope_quality,
//      missed_scrape_inferred, wraparound_handled, reset_detected.
//
// CounterMetadata mirrors SchemaDescriptor.semantic_type semantics
// (engine/l0/schema-continuity.ts:44 — 'counter' | 'gauge' | 'ratio' |
// 'latency_quantile' | 'categorical_rate') and adds tessera-specific
// counter_width. The inherited engine/l0/schema-continuity.ts is NOT
// modified (A12 anti-scope); ingestion adapters construct CounterMetadata
// from their adapter-local knowledge of signal semantics + counter width.
//
// Pure-function contract: transformPair(prev, next, meta, opts) → RateSample.
// Caller manages per-key prev-sample state (typically the ingestion adapter).
// First-scrape edge case is the caller's responsibility (transformPair
// signature requires a non-optional prev).
//
// Tessera-original code (NOT vendored from DeploySignal).

export interface CounterSample {
  /** Counter reading or value at the sample point.
   *  For counters, the cumulative count; for gauges/ratios, the instantaneous value. */
  value: number;
  /** Sample timestamp in seconds (epoch or relative; only differences matter). */
  ts_seconds: number;
}

export interface CounterMetadata {
  /** Mirrors engine/l0/schema-continuity.ts:44 — 'counter' | 'gauge' | 'ratio'
   *  | 'latency_quantile' | 'categorical_rate'. Only the literal 'counter' triggers
   *  rate-domain transform; all other values produce value-domain pass-through. */
  semantic_type: string;
  /** Counter width in bits, used only when semantic_type === 'counter' to determine
   *  whether the wraparound path applies. Defaults to 64 (no wraparound expected;
   *  any next < prev classifies as reset). DCGM 32-bit counters (e.g., NVLink error
   *  counters per SCOPING-MEMO-v0.3.md § 2.3 invariant 4): pass 32. */
  counter_width?: 32 | 64;
}

export interface TransformOpts {
  /** Expected scrape interval in seconds. Used to detect missed-scrape catch-up
   *  (when actual elapsed > expected × (1 + jitter_tolerance)). Required —
   *  caller must declare what cadence they were scheduling. */
  expected_scrape_interval_seconds: number;
  /** Fraction above expected interval before a sample is flagged degraded.
   *  Default: DEFAULT_JITTER_TOLERANCE = 0.5 (threshold = expected × 1.5). */
  jitter_tolerance?: number;
  /** Fraction of UINT32_MAX above which prev is considered "near wrap" for the
   *  32-bit wraparound path. Default: DEFAULT_WRAP_THRESHOLD_RATIO = 0.9. */
  wrap_threshold_ratio?: number;
}

export interface RateSample {
  /** Per-second rate for counter signals; pass-through value for non-counter.
   *  null when reset_detected (rate post-reset is undefined). */
  value: number | null;
  /** next.ts_seconds − prev.ts_seconds; always emitted (invariant 2). */
  actual_elapsed_seconds: number;
  /** 'degraded' iff missed_scrape_inferred or nonpositive_elapsed_detected;
   *  'normal' otherwise. */
  slope_quality: 'normal' | 'degraded';
  /** true iff actual_elapsed_seconds > expected × (1 + jitter_tolerance). */
  missed_scrape_inferred: boolean;
  /** true iff the 32-bit wraparound corrective path fired. */
  wraparound_handled: boolean;
  /** true iff next < prev fell through to the reset path. value is null. */
  reset_detected: boolean;
  /** Present (true) iff actual_elapsed_seconds <= 0 — duplicate or
   *  out-of-order timestamps (remediation 2026-06-10 M3). value is null and
   *  slope_quality is 'degraded'; a rate over non-positive elapsed time is
   *  undefined and must not reach TrendBuffer/detector state. */
  nonpositive_elapsed_detected?: boolean;
}

export const UINT32_MAX = 4_294_967_295;
export const UINT32_MOD = 4_294_967_296;
export const DEFAULT_JITTER_TOLERANCE = 0.5;
export const DEFAULT_WRAP_THRESHOLD_RATIO = 0.9;

export function transformPair(
  prev: CounterSample,
  next: CounterSample,
  meta: CounterMetadata,
  opts: TransformOpts,
): RateSample {
  const actual_elapsed_seconds = next.ts_seconds - prev.ts_seconds;

  // Pair-level timestamp invariant (remediation 2026-06-10 M3): a pair with
  // non-positive elapsed (duplicate or out-of-order scrape timestamps) has no
  // defined rate — previously this divided by 0/negative, emitting
  // Infinity/NaN or negative rates flagged 'normal'. Mirrors the reset path:
  // null value + quality flag; applies to all semantic types because the
  // broken invariant is the timestamps, not the value semantics.
  if (actual_elapsed_seconds <= 0) {
    return {
      value: null,
      actual_elapsed_seconds,
      slope_quality: 'degraded',
      missed_scrape_inferred: false,
      wraparound_handled: false,
      reset_detected: false,
      nonpositive_elapsed_detected: true,
    };
  }

  const jitter = opts.jitter_tolerance ?? DEFAULT_JITTER_TOLERANCE;
  const expected = opts.expected_scrape_interval_seconds;
  const missed_scrape_inferred = actual_elapsed_seconds > expected * (1 + jitter);
  const slope_quality: 'normal' | 'degraded' = missed_scrape_inferred ? 'degraded' : 'normal';

  // Invariant 1 — non-counter pass-through (value-domain unchanged).
  if (meta.semantic_type !== 'counter') {
    return {
      value: next.value,
      actual_elapsed_seconds,
      slope_quality,
      missed_scrape_inferred,
      wraparound_handled: false,
      reset_detected: false,
    };
  }

  // Counter arm.
  const width = meta.counter_width ?? 64;

  if (next.value < prev.value) {
    // Invariant 4 — 32-bit wraparound path (only when width === 32 AND prev near max).
    const wrapThresh = (opts.wrap_threshold_ratio ?? DEFAULT_WRAP_THRESHOLD_RATIO) * UINT32_MAX;
    if (width === 32 && prev.value > wrapThresh) {
      const corrected_delta = (UINT32_MOD - prev.value) + next.value;
      return {
        value: corrected_delta / actual_elapsed_seconds,
        actual_elapsed_seconds,
        slope_quality,
        missed_scrape_inferred,
        wraparound_handled: true,
        reset_detected: false,
      };
    }

    // Invariant 5 — reset path (any other decreasing counter).
    return {
      value: null,
      actual_elapsed_seconds,
      slope_quality,
      missed_scrape_inferred,
      wraparound_handled: false,
      reset_detected: true,
    };
  }

  // Clean increasing counter — rate-domain transform.
  const delta = next.value - prev.value;
  return {
    value: delta / actual_elapsed_seconds,
    actual_elapsed_seconds,
    slope_quality,
    missed_scrape_inferred,
    wraparound_handled: false,
    reset_detected: false,
  };
}

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
export declare const UINT32_MAX = 4294967295;
export declare const UINT32_MOD = 4294967296;
export declare const DEFAULT_JITTER_TOLERANCE = 0.5;
export declare const DEFAULT_WRAP_THRESHOLD_RATIO = 0.9;
export declare function transformPair(prev: CounterSample, next: CounterSample, meta: CounterMetadata, opts: TransformOpts): RateSample;
//# sourceMappingURL=counter-rate-transform.d.ts.map
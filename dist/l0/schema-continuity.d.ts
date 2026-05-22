import type { SchemaContinuityRecord } from '../types';
/** Inputs to the schema hash. All string-valued so the hash is stable
 *  across language/encoding round-trips. Omit keys that aren't part of
 *  the metadata to keep the hash deterministic. */
export interface SchemaDescriptor {
    signal_name: string;
    unit: string;
    /** counter | gauge | ratio | latency_quantile | categorical_rate. */
    semantic_type: string;
    /** per_request | per_second | per_minute | per_tick. */
    granularity: string;
    /** Set of label keys attached to the metric (not values — just keys). */
    label_keys?: string[];
    /** For latency_quantile: quantile list (e.g. [0.5, 0.95, 0.99]). */
    quantile_list?: number[];
    /** For histograms: bucket boundary set. */
    bucket_boundaries?: number[];
    /** For traces: span name set. */
    trace_span_names?: string[];
    /** For traces: attribute key set. */
    trace_attribute_keys?: string[];
}
/** Deterministic non-cryptographic hash. FNV-1a 32-bit on the serialized
 *  descriptor's canonical form. Crypto isn't required — the hash's job is
 *  equality comparison, not collision resistance under adversarial input. */
export declare function hashSchema(desc: SchemaDescriptor): string;
/** Classify a post-deploy schema observation against the pre-deploy
 *  baseline descriptor. Returns the continuity class per Addition #8's
 *  table. */
export declare function classifyContinuity(baseline: SchemaDescriptor, observed: SchemaDescriptor, opts?: {
    observabilityStackDeploy?: boolean;
}): SchemaContinuityRecord['schema_continuity'];
/** Emit a schema-continuity record for a post-deploy tick. `baselineRef`
 *  identifies the compiled config whose baseline this stream should be
 *  compared against; a mismatch between the live stream's baselineRef and
 *  the compiled config's baseline_ref is itself a breaking-class change. */
export declare function makeContinuityRecord(baseline: SchemaDescriptor, observed: SchemaDescriptor, baselineRef: string, opts?: {
    observabilityStackDeploy?: boolean;
}): SchemaContinuityRecord;
/** Per-family suppression decision per Addition #8 §Consequences at L2.
 *  Returns the set of families that should suppress for a signal under
 *  the given continuity class. `'*'` means "all families". */
export declare function familiesToSuppress(klass: SchemaContinuityRecord['schema_continuity']): Array<'A' | 'B' | 'C' | 'D' | 'E'> | '*';
/** Convenience: should a specific family suppress given this class? */
export declare function shouldSuppress(klass: SchemaContinuityRecord['schema_continuity'], family: 'A' | 'B' | 'C' | 'D' | 'E'): boolean;
/** Minimum post-deploy sample count before a rebaseline can complete.
 *  Addition #8 default; SRE policy overrides in production. */
export declare const MIN_REBASELINE_SAMPLES = 500;
//# sourceMappingURL=schema-continuity.d.ts.map
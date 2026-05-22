"use strict";
// VENDORED FROM DeploySignal main@5a72371 — 2026-05-16
// Source: deploysignal/engine/l0/schema-continuity.ts
// Sync policy: vendored-at-pin
// Extract target: @johnpatrickwarren-oss/deploysignal-engine (Tessera Phase 2 close commitment)
// DO NOT modify internals without ADR; deltas only at architecturally-anchored extension points (see SCOPING-MEMO-v0.3 § 9).
Object.defineProperty(exports, "__esModule", { value: true });
exports.MIN_REBASELINE_SAMPLES = void 0;
exports.hashSchema = hashSchema;
exports.classifyContinuity = classifyContinuity;
exports.makeContinuityRecord = makeContinuityRecord;
exports.familiesToSuppress = familiesToSuppress;
exports.shouldSuppress = shouldSuppress;
/** Deterministic non-cryptographic hash. FNV-1a 32-bit on the serialized
 *  descriptor's canonical form. Crypto isn't required — the hash's job is
 *  equality comparison, not collision resistance under adversarial input. */
function hashSchema(desc) {
    const canonical = canonicalize(desc);
    const s = JSON.stringify(canonical);
    let h = 0x811c9dc5 >>> 0;
    for (let i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i);
        h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
    }
    return h.toString(16).padStart(8, '0');
}
function canonicalize(desc) {
    const out = {
        signal_name: desc.signal_name,
        unit: desc.unit,
        semantic_type: desc.semantic_type,
        granularity: desc.granularity,
    };
    if (desc.label_keys)
        out.label_keys = [...desc.label_keys].sort();
    if (desc.quantile_list)
        out.quantile_list = [...desc.quantile_list].sort((a, b) => a - b);
    if (desc.bucket_boundaries)
        out.bucket_boundaries = [...desc.bucket_boundaries].sort((a, b) => a - b);
    if (desc.trace_span_names)
        out.trace_span_names = [...desc.trace_span_names].sort();
    if (desc.trace_attribute_keys)
        out.trace_attribute_keys = [...desc.trace_attribute_keys].sort();
    return out;
}
/** Classify a post-deploy schema observation against the pre-deploy
 *  baseline descriptor. Returns the continuity class per Addition #8's
 *  table. */
function classifyContinuity(baseline, observed, opts) {
    if (opts?.observabilityStackDeploy)
        return 'observability_stack';
    // Identity → continuous.
    if (hashSchema(baseline) === hashSchema(observed))
        return 'continuous';
    // Breaking: unit / semantic_type / granularity / signal_name changed, or
    // quantile / bucket list changed. A label key REMOVED is breaking; a
    // label key ADDED is extended.
    if (baseline.signal_name !== observed.signal_name)
        return 'breaking';
    if (baseline.unit !== observed.unit)
        return 'breaking';
    if (baseline.semantic_type !== observed.semantic_type)
        return 'breaking';
    if (baseline.granularity !== observed.granularity)
        return 'breaking';
    if (!setEquals(baseline.quantile_list, observed.quantile_list))
        return 'breaking';
    if (!setEquals(baseline.bucket_boundaries, observed.bucket_boundaries))
        return 'breaking';
    // Label keys: added-only is extended; removed-any is breaking.
    const baseKeys = new Set(baseline.label_keys ?? []);
    const obsKeys = new Set(observed.label_keys ?? []);
    for (const k of baseKeys)
        if (!obsKeys.has(k))
            return 'breaking';
    // Trace span / attribute keys: symmetric (new additions are extended).
    const baseSpans = new Set(baseline.trace_span_names ?? []);
    const obsSpans = new Set(observed.trace_span_names ?? []);
    for (const k of baseSpans)
        if (!obsSpans.has(k))
            return 'breaking';
    const baseAttrs = new Set(baseline.trace_attribute_keys ?? []);
    const obsAttrs = new Set(observed.trace_attribute_keys ?? []);
    for (const k of baseAttrs)
        if (!obsAttrs.has(k))
            return 'breaking';
    // Everything else is extended (added label key, new span name, etc.).
    return 'extended';
}
function setEquals(a, b) {
    if (!a && !b)
        return true;
    if (!a || !b)
        return false;
    if (a.length !== b.length)
        return false;
    const sa = [...a].sort((x, y) => x - y);
    const sb = [...b].sort((x, y) => x - y);
    for (let i = 0; i < sa.length; i++)
        if (sa[i] !== sb[i])
            return false;
    return true;
}
/** Emit a schema-continuity record for a post-deploy tick. `baselineRef`
 *  identifies the compiled config whose baseline this stream should be
 *  compared against; a mismatch between the live stream's baselineRef and
 *  the compiled config's baseline_ref is itself a breaking-class change. */
function makeContinuityRecord(baseline, observed, baselineRef, opts) {
    const klass = classifyContinuity(baseline, observed, opts);
    return {
        schema_hash: hashSchema(observed),
        schema_continuity: klass,
        schema_baseline_ref: baselineRef,
    };
}
/** Per-family suppression decision per Addition #8 §Consequences at L2.
 *  Returns the set of families that should suppress for a signal under
 *  the given continuity class. `'*'` means "all families". */
function familiesToSuppress(klass) {
    switch (klass) {
        case 'continuous': return [];
        case 'extended': return []; // no suppression; C/E may pick up new dim on rebaseline
        case 'breaking': return ['A', 'C', 'D', 'E']; // per-signal A/D; C/E suppress entirely
        case 'observability_stack': return '*';
    }
}
/** Convenience: should a specific family suppress given this class? */
function shouldSuppress(klass, family) {
    const list = familiesToSuppress(klass);
    if (list === '*')
        return true;
    return list.indexOf(family) >= 0;
}
/** Minimum post-deploy sample count before a rebaseline can complete.
 *  Addition #8 default; SRE policy overrides in production. */
exports.MIN_REBASELINE_SAMPLES = 500;
//# sourceMappingURL=schema-continuity.js.map
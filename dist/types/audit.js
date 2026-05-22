"use strict";
// VENDORED FROM DeploySignal main@5a72371 — 2026-05-16
// Source: deploysignal/engine/types/audit.ts
// Sync policy: vendored-at-pin
// Extract target: @johnpatrickwarren-oss/deploysignal-engine (Tessera Phase 2 close commitment)
// DO NOT modify internals without ADR; deltas only at architecturally-anchored extension points (see SCOPING-MEMO-v0.3 § 9).
Object.defineProperty(exports, "__esModule", { value: true });
exports.DETECTOR_REGISTRY = void 0;
// ── Audit schema v2 registry + types (W4 §4.1.h) ──────────────────
//
// Per audit/SCHEMA.md v2. Shipped-in-W4 canonical detector_ids only; reserved
// entries live in the spec but aren't emitted. Readers that see an
// unknown_detector_id emit a warning and preserve the record.
/** Canonical detector_ids per family, as shipped in W4. Normative —
 *  audit writers pull from here; readers validate against it. */
exports.DETECTOR_REGISTRY = {
    A: [
        // Legacy `mSPRT_*` ids — Page-CUSUM's canonical emission path
        // through W5. ARCHITECT-REPLY-34 D2 rewrites to `page_cusum_*` at
        // the REPLY-36 cleanup alongside demo expected_outcome updates;
        // kept as read-time aliases indefinitely for v1 replay compat.
        'mSPRT_p99_latency', 'mSPRT_ttft', 'mSPRT_eval_score',
        'mSPRT_tool_success_rate', 'mSPRT_downstream_err', 'mSPRT_cost_req',
        // Addition #17 (ARCHITECT-REPLY-34 D2) — forward-compat aliases
        // for the Page-CUSUM detector. Reserved for the REPLY-36 emission-
        // side rename; not produced by the audit writer in this PR.
        'page_cusum_p99_latency', 'page_cusum_ttft', 'page_cusum_eval_score',
        'page_cusum_tool_success_rate', 'page_cusum_downstream_err', 'page_cusum_cost_req',
        // Addition #17 — betting-based e-processes (Waudby-Smith & Ramdas
        // 2024 GRAPA + ONS fallback). Co-shipped alongside Page-CUSUM
        // under a 50/50 per-signal α split; fires emit
        // `betting_e_process_{signal}` in audit records.
        'betting_e_process_p99_latency', 'betting_e_process_ttft',
        'betting_e_process_eval_score', 'betting_e_process_tool_success_rate',
        'betting_e_process_downstream_err', 'betting_e_process_cost_req',
    ],
    B: [
        'kv_saturation', 'hbm_elevation', 'hbm_spill_roll', 'mfu_collapse',
        'slowbleed', 'collective', 'capacity', 'gpu_eff', 'compound_lat',
        'tok_econ', 'behavioral', 'eval_quality_drop', 'refusal_spike',
        'output_len_drift', 'tool_call_degradation', 'quality_warning',
    ],
    C: ['hotelling_t2_joint_vector', 'sequential_mmd', 'hotelling_t2_safe', 'sequential_mmd_e_process'],
    D: ['spectral_peak_acf_kv_cache', 'spectral_e_detector_kv_cache'],
    E: ['mahalanobis_conformal_baseline'],
};
//# sourceMappingURL=audit.js.map
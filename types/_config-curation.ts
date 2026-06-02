// engine/types/_config-curation.ts — split from config.ts (god-file decomposition).
// Q61 baseline-curation pipeline decision audit types + bundle metadata.
// Re-exported verbatim from ./config (facade); see config.ts header for vendoring policy.

/** Q61 SPEC-1 — 10-decision baseline curation pipeline canonical
 *  decision identifier. SLICE 1 ships D1-D4; SLICE 2 ships D5-D7;
 *  SLICE 3 ships D8-D10.
 *  Tessera SLICE 4 (R06) — additive extension D11; reserves D12 + D13 for SLICE 5 (R07).
 *    D11: per-shard within-window contamination screening (R06-shipped; tools/curate-baseline-pre-pass.ts).
 *    D12: fleet-correlated contamination detection (R07 reserved per Q-JC4; Stage 2b FCP-1).
 *    D13: warm-start eligibility tagging (R07 reserved per Q-JC5; Stage 3b). */
export type BaselineCurationDecisionId =
  | 'D1' | 'D2' | 'D3' | 'D4'
  | 'D5' | 'D6' | 'D7'
  | 'D8' | 'D9' | 'D10'
  | 'D11' | 'D12' | 'D13';  // ─── Tessera SLICE 4 Delta 1: per-shard contamination decisions

/** Q61 SPEC-1 — per-decision audit-emission record. Each decision in
 *  the baseline curation pipeline emits one of these, capturing the
 *  decision's inputs (upstream decisions + compile state), output,
 *  decision rule (architect prior-spec citation), verification
 *  (audit-emitted boolean + diagnostic path), and source-memorialization
 *  (architect-prior-spec reference). Audit trail enables Reviewer
 *  cross-references + future spec-drafting layer-attribution. */
export interface BaselineCurationDecision {
  /** Canonical decision identifier (D1-D13). */
  decision_id: BaselineCurationDecisionId;
  /** Human-readable decision name (e.g., 'Per-cell μ aggregation'). */
  decision_name: string;
  /** Decision inputs: upstream-decision dependencies (null for
   *  foundational decisions D1+D3) + opaque compile-state reference. */
  inputs: {
    upstream_decisions?: BaselineCurationDecisionId[];
    /** Opaque compile-state reference; downstream consumers shouldn't
     *  parse — exists for audit-trail traceability only. */
    compile_state_ref: string;
  };
  /** Opaque output reference. The actual numeric outputs (per-cell μ
   *  arrays, Σ matrices, sliding-buffer thresholds) live on existing
   *  CompiledConfig fields; this field captures the audit summary
   *  (e.g., {n_cells, n_signals} for D1) — NOT a duplicate of the
   *  existing CompiledConfig payload. */
  output_summary: Record<string, number | string | boolean>;
  /** Brief rule citation (architect-prior-spec memory). */
  decision_rule: string;
  /** Audit-emission verification: confirms the decision's diagnostic
   *  was emitted at the expected path. */
  verification: {
    audit_emitted: boolean;
    diagnostic_path: string;
  };
  /** Architect prior-spec citation (e.g., 'ARCHITECT-REPLY-Q2-B-4-…'). */
  source_memorialization: string;
}

/** REPLY-51b R4-2 — fast-path metadata read from the baseline bundle
 *  manifest without materializing samples. Consumed by the profile-
 *  dispatch layer to reconcile profile-requested cell dimensions
 *  against what the baseline actually supports (three-case per
 *  REPLY-51a D4). */
export interface BundleMetadata {
  /** Which cell-matrix dimensions the baseline carries enough
   *  metadata to emit along. hour_of_day is always true for any
   *  well-formed bundle (cell_dim !== null). day_of_week true when
   *  cell_dim === 'hour_of_day_x_day_of_week'. tenant_tier true
   *  when manifest.tenants > 1 (or bundle carries per-run tenant_id).
   *  workload_class + region currently always false (no manifest
   *  support; post-phase additions). */
  available_dimensions: {
    hour_of_day: boolean;
    day_of_week: boolean;
    workload_class: boolean;
    tenant_tier: boolean;
    region: boolean;
  };
  /** Total sample count (for diagnostic + audit); sum of
   *  n_runs × ticks_per_run from the manifest. */
  sample_count: number;
  /** Temporal span in days covered by the bundle. When not
   *  explicitly stamped on the manifest, defaults to 0 (reader
   *  treats 0 as "unknown"). */
  temporal_span_days: number;
  /** Matches manifest.version / bundle.version (e.g., `'synthetic-v1'`). */
  source_id: string;
  /** Bundle-generator version stamp for audit provenance.
   *  Defaults to `source_id` when the manifest doesn't expose a
   *  distinct ingestion-tool version. */
  ingestion_version: string;
}

// engine/types/_config-profile.ts — split from config.ts (god-file decomposition).
// Addition #28 reference workload-profile + customer-override + effective-config shapes.
// Re-exported verbatim from ./config (facade); see config.ts header for vendoring policy.

// ── Addition #28 (ARCHITECT-REPLY-51) — Reference workload profiles ──
//
// YAML-backed template library that parameterizes CompiledConfig
// inputs by workload class. Pre-#3-M0 role: profile IS the Tier 1 +
// Tier 2 defaults surface. Post-M0 role: profile becomes a seed
// catalog for the Metric Registry.
//
// These types mirror the loader-side shapes in `tools/profile-loader.ts`.
// Engine-side code stays runtime-agnostic about profile content; the
// audit surface is `CompiledConfig.profile_ref` + `customer_override_ref`
// (both strings). Consumers that want structured access (e.g., an
// audit-viewer that renders the resolved profile) can reload via
// `loadProfile(profile_ref)` at read time.

export interface WorkloadProfileSliEntry {
  signal: string;
  direction_of_better: 'higher' | 'lower';
  /** Detection magnitude in relative-deviation units. `δ_min` name
   *  preserved from ARCHITECT-REPLY-51 D3 literal spec. */
  δ_min: number;
}

export interface WorkloadProfileBakeEntry {
  signal: string;
  min_ticks_before_eligible: number;
  min_observation_window: number;
  max_deploy_window_days: number;
}

/** Schema-validated reference profile per REPLY-51 D3. See
 *  `profiles/schema/profile.schema.json` for the authoritative
 *  contract. Fields mirror the YAML-side shape 1:1. */
export interface WorkloadProfile {
  id: string;
  version: string;
  extends: string | null;
  description: string;
  sli_list: WorkloadProfileSliEntry[];
  structural_detectors: {
    enabled: boolean;
    dependencies: Array<{ detector_id: string; required_for: string[] }>;
  };
  joint_vector: {
    signals: string[];
    include_in_family_c: boolean;
    include_in_family_e: boolean;
  };
  alpha_allocation: {
    per_family: { A: number; B: number; C: number; D: number; E: number };
    total: number;
  };
  cell_dimensions: {
    hour_of_day: boolean;
    day_of_week: boolean;
    workload_class: boolean;
    tenant_tier: boolean;
    region: boolean;
  };
  bake_profiles: WorkloadProfileBakeEntry[];
  policy_defaults: {
    reversibility_threshold_minutes: number;
    auto_rollback_enabled: boolean;
    default_risk_tier: 'low' | 'medium' | 'high';
  };
}

/** Customer-side override layer per REPLY-51 D8. `overrides` is a
 *  partial `WorkloadProfile` shape; the loader enforces that every
 *  leaf key exists in the base profile schema (no new fields). */
export interface CustomerOverride {
  /** `<profile_id>@<semver>` reference to the base profile. */
  base_profile: string;
  customer_id: string;
  overrides: Partial<WorkloadProfile>;
}

/** Composition output: `deepMerge(profile, override.overrides)` with
 *  provenance refs attached for downstream audit. Carries the full
 *  resolved profile shape plus the two ref strings that land on
 *  `CompiledConfig`. */
export interface EffectiveConfig extends WorkloadProfile {
  profile_ref: string;
  customer_override_ref: string | null;
}

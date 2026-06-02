// engine/types/_config-regression.ts — split from config.ts (god-file decomposition).
// REPLY-52 regression-profile types, baseline-provenance/warning enums,
// compile-phase instrumentation, and the healthy-baseline bundle shape.
// Re-exported verbatim from ./config (facade); see config.ts header for vendoring policy.

// ── REPLY-52 regression-profile types ────────────────────────────────
//
// Hand-curated regression profiles per §D4 — used by
// tools/inject-regression.ts to mutate baseline sample series at a
// chosen T_inject tick for shadow-compare validation. v1 profiles
// derived from public postmortems; no ML inference on postmortem
// narratives per architect anti-scope.

/** Delta-scale discriminator per REPLY-52 D4 architect refinement.
 *  Profile authors declare intent explicitly; no default. */
export type RegressionDeltaKind =
  | 'absolute'
  | 'relative_to_baseline_sigma'
  | 'relative_to_baseline_mean';

export interface RegressionInjectionPoint {
  /** Ticks after T_inject at which this delta activates. Step-
   *  function semantic: latest applicable offset wins. */
  tick_offset: number;
  signal: string;
  delta_kind: RegressionDeltaKind;
  /** Signed magnitude. Units depend on `delta_kind`. */
  delta: number;
}

export interface RegressionProfile {
  id: string;
  source: string;
  duration_minutes: number;
  affected_signals: string[];
  injection_points: RegressionInjectionPoint[];
  expected_detection: {
    family: 'A' | 'B' | 'C' | 'D' | 'E';
    signal?: string;
    notes?: string;
  };
}

/** REPLY-52 D3 — baseline-provenance discriminator. v1 string enum;
 *  v2 (for follow-on) may evolve to discriminated-union with per-source
 *  metadata. Absent on pre-#52 configs (backward-compat). */
export type BaselineProvenance =
  | 'synthetic'
  | 'real_burstgpt'
  | 'real_azure_llm_inference'
  | 'real_mooncake'
  | 'grounded_synthetic'
  | 'mixed'
  // Q62 Slice 2 H1 (HF-only narrowing). Per ARCHITECT-REPLY-Q62-PHASE-
  // 1-2-LS-1-SCHEMA-DRIFT-DISPOSITION § Ask 1 (H1 PICKED): real_alpaserve
  // + real_deepspeed_fastgen DROPPED post-LS-1 schema-drift CRITICAL on
  // both datasets (BERT-era simulator replay; no public trace artifacts
  // respectively). Tagged Phase-3.d Slice 2.b future cycle.
  | 'real_huggingface_lmsys_arena';

/** REPLY-51b R4-2 — compile-time warning payload. Lightweight
 *  structured log for operator visibility + programmatic
 *  inspection. Emits to stderr + accumulates on
 *  `CompiledConfig.compile_warnings`. */
export interface Warning {
  /** Short machine-readable tag. Canonical codes:
   *    'CELL_DIM_BASELINE_DEFICIENCY' — profile enables a cell
   *      dimension the baseline bundle doesn't carry metadata
   *      for; dimension collapses per `cell_dimension_deficiency_
   *      mode`. */
  code: 'CELL_DIM_BASELINE_DEFICIENCY' | string;
  /** Human-readable message (rendered to stderr). */
  message: string;
  /** Structured payload for programmatic consumers. */
  context: Record<string, unknown>;
}

/** REPLY-50 D7 — per-phase wall-clock timings (milliseconds) collected
 *  during compile. `cov_estimation_ms` is the H1+H2 dominant cost
 *  (FastMCD per-cell + global aggregateFamilyC). Residual between the
 *  sum of per-phase counts and `total_ms` captures overhead not
 *  attributed to a specific phase (e.g., worker-pool setup, JSON
 *  serialization). All fields in milliseconds, rounded to int. */
export interface CompilePhases {
  l0_prep_ms: number;
  cov_estimation_ms: number;
  mmd_bootstrap_ms: number;
  conformal_calibration_ms: number;
  tau2_fit_ms: number;
  /** Time spent in worker_threads overhead (pool setup, serialization,
   *  aggregation). Zero when worker pool is disabled or pool size = 1
   *  (serial fallback). Populated by slice-2 work; field is present
   *  from slice-1 so the schema is stable. */
  worker_pool_overhead_ms: number;
  total_ms: number;
  /** REPLY-50 D6b — count of cells where MCD was skipped in favor of
   *  Ledoit-Wolf due to low-variance / low-outlier diagnosis. Useful
   *  for regression tracking of the D6b hit rate (Q2 watchpoint). */
  mcd_skipped_low_variance_cells?: number;
  /** REPLY-50 D4 — count of cells where MMD bootstrap was skipped
   *  because `mmd_variant === 'betting_e_process'`. Expected ≈ total
   *  cells on post-Ville-full compiles. */
  mmd_bootstrap_skipped_cells?: number;
}

/** Healthy-baseline input to the compiler. `signal_series` is a per-signal
 * array of tick values, all arrays the same length within a run.
 *
 * Week 2: adds optional `cell_dim` and per-run `hour_of_day[]` so the
 * compiler can slice the baseline by context cell. `cell_dim` is absent on
 * Week-1 bundles; consumers must treat absence as "no cell structure". */
export interface BaselineBundle {
  version: string;
  generated_at: string;
  seed: number;
  /** Week 2 PM-critique item 2: 'hour_of_day'. W3 ARCHITECT-REPLY-09.md:
   *  extends to 'hour_of_day_x_day_of_week'. When 2-D, each run carries a
   *  `day_of_week[]` array alongside `hour_of_day[]`. */
  cell_dim?: 'hour_of_day' | 'hour_of_day_x_day_of_week';
  runs: Array<{
    tenant_id?: string;
    signal_series: Record<string, number[]>;
    /** Hour-of-day label per tick (0..23). Present iff `cell_dim` is set. */
    hour_of_day?: number[];
    /** Day-of-week label per tick (0..6, Sun=0). Present iff
     *  `cell_dim === 'hour_of_day_x_day_of_week'`. */
    day_of_week?: number[];
  }>;
}

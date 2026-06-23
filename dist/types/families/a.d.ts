import type { SignalClass } from '../../signal-classes';
import type { SelfNormalizedEProcessFallback } from '../self-normalized-fallback';
/** Addition #17 — per-(deploy, signal) state for the Family A betting
 *  e-process detector. `M` is the Ville-bounded wealth martingale under
 *  H₀; fire threshold is `1/α_per_signal_betting`. `bet` is the current
 *  fraction λ_t in [-1, 1] (GRAPA bet with ONS fallback).
 *  `runningMean` / `runningSecondMoment` drive GRAPA's bet derivation.
 *  `onsFallbackCount` is an audit-observability counter tracking how
 *  many ticks fell back to ONS because GRAPA's bet left the unit ball. */
export interface BettingEProcessState {
    M: number;
    bet: number;
    n: number;
    alphaConsumed: number;
    runningMean: number;
    runningSecondMoment: number;
    onsFallbackCount: number;
    /** Q66 follow-up — last centered observation (x − baseline_mean) for AR(1)
     *  pre-whitening, mirroring MixtureSupermartingaleState.last_x_centered.
     *  Persists across ticks within a window; initialized to 0 by
     *  freshBettingState. When ar1_phi=0 (default / absent) the field is written
     *  but never read, so M / bet / runningMean / runningSecondMoment are
     *  computationally identical to the pre-whitening path (only this snapshot
     *  field differs). A state deserialized from a snapshot persisted BEFORE this
     *  field existed will lack it; updateBettingState reads it via `?? 0`, so such
     *  states behave as phi=0 on their first post-upgrade tick.
     *
     *  OPTIONAL (additive) so consumers that build BettingEProcessState literals —
     *  not only via freshBettingState — keep compiling across the upgrade.
     *  freshBettingState always sets it to 0; the only reader coalesces undefined. */
    last_x_centered?: number;
}
/** Per-signal Family A parameters within a cell. Replaces the Week-2
 *  `MSPRTParams.derivation.{mean, empirical_variance}` + `tau_squared` /
 *  `delta_min` triad with explicit names and no nested derivation block.
 *
 *  Addition #17 (ARCHITECT-REPLY-34) — `betting_e_process_alpha` is the
 *  half of per-signal α that goes to the betting e-process co-shipped
 *  alongside Page-CUSUM. Populated by the compiler as
 *  `(α_A / bonferroni_factor) · 0.5`; not operator-configurable.
 *  Optional in the type so v4-and-earlier configs load unchanged —
 *  the detector falls back to the same derived value when the field is
 *  absent. */
export interface FamilyAPerSignalParams {
    /** Q2.A — class declaration; audit-visible. Operators reading the
     *  compiled config see which transform was applied at calibration.
     *  Absent on pre-Q2.A configs; runtime detector falls back to
     *  resolveSignalClass(signal, cfg.signal_classes) → DEFAULT_SIGNAL_CLASSES
     *  → 'gaussian_like' when the field is missing. */
    signal_class?: SignalClass;
    /** Q2.A — `baseline_mean` and `baseline_sigma_squared` are now in
     *  TRANSFORMED space when `signal_class !== 'gaussian_like'` (logit
     *  for bounded_probability; log for heavy_tail; Anscombe for counts).
     *  The detector dispatcher applies the same forward transform to live
     *  observations before standardization. For gaussian_like signals the
     *  transform is identity, preserving pre-Q2.A semantics. */
    baseline_mean: number;
    /** Q2.A — pre-transform per-cell μ; consumed by Q2.B.4 calibration-
     *  coherence audit. baseline_mean (above) is post-transform; this
     *  field is the raw arithmetic mean of samples before transform.
     *  Used by Q2.B.4 to compare against Family C's per-cell mean_vector
     *  (which lives in raw space) in same-space same-units terms. Absent
     *  on pre-Q2.A configs. */
    baseline_mean_raw?: number;
    baseline_sigma_squared: number;
    /** Q2.B.5 (per Q2-B-5-SIGMA-COHERENCE-SPEC.md) — pre-transform
     *  per-cell σ² in RAW observation space. Consumed by Page-CUSUM
     *  (`engine/detectors/page-cusum.ts`) for boundedZ standardization.
     *  Source per architect spec:
     *    - OVERLAPPING signals (in both FAMILY_A and FAMILY_C):
     *      `σ²_raw_i = baseline_mean_raw² · Σ_C_blended[i,i]`
     *      (single-source coherence: variance of relative-deviation r =
     *      (x − μ)/μ scales back to raw via μ²; under Q2.B.4 α=1 this
     *      equals raw per-cell sample variance exactly — Family A
     *      regression invariance preserved).
     *    - FAMILY-A-ONLY signals (eval_score, tool_success_rate): raw
     *      per-cell sample variance directly with P1 floor.
     *  Backward-compat: pre-Q2.B.5 configs lack this field; runtime
     *  Page-CUSUM falls through to `baseline_sigma_squared` (which is
     *  raw-space on pre-Q2.A and transformed-space on Q2.A configs;
     *  pre-Q2.B.5 / post-Q2.A configs need re-compile to land
     *  Σ-coherent raw σ²). */
    baseline_sigma_squared_raw?: number;
    tau_squared: number;
    delta_min: number;
    betting_e_process_alpha?: number;
    /** P1 audit visibility per ARCHITECT-REPLY-52ge §69-71. True when the
     *  compiler's empirical sample variance underflowed below `σ²_floor =
     *  max(ε_f · μ², 10⁻⁶ · μ²)` and the floor was applied to
     *  `baseline_sigma_squared`. Closes V1.H1 (bounded-probability signal
     *  saturation collapsing σ² to FP zero, breaking the betting-e-process
     *  Ville bound under iid-bootstrap). Q2.A architecturally closes V1.H1
     *  via class-appropriate variance-stabilizing transforms; this floor
     *  remains as belt-and-suspenders defense-in-depth. Field absent on
     *  cells where the empirical variance was non-degenerate. */
    sigma_floor_applied?: boolean;
    /** Q2.B.6.3 — Sliding-buffer-aware betting wealth threshold under joint
     *  AR(1) H₀. Empirical (1−α) quantile of MAX wealth `M_t = M_{t-1} ·
     *  (1 + λ_t · z_t)` per trajectory under joint AR(1) bootstrap with
     *  sliding-buffer evaluation regime (mirrors Q2.B.6.2 family_C safe_test
     *  pattern). Replaces analytical `1 / α_betting` threshold for the
     *  betting-e-process runtime evaluation when AR(1) ρ for the signal is
     *  non-trivial. Optional for backward-compat with pre-Q2.B.6.3 configs;
     *  absence triggers fallthrough to `1 / α_betting`. Stamped per
     *  per_signal entry by the calibrator post-AR(1) ρ stamping. P4-β.5
     *  evaluation-scope alignment closure on family_A betting path. See
     *  coordination/DIAGNOSTIC-Q2-B-6-3-FAMILY-A-BETTING-MECHANISM-2026-04-28.md. */
    betting_sliding_buffer_threshold?: number;
    /** Q2.B.6.3 — Audit-visible calibration scope. `'single_window'` is
     *  the pre-Q2.B.6.3 analytical-1/α threshold semantic; `'sliding_buffer_ar1'`
     *  is the post-Q2.B.6.3 per-trajectory MAX wealth quantile under joint
     *  AR(1) bootstrap. */
    betting_calibration_scope?: 'single_window' | 'sliding_buffer_ar1';
    /** Q66 Phase-3.d.A.b — per-signal AR(1) coefficient phi.
     *  Estimated at compile time via Yule-Walker on baseline cell residuals
     *  (centered against baseline_mean per axis 4.b reinforcement: AR(1)
     *  phi must be estimated on baseline-mean-centered series, NOT raw
     *  series). Used at runtime to pre-whiten observation:
     *    x_pre_whitened = x_centered − phi · x_{t-1, centered}
     *  Pre-whitened residual is approximately IID sub-Gaussian → Howard-
     *  Ramdas-2021 §4.2 closed-form applies unchanged; restores Ville
     *  bound under parametric_ar1 mode (closes Q66 SLICE 1 LS-1 surface
     *  parametric_ar1 ρ=0.5 → 17.2% FPR regression).
     *
     *  Optional ADDITIVE field (sub-rule 2 MERGE pattern); absence treated
     *  as phi=0 (no pre-whitening; reduces to Slice 1 behavior; appropriate
     *  for synthetic substrates + iid_bootstrap mode where AR(1) correlation
     *  absent by construction).
     *
     *  Compile-time guard: phi clipped to [-0.95, +0.95] for numerical
     *  stability (avoid near-unit-root variance amplification). Yule-Walker
     *  estimator uses centered residuals.
     *
     *  Q59 H4 PERMANENT clause 1 retirement: this field's introduction
     *  RETIRES Q59 H4 PERMANENT "NO compile-time ar1_phi extension to
     *  family_A" anti-scope clause per sub-rule 3 INVERTED extension at
     *  Phase-3.d.A.b sub-track close.
     *
     *  Q66 Phase-3.d.A.c.γ calibration-regime-vs-sweep-regime semantic:
     *  this field stores CALIBRATION-TIME phi estimated from baseline
     *  cell residuals. Runtime pre-whitening engages with this stamped
     *  value; correction is effective ONLY when calibration regime
     *  matches sweep/runtime regime. For substrates whose baseline is
     *  iid (phi distribution sampling-noise-dominated; mean ~0;
     *  |max| < 0.5), pre-whitening reduces to identity and cannot
     *  correct AR(1) injected at sweep evaluation time. The
     *  `isSweepModeCalibrationRegimeMatched` orchestrator helper at
     *  `tools/run-shadow-compare.ts` exempts such (substrate × mode ×
     *  detector) triples from halt-boundary (a) per Q66 .A.c.γ
     *  disposition; self-normalized e-process variant handling is
     *  TAGGED for Phase-3.d.E future cycle. */
    ar1_phi?: number;
    /** Q66 Phase-3.d.A — Howard-Ramdas-McAuliffe-Sekhon-2021 mixture-
     *  supermartingale parameters for Page-CUSUM Ville-bounded variant.
     *  Per-signal hyperparams derived from existing baseline calibration
     *  state per Q66.1 derivation table (signal_class → mixture distribution
     *  + Practice-1 inline derivation from baseline_sigma_squared_raw +
     *  baseline_mean for bounded signals). ADDITIVE optional field;
     *  preserves existing schema (MERGE pattern; sub-rule 2). Pre-Phase-
     *  3.d.A configs lack this field; runtime detector dispatch falls
     *  through to classical Page-CUSUM with deprecation warning OR errors
     *  if classical retired post-Phase-3.d.C consolidation. */
    mixture_supermartingale_params?: {
        /** Mixture distribution choice per signal_class:
         *   - heavy_tail/counts → 'gaussian' (Howard-Ramdas-2021 §4.2 stitched-
         *     Gaussian mixture; closed-form via exp + log).
         *   - bounded → 'beta' (Howard-Ramdas-2021 §5 Beta mixture; closed-
         *     form via incomplete Beta function).
         *   - schema_continuity → 'categorical' (deferred to Phase-3.d.A.b
         *     sub-track). */
        mixture_distribution: 'gaussian' | 'beta' | 'categorical';
        /** Gaussian mixture σ²_prior (sub-Gaussian signals). Sourced from
         *  baseline_sigma_squared_raw per Q66.1 derivation rationale:
         *  σ²_prior aligns mixture envelope with within-cell variance. */
        gaussian_sigma_squared_prior?: number;
        /** Beta mixture α prior (Jeffreys default 1.0; per-signal tuned via
         *  baseline_mean + n_prior=5 per Howard-Ramdas-2021 §5 numerical
         *  experiments default). */
        beta_alpha_prior?: number;
        beta_beta_prior?: number;
    };
    /** Q70 Phase-3.d.E — self-normalized e-process variant fallback for the
     *  family_A_betting detector (per-signal). Activates when conditional
     *  exemption (Q70.1) is too restrictive for the (substrate × sweep_mode)
     *  triple AND empirical signal warrants alternative bound construction.
     *  §7 EmpiricalProcessLILBound primary; §6 BetaBinomial secondary
     *  (bounded_probability signals). ADDITIVE optional (sub-rule 2 MERGE);
     *  pre-Q70 configs lack this field; runtime detector dispatch falls
     *  through to standard Ville bound when absent. SLICE 1: schema only;
     *  calibrator stamping + detector consumption deferred to SLICE 2. */
    self_normalized_fallback?: SelfNormalizedEProcessFallback;
}
/** Compact view-model handed to the Page-CUSUM detector. Assembled by
 *  `resolveMSPRTParams()` at detector-call time from a `BaselineCellEntry`
 *  + signal-level bake profile + per-family α. Kept as an interface so the
 *  detector's API stays stable across schema revisions. */
export interface MSPRTParams {
    signal: string;
    tau_squared: number;
    delta_min: number;
    min_samples: number;
    min_ticks_before_eligible: number;
    /** Addition #4 clause 2 — the per-signal observation-count eligibility
     *  gate. Populated from `CompiledConfig.bake_profiles[signal].min_observation_window`.
     *  Wired in W4 §4.1.h per ARCHITECT-REPLY-12 S2 landing. */
    min_observation_window: number;
    max_deploy_window_days: number;
    alpha: number;
    derivation?: {
        tau_multiplier: number;
        empirical_variance: number;
        /** Q2.B.5 — raw-space σ² consumed by Page-CUSUM for boundedZ
         *  standardization. Optional for backward-compat; runtime falls
         *  through to `empirical_variance` when absent (matches pre-Q2.A
         *  behavior). For overlapping signals on Q2.B.5+ configs:
         *  derived as μ_raw² · Σ_C_blended[i,i] at compile time. */
        empirical_variance_raw?: number;
        mean: number;
        /** Q2.A — pre-transform per-cell μ used by Page-CUSUM in raw
         *  observation space. Absent on pre-Q2.A configs; falls back to
         *  `mean` (which IS raw on pre-Q2.A configs). */
        mean_raw?: number;
        std: number;
        pooled?: boolean;
        pooled_from_hours?: number[];
        n_samples: number;
        /** Q2.B.6.3 — sliding-buffer-aware betting wealth threshold under
         *  joint AR(1) H₀. Sourced from FamilyAPerSignalParams.
         *  betting_sliding_buffer_threshold; consumed by
         *  engine/detectors/betting-e-process.ts:evaluateBettingEProcess in
         *  preference to analytical 1/α_betting. Optional for backward-compat;
         *  pre-Q2.B.6.3 configs (and signals where the calibrator skipped
         *  bootstrap due to missing μ/σ²) fall through to 1/α_betting. */
        betting_sliding_buffer_threshold?: number;
        /** Q66 follow-up — per-signal AR(1) coefficient for betting-path
         *  pre-whitening, sourced from FamilyAPerSignalParams.ar1_phi. Consumed by
         *  evaluateBettingEProcess → updateBettingState to whiten the centered
         *  observation (x_pre_whitened = x_centered − phi·x_{t-1,centered}) before
         *  standardization, restoring the Ville bound under autocorrelated H0 — the
         *  same mechanism already used by family-a-mixture-supermartingale and
         *  Page-CUSUM. Optional; absence ⇒ phi=0 ⇒ no whitening (backward-compat). */
        ar1_phi?: number;
    };
}
//# sourceMappingURL=a.d.ts.map
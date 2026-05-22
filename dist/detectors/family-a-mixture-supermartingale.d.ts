import type { FamilyAPerSignalParams } from '../types/families/a';
/** Per-(signal) mixture-supermartingale state. Persists across ticks
 *  within a window; reset at window boundary. Sticky firing latch
 *  preserves Ville-bound semantic (once threshold crossed, detector
 *  remains in fired state). */
export interface MixtureSupermartingaleState {
    /** Running sum of pre-whitened centered observations:
     *    S_t = Σ (x_s_centered − phi · x_{s-1}_centered)
     *  When phi=0 (Slice 1 behavior; pre-Phase-3.d.A.b configs), S_t
     *  reduces to Σ x_s_centered identically. */
    S_t: number;
    /** Current mixture-supermartingale value M_t. */
    M_t: number;
    /** Sticky firing latch — set true at first tick t where M_t ≥ 1/α;
     *  remains true until window boundary state reset. */
    fired: boolean;
    /** Tick index of first fire (null until threshold crossed). */
    tick_at_first_fire: number | null;
    /** Sample count this signal this window. Mirrors classical CUSUM `n`
     *  for diagnostic + bake-profile parity; not gating. */
    n: number;
    /** Q66 Phase-3.d.A.b — last centered observation for AR(1) pre-
     *  whitening. Persists across ticks within window; reset to 0 at
     *  window boundary state reset (initialized to 0 by
     *  freshMixtureSupermartingaleState). When ar1_phi=0 (default), this
     *  field is unused and pre-whitening reduces to identity. */
    last_x_centered: number;
}
export declare function freshMixtureSupermartingaleState(): MixtureSupermartingaleState;
export type MixtureSupermartingaleStates = Record<string, MixtureSupermartingaleState>;
export declare function getOrCreateMixtureSupermartingaleState(states: MixtureSupermartingaleStates, signal: string): MixtureSupermartingaleState;
/** Howard-Ramdas-2021 §4.2 stitched-Gaussian mixture closed-form M_t.
 *
 *  For a sub-Gaussian process with per-tick variance σ² and mixture prior
 *  N(0, σ²_prior), the supermartingale evaluates to:
 *
 *    M_t = sqrt(σ²_prior / (σ²·t + σ²_prior))
 *        · exp(S_t² / (2 · (σ²·t + σ²_prior)))
 *
 *  Stable computation via log-space:
 *    log_M_t = (S_t² / (2 · denom)) + 0.5 · log(σ²_prior / denom)
 *    where denom = σ²·t + σ²_prior.
 *
 *  M_t starts at 1.0 at t=0 (S_0=0, denom=σ²_prior, log_M_0 = 0). */
export declare function computeGaussianMixtureSupermartingale(S_t: number, t: number, sigma_squared: number, sigma_squared_prior: number): number;
/** Howard-Ramdas-2021 §5 Beta mixture supermartingale closed-form.
 *
 *  For a [0,1]-bounded process (Bernoulli or bounded random variables
 *  post-logit-transform inverse) with Beta(α_prior, β_prior) prior on
 *  the post-change mean, the mixture supermartingale at tick t with
 *  cumulative success count k = (S_t + t·baseline_p) (where baseline_p
 *  is the H₀ mean) evaluates to:
 *
 *    M_t = B(α_prior + k, β_prior + t - k) / B(α_prior, β_prior)
 *        · baseline_p^(-k) · (1 - baseline_p)^(-(t-k))
 *
 *  where B(·,·) is the Beta function = Γ(·)·Γ(·)/Γ(·+·).
 *
 *  In our application, the input is `S_t` (centered: live observation
 *  minus baseline_mean accumulated across t). For [0,1]-bounded signals
 *  baseline_p = baseline_mean (in raw probability space). We reconstruct
 *  k = S_t + t · baseline_mean and clamp to [0, t] to handle finite-
 *  sample variance.
 *
 *  Stable computation in log space throughout:
 *    log B(a, b) = logGamma(a) + logGamma(b) - logGamma(a+b)
 *    log M_t = [logB(α'+k, β'+t-k) - logB(α', β')] - [k·log(p) + (t-k)·log(1-p)]
 *
 *  where (α', β') = (α_prior, β_prior). */
export declare function computeBetaMixtureSupermartingale(S_t: number, t: number, baseline_mean_p: number, alpha_prior: number, beta_prior: number): number;
export interface PageCusumMixtureSupermartingaleInput {
    signal: string;
    /** Centered observation: x = live_value - baseline_mean. */
    x_centered: number;
    /** Live raw value (used for Beta mixture k reconstruction; ignored for
     *  Gaussian mixture). For Beta mixture, x_centered + baseline_mean
     *  must lie in [0,1] for the supermartingale to be well-defined. */
    live_value: number;
    /** Baseline mean (raw observation space; matches Page-CUSUM's
     *  cellMeanRaw consumption per Q2.B.5). */
    baseline_mean: number;
    /** Per-tick variance σ² under H₀. Sub-Gaussian variance proxy for
     *  Gaussian mixture; ignored for Beta mixture. */
    sigma_squared: number;
    /** Mixture-supermartingale parameters from compile-time calibration
     *  (per Q66.1 derivation). */
    params: NonNullable<FamilyAPerSignalParams['mixture_supermartingale_params']>;
    /** Q66 Phase-3.d.A.b — per-signal AR(1) phi from compile-time
     *  Yule-Walker calibration. Applied at runtime as pre-whitening:
     *    x_pre_whitened = x_centered − phi · state.last_x_centered
     *  Pre-whitened residual is approximately IID sub-Gaussian → Howard-
     *  Ramdas-2021 §4.2 closed-form applies unchanged.
     *
     *  Optional; absence (phi=0) reduces to Slice 1 behavior (no pre-
     *  whitening; identity transformation). Pre-Phase-3.d.A.b configs
     *  + iid_bootstrap mode pass undefined; .A.b configs pass
     *  cal.ar1_phi from compile output. */
    ar1_phi?: number;
    /** State persists across ticks within window. Mutated in place. */
    state: MixtureSupermartingaleState;
    /** α-budget per detector — Ville-bound threshold = 1/α. */
    alpha: number;
}
export interface PageCusumMixtureSupermartingaleResult {
    fire: boolean;
    M_t: number;
    threshold: number;
    /** Two-sided detection: TRUE if Ville-bound exceeded for either positive
     *  drift (S_t > 0) OR negative drift (S_t < 0) under symmetric Gaussian
     *  mixture. Per architect spec § Q66.4 ASK D disposition: two-sided
     *  detection is the natural form for symmetric-Gaussian-prior mixture-
     *  supermartingale; classical Page-CUSUM was one-sided (reset-at-zero
     *  truncates negative drift); Phase D variant flips to two-sided. */
    two_sided: boolean;
}
/** Q66 Phase-3.d.A — Howard-Ramdas-2021 mixture-supermartingale Page-CUSUM
 *  variant. Anytime-valid Ville-bounded; methodology-resampler-mode
 *  INVARIANT. */
export declare function evaluatePageCusumMixtureSupermartingale(input: PageCusumMixtureSupermartingaleInput): PageCusumMixtureSupermartingaleResult;
/** Q66.A.b — compute per-signal AR(1) coefficient phi via Yule-Walker
 *  on baseline cell residuals (centered against `baseline_mean`).
 *
 *  Estimator: lag-1 sample autocorrelation
 *    phi_hat = Σ x_t · x_{t-1} / Σ x_t²
 *  on centered residuals x = raw_value − baseline_mean. Phi clipped
 *  to [-0.95, +0.95] for numerical stability (avoid near-unit-root
 *  variance amplification in subsequent pre-whitening).
 *
 *  Returns 0 when:
 *    - cellRows.length < 2 (insufficient samples for lag-1 autocorrelation)
 *    - centered variance underflows (< 1e-12) → no signal to estimate phi
 *    - all observations identical (degenerate baseline)
 *
 *  Per axis 4.b reinforcement (input-data-structure semantic): AR(1)
 *  phi MUST be estimated on baseline-mean-centered series, NOT raw
 *  series. Raw-series Yule-Walker conflates non-zero mean with AR(1)
 *  coefficient (bias toward unity for highly-positive-mean signals;
 *  see Q59 LS-2 architect-side capture). */
export declare function computePerSignalAr1Phi(values: ReadonlyArray<number>, baseline_mean: number): number;
/** Q66.1 — derive mixture_supermartingale_params from existing Family A
 *  per-signal calibration state. Compile-time helper consumed by
 *  tools/calibrators/family-a.ts. Returns undefined for signal classes
 *  without a Phase-3.d.A SLICE 1 implementation (categorical →
 *  Phase-3.d.A.b). */
export declare function deriveMixtureSupermartingaleParams(per_signal: FamilyAPerSignalParams): FamilyAPerSignalParams['mixture_supermartingale_params'] | undefined;
//# sourceMappingURL=family-a-mixture-supermartingale.d.ts.map
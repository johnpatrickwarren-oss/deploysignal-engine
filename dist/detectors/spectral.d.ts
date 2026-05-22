import type { CompiledConfig, DetectorVerdict, FamilyDPerSignal, SchemaContinuityRecord, SpectralEDetectorState } from '../types';
declare const DEFAULT_ALPHA_D = 0.0001;
declare const DEFAULT_MIN_PEAK_LAG = 3;
declare const DEFAULT_MAX_PEAK_LAG = 10;
/** Deseason-then-normalize ACF at lag `k` over a window `y` of length N. */
export declare function normalizedACF(y: number[], k: number): number;
/** Peak ACF over lag range [min_lag, max_lag]. Returns the peak value and
 *  the lag at which it occurs. */
export declare function peakACF(y: number[], minLag: number, maxLag: number): {
    peak: number;
    lag: number;
};
/** Look up Family D params for a signal, falling back to aggregate. */
export declare function lookupFamilyDParams(cfg: CompiledConfig, cell: {
    hour_of_day: number;
    day_of_week?: number;
}, signal: string): FamilyDPerSignal | null;
/** Evaluate Family D for one signal at one tick. Needs a rolling window of
 *  recent values, supplied by the caller (typically the TrendBuffer's long
 *  view).
 *
 *  Legacy path (`cell.spectral_variant === 'bootstrap_null'` or absent):
 *  fires when peak|ACF| exceeds the per-signal compiled threshold.
 *
 *  Addition #21 path (`cell.spectral_variant === 'e_detector'` + `state`
 *  provided): routes peak|ACF| through the mixture-prior e-detector's
 *  wealth-process update (see evaluateSpectralEDetector). REPLACE semantic
 *  per REPLY-45 D1 — one detector_id per signal per tick. */
export declare function evaluateFamilyD(cfg: CompiledConfig, signal: string, recentSamples: number[], ctx: {
    hourOfDay: number;
    dayOfWeek?: number;
    ticksSinceDeploy: number;
    deployAgeDays: number;
    trafficPct: number;
    schemaContinuityClass?: SchemaContinuityRecord['schema_continuity'];
}, state?: SpectralEDetectorState): DetectorVerdict | null;
/** Unified context the Record<SpectralVariant, Evaluator> receives. */
interface SpectralDispatchCtx {
    params: FamilyDPerSignal;
    peak: number;
    lag: number;
    alphaD: number;
    signal: string;
    state?: SpectralEDetectorState;
}
type SpectralVariant = 'bootstrap_null' | 'e_detector';
type SpectralEvaluator = (ctx: SpectralDispatchCtx) => DetectorVerdict;
/** Resolve a cell's declared spectral_variant to the effective dispatch
 *  key. undefined → legacy default; 'e_detector' w/o state → legacy
 *  fallback (preserves pre-D-54-2 behavior). */
declare function spectralVariantForDispatch(raw: FamilyDPerSignal['spectral_variant'], hasState: boolean): SpectralVariant;
/** Exposed for dispatch-map parity testing. */
export declare const _SPECTRAL_EVALUATORS_FOR_TEST: Record<SpectralVariant, SpectralEvaluator>;
export declare const _spectralVariantForDispatch: typeof spectralVariantForDispatch;
/** Convenience: the signal list Family D watches. Restricted to the
 *  detectors shipped in the W4 registry (audit/SCHEMA.md v2 §Per-family
 *  detector registry). Other oscillation-prone signals (p99_latency,
 *  ttft, hbm_spill) will land when their `spectral_peak_acf_*` entries
 *  are added to the registry — post-W4 architect scope. */
export declare const FAMILY_D_SIGNALS: readonly ["kv_cache"];
export { DEFAULT_ALPHA_D, DEFAULT_MIN_PEAK_LAG, DEFAULT_MAX_PEAK_LAG };
/** Fresh wealth state for a new (deploy, signal) spectral-e-detector
 *  evaluation. `M₀ = 1` per Ville-inequality convention. */
export declare function freshSpectralEDetectorState(): SpectralEDetectorState;
/** Addition #21 (ARCHITECT-REPLY-45 D3) — spectral e-detector per-tick
 *  evaluation against a cell with populated `null_mean`, `null_std`, and
 *  `betting_delta`. Caller owns the state object; this function mutates
 *  `state.M` / `state.n` / `state.alphaConsumed` in place.
 *
 *  Formula (derivation from Gaussian-mean-shift LLR with prior
 *  μ ~ N(μ₀ + δ_D, σ₀²)):
 *
 *    Let r = δ_D / σ₀  (dimensionless mixture-shift magnitude).
 *    Let u = (peak_t − μ₀) / σ₀  (standardized peak).
 *    z_t = r · u − 0.5 · r²
 *        = (δ_D · (peak_t − μ₀)) / σ₀² − δ_D² / (2 σ₀²)
 *    M_t = M_{t-1} · exp(z_t)
 *    Fire when M_t ≥ 1/α_D.
 *
 *  Practice-5 anchors at μ₀=0.42, σ₀=0.05, δ_D=0.015, α_D=1e-4 per
 *  REPLY-45:
 *    - Healthy (peak_t = μ₀): z_t = −0.045; wealth drifts ~0.956×/tick.
 *    - 1σ₀ mild (peak_t = 0.47): z_t = +0.255; fire ~36 ticks.
 *    - 2σ₀ moderate (peak_t = 0.52): z_t = +0.555; fire ~17 ticks.
 *    - 3σ₀ strong (peak_t = 0.57): z_t = +0.855; fire ~11 ticks.
 *  All within sufficiency-gate canary window. */
export declare function evaluateSpectralEDetector(input: {
    params: FamilyDPerSignal;
    alpha: number;
    signal: string;
}, peak_t: number, state: SpectralEDetectorState): DetectorVerdict;
//# sourceMappingURL=spectral.d.ts.map
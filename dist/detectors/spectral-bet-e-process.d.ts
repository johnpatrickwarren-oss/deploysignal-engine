/** Disjoint-window length (registered, frozen). */
export declare const W_K3 = 30;
/** Registered Fourier bins, k ∈ {1, 2, 3} ⇒ f_k ∈ {1/30, 2/30, 3/30}.
 *  Neither touches {0, W/2} = {0, 15}, where the exactness identity's
 *  hypotheses (nonzero, non-Nyquist frequency) fail. */
export declare const BINS_K3: number[];
/** κ for the e-value calibrator e = κ·p^(κ−1). Registered, shared
 *  derivation with K4 (point-tail-bet-e-value.ts's KAPPA). */
export declare const KAPPA_K3 = 0.1;
export interface SpectralBinResult {
    k: number;
    U: number;
    p: number;
    e: number;
}
export interface SpectralWindowResult {
    perBin: SpectralBinResult[];
    eAvg: number;
}
/** Per-window periodogram bet: direct DFT summation over BINS_K3. Requires
 *  `window.length === W_K3` and `sigma > 0` — the known-σ regime is
 *  machine-encoded here, not left to the caller's discipline. */
export declare function spectralBetWindow(window: number[], sigma: number, kappa?: number): SpectralWindowResult;
export interface SpectralWealthResult {
    wealth: number;
    log: number[];
}
/** Wealth over disjoint windows: product of per-window eAvg, accumulated in
 *  the log domain (ADR 0026 convention — see module docstring). `log[i]`
 *  is the cumulative log-wealth through window i, the running trajectory an
 *  any-time (Ville-inequality) crossing check needs at every prefix, not
 *  just the final tick. Each window is validated by `spectralBetWindow`
 *  (propagates its guards). */
export declare function spectralBetWealth(windows: number[][], sigma: number): SpectralWealthResult;
//# sourceMappingURL=spectral-bet-e-process.d.ts.map
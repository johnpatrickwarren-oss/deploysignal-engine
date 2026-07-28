export type ExogenousKind = 'scheduler-intent' | 'workload-class' | 'planned-event' | 'calendar';
export interface CovariateSeries {
    name: string;
    kind: ExogenousKind;
    /** One value per tick, aligned with y. Known at (or before) the tick it labels. */
    values: ReadonlyArray<number>;
}
export declare function assertExogenous(covs: ReadonlyArray<CovariateSeries>): void;
export interface CovariateResidualizerOptions {
    /** Maximum AR order for AIC selection over the regression residual. Default 5. */
    maxArOrder?: number;
    /** Ridge added to the normal equations' diagonal (relative to each regressor's mean square) —
     *  guards near-collinear covariates. Default 1e-8. */
    ridge?: number;
    /** |lag-1 ρ̂| at/above which the final residual fails whiteness. Default max(0.1, 2/√N). */
    whitenessRhoMax?: number;
}
export interface CovariateResidualizerFit {
    covariateNames: string[];
    intercept: number;
    beta: number[];
    /** AIC-selected AR coefficients on the regression residual (possibly empty = white already). */
    phi: number[];
    arOrder: number;
    /** Innovation variance of the fitted AR(p). */
    sigma2: number;
    /** Lag-1 autocorrelation of the FINAL (one-step) residual on the fit window — the ar1_phi the
     *  emitter contract wants supplied. */
    residualLag1Rho: number;
    whiteness: {
        rhoMax: number;
        pass: boolean;
    };
    /** In-sample one-step RMSE of the full model (for MASE-style comparisons by the caller). */
    oneStepRmse: number;
    nFit: number;
}
/**
 * Fit on the baseline window (and ONLY the baseline window — the caller owns the epoch split).
 * Zero covariates = the plain-AR(p) comparator.
 */
export declare function fitCovariateResidualizer(y: ReadonlyArray<number>, covariates: ReadonlyArray<CovariateSeries>, opts?: CovariateResidualizerOptions): CovariateResidualizerFit;
export interface OneStepResult {
    /** ε̂_t for t ≥ arOrder (earlier ticks have no full AR history). */
    residuals: number[];
    /** ε̂_t / σ̂ — the series an e-value consumes. */
    standardized: number[];
    /** First tick index of `residuals` within the supplied window. */
    startIndex: number;
}
/**
 * Apply a FROZEN fit to a (typically later) window: one-step-ahead innovations only. The
 * covariate values must be the window's own — same names, same order as at fit time.
 */
export declare function oneStepResiduals(fit: CovariateResidualizerFit, y: ReadonlyArray<number>, covariates: ReadonlyArray<CovariateSeries>): OneStepResult;
//# sourceMappingURL=covariate-residualizer.d.ts.map
// baseline/covariate-residualizer.ts — the covariate-augmented statistical residualizer
// (Tessera ADR 0024 G2's "cheap arm": AR(p) + exogenous-covariate regression, zero new deps).
//
// WHY THIS EXISTS. ADR 0024 (Tessera) deferred learned-forecaster residualization behind gates,
// the first of which (G2) is this module: the in-engine statistical arm that any deep model must
// beat by a margin worth a Python sidecar. It extends the existing stack — seasonal kit
// (baseline/seasonal-baseline.ts) + AR(p) (detectors/ar-p.ts) — with a linear regression on
// STRICTLY EXOGENOUS covariates (scheduler intent, workload class, planned events, calendar).
//
// COMPOSITION. This module takes y ALREADY deseasonalized (the product composes
// `seasonalBaselineResidual` upstream, or passes raw y where no seasonal axis applies) and fits
//     y_t = c + β·X_t + u_t,   u_t ~ AR(p):  u_t = Σ φ_i u_{t−i} + ε_t
// on the BASELINE window only (frozen per epoch — filtration discipline, ADR 0024 § 2). The
// "plain AR(p)" comparator is this module with zero covariates; the fit is then just
// mean-centering + Yule-Walker, so the comparison is apples-to-apples by construction.
//
// ONE-STEP-AHEAD ONLY. `oneStepResiduals` emits ε̂_t = u_t − Σ φ_i u_{t−i} (standardized by the
// innovation σ̂) using only information through t−1 given the frozen fit — the only residual kind
// admissible into an e-value (h-step residuals are MA(h−1) by construction). The fit reports the
// FINAL residual's lag-1 autocorrelation and a whiteness verdict; a consumer that feeds
// non-white residuals to an e-value is violating the emitter contract, and this number is how
// the contract checks.
//
// EXOGENEITY IS A CONTRACT, NOT A HOPE. Covariates carry a declared kind from a closed union,
// and `assertExogenous` rejects names that look like system-state responses (temperature,
// clocks, utilization…) regardless of declared kind: a covariate that responds to health
// *correctly predicts the incident* and drives the residual to zero exactly when detection
// matters (ADR 0024 § 3). There is deliberately no override flag.

import { autocovarianceSequence, yuleWalkerLevinson } from '../detectors/ar-p';

export type ExogenousKind = 'scheduler-intent' | 'workload-class' | 'planned-event' | 'calendar';

export interface CovariateSeries {
  name: string;
  kind: ExogenousKind;
  /** One value per tick, aligned with y. Known at (or before) the tick it labels. */
  values: ReadonlyArray<number>;
}

/** Name patterns that are system-state RESPONSES, not exogenous drivers. A covariate matching
 *  one of these is rejected regardless of its declared kind. */
const SYSTEM_STATE_PATTERN =
  /temp|therm|clock|freq|power|watt|util|ecc|throttle|fan|volt|current|error|retry|xid|health/i;

export function assertExogenous(covs: ReadonlyArray<CovariateSeries>): void {
  for (const c of covs) {
    if (SYSTEM_STATE_PATTERN.test(c.name)) {
      throw new Error(
        `covariate-residualizer: "${c.name}" matches a system-state response pattern — ` +
        `health-adjacent covariates predict the incident and null the residual (ADR 0024 § 3). ` +
        `Only strictly exogenous covariates are admissible.`);
    }
  }
}

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
  whiteness: { rhoMax: number; pass: boolean };
  /** In-sample one-step RMSE of the full model (for MASE-style comparisons by the caller). */
  oneStepRmse: number;
  nFit: number;
}

/** Solve (A + ridge·diag)·x = b for symmetric positive-definite A via Cholesky. */
function solveSpd(A: number[][], b: number[], ridgeAbs: number[]): number[] {
  const n = b.length;
  const L: number[][] = Array.from({ length: n }, () => new Array<number>(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      let s = A[i][j] + (i === j ? ridgeAbs[i] : 0);
      for (let k = 0; k < j; k++) s -= L[i][k] * L[j][k];
      if (i === j) {
        if (s <= 0) throw new Error('covariate-residualizer: normal equations not positive definite (collinear covariates?)');
        L[i][i] = Math.sqrt(s);
      } else {
        L[i][j] = s / L[j][j];
      }
    }
  }
  const y = new Array<number>(n).fill(0);
  for (let i = 0; i < n; i++) {
    let s = b[i];
    for (let k = 0; k < i; k++) s -= L[i][k] * y[k];
    y[i] = s / L[i][i];
  }
  const x = new Array<number>(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let s = y[i];
    for (let k = i + 1; k < n; k++) s -= L[k][i] * x[k];
    x[i] = s / L[i][i];
  }
  return x;
}

function lag1Rho(x: ReadonlyArray<number>): number {
  const n = x.length;
  if (n < 3) return 0;
  const m = x.reduce((a, b) => a + b, 0) / n;
  let num = 0, den = 0;
  for (let t = 0; t < n; t++) {
    den += (x[t] - m) * (x[t] - m);
    if (t > 0) num += (x[t] - m) * (x[t - 1] - m);
  }
  return den > 0 ? num / den : 0;
}

/** The regression residual u_t = y_t − c − β·X_t under a frozen fit. */
function regressionResiduals(
  fit: { intercept: number; beta: number[] }, y: ReadonlyArray<number>,
  covs: ReadonlyArray<CovariateSeries>,
): number[] {
  return y.map((v, t) => {
    let pred = fit.intercept;
    for (let j = 0; j < fit.beta.length; j++) pred += fit.beta[j] * covs[j].values[t];
    return v - pred;
  });
}

/** One-step innovations ε̂_t = u_t − Σ φ_i u_{t−i}, defined for t ≥ arOrder. */
function innovations(u: ReadonlyArray<number>, phi: ReadonlyArray<number>): number[] {
  const p = phi.length;
  const out: number[] = [];
  for (let t = p; t < u.length; t++) {
    let pred = 0;
    for (let i = 0; i < p; i++) pred += phi[i] * u[t - 1 - i];
    out.push(u[t] - pred);
  }
  return out;
}

/**
 * Fit on the baseline window (and ONLY the baseline window — the caller owns the epoch split).
 * Zero covariates = the plain-AR(p) comparator.
 */
export function fitCovariateResidualizer(
  y: ReadonlyArray<number>, covariates: ReadonlyArray<CovariateSeries>,
  opts: CovariateResidualizerOptions = {},
): CovariateResidualizerFit {
  const n = y.length;
  if (n < 16) throw new Error(`covariate-residualizer: need ≥16 fit samples, got ${n}`);
  for (const c of covariates) {
    if (c.values.length !== n) {
      throw new Error(`covariate-residualizer: covariate "${c.name}" has ${c.values.length} values for ${n} ticks`);
    }
  }
  assertExogenous(covariates);
  const maxP = Math.min(opts.maxArOrder ?? 5, Math.floor(n / 4));
  const ridge = opts.ridge ?? 1e-8;

  // OLS with intercept: regressors [1, X_1..X_k].
  const k = covariates.length;
  const dim = k + 1;
  const A: number[][] = Array.from({ length: dim }, () => new Array<number>(dim).fill(0));
  const b = new Array<number>(dim).fill(0);
  const reg = (j: number, t: number): number => (j === 0 ? 1 : covariates[j - 1].values[t]);
  for (let t = 0; t < n; t++) {
    for (let i = 0; i < dim; i++) {
      b[i] += reg(i, t) * y[t];
      for (let j = 0; j <= i; j++) A[i][j] += reg(i, t) * reg(j, t);
    }
  }
  for (let i = 0; i < dim; i++) for (let j = i + 1; j < dim; j++) A[i][j] = A[j][i];
  const ridgeAbs = A.map((row, i) => ridge * Math.max(row[i] / n, 1e-12) * n);
  const coef = solveSpd(A, b, ridgeAbs);
  const intercept = coef[0], beta = coef.slice(1);

  // AR(p) on the regression residual, AIC over 0..maxP.
  const u = regressionResiduals({ intercept, beta }, y, covariates);
  const uMean = u.reduce((a, v) => a + v, 0) / n; // ≈0 by construction; keep the frame explicit
  const gammas = autocovarianceSequence(u as number[], uMean, maxP);
  let best: { phi: number[]; sigma2: number; aic: number } = {
    phi: [], sigma2: Math.max(gammas[0], 1e-18), aic: n * Math.log(Math.max(gammas[0], 1e-18)),
  };
  for (let p = 1; p <= maxP; p++) {
    const { phi, sigma2_innovation, reflection_coefficients } = yuleWalkerLevinson(gammas.slice(0, p + 1));
    if (reflection_coefficients.some((r) => Math.abs(r) > 1)) break; // unstable — keep lower order
    const aic = n * Math.log(Math.max(sigma2_innovation, 1e-18)) + 2 * p;
    if (aic < best.aic) best = { phi, sigma2: Math.max(sigma2_innovation, 1e-18), aic };
  }

  const eps = innovations(u, best.phi);
  const rho1 = lag1Rho(eps);
  const rhoMax = opts.whitenessRhoMax ?? Math.max(0.1, 2 / Math.sqrt(eps.length));
  const rmse = Math.sqrt(eps.reduce((a, e) => a + e * e, 0) / Math.max(eps.length, 1));
  return {
    covariateNames: covariates.map((c) => c.name),
    intercept, beta,
    phi: best.phi, arOrder: best.phi.length, sigma2: best.sigma2,
    residualLag1Rho: rho1,
    whiteness: { rhoMax, pass: Math.abs(rho1) < rhoMax },
    oneStepRmse: rmse,
    nFit: n,
  };
}

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
export function oneStepResiduals(
  fit: CovariateResidualizerFit, y: ReadonlyArray<number>, covariates: ReadonlyArray<CovariateSeries>,
): OneStepResult {
  if (covariates.length !== fit.beta.length) {
    throw new Error(`covariate-residualizer: fit has ${fit.beta.length} covariates, got ${covariates.length}`);
  }
  for (let j = 0; j < covariates.length; j++) {
    if (covariates[j].name !== fit.covariateNames[j]) {
      throw new Error(`covariate-residualizer: covariate order mismatch — fit[${j}]="${fit.covariateNames[j]}", got "${covariates[j].name}"`);
    }
    if (covariates[j].values.length !== y.length) {
      throw new Error(`covariate-residualizer: covariate "${covariates[j].name}" length ≠ window length`);
    }
  }
  assertExogenous(covariates);
  const u = regressionResiduals(fit, y, covariates);
  const residuals = innovations(u, fit.phi);
  const sd = Math.sqrt(fit.sigma2);
  return {
    residuals,
    standardized: residuals.map((e) => e / sd),
    startIndex: fit.phi.length,
  };
}

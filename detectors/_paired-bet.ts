// detectors/_paired-bet.ts — ADR 0036: the one-sided bounded-mean betting e-process every
// randomized-twin statistic reduces to.
//
// H0: E[X_t | F_{t−1}] ≤ m_t for observations X_t ∈ [lo, hi], where the null mean m_t may change
// tick to tick (the observed traffic share, arm totals) but is known when X_t arrives. Wealth
// K_t = ∏ (1 + λ_s (X_s − m_s)) with λ_s ∈ [0, λmax_s] chosen from ticks before s. Under H0 each
// factor has conditional mean 1 + λ_s (E[X_s | F] − m_s) ≤ 1 and is ≥ 1/2 (λmax = ½ / (m − lo)), so K
// is a nonnegative supermartingale and Ville gives P(sup_t K_t ≥ 1/α) ≤ α. The premise is the bound
// and the conditional mean — no baseline, no scale, no tail, no φ.
//
// λ is the GRAPA ratio (running mean over running second moment of Y = X − m, Waudby-Smith–Ramdas
// 2023 §5) shrunk by one pseudo-observation with Y = 0 and second moment ((hi − lo)/4)², then
// clipped to [0, λmax]. It uses only past ticks, which is all validity needs; its quality is power.

import { advanceLogWealth, wealthView } from './_wealth';

export interface PairedBetSpec {
  /** Smallest value an observation can take. */
  lo: number;
  /** Largest value an observation can take. */
  hi: number;
  /** H0: E[X | past] ≤ nullMean. Needs lo < nullMean ≤ hi. */
  nullMean: number;
}

export interface PairedBetState {
  /** Log-wealth (the source of truth; see _wealth.ts). */
  log_K: number;
  /** Observations consumed. */
  n: number;
  /** Σ (X − m). */
  sumY: number;
  /** Σ (X − m)². */
  sumY2: number;
}

/** λmax as a fraction of the positivity bound 1 / (m − lo): every factor stays ≥ 1 − this. */
export const PAIRED_BET_MAX_FRACTION = 0.5;

export function initPairedBet(): PairedBetState {
  return { log_K: 0, n: 0, sumY: 0, sumY2: 0 };
}

export function pairedBetLambdaMax(spec: PairedBetSpec): number {
  if (!(spec.lo < spec.nullMean && spec.nullMean <= spec.hi)) {
    throw new RangeError(
      `paired-bet: need lo < nullMean <= hi, got lo=${spec.lo} nullMean=${spec.nullMean} hi=${spec.hi}`,
    );
  }
  return PAIRED_BET_MAX_FRACTION / (spec.nullMean - spec.lo);
}

/** The bet for the NEXT observation, from past observations only. */
export function pairedBetLambda(state: PairedBetState, spec: PairedBetSpec): number {
  const lamMax = pairedBetLambdaMax(spec);
  const quarter = (spec.hi - spec.lo) / 4;
  const mean = state.sumY / (state.n + 1);
  const second = (quarter * quarter + state.sumY2) / (state.n + 1);
  const lam = mean / second;
  return lam <= 0 ? 0 : lam >= lamMax ? lamMax : lam;
}

/** Consume one observation. NaN carries no evidence and holds the state. Pure. */
export function updatePairedBet(state: PairedBetState, spec: PairedBetSpec, x: number): PairedBetState {
  if (Number.isNaN(x)) return state;
  if (x < spec.lo || x > spec.hi) {
    throw new RangeError(`paired-bet: observation ${x} outside [${spec.lo}, ${spec.hi}]`);
  }
  const lam = pairedBetLambda(state, spec);
  const y = x - spec.nullMean;
  return {
    log_K: advanceLogWealth(state.log_K, Math.log1p(lam * y), -Infinity),
    n: state.n + 1,
    sumY: state.sumY + y,
    sumY2: state.sumY2 + y * y,
  };
}

export function pairedBetWealth(state: PairedBetState): number {
  return wealthView(state.log_K);
}

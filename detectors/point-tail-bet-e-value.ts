// detectors/point-tail-bet-e-value.ts — K4: conformal tail-bet e-value.
//
// knowledge/methodology/coverage-gap-detectors.md § K4 (`point_tail_bet_e_value`).
// Closes the coverage matrix's K4 NO row: the bounded-increment portfolio
// (safe-t, hedged indicators) structurally cannot bank one catastrophic
// observation — every per-tick increment is capped. This construction makes
// evidence from a SINGLE point decisive, unbounded in its rank.
//
// Construction. Score a live observation against a held-out calibration
// reference: s = |x − m_ref| / MAD_ref, m_ref and MAD_ref computed from
// n ≥ 10,000 held-out rows (raw MAD, no consistency constant — the score
// is rank-based through the conformal p-value below, so any monotone
// rescaling of the score, including a fixed consistency constant on MAD,
// leaves every rank and therefore every p-value unchanged). Conformal
// p-value against the held-out scores:
//
//     p(x) = (1 + #{s_cal >= s(x)}) / (n + 1)
//
// Per-point e-value through the κp^(κ−1) calibrator:
//
//     e = κ · p^(κ−1)          κ = KAPPA = 0.1 (registered, near
//                                log-optimal for the registered 5σ
//                                alternative — computed in design, not
//                                tuned; see the design page)
//
// Two-step validity argument (the docstring the design page requires):
//   1. Conformal p is super-uniform under exchangeability of the
//      (calibration, live) scores — distribution-free and exact; no
//      plug-in parameter. This is the valid super-uniform p-value the
//      calibrator below requires as its precondition.
//   2. ∫₀¹ κ·p^(κ−1) dp = 1 for any κ ∈ (0, 1), so e = κ·p^(κ−1) is a
//      valid e-value with E[e | H0] <= 1 per point (Vovk-Wang calibrator).
// Both steps are citable theorems whose hypotheses (exchangeability; a
// super-uniform input p) the certification battery checks directly.
// Quantifier tag: proof, with the calibrator identity as the artifact.

/** κ for the e-value calibrator e = κ·p^(κ−1). Registered, not tuned. */
export const KAPPA = 0.1;

export interface TailBetCalibration {
  median: number;
  mad: number;
  sortedScores: number[];
}

function median(sorted: number[]): number {
  const n = sorted.length;
  const mid = n >> 1;
  return n % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/** Binary search: count of values in `sorted` (ascending) that are >= x. */
function countGte(sorted: number[], x: number): number {
  let lo = 0, hi = sorted.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (sorted[mid] < x) lo = mid + 1; else hi = mid;
  }
  return sorted.length - lo;
}

/** Computes (median_ref, MAD_ref, sorted calibration scores) from held-out
 *  rows. Requires n >= 10,000 (the coverage-gap page's registered floor)
 *  and a nondegenerate MAD (MAD = 0 collapses every score to +Infinity). */
export function calibrateTailBet(rows: number[]): TailBetCalibration {
  if (rows.length < 10_000) {
    throw new Error(`calibrateTailBet: requires >= 10,000 held-out rows, got ${rows.length}`);
  }
  const sortedRows = [...rows].sort((a, b) => a - b);
  const m = median(sortedRows);
  const absDevs = rows.map((x) => Math.abs(x - m));
  const mad = median([...absDevs].sort((a, b) => a - b));
  if (mad === 0) {
    throw new Error('calibrateTailBet: MAD of held-out rows is 0 (degenerate reference)');
  }
  const sortedScores = absDevs.map((d) => d / mad).sort((a, b) => a - b);
  return { median: m, mad, sortedScores };
}

/** Per-point conformal tail-bet e-value against a frozen calibration.
 *  score = |x - cal.median| / cal.mad; p = (1 + #{cal >= score}) / (n+1);
 *  e = kappa * p^(kappa-1). See module docstring for the validity argument. */
export function pointTailBetEValue(
  x: number,
  cal: TailBetCalibration,
  kappa: number = KAPPA,
): { e: number; p: number; score: number } {
  const score = Math.abs(x - cal.median) / cal.mad;
  const n = cal.sortedScores.length;
  const p = (1 + countGte(cal.sortedScores, score)) / (n + 1);
  const e = kappa * Math.pow(p, kappa - 1);
  return { e, p, score };
}

// engine/detectors/mixture-confidence-sequence.ts — ADR 0027, study 2026-09-mixture-cs.
//
// The confidence sequence inverted from the Family A mixture supermartingale the engine already
// runs. The detector accumulates the centered partial sum S_t and evaluates Howard et al. 2021's
// two-sided normal mixture with mixing variance ρ = gaussian_sigma_squared_prior
// (computeGaussianMixtureLogSupermartingale):
//
//   log M_t(S_t) = S_t² / (2(σ²t + ρ)) + ½ log(ρ / (σ²t + ρ)).
//
// For a candidate shift m the same game on x_i − m has partial sum S_t − t·m, and the set of m
// whose game has NOT made money, { m : log M_t(S_t − tm) < log(1/α) }, is the interval
//
//   C_t = S_t/t ± w_t,     w_t = sqrt((σ²t + ρ) · log((σ²t + ρ) / (α² ρ))) / t
//
// — Howard 2021 eq. (14) with intrinsic time v = σ²t and l₀ = 1; Ramdas 2023 eq. (22). By
// Ville, P(∃t : δ ∉ C_t) ≤ α whenever x_i − δ is conditionally sub-Gaussian with parameter σ
// under the reference law. Rejecting when C_t excludes 0 IS the detector's own fire rule
// (Howard §6): both are M_t(S_t) ≥ 1/α, so the CS and the test are one object seen twice.
//
// WHAT IT COVERS. S_t is built from x_centered = live − μ̂_baseline, so C_t is an interval for
// the shift FROM THE COMPILED BASELINE MEAN. With μ̂ = μ + ε the estimand covered is δ − ε; the
// operationally wanted δ is missed by exactly ε, and the miss probability at a fixed horizon T
// with an m-sample calibration is 2·Φ̄( w_T / (σ·sqrt(1/T + 1/m)) ) — the study's P3, the
// estimation premise priced in closed form (knowledge stats/validity-premise-chain). The
// registered numbers live in validation/mixture-cs/REPORT.md once the run is scored.
//
// REPORTED instrument: no verdict authority. Wired onto the mixture result only per the study's
// registered outcome rule (PREREGISTRATION.md §3).

export interface MixtureConfidenceSequenceInput {
  /** the detector's centered (whitened) partial sum S_t. */
  S_t: number;
  /** wealth updates so far (t ≥ 1). */
  t: number;
  /** compiled per-tick variance σ². */
  sigma_squared: number;
  /** mixing variance ρ = gaussian_sigma_squared_prior. */
  sigma_squared_prior: number;
  /** the level the detector fires at (its 1/α). */
  alpha: number;
}

export interface MixtureConfidenceSequence {
  /** X̄_t = S_t / t — the running mean shift from the compiled baseline. */
  center: number;
  /** w_t as above. */
  half_width: number;
  lower: number;
  upper: number;
  /** true iff 0 ∉ C_t — identical to the detector's M_t ≥ 1/α. */
  excludes_zero: boolean;
}

export function mixtureConfidenceSequence(a: MixtureConfidenceSequenceInput): MixtureConfidenceSequence {
  if (!(a.t >= 1)) throw new Error(`mixtureConfidenceSequence: t must be ≥ 1, got ${a.t}`);
  if (!(a.alpha > 0 && a.alpha < 1)) throw new Error(`mixtureConfidenceSequence: alpha must be in (0,1), got ${a.alpha}`);
  if (!(a.sigma_squared_prior > 0)) throw new Error(`mixtureConfidenceSequence: σ²_prior must be > 0, got ${a.sigma_squared_prior}`);
  if (!(a.sigma_squared >= 0)) throw new Error(`mixtureConfidenceSequence: σ² must be ≥ 0, got ${a.sigma_squared}`);
  const v = a.sigma_squared * a.t + a.sigma_squared_prior;
  const half_width = Math.sqrt(v * Math.log(v / (a.alpha * a.alpha * a.sigma_squared_prior))) / a.t;
  const center = a.S_t / a.t;
  return {
    center, half_width,
    lower: center - half_width, upper: center + half_width,
    excludes_zero: Math.abs(center) >= half_width,
  };
}

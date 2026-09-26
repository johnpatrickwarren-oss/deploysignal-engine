// per-shard/twin-planning.ts — ADR 0036: how many ticks a twin bake needs to catch a given
// regression. A POWER figure: the second-order growth rate of the paired-bet wealth at the capped
// Kelly bet, ln(1/α) / growth. Inputs may be estimated from history (traffic, bad-event rate);
// nothing here is read by the rollback or proceed tests. The adaptive λ pays a learning cost the
// figure omits; study 2026-09-twin-null records the measured ratio.

export interface RatePlanInput {
  kind: 'rate';
  /** Canary traffic share within the experiment, in (0, 1). */
  canaryShare: number;
  /** Odds ratio of the regression to detect, > 0 (1.2 = 20% more bad events per request). */
  oddsRatio: number;
  /** Expected bad events per tick across both arms, > 0. */
  badEventsPerTick: number;
  alpha: number;
}

export interface SignPlanInput {
  kind: 'sign';
  /** P(canary tick worse) − 1/2 to detect, in [0, 0.5). */
  excessProbability: number;
  /** Fraction of ticks that tie, in [0, 1). */
  tieRate: number;
  alpha: number;
}

function growthPerTick(mu: number, m2: number, lamMax: number): number {
  if (mu <= 0) return 0;
  const lam = Math.min(mu / m2, lamMax);
  return lam * mu - (lam * lam * m2) / 2;
}

export function ticksToDetect(input: RatePlanInput | SignPlanInput): number {
  if (!(input.alpha > 0 && input.alpha < 1)) throw new RangeError(`twin-planning: alpha ${input.alpha}`);
  const target = Math.log(1 / input.alpha);
  if (input.kind === 'sign') {
    if (!(input.excessProbability >= 0 && input.excessProbability < 0.5)) {
      throw new RangeError(`twin-planning: excessProbability ${input.excessProbability}`);
    }
    if (!(input.tieRate >= 0 && input.tieRate < 1)) throw new RangeError(`twin-planning: tieRate ${input.tieRate}`);
    // X ∈ {0, 1}, null 1/2: E[(X − ½)²] = ¼ exactly; λmax = ½ / (½ − 0) = 1.
    const g = growthPerTick(input.excessProbability, 0.25, 1);
    return g > 0 ? target / g / (1 - input.tieRate) : Infinity;
  }
  const { canaryShare: pi, oddsRatio, badEventsPerTick: e } = input;
  if (!(pi > 0 && pi < 1)) throw new RangeError(`twin-planning: canaryShare ${pi}`);
  if (!(oddsRatio > 0)) throw new RangeError(`twin-planning: oddsRatio ${oddsRatio}`);
  if (!(e > 0)) throw new RangeError(`twin-planning: badEventsPerTick ${e}`);
  // Rare-event limit: the canary's share of bad events under the alternative.
  const share = (pi * oddsRatio) / (pi * oddsRatio + 1 - pi);
  const mu = share - pi;
  const m2 = (share * (1 - share)) / e + mu * mu;
  const g = growthPerTick(mu, m2, 0.5 / pi);
  return g > 0 ? target / g : Infinity;
}

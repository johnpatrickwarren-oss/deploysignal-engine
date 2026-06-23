import type { MSPRTParams, CompiledConfig, DetectorVerdict, SchemaContinuityRecord, BettingEProcessState } from '../types';
export declare function freshBettingState(): BettingEProcessState;
/** Per-deploy per-signal state store mirror of CUSUMStates. */
export type BettingStates = Record<string, BettingEProcessState>;
export declare function getOrCreateBetting(states: BettingStates, signal: string): BettingEProcessState;
/** GRAPA bet — closed-form predictive λ derived from the running first
 *  and second moments of the standardized z_t sequence. Returns a bet in
 *  the open unit ball; caller falls back to ONS when the raw GRAPA value
 *  exceeds BET_CLIP in magnitude. */
export declare function grapaBet(runningMean: number, runningSecondMoment: number, _prevBet: number): number;
/** ONS (Online Newton Step) fallback bet — used when GRAPA leaves the
 *  unit ball. A tempered gradient step on the log-wealth loss
 *  L_t(λ) = −log(1 + λ · z_t). The second-moment scaling comes from the
 *  running second moment of z to match ONS's A_t ≈ Σ ∇²L. */
export declare function onsBet(runningMean: number, runningSecondMoment: number, prevBet: number): number;
/** Pick a bet: GRAPA if it's inside the unit ball, else ONS fallback.
 *  Returns `{ bet, fellBack }` so the caller can update the state's
 *  `onsFallbackCount` audit counter. */
export declare function pickBet(runningMean: number, runningSecondMoment: number, prevBet: number): {
    bet: number;
    fellBack: boolean;
};
/** Betting-state tick update: derive z_t from the cell's baseline
 *  mean/σ, pick the bet, advance wealth with the non-negativity guard,
 *  and update running moments. Per-tick α is accounted separately in
 *  `alphaConsumed` for audit symmetry with Page-CUSUM. */
export declare function updateBettingState(state: BettingEProcessState, x: number, baselineMean: number, sigmaSquared: number, perTickAlpha: number, ar1Phi?: number): number;
/** Per-tick betting e-process input mirroring CUSUMInput. */
export interface BettingInput {
    signal: string;
    params: MSPRTParams;
    state: BettingEProcessState;
    trafficPct: number;
    trafficGate: number;
    ticksSinceDeploy: number;
    deployAgeDays: number;
    /** α_per_signal_betting: (α_A / bonf) · 0.5 per D7. Threshold = 1/α. */
    alphaBetting: number;
}
/** Evaluate the betting e-process at one tick, mirroring evaluateCUSUM's
 *  shape. Eligibility gates suppress FIRE (not ACCUMULATION); the wealth
 *  martingale evolves across suppressed ticks so that when eligibility
 *  lands, M_t already reflects deploy history — parity with Page-CUSUM's
 *  S_n accumulation semantic (D9). */
export declare function evaluateBettingEProcess(input: BettingInput, x: number): DetectorVerdict;
/** Per-tick Family A betting shadow. Parallel to evaluateFamilyAShadow;
 *  reads the same cell params + bake profile + ignore/schema gates so
 *  downstream audit records emit two independent per-signal verdicts
 *  (one per co-shipped detector) under a single Family A α-budget split
 *  50/50. Fires become `family_A_betting_{signal}` rollback entries. */
export declare function evaluateFamilyABettingShadow(cfg: CompiledConfig, liveMetrics: Record<string, number | undefined>, states: BettingStates, ctx: {
    hourOfDay: number;
    dayOfWeek?: number;
    ticksSinceDeploy: number;
    deployAgeDays: number;
    trafficPct: number;
    schemaContinuityClass?: SchemaContinuityRecord['schema_continuity'];
    ignoredSignals?: Set<string>;
    /** Addition #23 — tenant_id resolved to tenant_tier via
     *  `cfg.tenant_tier_map` for per-tier cell lookup. */
    tenantId?: string;
}): DetectorVerdict[];
//# sourceMappingURL=betting-e-process.d.ts.map
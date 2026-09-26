import { type PairedBetState } from '../detectors/_paired-bet';
import { type TwinMetricSpec, type TwinMetricState, type TwinObservation } from '../detectors/twin-contrast';
export interface TwinGateConfig {
    metrics: readonly TwinMetricSpec[];
    alphaRollback: number;
    alphaProceed: number;
    alphaSrm: number;
    /** Configured routing share of the canary within the experiment: w_c / (w_c + w_k). */
    canaryWeight: number;
    maxTicks: number;
    /** Opt in to `rate` metrics at canaryWeight ≠ 0.5. Refused by default: at an unequal split any
     *  per-tick arm-level shock moves the rollback null off the traffic share (study 2026-09-twin-null
     *  P2: 0.755 false rollback at w 0.1, σ_arm 0.3). Set it only where the arms are known to carry no
     *  arm-level effect on any tick, e.g. from an A/A run at the same split. */
    allowUnequalRateSplit?: boolean;
}
export type TwinVerdict = 'rollback' | 'proceed' | 'extend' | 'inconclusive' | 'invalid_experiment';
export interface TwinGateState {
    tick: number;
    terminal: TwinVerdict | null;
    metrics: Readonly<Record<string, TwinMetricState>>;
    srmUp: PairedBetState;
    srmDown: PairedBetState;
}
export interface TwinTickInput {
    canaryRequests: number;
    controlRequests: number;
    observations: Readonly<Record<string, TwinObservation | undefined>>;
}
export interface TwinMetricReport {
    id: string;
    rollbackE: number;
    rollbackThreshold: number;
    proceedE: number;
    proceedThreshold: number;
    used: number;
    skipped: number;
    ties: number;
    missing: number;
}
export interface TwinGateDecision {
    verdict: TwinVerdict;
    tick: number;
    srmE: number;
    srmThreshold: number;
    metrics: TwinMetricReport[];
}
export declare function checkTwinGateConfig(cfg: TwinGateConfig): void;
export declare function initTwinGate(cfg: TwinGateConfig): TwinGateState;
export declare function stepTwinGate(cfg: TwinGateConfig, state: TwinGateState, input: TwinTickInput): {
    state: TwinGateState;
    decision: TwinGateDecision;
};
//# sourceMappingURL=twin-gate.d.ts.map
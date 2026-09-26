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
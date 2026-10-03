import { type PairedBetState } from './_paired-bet';
export interface PeerRankSpec {
    id: string;
    worse: 'higher' | 'lower';
    /** Proceed-side excess probability τ ∈ (0, ½) that the unit's tick is worse (as the sign kind). */
    tolerance: number;
    /** ADR 0037's band, applied per peer: worse 'higher' → unit > peer · (1 + relative) + absolute. */
    margin?: {
        relative?: number;
        absolute?: number;
    };
    alpha: number;
}
export interface PeerRankObservation {
    unit: number;
    peers: readonly number[];
    /** ADR 0040: one relative offset per peer, declared by the caller (estimated from a pre-change window in
     *  which unit and peers ran concurrently, or known). Peer j's reference becomes peers[j] · (1 + offsets[j])
     *  before the band. Absent or 0 is ADR 0039. Length must equal peers.length when present. */
    offsets?: readonly number[];
    /** ADR 0041: one relative margin per peer, derived by the caller from the same pre-window as `offsets`
     *  (a declared quantile of |unit/peer − 1 − median|). The band for peer j is max(spec.margin.relative,
     *  margins[j]); widening the band can only lower x, so the spec's null stays valid. Length must equal
     *  peers.length when present; a non-finite or negative entry is treated as 0. */
    margins?: readonly number[];
}
export interface PeerRankState {
    rollback: PairedBetState;
    proceed: PairedBetState;
    used: number;
    skipped: number;
    missing: number;
    fired: boolean;
    firedAt: number | null;
}
export interface PeerRankStep {
    state: PeerRankState;
    x: number | null;
    peersScored: number;
    rollbackE: number;
    proceedE: number;
    threshold: number;
    fire: boolean;
    proceed: boolean;
}
export declare function checkPeerRankSpec(spec: PeerRankSpec): void;
export declare function initPeerRank(spec: PeerRankSpec): PeerRankState;
/** Is the unit worse than one peer, beyond the band? `extraRel` (ADR 0041) is a per-peer relative
 *  margin floor; the band uses the larger of it and the spec's relative margin. Exported for the N = 2
 *  reproduction check. */
export declare function worseThanPeer(spec: PeerRankSpec, unit: number, peer: number, extraRel?: number): boolean;
/** The per-tick score, or null when it cannot be scored (non-finite unit, no finite peer). Without a
 *  margin an exact tie with a peer counts half (the sign kind's 'tie' is a skipped tick at N = 2;
 *  at N > 2 a tie with one peer of many is a half-comparison, which keeps E[x] = ½ under exchange). */
export declare function peerRankScore(spec: PeerRankSpec, obs: PeerRankObservation): {
    x: number;
    peersScored: number;
} | null;
export declare function stepPeerRank(spec: PeerRankSpec, state: PeerRankState, obs: PeerRankObservation): PeerRankStep;
//# sourceMappingURL=peer-rank.d.ts.map
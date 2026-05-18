// engine/topology/common-mode-attribution.ts — Tessera Phase 2 SLICE 3.C (R26) WU-04 MD-F4.
// RED stub — not implemented yet. Full implementation in GREEN commit.

import type { TopologyNode, TopologySnapshot } from '../types/verdict';
import { computeSnapshotHash as _computeSnapshotHash } from '../topology-overlay';

export interface FiredShardEvent {
  shard_node_id: string;
  event_ts: number;
  event_id?: string;
}

export interface CommonModeCandidate {
  shared_node_id: string;
  shared_node_kind: 'psu' | 'rack' | 'cooling_zone';
  member_shard_ids: readonly string[];
  member_count: number;
  topology_distance: number;
  earliest_event_ts: number;
  latest_event_ts: number;
  correlational_not_causal: true;
}

export interface CommonModeAttributionOpts {
  max_hop_distance?: number;
  min_member_count?: number;
  candidate_node_kinds?: ReadonlyArray<TopologyNode['kind']>;
  now?: () => number;
}

export interface CommonModeAttributionInput {
  fired_events: readonly FiredShardEvent[];
  snapshot: TopologySnapshot;
  opts?: CommonModeAttributionOpts;
}

export interface CommonModeAttributionResult {
  candidates: readonly CommonModeCandidate[];
  snapshot_hash: string;
  attributed_at_ts: number;
}

export const DEFAULT_MAX_HOP_DISTANCE = 1;
export const DEFAULT_MIN_MEMBER_COUNT = 2;
export const DEFAULT_CANDIDATE_NODE_KINDS: ReadonlyArray<TopologyNode['kind']> = ['psu', 'rack', 'cooling_zone'];

export function attributeCommonMode(
  _input: CommonModeAttributionInput,
): CommonModeAttributionResult {
  throw new Error('not implemented');
}

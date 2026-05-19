// engine/events/freeze-hook.ts — STUB (R34 RED commit — not yet implemented)

import {
  updatePerShardResidual,
  type ExtendedSampleObservation,
} from '../per-shard/runtime';
import type { PerShardResidual, BaselineCellEntry } from '../types/config';

export interface FreezeHookState {
  active: boolean;
  until_ts?: number;
  cluster_event_id?: string;
}

export function freezeAwareUpdatePerShardResidual(
  _current: PerShardResidual,
  _obs: ExtendedSampleObservation,
  _baselineCell: BaselineCellEntry | undefined,
  _freezeState: FreezeHookState,
  _config: { freeze_hook_enabled?: boolean },
): PerShardResidual {
  throw new Error('not implemented');
}

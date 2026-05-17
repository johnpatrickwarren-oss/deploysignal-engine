// engine/fleet/detectors.ts — Tessera SLICE 3 second slice (R12):
// fleet-merged Family A + Family C detector surfaces.
//
// Bridges the inherited-engine per-shard wealth processes and R11's
// family-agnostic fleet-merge primitives:
//
//   fleetMergeFamilyA: takes a ReadonlyArray of per-shard
//     BettingEProcessState (engine/types/families/a.ts:20), extracts
//     Math.log(Math.max(state.M, WEALTH_FLOOR)) per shard, calls the
//     caller-supplied primitive (combineProduct or combineAverage from
//     engine/fleet/combine.ts), updates the fleet wealth tracker via
//     updateFleetEProcessState, returns { log_fleet_e, fleet_state }.
//
//   fleetMergeFamilyC: takes a ReadonlyArray of per-shard
//     FamilyCBettingEProcessState (engine/types/families/c.ts:297),
//     reads state.log_S_t directly per shard (already log-space per
//     inherited engine convention; no extra log or floor), then
//     identical to fleet-merge body for Family A.
//
// Caller-selection mechanism (PoE vs AoE; per Q-R12-SPEC Mechanism
// primitive 3): the caller passes combineProduct (PoE — Ville-preserved
// under conditional independence) OR combineAverage (AoE — Ville-preserved
// under arbitrary dependence; conditional-independence-robust). These
// wrappers make NO claim about which primitive is safe in a given regime —
// that decision belongs to the caller. R11 PR-F1 evidence matrix (at
// test/q11-hierarchical-e-value-combination.test.ts AC-13/14/15/16)
// empirically demonstrated both regimes; R12 ships the named family-
// specific entry points the operator-layer caller will use at R13+.
//
// Per-shard input invariance: neither wrapper mutates any field of any
// per-shard input state. Wrappers READ state.M (Family A) or state.log_S_t
// (Family C); they do NOT write. Per AC-6 + AC-7 (deep-equal-before-vs-after
// on every field).
//
// Fleet state mutation contract: in-place (matches R11 convention at
// engine/fleet/combine.ts:122-138). The returned FleetMergeStepResult.fleet_state
// is the SAME reference as the input fleet_state parameter.
//
// Tessera-original code (NOT vendored from DeploySignal). Extracts to the
// shared npm package at Tessera Phase 2 close per SCOPING-MEMO-v0.3 § 9.

import type { BettingEProcessState } from '../types/families/a';
import type { FamilyCBettingEProcessState } from '../types/families/c';
import {
  updateFleetEProcessState,
  type FleetEProcessState,
  type FleetMergeOutput,
} from './combine';

/** Wealth floor — prevents Math.log(0) on long no-drift Family A runs where
 *  BettingEProcessState.M underflows below 1e-12. Mirrors the inherited
 *  engine convention at engine/detectors/betting-e-process.ts:65
 *  (WEALTH_FLOOR is module-private there; redeclared here as Tessera-fleet-
 *  layer constant with the same numeric value). */
const WEALTH_FLOOR = 1e-12;

/** Function-signature alias for the caller-supplied combination primitive.
 *  Matches exactly the signature of R11's combineProduct + combineAverage
 *  exports at engine/fleet/combine.ts:63 + :87. Caller picks per the
 *  operating regime (option (a) caller-selection mechanism; see file
 *  header for the conditional-independence-assumption + compensating-control
 *  responsibility split). */
export type CombinePrimitive = (xs: ReadonlyArray<number>) => FleetMergeOutput;

/** Result of a single fleet-merge step. Carries both the fleet log-e-value
 *  (convenience alias for fleet_state.log_fleet_e_t post-update) AND the
 *  same fleet_state reference (in-place mutation contract; explicit
 *  ergonomic for callers that chain across ticks). */
export interface FleetMergeStepResult {
  log_fleet_e: number;
  fleet_state: FleetEProcessState;
}

/** Shared internal helper: takes pre-extracted log-e-values, calls the
 *  primitive, updates the fleet wealth tracker in-place, returns the
 *  result. Throws (via the primitive) when log_e_values.length === 0
 *  (R11 combineProduct/combineAverage own the empty-input semantics).
 *  Module-local; NOT exported. */
function fleetMergeStep(
  log_e_values: ReadonlyArray<number>,
  primitive: CombinePrimitive,
  fleet_state: FleetEProcessState,
  log_threshold: number,
): FleetMergeStepResult {
  const out = primitive(log_e_values);
  updateFleetEProcessState(fleet_state, out.log_fleet_e, log_threshold);
  return { log_fleet_e: out.log_fleet_e, fleet_state };
}

/** Fleet-merged Family A detector surface. Extracts Math.log(Math.max(
 *  state.M, WEALTH_FLOOR)) from each per-shard BettingEProcessState
 *  (engine/types/families/a.ts:20), calls the caller-supplied combination
 *  primitive, updates the fleet wealth tracker.
 *
 *  Pure with respect to per-shard inputs: reads only state.M; does NOT
 *  mutate any field of any per_shard_states[i].
 *
 *  In-place mutates fleet_state per R11 convention; returns the same
 *  reference in FleetMergeStepResult.fleet_state.
 *
 *  Throws (via the primitive) when per_shard_states is empty.
 *
 *  Caller-selection responsibility: picks primitive = combineProduct (PoE)
 *  under iid-assumption-evidence; primitive = combineAverage (AoE) when
 *  correlated drift cannot be ruled out (Vovk-Wang 2021 §4; R11 PR-F1
 *  evidence at test/q11-hierarchical-e-value-combination.test.ts AC-13..16). */
export function fleetMergeFamilyA(
  per_shard_states: ReadonlyArray<BettingEProcessState>,
  primitive: CombinePrimitive,
  fleet_state: FleetEProcessState,
  log_threshold: number,
): FleetMergeStepResult {
  const log_e_values: number[] = [];
  for (const state of per_shard_states) {
    log_e_values.push(Math.log(Math.max(state.M, WEALTH_FLOOR)));
  }
  return fleetMergeStep(log_e_values, primitive, fleet_state, log_threshold);
}

/** Fleet-merged Family C detector surface. Reads state.log_S_t directly
 *  from each per-shard FamilyCBettingEProcessState (engine/types/families/c.ts:297).
 *  The Family C wealth is already stored in log-space per the inherited
 *  engine convention (engine/types/families/c.ts:298-299 JSDoc: "Wealth
 *  process S_t (multiplicative). Stored in log-space as log_S_t for numerical
 *  stability"); no Math.log call or floor is applied.
 *
 *  Pure with respect to per-shard inputs: reads only state.log_S_t; does
 *  NOT mutate any field of any per_shard_states[i].
 *
 *  In-place mutates fleet_state per R11 convention; returns the same
 *  reference in FleetMergeStepResult.fleet_state.
 *
 *  Throws (via the primitive) when per_shard_states is empty.
 *
 *  Caller-selection responsibility: same as fleetMergeFamilyA. */
export function fleetMergeFamilyC(
  per_shard_states: ReadonlyArray<FamilyCBettingEProcessState>,
  primitive: CombinePrimitive,
  fleet_state: FleetEProcessState,
  log_threshold: number,
): FleetMergeStepResult {
  const log_e_values: number[] = [];
  for (const state of per_shard_states) {
    log_e_values.push(state.log_S_t);
  }
  return fleetMergeStep(log_e_values, primitive, fleet_state, log_threshold);
}

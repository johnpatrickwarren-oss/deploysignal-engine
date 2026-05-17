// engine/types/fleet.ts — Tessera SLICE 3 (R11): fleet-level e-process state type.
//
// Single source of truth for the FleetEProcessState shape consumed by
// engine/fleet/combine.ts's updateFleetEProcessState. Mirrors the inherited
// per-shard wealth-process state interfaces (BettingEProcessState at
// engine/types/families/a.ts:20; FamilyCBettingEProcessState at
// engine/types/families/c.ts:297) in mutation contract (in-place) and field
// composition (current value + running max + sticky-fire latch + tick count).
//
// Tessera-original code (NOT vendored from DeploySignal). Extracts to the shared
// npm package at Tessera Phase 2 close per SCOPING-MEMO-v0.3 § 9.

/** Tessera SLICE 3 (R11) — fleet-level e-process state for hierarchical e-value
 *  combination across N per-shard wealth processes. Persists across fleet-ticks
 *  within an evaluation window; reset by re-constructing via freshFleetEProcessState
 *  at window boundary.
 *
 *  All fields stored in log-space for numerical stability (matches inherited
 *  FamilyCBettingEProcessState.log_S_t convention).
 *
 *  Sticky-fire semantics: once log_fleet_e_max crosses log_threshold at any tick,
 *  `fired` remains true for the remainder of the window. `tick_at_first_fire`
 *  records the FIRST crossing (0-based tick index post-update).
 *
 *  Mutation contract: in-place (matches inherited engine convention at
 *  engine/detectors/betting-e-process.ts:151-175 + engine/detectors/
 *  family-c-betting-e-process.ts:231-244). Distinct from the Tessera per-shard
 *  layer's pure-function convention (R03/R04/R05/R10) because this IS a wealth
 *  process; the per-shard layer is a sample accumulator. */
export interface FleetEProcessState {
  /** Most recent log of the fleet e-value at the current tick. Initialized
   *  to 0 (fleet e_0 = 1 ⇒ log_e_0 = 0). */
  log_fleet_e_t: number;
  /** Running max of log_fleet_e across ticks. Initialized to 0. Load-bearing
   *  for any-time Ville evaluation: P(sup_t log_fleet_e_t ≥ log(1/α_fleet)) ≤ α_fleet. */
  log_fleet_e_max: number;
  /** Tick count. Initialized to 0; incremented by 1 at each updateFleetEProcessState call. */
  n: number;
  /** Sticky-fire latch — set true at first tick t where log_fleet_e_max ≥ log_threshold;
   *  remains true thereafter. Initialized to false. */
  fired: boolean;
  /** Tick index (0-based) at first fire; null until threshold crossed. */
  tick_at_first_fire: number | null;
}

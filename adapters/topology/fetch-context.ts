// engine/topology/fetch-context.ts — Phase 3 SLICE 2 WU-Phase3-2B (R58).
//
// TopologyFetchContext: Tessera-original extension of the inherited
// `FetchContext` (engine/topology-overlay.ts:57-60) carrying optional
// real-cluster-fetch metadata (authToken, apiEndpoint, timeoutMs).
//
// Path B (R58): all three new fields are accepted by adapter
// `fetchSnapshot(ctx?)` methods but are unused at runtime EXCEPT
// `apiEndpoint` — if defined, adapters throw
// `LIVE_FETCH_NOT_IMPLEMENTED_PATH_B: <vendor>` to surface Path B
// deferral explicitly. Real-cluster-fetch implementation is deferred
// per PRD § Phase 3 Path B (OQ-P3-9 RESOLVED 2026-05-19 at
// WAVE-GATE-06).
//
// Why a Tessera-original file instead of modifying
// engine/topology-overlay.ts: the inherited file is vendored-at-pin
// (engine/topology-overlay.ts:3 "Sync policy: vendored-at-pin").
// Tessera-original extension files preserve A12 inviolate while
// providing the richer ctx surface adapters can opt into via TS
// method-parameter bivariance.
//
// Tessera-original code (NOT vendored from DeploySignal).

import type { FetchContext } from '../topology-overlay';

export interface TopologyFetchContext extends FetchContext {
  /** Bearer token / auth credential for future real-cluster fetch endpoints.
   *  Path B (R58): accepted in contract; unused at runtime. */
  authToken?: string;
  /** Real-cluster topology fetch endpoint URI. Path B (R58): if defined,
   *  adapter throws LIVE_FETCH_NOT_IMPLEMENTED_PATH_B. */
  apiEndpoint?: string;
  /** Real-cluster fetch deadline in milliseconds. Path B (R58): accepted
   *  in contract; unused at runtime. */
  timeoutMs?: number;
}

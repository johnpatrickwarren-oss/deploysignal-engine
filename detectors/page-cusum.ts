// VENDORED FROM DeploySignal main@5a72371 — 2026-05-16
// Source: deploysignal/engine/detectors/page-cusum.ts
// Sync policy: vendored-at-pin
// Extract target: @johnpatrickwarren-oss/deploysignal-engine (Tessera Phase 2 close commitment)
// DO NOT modify internals without ADR; deltas only at architecturally-anchored extension points (see SCOPING-MEMO-v0.3 § 9).

// engine/detectors/page-cusum.ts — Family A co-ship: Page-CUSUM with
// mixture prior (this module group) + betting-based e-processes (see
// betting-e-process.ts). Both fire independently under a 50/50 α-split
// of the per-signal Bonferroni-corrected budget; Family A fuses via
// any-fire union.
//
// Per ARCHITECT-REPLY-05.md (2026-04-18) and ARCHITECT-REPLY-34.md
// (2026-04-20, Addition #17 co-ship). The sliding-window mSPRT drafted
// earlier in W2 was a spec gap — cumulative mean has the same pre-drift
// dilution problem for unknown-change-point drifts, and sliding window
// dilutes the statistic even further. Page-CUSUM with mixture prior
// (Page 1954; Lorden 1971; Lai 1995, 2001) is the classical Page-1954
// reset-at-zero CUSUM with Gaussian mixture-prior log-likelihood-ratio
// update; per-deploy Bonferroni-corrected α via excursion theory (not
// anytime-valid Ville-bounded e-process; Howard-Ramdas-McAuliffe-Sekhon
// 2021 anytime-valid variants would use non-resetting mixture
// supermartingale or explicit betting-style e-process construction).
// File was named `mSPRT.ts` through W5 for historical
// reasons; renamed 2026-04-20 per Addition #17 D1 text fold — a one-line
// re-export shim at the old path keeps legacy imports loadable for one
// PR cycle.
//
// Math (per tick, per signal):
//
//   z_n = log[ N(x_n | 0, σ² + τ²) / N(x_n | 0, σ²) ]
//       = ½·log( σ² / (σ² + τ²) )  +  x_n² · τ² / ( 2·σ² · (σ² + τ²) )
//
//   S_n = max(0, S_{n-1} + z_n),  S_0 = 0
//
// Fire when S_n ≥ h = −log(α_per_signal). Per-signal α is Bonferroni-
// corrected; at W2 defaults (α_family_A = 4e-4, N_signals = 6), h ≈ 9.6.
//
// Reset semantics: the max(0, ...) truncates pre-drift stable samples so
// their small-negative z_n contributions never dilute post-drift fire
// signal. This is what makes Page-CUSUM robust to unknown onset.
//
// x_n is the deviation from the *cell-matched* baseline mean (hour-of-day,
// per addition #2 in NORTH-STAR-ARCHITECTURE.md), not the scenario's
// global baseline. σ² and τ² also come from the cell. CUSUM state S_n
// carries across cell boundaries but z_n uses the new cell's σ² and mean.
//
// Bake-profile and traffic-pct gating suppress the *fire*, not the
// accumulation — S_n keeps updating during suppression so that when
// eligibility lands, the statistic already reflects deploy history.
//
// ── Facade ────────────────────────────────────────────────────────────
// This file is the stable public entry point. The implementation lives in
// three cohesive sibling modules (god-file refactor — behavior preserved
// verbatim):
//   _page-cusum-core.ts      — CUSUM state, classical update, cell match,
//                              traffic-gate + primary-signal-set helpers.
//   _page-cusum-classical.ts — classical Page-1954 reset-at-zero path.
//   _page-cusum-mixture.ts   — Howard-Ramdas-2021 mixture-supermartingale
//                              path (canonical Family A dispatch).
// Every name that was importable from `detectors/page-cusum` before the
// split remains importable from here, unchanged.

export {
  // state
  type CUSUMState,
  freshCUSUM,
  type CUSUMStates,
  getOrCreateCUSUM,
  updateCUSUM,
  type CUSUMInput,
  // shared helpers
  trafficGateMin,
  FAMILY_A_PRIMARY_SIGNALS,
} from './_page-cusum-core';

export {
  evaluateCUSUM,
  lookupCellParams,
  evaluateFamilyAShadow,
} from './_page-cusum-classical';

export {
  type MixtureSupermartingaleStates,
  evaluateFamilyAShadowMixture,
  evaluateFamilyA,
} from './_page-cusum-mixture';

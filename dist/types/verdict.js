"use strict";
// VENDORED FROM DeploySignal main@5a72371 — 2026-05-16
// Source: deploysignal/engine/types/verdict.ts
// Sync policy: vendored-at-pin
// Extract target: @johnpatrickwarren-oss/deploysignal-engine (Tessera Phase 2 close commitment)
// DO NOT modify internals without ADR; deltas only at architecturally-anchored extension points (see SCOPING-MEMO-v0.3 § 9).
// Tessera Phase 2 SLICE 1 amendments (R18, 2026-05-17) — three additive extensions
// per SCOPING-MEMO-v0.3.md § 2.3 + § 9.4:
//   1. TopologyNode.kind union extends to include 'gpu_shard' | 'rack' (subset of v0.3 list;
//      'psu' | 'cooling_zone' deferred to later Phase 2 SLICE).
//   2. TopologyEdge.relationship union extends to include 'contains' (hierarchical containment;
//      BFS at engine/topology-overlay.ts treats edges bidirectionally regardless of relationship,
//      inherited semantic accepted at SLICE 1).
//   3. VerdictGroup adds optional `cluster_event_id?: string` (Phase 2 outer-aggregator hook;
//      preserves Addition #25 D2 + D5 at SLICE 1; SLICE 2 may amend D5).
// All three extensions are additive-only; Addition #25 D2 + D5 and Addition #26 D4 preserved.
//
// Tessera Phase 2 SLICE 3.A amendments (R23, 2026-05-18) — two additive extensions
// per Q-R23-SPEC.md § 2.1 (remaining node-kind enumerations from SCOPING-MEMO-v0.3 § 2.3):
//   4. TopologyNode.kind union extends to include 'psu' | 'cooling_zone' (completes the
//      v0.3 four-kind hardware-topology set deferred at SLICE 1).
//   5. TopologyEdge.relationship union extends to include 'nvlink_peer' (peer-to-peer GPU
//      interconnect; semantically distinct from containment; BFS at
//      engine/topology-overlay.ts treats edges bidirectionally regardless of relationship).
// Both extensions are additive-only; Addition #25 D2 + D5 and Addition #26 D4 preserved.
//
// Tessera Phase 3 SLICE 1 amendments (R53, 2026-05-19) — two additive extensions
// per Q-R53-SPEC.md § 2.4 (AWS Neuron family adapter enum additions):
//   6. TopologyNode.kind union extends to include 'trainium_chip' | 'inferentia_chip'
//      (AWS Trainium + Inferentia2 chip-family node kinds; discriminated by instance_type prefix).
//   7. TopologyEdge.relationship union extends to include 'neuron_link_peer' (NeuronLink-v2
//      peer-to-peer interconnect; undirected-deduped; BFS at engine/topology-overlay.ts
//      treats edges bidirectionally regardless of relationship).
// Both extensions are additive-only; Addition #25 D2/D5 + Addition #26 D4 preserved.
Object.defineProperty(exports, "__esModule", { value: true });
//# sourceMappingURL=verdict.js.map
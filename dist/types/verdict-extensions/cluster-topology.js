"use strict";
// engine/types/verdict-extensions/cluster-topology.ts
//
// Optional cluster-topology vocabulary for consumers modeling NVL-class GPU
// fabrics (Blackwell NVL72 superchips, NVLink switches, scale-out leaf/spine,
// federated multi-cluster campuses).
//
// Intentionally NOT merged into the base NodeKind / EdgeRelationship unions
// in `types/verdict.ts`. Rationale:
//
//   - The base unions are closed and consumed by exhaustive switches in the
//     engine and in downstream services (DeploySignal, etc.). Widening them
//     would silently turn `default: const _: never = n.kind;` exhaustiveness
//     checks into compile errors in every consumer.
//
//   - These additions describe a specific operational regime (NVL-class GPU
//     fabrics + scale-out fabric tiers + federated campuses) that not every
//     engine consumer needs. Keeping them opt-in means non-cluster consumers
//     see zero schema-surface churn.
//
// Adopters compose explicitly:
//
//   import type { NodeKind, EdgeRelationship } from '@johnpatrickwarren-oss/deploysignal-engine/types/verdict';
//   import type { ClusterTopologyKind, ClusterEdgeRelationship } from '@johnpatrickwarren-oss/deploysignal-engine/types/verdict-extensions/cluster-topology';
//
//   type MyNodeKind = NodeKind | ClusterTopologyKind;
//   type MyEdgeRelationship = EdgeRelationship | ClusterEdgeRelationship;
//
// Originally motivated by the clustersynth synthetic-fixture project
// (https://github.com/johnpatrickwarren-oss/clustersynth), which emits
// TopologySnapshot JSON for GB200 / GB300 NVL72 clusters at order-of-magnitude
// scaling and exposed the closed-union gap at consumer integration time.
Object.defineProperty(exports, "__esModule", { value: true });
//# sourceMappingURL=cluster-topology.js.map
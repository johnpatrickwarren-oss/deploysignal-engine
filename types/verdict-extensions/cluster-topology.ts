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

/**
 * Node kinds for NVL-class GPU clusters + scale-out fabric + multi-cluster
 * federation. Compose with the base NodeKind from `types/verdict` rather than
 * replacing it.
 *
 * Members:
 *   - `cluster`         — top-level flat-cluster aggregator (single NVLink domain
 *                          per cluster, or as a sub-cluster within a campus)
 *   - `cpu_shard`       — host CPU (e.g. Grace) paired with GPU shards via PCIe
 *   - `superchip`       — compute tray-level group (e.g. NVL72 Bianca: 4 GPU + 2 Grace)
 *   - `nvlink_switch`   — NVSwitch tray inside a single NVLink domain
 *   - `nic`             — host NIC (ConnectX-class)
 *   - `tor_switch`      — top-of-rack switch (scale-out fabric tier 1)
 *   - `leaf_switch`     — pod-level leaf switch (scale-out fabric tier 2)
 *   - `spine_switch`    — cluster-level spine switch (scale-out fabric tier 3)
 *   - `pod`             — pod aggregator (group of racks under a shared leaf pair)
 *   - `campus`          — campus aggregator (group of clusters under a site WAN tier)
 *   - `site_wan_router` — campus-level inter-cluster WAN router
 */
export type ClusterTopologyKind =
  | 'cluster'
  | 'cpu_shard'
  | 'superchip'
  | 'nvlink_switch'
  | 'nic'
  | 'tor_switch'
  | 'leaf_switch'
  | 'spine_switch'
  | 'pod'
  | 'campus'
  | 'site_wan_router';

/**
 * Edge relationships for NVL-class GPU clusters + scale-out fabric. Compose
 * with the base EdgeRelationship from `types/verdict` rather than replacing it.
 *
 * Members:
 *   - `nvlink_switched` — GPU ↔ NVSwitch (fully-switched NVLink domain; distinct
 *                          from base `nvlink_peer` which is GPU ↔ GPU direct)
 *   - `pcie_peer`       — GPU ↔ paired host CPU within a superchip
 *   - `power_supply`    — PSU → compute tray (power containment)
 *   - `cooling`         — cooling_zone → rack (thermal containment, typically
 *                          rack-level for liquid-cooled NVL72)
 *   - `network_link`    — generic fabric connectivity edge (NIC ↔ ToR, ToR ↔ leaf,
 *                          leaf ↔ spine, spine ↔ site_wan_router); carries topology
 *                          only (no bandwidth / latency / weight semantics)
 */
export type ClusterEdgeRelationship =
  | 'nvlink_switched'
  | 'pcie_peer'
  | 'power_supply'
  | 'cooling'
  | 'network_link';

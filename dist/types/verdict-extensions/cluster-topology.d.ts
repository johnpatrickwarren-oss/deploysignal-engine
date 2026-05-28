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
export type ClusterTopologyKind = 'cluster' | 'cpu_shard' | 'superchip' | 'nvlink_switch' | 'nic' | 'tor_switch' | 'leaf_switch' | 'spine_switch' | 'pod' | 'campus' | 'site_wan_router';
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
export type ClusterEdgeRelationship = 'nvlink_switched' | 'pcie_peer' | 'power_supply' | 'cooling' | 'network_link';
//# sourceMappingURL=cluster-topology.d.ts.map
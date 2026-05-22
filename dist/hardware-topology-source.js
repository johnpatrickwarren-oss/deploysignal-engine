"use strict";
// engine/hardware-topology-source.ts — Tessera-original Phase 2 SLICE 3.A (R23).
//
// HardwareTopologySource — concrete impl of the inherited Addition #26
// TopologySource interface (engine/topology-overlay.ts:50-55) for hardware
// topology data (NVLink / rack / PSU / cooling-zone). At R23 (SLICE 3.A),
// constructor accepts a pre-resolved TopologySnapshot — analogous to
// inherited StaticTopologySource at engine/topology-overlay.ts:83-101.
// SLICE 3.B (R24) adds concrete ingestion adapters (Slurm topology /
// Kubernetes node-label / NVIDIA NVLink-topology) against the same
// interface; the R23 class's API is the contract surface for that
// expansion.
//
// snapshotHash() delegates to the inherited computeSnapshotHash free
// function — every TopologySource impl shares identical hash semantics
// per Addition #26 D6 archaeological-render requirement.
//
// Tessera-original code (NOT vendored from DeploySignal).
Object.defineProperty(exports, "__esModule", { value: true });
exports.HardwareTopologySource = void 0;
const topology_overlay_1 = require("./topology-overlay");
class HardwareTopologySource {
    constructor(snapshot, opts = {}) {
        this.snapshot = snapshot;
        this.id = opts.id ?? snapshot.source_id ?? 'hardware_topology_source';
        this.version = opts.version ?? snapshot.source_version ?? 'hardware-1';
    }
    async fetchSnapshot(_ctx) {
        return this.snapshot;
    }
    snapshotHash(snapshot) {
        return (0, topology_overlay_1.computeSnapshotHash)(snapshot);
    }
}
exports.HardwareTopologySource = HardwareTopologySource;
//# sourceMappingURL=hardware-topology-source.js.map
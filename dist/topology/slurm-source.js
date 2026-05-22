"use strict";
// engine/topology/slurm-source.ts — Tessera-original Phase 2 SLICE 3.B (R28 / WU-01).
//
// SlurmTopologySource — concrete impl of the inherited Addition #26
// TopologySource interface (engine/topology-overlay.ts:50-55) for Slurm
// topology.conf format. Parses canonical Slurm hierarchical-tree topology
// + leaf hostlists into a TopologySnapshot consumable by the inherited
// BFS-on-undirected attribution layer.
//
// snapshotHash() delegates to the inherited computeSnapshotHash free
// function — every TopologySource impl shares identical hash semantics
// per Addition #26 D6 archaeological-render requirement.
//
// L0 contract boundary: Slurm topology.conf is configuration data, not
// counter telemetry; this module does NOT import or invoke
// engine/l0/counter-rate-transform.ts (per CLUSTER-HANDOFF-1-WU00-WU01
// D2 MEDIUM interface-only stance).
//
// Tessera-original code (NOT vendored from DeploySignal).
Object.defineProperty(exports, "__esModule", { value: true });
exports.SlurmTopologySource = void 0;
exports.parseSlurmTopologyConf = parseSlurmTopologyConf;
exports.expandSlurmHostlist = expandSlurmHostlist;
const topology_overlay_1 = require("../topology-overlay");
class SlurmTopologySource {
    constructor(topologyConfText, opts = {}) {
        this.id = opts.id ?? 'slurm_topology_source';
        this.version = opts.version ?? 'slurm-1';
        const fetchedAtTs = opts.fetchedAtTs ?? Math.floor(Date.now() / 1000);
        this.snapshot = parseSlurmTopologyConf(topologyConfText, {
            sourceId: this.id,
            sourceVersion: this.version,
            fetchedAtTs,
        });
    }
    async fetchSnapshot(ctx) {
        if (ctx?.apiEndpoint !== undefined) {
            throw new Error('LIVE_FETCH_NOT_IMPLEMENTED_PATH_B: slurm');
        }
        return this.snapshot;
    }
    snapshotHash(snapshot) {
        return (0, topology_overlay_1.computeSnapshotHash)(snapshot);
    }
}
exports.SlurmTopologySource = SlurmTopologySource;
function parseSlurmTopologyConf(text, meta) {
    const declaredSwitches = new Set();
    const referencedSwitches = new Set();
    const leafNodes = new Set();
    const edges = [];
    const lines = text.split('\n');
    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
        const rawLine = lines[lineIdx].replace(/\r$/, '');
        const trimmed = rawLine.trim();
        if (trimmed === '' || trimmed.startsWith('#'))
            continue;
        const tokens = trimmed.split(/\s+/);
        const firstTok = tokens[0];
        if (!firstTok.startsWith('SwitchName=')) {
            throw new Error(`SLURM_TOPOLOGY_PARSE_ERROR: missing SwitchName on line ${lineIdx + 1}`);
        }
        const switchName = firstTok.slice('SwitchName='.length);
        if (switchName === '') {
            throw new Error(`SLURM_TOPOLOGY_PARSE_ERROR: empty SwitchName on line ${lineIdx + 1}`);
        }
        if (declaredSwitches.has(switchName)) {
            throw new Error(`SLURM_TOPOLOGY_PARSE_ERROR: duplicate SwitchName '${switchName}' on line ${lineIdx + 1}`);
        }
        declaredSwitches.add(switchName);
        for (let t = 1; t < tokens.length; t++) {
            const tok = tokens[t];
            if (tok.startsWith('Switches=')) {
                const csv = tok.slice('Switches='.length);
                if (csv === '') {
                    throw new Error(`SLURM_TOPOLOGY_PARSE_ERROR: empty value for 'Switches' on line ${lineIdx + 1}`);
                }
                const childNames = csv.split(',');
                for (const child of childNames) {
                    if (child === '') {
                        throw new Error(`SLURM_TOPOLOGY_PARSE_ERROR: empty token in 'Switches' on line ${lineIdx + 1}`);
                    }
                    if (!declaredSwitches.has(child))
                        referencedSwitches.add(child);
                    edges.push({ from: switchName, to: child, relationship: 'contains' });
                }
            }
            else if (tok.startsWith('Nodes=')) {
                const csv = tok.slice('Nodes='.length);
                if (csv === '') {
                    throw new Error(`SLURM_TOPOLOGY_PARSE_ERROR: empty value for 'Nodes' on line ${lineIdx + 1}`);
                }
                // Bracket-aware comma-split: split on top-level commas only.
                const hostlistTokens = splitTopLevelCommas(csv, lineIdx + 1);
                for (const hostlistTok of hostlistTokens) {
                    const leaves = expandSlurmHostlist(hostlistTok);
                    for (const leaf of leaves) {
                        leafNodes.add(leaf);
                        edges.push({ from: switchName, to: leaf, relationship: 'contains' });
                    }
                }
            }
            else {
                throw new Error(`SLURM_TOPOLOGY_PARSE_ERROR: unsupported clause '${tok}' on line ${lineIdx + 1}`);
            }
        }
    }
    // Cross-set inconsistency check (D8 tail).
    for (const name of leafNodes) {
        if (declaredSwitches.has(name) || referencedSwitches.has(name)) {
            throw new Error(`SLURM_TOPOLOGY_PARSE_ERROR: name '${name}' declared as both switch and node`);
        }
    }
    const nodes = [];
    for (const name of declaredSwitches)
        nodes.push({ id: name, service_name: name, kind: 'rack' });
    for (const name of referencedSwitches) {
        if (!declaredSwitches.has(name))
            nodes.push({ id: name, service_name: name, kind: 'rack' });
    }
    for (const name of leafNodes)
        nodes.push({ id: name, service_name: name, kind: 'gpu_shard' });
    return {
        nodes,
        edges,
        fetched_at_ts: meta.fetchedAtTs,
        source_id: meta.sourceId,
        source_version: meta.sourceVersion,
    };
}
function expandSlurmHostlist(hostlist) {
    const bracketStart = hostlist.indexOf('[');
    if (bracketStart === -1) {
        return [hostlist];
    }
    const bracketEnd = hostlist.indexOf(']');
    if (bracketEnd === -1 || bracketEnd < bracketStart) {
        throw new Error(`SLURM_TOPOLOGY_PARSE_ERROR: unclosed bracket in hostlist '${hostlist}'`);
    }
    // Multi-bracket out-of-scope (§ 1.2).
    if (hostlist.indexOf('[', bracketStart + 1) !== -1) {
        throw new Error(`SLURM_TOPOLOGY_PARSE_ERROR: multi-bracket hostlist out-of-scope '${hostlist}'`);
    }
    const prefix = hostlist.slice(0, bracketStart);
    const body = hostlist.slice(bracketStart + 1, bracketEnd);
    const suffix = hostlist.slice(bracketEnd + 1);
    if (suffix.indexOf(']') !== -1 || suffix.indexOf('[') !== -1) {
        throw new Error(`SLURM_TOPOLOGY_PARSE_ERROR: stray bracket in hostlist '${hostlist}'`);
    }
    const out = [];
    const subTokens = body.split(',');
    for (const sub of subTokens) {
        if (/^\d+$/.test(sub)) {
            out.push(prefix + sub + suffix);
        }
        else {
            const m = sub.match(/^(\d+)-(\d+)$/);
            if (!m) {
                throw new Error(`SLURM_TOPOLOGY_PARSE_ERROR: malformed range '${sub}' in hostlist '${hostlist}'`);
            }
            const startStr = m[1];
            const endStr = m[2];
            const start = parseInt(startStr, 10);
            const end = parseInt(endStr, 10);
            if (start > end) {
                throw new Error(`SLURM_TOPOLOGY_PARSE_ERROR: range start > end '${sub}' in hostlist '${hostlist}'`);
            }
            const padWidth = Math.max(startStr.length, endStr.length);
            for (let i = start; i <= end; i++) {
                out.push(prefix + String(i).padStart(padWidth, '0') + suffix);
            }
        }
    }
    return out;
}
function splitTopLevelCommas(csv, lineNumber) {
    const out = [];
    let depth = 0;
    let buf = '';
    for (const ch of csv) {
        if (ch === '[')
            depth++;
        else if (ch === ']')
            depth--;
        if (depth < 0) {
            throw new Error(`SLURM_TOPOLOGY_PARSE_ERROR: stray ']' in 'Nodes' on line ${lineNumber}`);
        }
        if (ch === ',' && depth === 0) {
            if (buf === '') {
                throw new Error(`SLURM_TOPOLOGY_PARSE_ERROR: empty token in 'Nodes' on line ${lineNumber}`);
            }
            out.push(buf);
            buf = '';
        }
        else {
            buf += ch;
        }
    }
    if (depth !== 0) {
        throw new Error(`SLURM_TOPOLOGY_PARSE_ERROR: unclosed bracket in 'Nodes' on line ${lineNumber}`);
    }
    if (buf === '') {
        throw new Error(`SLURM_TOPOLOGY_PARSE_ERROR: trailing comma in 'Nodes' on line ${lineNumber}`);
    }
    out.push(buf);
    return out;
}
//# sourceMappingURL=slurm-source.js.map
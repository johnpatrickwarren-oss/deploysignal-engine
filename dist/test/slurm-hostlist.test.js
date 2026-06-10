"use strict";
// test/slurm-hostlist.test.ts — remediation 2026-06-10 (M2).
//
// Slurm hostlist range expansion must match Slurm semantics: `node[1-10]`
// expands to node1 … node10 (no padding); zero-padding applies only when the
// range spec itself is written with leading zeros, e.g. `node[01-10]` →
// node01 … node10. The reviewed code padded to max(start,end) digit width
// unconditionally, producing node01…node10 for `[1-10]` — node IDs that match
// no real hostname, so attributeCommonMode silently skipped those hosts.
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const slurm_source_1 = require("../topology/slurm-source");
(0, node_test_1.test)('M2: [1-10] expands without zero-padding across the digit boundary', () => {
    strict_1.default.deepEqual((0, slurm_source_1.expandSlurmHostlist)('node[1-10]'), [
        'node1', 'node2', 'node3', 'node4', 'node5',
        'node6', 'node7', 'node8', 'node9', 'node10',
    ]);
});
(0, node_test_1.test)('M2: [01-10] preserves the written zero-padding', () => {
    strict_1.default.deepEqual((0, slurm_source_1.expandSlurmHostlist)('node[01-10]'), [
        'node01', 'node02', 'node03', 'node04', 'node05',
        'node06', 'node07', 'node08', 'node09', 'node10',
    ]);
});
(0, node_test_1.test)('M2: [08-12] pads to the start token width', () => {
    strict_1.default.deepEqual((0, slurm_source_1.expandSlurmHostlist)('node[08-12]'), [
        'node08', 'node09', 'node10', 'node11', 'node12',
    ]);
});
(0, node_test_1.test)('M2: singletons, commas, and suffixes unchanged', () => {
    strict_1.default.deepEqual((0, slurm_source_1.expandSlurmHostlist)('gpu[1,3,9-11]-nv'), [
        'gpu1-nv', 'gpu3-nv', 'gpu9-nv', 'gpu10-nv', 'gpu11-nv',
    ]);
    strict_1.default.deepEqual((0, slurm_source_1.expandSlurmHostlist)('plainhost'), ['plainhost']);
});
//# sourceMappingURL=slurm-hostlist.test.js.map
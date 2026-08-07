"use strict";
// test/group-average-e-value.test.ts — the group-average e-value (K2 candidate).
//
// Coverage matrix K2 = group-in-unison drift (validation/coverage/PREREGISTRATION.md §1, §5).
// groupAverageEValue composes K per-series terminal e-values (safe-t) into one group e-value: the
// arithmetic mean, which is itself an e-value under arbitrary dependence of the components
// (Vovk-Wang 2021 §4; ~/concord/knowledge/stats/pages/e-value.md "Combining e-values").
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const group_average_e_value_1 = require("../detectors/group-average-e-value");
(0, node_test_1.test)('mean: arithmetic mean of [2, 4] is 3', () => {
    const got = (0, group_average_e_value_1.groupAverageEValue)([2, 4]);
    strict_1.default.ok(Math.abs(got - 3) < 1e-9, `expected ~3, got ${got}`);
});
(0, node_test_1.test)('mean: matches the plain arithmetic mean on a larger, unequal set', () => {
    const vals = [1, 2, 3, 4, 5, 100];
    const want = vals.reduce((a, b) => a + b, 0) / vals.length;
    const got = (0, group_average_e_value_1.groupAverageEValue)(vals);
    strict_1.default.ok(Math.abs(got - want) < 1e-6 * Math.max(1, want), `expected ~${want}, got ${got}`);
});
(0, node_test_1.test)('mean: a single component is its own mean (identity)', () => {
    const got = (0, group_average_e_value_1.groupAverageEValue)([7]);
    strict_1.default.ok(Math.abs(got - 7) < 1e-9, `expected ~7, got ${got}`);
});
(0, node_test_1.test)('mean: a zero component pulls the mean down correctly', () => {
    const got = (0, group_average_e_value_1.groupAverageEValue)([0, 4]);
    strict_1.default.ok(Math.abs(got - 2) < 1e-9, `expected ~2, got ${got}`);
});
(0, node_test_1.test)('guards: throws on empty input', () => {
    strict_1.default.throws(() => (0, group_average_e_value_1.groupAverageEValue)([]), Error);
});
(0, node_test_1.test)('guards: throws on a negative component', () => {
    strict_1.default.throws(() => (0, group_average_e_value_1.groupAverageEValue)([1, -1]), Error);
});
(0, node_test_1.test)('guards: throws on a NaN component', () => {
    strict_1.default.throws(() => (0, group_average_e_value_1.groupAverageEValue)([1, NaN]), Error);
});
//# sourceMappingURL=group-average-e-value.test.js.map
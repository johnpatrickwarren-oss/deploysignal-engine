"use strict";
// test/adr-0008-multi-factor-common-mode.test.ts — ADR 0008 (productionises ADR 0007 frontier #2).
//
// The contamination-robust MULTI-FACTOR common-mode generalises the scalar center (ADR 0004 PR B) to
// HETEROGENEOUS factor loadings. Properties:
//   1. On a heterogeneous-loading fleet the SCALAR center FAILS (FDP ≫ q) but multi-factor controls
//      FDP ≤ q at power — the whole point.
//   2. On a homogeneous fleet it still controls FDP ≤ q (reduces toward the scalar center).
//   3. Breakdown: controlled at a minority fault fraction, degrades past it.
//   4. Guards.
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const multi_factor_common_mode_1 = require("../fleet/multi-factor-common-mode");
const common_mode_1 = require("../fleet/common-mode");
const nuisance_robust_bf_e_value_1 = require("../detectors/nuisance-robust-bf-e-value");
const e_bh_1 = require("../fleet/e-bh");
function lcg(seed) {
    let s = seed >>> 0;
    return () => { s = ((s * 1664525) + 1013904223) >>> 0; return s / 0x100000000; };
}
function gaussian(rng) {
    const u1 = Math.max(rng(), 1e-12), u2 = rng();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}
const N = 36, M = 280, NT = 120, T = M + NT, FONSET = M;
const BASE = 1000, DRIFT = 0.5, LVL = 10, NOISE = 2, RHO = 0.5, STEP = 5;
/** A factor-model fleet: shared random-walk factor F, per-shard loading λ_i (heterogeneous or 1),
 *  per-shard level + AR(1) noise, step fault on the first `mfail` shards from FONSET. */
function genFleet(seed, mfail, hetero) {
    const rng = lcg(seed);
    const f = () => gaussian(rng);
    const F = new Array(T).fill(0);
    for (let t = 1; t < T; t++)
        F[t] = F[t - 1] + DRIFT * f();
    const lam = Array.from({ length: N }, () => (hetero ? 0.2 + 1.6 * rng() : 1));
    const failed = Array.from({ length: N }, (_, i) => i < mfail);
    const X = [];
    for (let i = 0; i < N; i++) {
        const lvl = LVL * f();
        const row = new Array(T);
        let p = f();
        for (let t = 0; t < T; t++) {
            p = RHO * p + Math.sqrt(1 - RHO * RHO) * f();
            row[t] = BASE + lvl + lam[i] * F[t] + NOISE * p + (failed[i] && t >= FONSET ? STEP : 0);
        }
        X[i] = row;
    }
    return { X, failed };
}
const CAL = { start: 0, len: M }, TST = { start: M, len: NT };
const eValues = (R) => R.map((r) => (0, nuisance_robust_bf_e_value_1.nuisanceRobustBFEValue)(r, CAL, TST));
function fdpPower(R, failed, q) {
    const rej = (0, e_bh_1.eBenjaminiHochberg)(eValues(R), q).selected;
    const fp = rej.filter((i) => !failed[i]).length, tp = rej.filter((i) => failed[i]).length;
    const nf = failed.filter(Boolean).length;
    return { fdp: rej.length ? fp / rej.length : 0, power: nf ? tp / nf : 0 };
}
const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
// ── 1. Heterogeneous loadings — scalar FAILS, multi-factor controls FDP ≤ q at power. ──────────────
(0, node_test_1.test)('heterogeneous: scalar common-mode fails (FDP ≫ q) but multi-factor controls FDP ≤ q at power', () => {
    const TR = 18, q = 0.1, MFAIL = 4; // ~10% faults
    const scalar = [];
    const multi = [];
    for (let s = 0; s < TR; s++) {
        const { X, failed } = genFleet(1 + s * 53, MFAIL, true);
        scalar.push(fdpPower((0, common_mode_1.contaminationRobustResiduals)(X, M), failed, q));
        multi.push(fdpPower((0, multi_factor_common_mode_1.multiFactorRobustResiduals)(X, M), failed, q));
    }
    const scalarFDP = mean(scalar.map((r) => r.fdp));
    const multiFDP = mean(multi.map((r) => r.fdp)), multiPow = mean(multi.map((r) => r.power));
    strict_1.default.ok(scalarFDP > 0.3, `the scalar center must FAIL on heterogeneous loadings (FDP ${scalarFDP.toFixed(3)} ≫ q)`);
    strict_1.default.ok(multiFDP <= q + 0.02, `multi-factor FDP ${multiFDP.toFixed(3)} must be ≤ q=${q}`);
    strict_1.default.ok(multiPow >= 0.5, `multi-factor power ${multiPow.toFixed(3)} must stay usable`);
});
// ── 2. Homogeneous loadings — multi-factor still controls FDP ≤ q. ─────────────────────────────────
(0, node_test_1.test)('homogeneous: multi-factor still controls FDP ≤ q (it reduces toward the scalar center)', () => {
    const TR = 18, q = 0.1, MFAIL = 4;
    const multi = [];
    for (let s = 0; s < TR; s++) {
        const { X, failed } = genFleet(7 + s * 53, MFAIL, false);
        multi.push(fdpPower((0, multi_factor_common_mode_1.multiFactorRobustResiduals)(X, M), failed, q));
    }
    strict_1.default.ok(mean(multi.map((r) => r.fdp)) <= q + 0.02, `homogeneous multi-factor FDP must be ≤ q`);
    strict_1.default.ok(mean(multi.map((r) => r.power)) >= 0.5, 'homogeneous multi-factor power must stay usable');
});
// ── 3. Breakdown — controlled at a minority, lost past it. ─────────────────────────────────────────
(0, node_test_1.test)('breakpoint: FDP controlled at 10% faults, degrades by 40% (the minority-fault envelope)', () => {
    const TR = 14, q = 0.1;
    const fdpAt = (mfail) => {
        const rs = [];
        for (let s = 0; s < TR; s++) {
            const { X, failed } = genFleet(11 + s * 53, mfail, true);
            rs.push(fdpPower((0, multi_factor_common_mode_1.multiFactorRobustResiduals)(X, M), failed, q).fdp);
        }
        return mean(rs);
    };
    const low = fdpAt(4), high = fdpAt(15);
    strict_1.default.ok(low <= q + 0.02, `at 10% faults FDP ${low.toFixed(3)} must be ≤ q`);
    strict_1.default.ok(high > low, `at 40% faults FDP ${high.toFixed(3)} must degrade vs 10% (${low.toFixed(3)}) — the breakdown`);
});
// ── 4. The scree diagnostic — choosing `factors` (the r footgun is visible). ──────────────────────
(0, node_test_1.test)('scree: factorDeflationEnergy exposes the true factor count (1-factor data → an elbow after factor 1)', () => {
    // Single-factor heterogeneous fleet, no faults. Factor 1 should remove a large energy fraction; a
    // spurious factor 2 should drop to the noise floor — the elbow a consumer reads to set `factors`.
    const { X } = genFleet(2024, 0, true);
    const energy = (0, multi_factor_common_mode_1.factorDeflationEnergy)(X, M, 3);
    strict_1.default.equal(energy.length, 3);
    strict_1.default.ok(energy[0] > 0.5, `the single true factor must remove a large energy fraction; got ${energy[0].toFixed(3)}`);
    strict_1.default.ok(energy[1] < energy[0] / 3, `a spurious 2nd factor must drop sharply (elbow); ${energy[1].toFixed(3)} vs ${energy[0].toFixed(3)}`);
    strict_1.default.throws(() => (0, multi_factor_common_mode_1.factorDeflationEnergy)(X, M, N), RangeError, 'maxFactors >= n');
});
// ── 5. Guards. ────────────────────────────────────────────────────────────────────────────────────
(0, node_test_1.test)('guards: invalid matrix / calLen / factors throw RangeError', () => {
    strict_1.default.throws(() => (0, multi_factor_common_mode_1.multiFactorRobustResiduals)([], 5), RangeError, 'empty');
    strict_1.default.throws(() => (0, multi_factor_common_mode_1.multiFactorRobustResiduals)([[1, 2], [3]], 1), RangeError, 'ragged');
    strict_1.default.throws(() => (0, multi_factor_common_mode_1.multiFactorRobustResiduals)([[1, 2, NaN], [4, 5, 6]], 1), RangeError, 'non-finite');
    strict_1.default.throws(() => (0, multi_factor_common_mode_1.multiFactorRobustResiduals)([[1, 2, 3], [4, 5, 6]], 0), RangeError, 'calLen < 1');
    strict_1.default.throws(() => (0, multi_factor_common_mode_1.multiFactorRobustResiduals)([[1, 2, 3], [4, 5, 6]], 4), RangeError, 'calLen > ticks');
    strict_1.default.throws(() => (0, multi_factor_common_mode_1.multiFactorRobustResiduals)([[1, 2, 3], [4, 5, 6]], 2, { factors: 2 }), RangeError, 'factors >= n');
    strict_1.default.throws(() => (0, multi_factor_common_mode_1.multiFactorRobustResiduals)([[1, 2, 3], [4, 5, 6]], 2, { factors: 0 }), RangeError, 'factors < 1');
});
//# sourceMappingURL=adr-0008-multi-factor-common-mode.test.js.map
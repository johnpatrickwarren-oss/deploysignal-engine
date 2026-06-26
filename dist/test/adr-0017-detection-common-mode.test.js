"use strict";
// test/adr-0017-detection-common-mode.test.ts — ADR 0017, the detection-oriented common-mode.
//
// The FDP-oriented multi-factor common-mode (ADR 0008) ABSORBS a single-shard test-window fault into that
// shard's loading (it is collinear with the nonstationary factor), giving 0% detection (FAIR test, ADR 0016).
// The detection-oriented common-mode removes the CROSSED-domain common-mode by backfitting with the loading
// fit on the healthy REFERENCE window, so a test-window fault is PRESERVED. Properties asserted:
//   1. On a crossed-domain, heterogeneous-loading, nonstationary fleet it REMOVES the common-mode on healthy
//      shards (residual variance ≪ raw).
//   2. It PRESERVES a single-shard test-window step in the residual, where the full-loading multi-factor
//      common-mode ABSORBS it — the whole point.
//   3. Guards.
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const detection_common_mode_1 = require("../fleet/detection-common-mode");
const multi_factor_common_mode_1 = require("../fleet/multi-factor-common-mode");
function lcg(seed) {
    let s = seed >>> 0;
    return () => { s = ((s * 1664525) + 1013904223) >>> 0; return s / 0x100000000; };
}
function gaussian(rng) {
    const u1 = Math.max(rng(), 1e-12), u2 = rng();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}
// 48 shards over TWO CROSSED partitions: cooling domain = i % 4, power domain = i % 3 (gcd=1 ⇒ genuinely
// crossed). Each domain carries its own nonstationary factor (AR(1) + a ramp). Loadings are heterogeneous.
const N = 48, REF = 160, NT = 120, T = REF + NT, FONSET = REF;
const NCOOL = 4, NPOWER = 3, NOISE = 1, RHO = 0.6, STEP = 8;
const coolOf = (i) => i % NCOOL;
const powerOf = (i) => i % NPOWER;
function genFleet(seed, victim) {
    const rng = lcg(seed);
    const g = () => gaussian(rng);
    // per-domain nonstationary factors: AR(1) innovations + a per-domain linear ramp.
    const mkFactor = (rampPerT) => {
        const f = new Array(T).fill(0);
        let p = g();
        for (let tt = 0; tt < T; tt++) {
            p = RHO * p + Math.sqrt(1 - RHO * RHO) * g();
            f[tt] = p + rampPerT * tt;
        }
        return f;
    };
    const cool = Array.from({ length: NCOOL }, (_, d) => mkFactor(0.03 * (d + 1)));
    const power = Array.from({ length: NPOWER }, (_, e) => mkFactor(-0.02 * (e + 1)));
    const X = [];
    for (let i = 0; i < N; i++) {
        const lvl = 5 * g();
        const lamCool = 0.4 + 1.2 * rng(); // heterogeneous loadings
        const lamPower = 0.4 + 1.2 * rng();
        const fc = cool[coolOf(i)], fp = power[powerOf(i)];
        const row = new Array(T);
        for (let tt = 0; tt < T; tt++) {
            row[tt] = lvl + lamCool * fc[tt] + lamPower * fp[tt] + NOISE * g()
                + (i === victim && tt >= FONSET ? STEP : 0);
        }
        X[i] = row;
    }
    return { X };
}
const partitions = () => {
    const cool = Array.from({ length: N }, (_, i) => coolOf(i));
    const power = Array.from({ length: N }, (_, i) => powerOf(i));
    return [cool, power];
};
const mean = (r, a, b) => {
    let s = 0;
    for (let i = a; i < b; i++)
        s += r[i];
    return s / (b - a);
};
const sd = (r, a, b) => {
    const m = mean(r, a, b);
    let s = 0;
    for (let i = a; i < b; i++)
        s += (r[i] - m) ** 2;
    return Math.sqrt(s / (b - a));
};
const median = (xs) => { const s = [...xs].sort((p, q) => p - q); return s[s.length >> 1]; };
const residShift = (r) => mean(r, FONSET, T) - mean(r, 0, REF);
(0, node_test_1.test)('detection common-mode: removes crossed-domain common-mode on healthy shards', () => {
    const { X } = genFleet(7, -1); // no fault
    const R = (0, detection_common_mode_1.detectionOrientedResiduals)(X, REF, partitions(), { iterations: 4, loadLen: REF });
    // residual variance must be a small fraction of the raw (level-removed) variance — common-mode gone.
    const ratios = [];
    for (let i = 0; i < N; i++) {
        const rawSd = sd(X[i], 0, T); // raw includes the big common-mode swing
        const resSd = sd(R[i], 0, T);
        ratios.push(resSd / rawSd);
    }
    const medRatio = median(ratios);
    strict_1.default.ok(medRatio < 0.5, `expected residual/raw sd ratio < 0.5 (common-mode removed); got ${medRatio.toFixed(3)}`);
});
(0, node_test_1.test)('detection common-mode: PRESERVES a single-shard fault that the FDP-oriented common-mode ABSORBS', () => {
    const victim = 17;
    let detPreserve = 0, mfPreserve = 0, healthyFp = 0, nSeeds = 0;
    for (let seed = 1; seed <= 5; seed++) {
        const { X } = genFleet(seed, victim);
        const Rdet = (0, detection_common_mode_1.detectionOrientedResiduals)(X, REF, partitions(), { iterations: 4, loadLen: REF });
        const Rmf = (0, multi_factor_common_mode_1.multiFactorRobustResiduals)(X, REF, { factors: 2 }); // full-loading, FDP-oriented
        detPreserve += residShift(Rdet[victim]);
        mfPreserve += residShift(Rmf[victim]);
        // a healthy shard's residual shift should stay small under the detection common-mode
        healthyFp += Math.abs(residShift(Rdet[victim === 0 ? 1 : 0]));
        nSeeds++;
    }
    detPreserve /= nSeeds;
    mfPreserve /= nSeeds;
    healthyFp /= nSeeds;
    // 1. The detection common-mode keeps most of the STEP in the residual.
    strict_1.default.ok(detPreserve > 0.55 * STEP, `detection common-mode should preserve the fault (> ${(0.55 * STEP).toFixed(1)}); got ${detPreserve.toFixed(2)}`);
    // 2. The full-loading common-mode absorbs most of it.
    strict_1.default.ok(mfPreserve < 0.5 * STEP, `full-loading common-mode should absorb the fault (< ${(0.5 * STEP).toFixed(1)}); got ${mfPreserve.toFixed(2)}`);
    // 3. Detection-oriented preserves materially more signal than the FDP-oriented one (the whole point).
    strict_1.default.ok(detPreserve > 2 * mfPreserve, `detection should preserve ≫ FDP-oriented; det=${detPreserve.toFixed(2)} mf=${mfPreserve.toFixed(2)}`);
    // 4. A healthy shard stays near zero (fault is localised, not smeared).
    strict_1.default.ok(healthyFp < 0.4 * detPreserve, `healthy shard residual shift should stay small; got ${healthyFp.toFixed(2)} vs victim ${detPreserve.toFixed(2)}`);
});
(0, node_test_1.test)('detection common-mode: guards', () => {
    const X = genFleet(1, -1).X;
    const P = partitions();
    strict_1.default.throws(() => (0, detection_common_mode_1.detectionOrientedResiduals)([], REF, P), /at least one shard/);
    strict_1.default.throws(() => (0, detection_common_mode_1.detectionOrientedResiduals)(X, 0, P), /calLen must be an integer/);
    strict_1.default.throws(() => (0, detection_common_mode_1.detectionOrientedResiduals)(X, REF, P, { iterations: 0 }), /iterations must be a positive integer/);
    strict_1.default.throws(() => (0, detection_common_mode_1.detectionOrientedResiduals)(X, REF, P, { loadLen: T + 1 }), /loadLen must be an integer/);
    strict_1.default.throws(() => (0, detection_common_mode_1.detectionOrientedResiduals)(X, REF, []), /at least one factor partition/);
    strict_1.default.throws(() => (0, detection_common_mode_1.detectionOrientedResiduals)(X, REF, [[0, 1, 2]]), /expected one label per shard/);
    const ragged = X.map((r, i) => (i === 3 ? r.slice(0, T - 1) : r));
    strict_1.default.throws(() => (0, detection_common_mode_1.detectionOrientedResiduals)(ragged, REF, P), /ragged matrix/);
});
//# sourceMappingURL=adr-0017-detection-common-mode.test.js.map
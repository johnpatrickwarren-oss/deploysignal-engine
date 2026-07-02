"use strict";
// test/adr-0022-loo-small-domain-factors.test.ts — ADR 0022, leave-one-shard-out factors for
// small domains in the detection-oriented common-mode (2026-07-02 math audit, finding F11).
//
// DEFECT (pre-ADR-0022): the domain factor was a robust location over ALL members including the
// evaluated shard. For a 2-member domain that is the pair AVERAGE, so a faulty member half-self-
// absorbed its own step and mirrored −step/2 onto its healthy sibling. Locked here:
//   1. 2-member domain: under LOO the faulty member's residual carries ~the FULL step (the old
//      all-members path, replicated in-test, keeps only ~half). The healthy sibling carries the
//      documented mirrored PAIR CONTRAST (intrinsic — see the file-header honesty note; it is
//      locked here so a silent construction change is caught).
//   2. 3-member analog: faulty member fully exposed; healthy members' mirror share is bounded and
//      strictly below the faulty member.
//   3. 5-member domain: healthy members stay clean (the LOO Tukey center over >= 3 others rejects
//      the single faulty sibling).
//   4. A domain larger than LOO_MAX_MEMBERS is numerically IDENTICAL to the all-members path
//      (replicated in-test, compared with deepStrictEqual).
//   5. Crossed small+large partitions: small-domain members still get the large-domain factor
//      removed.
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const detection_common_mode_1 = require("../fleet/detection-common-mode");
const common_mode_1 = require("../fleet/common-mode");
const multi_factor_common_mode_1 = require("../fleet/multi-factor-common-mode");
function lcg(seed) {
    let s = seed >>> 0;
    return () => { s = ((s * 1664525) + 1013904223) >>> 0; return s / 0x100000000; };
}
function gaussian(rng) {
    const u1 = Math.max(rng(), 1e-12), u2 = rng();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}
const REF = 160, NT = 120, T = REF + NT, STEP = 8, RHO = 0.6;
/** n members sharing one AR(1) factor; member `faulty` gets a +STEP at t >= REF. */
function genDomain(seed, n, faulty, lams) {
    const rng = lcg(seed);
    const g = () => gaussian(rng);
    const F = new Array(T);
    {
        let p = g();
        for (let t = 0; t < T; t++) {
            p = RHO * p + Math.sqrt(1 - RHO * RHO) * g();
            F[t] = p;
        }
    }
    const X = [];
    for (let i = 0; i < n; i++) {
        const row = new Array(T);
        for (let t = 0; t < T; t++)
            row[t] = lams[i] * F[t] + g() + (i === faulty && t >= REF ? STEP : 0);
        X.push(row);
    }
    return X;
}
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
const shift = (r) => mean(r, REF, T) - mean(r, 0, REF);
const singleDomain = (n) => [Array.from({ length: n }, () => 0)];
/** Faithful replica of the PRE-ADR-0022 all-members path for ONE single-partition domain:
 *  level-remove, then `iterations` sweeps of (factor over ALL members' current residuals →
 *  degeneracy guard → per-member reference-window robustSlope → subtract). Byte-for-byte the
 *  operation order of `deflate(idxs, idxs)` in fleet/detection-common-mode.ts. */
function oldAllMembersResiduals(X, calLen, iterations) {
    const n = X.length, t = X[0].length, loadLen = calLen;
    const R = X.map((row) => { const lvl = (0, multi_factor_common_mode_1.median)(row.slice(0, calLen)); return row.map((v) => v - lvl); });
    const F = new Array(t);
    const col = [];
    const refRow = new Array(loadLen);
    const fRef = new Array(loadLen);
    for (let it = 0; it < iterations; it++) {
        let refE = 0, fullE = 0;
        for (let j = 0; j < t; j++) {
            col.length = 0;
            for (let i = 0; i < n; i++)
                col.push(R[i][j]);
            F[j] = (0, common_mode_1.robustLocation)(col);
            const f2 = F[j] * F[j];
            fullE += f2;
            if (j < loadLen) {
                fRef[j] = F[j];
                refE += f2;
            }
        }
        if (refE <= 1e-12 || refE < 1e-6 * fullE)
            continue;
        for (let i = 0; i < n; i++) {
            for (let j = 0; j < loadLen; j++)
                refRow[j] = R[i][j];
            const lam = (0, multi_factor_common_mode_1.robustSlope)(fRef, refRow);
            for (let j = 0; j < t; j++)
                R[i][j] -= lam * F[j];
        }
    }
    return R;
}
(0, node_test_1.test)('ADR 0022: LOO_MAX_MEMBERS is exported and equals 5', () => {
    strict_1.default.equal(detection_common_mode_1.LOO_MAX_MEMBERS, 5);
});
(0, node_test_1.test)('ADR 0022: 2-member domain — fault fully exposed (was half-absorbed); sibling mirror is the pair contrast', () => {
    const seeds = [1, 2, 3, 4, 5, 6, 7, 8];
    let newFaulty = 0, oldFaulty = 0, oldHealthy = 0, newHealthyAbs = 0;
    for (const seed of seeds) {
        const X = genDomain(seed, 2, 0, [1, 1]);
        const Rnew = (0, detection_common_mode_1.detectionOrientedResiduals)(X, REF, singleDomain(2), { iterations: 4, loadLen: REF });
        const Rold = oldAllMembersResiduals(X, REF, 4);
        newFaulty += shift(Rnew[0]);
        oldFaulty += shift(Rold[0]);
        newHealthyAbs += Math.abs(shift(Rnew[1]));
        oldHealthy += shift(Rold[1]);
    }
    newFaulty /= seeds.length;
    oldFaulty /= seeds.length;
    newHealthyAbs /= seeds.length;
    oldHealthy /= seeds.length;
    // (a) The faulty member carries ~the FULL step under LOO — it cannot move the reference it is
    //     compared against (the old path half-self-absorbed: factor = pair average).
    strict_1.default.ok(newFaulty >= 0.85 * STEP, `LOO faulty residual must carry ~the full step (>= ${(0.85 * STEP).toFixed(1)}); got ${newFaulty.toFixed(2)}`);
    strict_1.default.ok(oldFaulty <= 0.6 * STEP, `old all-members path half-absorbs (<= ${(0.6 * STEP).toFixed(1)}); got ${oldFaulty.toFixed(2)}`);
    strict_1.default.ok(oldHealthy <= -0.3 * STEP, `old all-members path mirrors ~-step/2 onto the sibling; got ${oldHealthy.toFixed(2)}`);
    strict_1.default.ok(newFaulty > 1.5 * oldFaulty, `LOO must expose materially more of the fault than the old path; new=${newFaulty.toFixed(2)} old=${oldFaulty.toFixed(2)}`);
    // (b) HONESTY LOCK (adapted from the ADR 0022 spec): the sibling's residual is a pure PAIR
    //     CONTRAST, so it necessarily carries a mirrored share of the fault (any repair of the
    //     mirror algebraically reconstructs the undeflated series — file header, honesty note).
    //     Lock that the mirror is present-but-bounded and stays BELOW the faulty member, so
    //     magnitude ranking still points at the faulty member; a future change that silently
    //     alters this trade-off must fail here and revisit the docs.
    strict_1.default.ok(newHealthyAbs > 0.15 * STEP && newHealthyAbs < 0.8 * STEP, `documented pair-contrast mirror expected in (${(0.15 * STEP).toFixed(1)}, ${(0.8 * STEP).toFixed(1)}); got ${newHealthyAbs.toFixed(2)}`);
    strict_1.default.ok(newHealthyAbs < 0.75 * newFaulty, `mirror must stay below the faulty member (ranking preserved); healthy=${newHealthyAbs.toFixed(2)} faulty=${newFaulty.toFixed(2)}`);
});
(0, node_test_1.test)('ADR 0022: 3-member domain — faulty member fully exposed; healthy members below the faulty', () => {
    const seeds = [1, 2, 3, 4, 5, 6, 7, 8];
    let newFaulty = 0, oldFaulty = 0, healthyAbs = 0;
    for (const seed of seeds) {
        const X = genDomain(seed, 3, 0, [1, 1, 1]);
        const Rnew = (0, detection_common_mode_1.detectionOrientedResiduals)(X, REF, singleDomain(3), { iterations: 4, loadLen: REF });
        const Rold = oldAllMembersResiduals(X, REF, 4);
        newFaulty += shift(Rnew[0]);
        oldFaulty += shift(Rold[0]);
        healthyAbs += (Math.abs(shift(Rnew[1])) + Math.abs(shift(Rnew[2]))) / 2;
    }
    newFaulty /= seeds.length;
    oldFaulty /= seeds.length;
    healthyAbs /= seeds.length;
    strict_1.default.ok(newFaulty >= 0.9 * STEP, `LOO faulty residual must carry ~the full step (>= ${(0.9 * STEP).toFixed(1)}); got ${newFaulty.toFixed(2)}`);
    strict_1.default.ok(newFaulty >= oldFaulty, `LOO must not expose less than the old path; new=${newFaulty.toFixed(2)} old=${oldFaulty.toFixed(2)}`);
    // The 2-point LOO center for a healthy member (faulty + healthy sibling) cannot reject the
    // faulty one, so a bounded mirror share remains (documented); it stays well below the faulty.
    strict_1.default.ok(healthyAbs < 0.5 * STEP, `healthy members' mirror share must stay < ${(0.5 * STEP).toFixed(1)}; got ${healthyAbs.toFixed(2)}`);
    strict_1.default.ok(healthyAbs < 0.5 * newFaulty, `healthy members must rank clearly below the faulty; healthy=${healthyAbs.toFixed(2)} faulty=${newFaulty.toFixed(2)}`);
});
(0, node_test_1.test)('ADR 0022: 5-member domain — healthy members stay clean (LOO Tukey center rejects the faulty sibling)', () => {
    const seeds = [1, 2, 3, 4, 5, 6, 7, 8];
    let newFaulty = 0, healthyMax = 0;
    for (const seed of seeds) {
        const X = genDomain(seed, 5, 0, [1.2, 0.8, 1.0, 0.6, 1.4]);
        const R = (0, detection_common_mode_1.detectionOrientedResiduals)(X, REF, singleDomain(5), { iterations: 4, loadLen: REF });
        newFaulty += shift(R[0]);
        for (let i = 1; i < 5; i++)
            healthyMax = Math.max(healthyMax, Math.abs(shift(R[i])));
    }
    newFaulty /= seeds.length;
    strict_1.default.ok(newFaulty >= 0.85 * STEP, `faulty must carry ~the full step; got ${newFaulty.toFixed(2)}`);
    strict_1.default.ok(healthyMax < 0.15 * STEP, `with >= 3 other members the LOO Tukey center rejects the faulty sibling — healthy members clean (< ${(0.15 * STEP).toFixed(1)}); got ${healthyMax.toFixed(2)}`);
});
(0, node_test_1.test)('ADR 0022: a domain larger than LOO_MAX_MEMBERS is numerically identical to the all-members path', () => {
    const n = detection_common_mode_1.LOO_MAX_MEMBERS + 2; // 7 members: strictly above the LOO cutoff
    const X = genDomain(42, n, 2, [1.1, 0.7, 1.0, 0.9, 1.3, 0.6, 1.2]);
    const got = (0, detection_common_mode_1.detectionOrientedResiduals)(X, REF, singleDomain(n), { iterations: 4, loadLen: REF });
    const want = oldAllMembersResiduals(X, REF, 4);
    strict_1.default.deepEqual(got, want, 'domains above LOO_MAX_MEMBERS must keep the exact pre-ADR-0022 numerics');
});
(0, node_test_1.test)('ADR 0022: crossed small+large partitions — small-domain members still shed the large-domain factor', () => {
    // 12 shards: partition A = one 12-member domain (kept on the iterated all-members path),
    // partition B = six 2-member pairs (post-loop LOO). No fault: residuals must lose the
    // common-mode of BOTH partitions.
    const n = 12;
    const rng = lcg(77);
    const g = () => gaussian(rng);
    const mkF = () => {
        const f = new Array(T);
        let p = g();
        for (let t = 0; t < T; t++) {
            p = RHO * p + Math.sqrt(1 - RHO * RHO) * g();
            f[t] = 2 * p;
        }
        return f;
    };
    const big = mkF();
    const pairF = Array.from({ length: n / 2 }, () => mkF());
    const X = [];
    for (let i = 0; i < n; i++) {
        const lamA = 0.6 + 0.8 * rng(), lamB = 0.6 + 0.8 * rng();
        const row = new Array(T);
        for (let t = 0; t < T; t++)
            row[t] = lamA * big[t] + lamB * pairF[i >> 1][t] + g();
        X.push(row);
    }
    const partitions = [
        Array.from({ length: n }, () => 0), // one large domain
        Array.from({ length: n }, (_, i) => i >> 1), // six 2-member pairs
    ];
    const R = (0, detection_common_mode_1.detectionOrientedResiduals)(X, REF, partitions, { iterations: 4, loadLen: REF });
    const ratios = Array.from({ length: n }, (_, i) => sd(R[i], 0, T) / sd(X[i], 0, T)).sort((a, b) => a - b);
    const medRatio = ratios[n >> 1];
    strict_1.default.ok(medRatio < 0.6, `crossed small+large common-mode must be removed (median residual/raw sd < 0.6); got ${medRatio.toFixed(3)}`);
});
//# sourceMappingURL=adr-0022-loo-small-domain-factors.test.js.map
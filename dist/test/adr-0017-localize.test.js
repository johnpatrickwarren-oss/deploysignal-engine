"use strict";
// test/adr-0017-localize.test.ts — the topology-localised fault-detection path (ADR 0016/0017).
//
// localizeFaults composes: detection-oriented common-mode → per-shard UI e-value → topology-PARTITIONED
// e-BH. End-to-end, on a crossed-domain, heterogeneous-loading, nonstationary fleet, it should LOCALISE a
// single-shard test-window fault (flag the victim, keep healthy false-positives low) — the path the FDP
// pipeline cannot, because its common-mode absorbs the fault. Properties:
//   1. Localises a single-shard fault FAR more often than a healthy shard, at controlled FP.
//   2. Result structure is consistent (per-shard e-values, by-group selections ⊆ groups).
//   3. Guards.
//
// TOPOLOGY (mirrors the FAIR per-rack regime, ADR 0016). 12 racks × 10 GPUs = 120 shards. A rack is NESTED in
// one cooling domain (rack%3) and one power domain (rack%4), so shards in a rack share BOTH coarse factors —
// the within-rack contrast is clean once the common-mode is removed. Localising per RACK (not per common-mode
// domain) is what keeps the false-positive rate low.
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const localize_1 = require("../fleet/localize");
function lcg(seed) {
    let s = seed >>> 0;
    return () => { s = ((s * 1664525) + 1013904223) >>> 0; return s / 0x100000000; };
}
function gaussian(rng) {
    const u1 = Math.max(rng(), 1e-12), u2 = rng();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}
const RACKS = 10, PER_RACK = 16, N = RACKS * PER_RACK;
const REF = 160, NT = 120, T = REF + NT, FONSET = REF;
const NCOOL = 3, NPOWER = 4, NOISE = 1, RHO = 0.6, STEP = 12;
// NOTE. The trustworthy output is the RANKING (perShardEValue): victims are enriched ~7× over healthy. The
// e-BH `selected` set is NOT a certified fault list — measured at scale (ADR 0016/0017, 2.9k–5.8k GPUs, ~1%
// faults) FDP ≈ 93% (low FPR ≠ low FDP at rare-fault density; the data-dependent residual voids the e-BH
// theorem). So this test asserts the localisation SIGNAL (victim selected ≫ a healthy shard) — NOT FDP/precision,
// which is poor by design and validated separately. For large fleets only; small fleets → DCGM.
const rackOf = (i) => Math.floor(i / PER_RACK);
const coolOf = (i) => rackOf(i) % NCOOL;
const powerOf = (i) => rackOf(i) % NPOWER;
function genFleet(seed, victim) {
    const rng = lcg(seed);
    const g = () => gaussian(rng);
    const mkFactor = (rampPerT) => {
        const f = new Array(T).fill(0);
        let p = g();
        for (let tt = 0; tt < T; tt++) {
            p = RHO * p + Math.sqrt(1 - RHO * RHO) * g();
            f[tt] = p + rampPerT * tt;
        }
        return f;
    };
    const cool = Array.from({ length: NCOOL }, (_, d) => mkFactor(0.012 * (d + 1)));
    const power = Array.from({ length: NPOWER }, (_, e) => mkFactor(-0.009 * (e + 1)));
    const X = [];
    for (let i = 0; i < N; i++) {
        const lvl = 5 * g();
        const lamCool = 0.4 + 1.2 * rng(), lamPower = 0.4 + 1.2 * rng();
        const fc = cool[coolOf(i)], fp = power[powerOf(i)];
        const row = new Array(T);
        for (let tt = 0; tt < T; tt++) {
            row[tt] = lvl + lamCool * fc[tt] + lamPower * fp[tt] + NOISE * g() + (i === victim && tt >= FONSET ? STEP : 0);
        }
        X[i] = row;
    }
    return X;
}
const factorPartitions = () => [
    Array.from({ length: N }, (_, i) => coolOf(i)),
    Array.from({ length: N }, (_, i) => powerOf(i)),
];
const racks = () => Array.from({ length: N }, (_, i) => rackOf(i));
const cal = { start: 0, len: 60 }, tst = { start: FONSET, len: NT };
(0, node_test_1.test)('localize: flags a single-shard fault FAR more often than a healthy shard (signal ≫ noise)', () => {
    // The detection-oriented common-mode is an honestly WEAK improvement (~40% recall, ADR 0017) — not reliable
    // recall, but a clear localisation SIGNAL: the victim is selected far more than a healthy shard, at low FP,
    // in the clean per-rack regime. Aggregate over several victims × seeds for a stable estimate.
    const victims = [8, 88, 152]; // distinct racks
    let hits = 0, instances = 0, healthySel = 0, healthyTot = 0;
    for (let seed = 1; seed <= 3; seed++) {
        for (const victim of victims) {
            const X = genFleet(seed, victim);
            const r = (0, localize_1.localizeFaults)({
                X, referenceLen: REF, cal, test: tst,
                factorPartitions: factorPartitions(), localizationGroups: racks(),
                qLevel: 0.1, commonMode: { iterations: 4, loadLen: REF },
            });
            if (r.selected.includes(victim))
                hits++;
            instances++;
            for (let i = 0; i < N; i++) {
                if (i === victim)
                    continue;
                healthyTot++;
                if (r.selected.includes(i))
                    healthySel++;
            }
        }
    }
    const detRate = hits / instances, fpRate = healthySel / healthyTot;
    // Wiring + signal bars (absolute FP control is group-size-dependent — see the NOTE above; validated large-
    // scale in ADR 0016). The victim must be localised most of the time, and far more often than a healthy shard.
    strict_1.default.ok(detRate >= 0.6, `should localise the fault most of the time; got ${(detRate * 100).toFixed(0)}%`);
    strict_1.default.ok(detRate >= 2 * fpRate, `detection should be ≫ healthy FP rate; det=${(detRate * 100).toFixed(0)}% fp=${(fpRate * 100).toFixed(1)}%`);
});
(0, node_test_1.test)('localize: result structure is consistent', () => {
    const X = genFleet(3, 25);
    const r = (0, localize_1.localizeFaults)({
        X, referenceLen: REF, cal, test: tst,
        factorPartitions: factorPartitions(), localizationGroups: racks(), qLevel: 0.1,
    });
    strict_1.default.equal(r.perShardEValue.length, N);
    strict_1.default.ok(r.perShardEValue.every((e) => Number.isFinite(e) && e >= 0));
    const fromGroups = [...r.byGroup.values()].flat().sort((a, b) => a - b);
    strict_1.default.deepEqual(r.selected, fromGroups);
    const grp = racks();
    for (const [g, idxs] of r.byGroup)
        for (const i of idxs)
            strict_1.default.equal(grp[i], g);
});
(0, node_test_1.test)('localize: guards', () => {
    const X = genFleet(1, -1);
    const P = factorPartitions(), G = racks();
    strict_1.default.throws(() => (0, localize_1.localizeFaults)({ X: [], referenceLen: REF, cal, test: tst, factorPartitions: P, localizationGroups: G, qLevel: 0.1 }), /at least one shard/);
    strict_1.default.throws(() => (0, localize_1.localizeFaults)({ X, referenceLen: REF, cal, test: tst, factorPartitions: P, localizationGroups: G, qLevel: 0 }), /qLevel must be in/);
    strict_1.default.throws(() => (0, localize_1.localizeFaults)({ X, referenceLen: REF, cal, test: tst, factorPartitions: P, localizationGroups: [0, 1, 2], qLevel: 0.1 }), /one label per shard/);
});
//# sourceMappingURL=adr-0017-localize.test.js.map
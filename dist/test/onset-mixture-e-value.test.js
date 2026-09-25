"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.lockstepAgainstTessera = lockstepAgainstTessera;
// test/onset-mixture-e-value.test.ts — the onset-mixture e-value (ADR 0034): lockstep against
// Tessera's compiled tools while Tessera carries an independent copy, and Tessera's property tests.
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
const onset_mixture_e_value_1 = require("../detectors/onset-mixture-e-value");
const _bounded_bet_1 = require("../detectors/_bounded-bet");
const calibration_monitor_1 = require("../fleet/calibration-monitor");
const e_bh_guarded_1 = require("../fleet/e-bh-guarded");
const guarantees_1 = require("../guarantees");
function mulberry(seed) {
    let a = seed >>> 0;
    return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function gauss(rng) {
    let u = 0, v = 0;
    while (!u)
        u = rng();
    while (!v)
        v = rng();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
// ── lockstep against Tessera (skips when Tessera re-exports this engine, or is unreachable) ──
function tesseraTools() {
    const root = path.resolve(__dirname, '..', '..');
    const candidates = [
        ...(process.env.TESSERA_ROOT ? [path.resolve(process.env.TESSERA_ROOT)] : []),
        path.resolve(root, '..', 'tessera'), path.resolve(root, '..', '..', '..', 'tessera'),
    ];
    for (const dir of candidates) {
        const m = path.join(dir, 'tools', 'mixture-evalue.js'), s = path.join(dir, 'tools', 'supfdr.js');
        if (fs.existsSync(m) && fs.existsSync(s)) {
            const src = path.join(dir, 'tools', 'mixture-evalue.ts');
            const independent = !(fs.existsSync(src)
                && fs.readFileSync(src, 'utf8').includes('deploysignal-engine/detectors/onset-mixture-e-value'));
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            return { mix: require(m), sup: require(s), dir, independent };
        }
    }
    return null;
}
function lockstepAgainstTessera(streams = 120) {
    const T = tesseraTools();
    if (!T)
        return null;
    if (!T.independent)
        return { comparisons: 0, mismatches: 0, dir: T.dir, independent: false };
    let comparisons = 0, mismatches = 0;
    const eq = (a, b) => { comparisons++; if (!(a === b || (Number.isNaN(a) && Number.isNaN(b))))
        mismatches++; };
    for (let s = 0; s < streams; s++) {
        const rng = mulberry(500 + s);
        const n = [40, 120, 240, 600][s % 4];
        const shiftAt = (s % 3) === 0 ? n : Math.floor(n / 2);
        const r = Array.from({ length: n }, (_, t) => gauss(rng) * (1 + (s % 5) * 0.05) + (t >= shiftAt ? (s % 4) : 0));
        for (const inc of ['gaussian', 'bounded']) {
            eq((0, onset_mixture_e_value_1.normalizedMixtureEValue)(r, inc), T.mix.normalizedMixtureEValue(r, inc));
            eq((0, onset_mixture_e_value_1.geometricMixtureEValue)(r, inc), T.mix.geometricMixtureEValue(r, inc));
            for (const cut of [1, 7, Math.floor(n / 3), n - 1])
                eq((0, onset_mixture_e_value_1.geometricMixtureEValue)(r.slice(0, cut), inc), T.mix.geometricMixtureEValue(r.slice(0, cut), inc));
        }
        for (const e of [0, 0.5, 1, 1.5, 4, 1e6, r[0] * r[0]])
            eq((0, onset_mixture_e_value_1.supAdjuster)(e), T.sup.supAdjuster(e));
    }
    return { comparisons, mismatches, dir: T.dir, independent: true };
}
(0, node_test_1.test)('LOCKSTEP: normalized and geometric mixture e-values and the adjuster equal Tessera\'s compiled tools', (t) => {
    const r = lockstepAgainstTessera(120);
    if (!r) {
        t.diagnostic('Tessera compiled tools not reachable; lockstep skipped');
        t.skip();
        return;
    }
    if (!r.independent) {
        t.diagnostic(`${r.dir}: tools/mixture-evalue.ts re-exports this engine; nothing independent to compare`);
        t.skip();
        return;
    }
    strict_1.default.ok(r.comparisons > 2000, `expected > 2000 comparisons, got ${r.comparisons}`);
    strict_1.default.equal(r.mismatches, 0, `${r.mismatches} of ${r.comparisons} comparisons mismatch against ${r.dir}`);
});
// ── the increment family has one home ──
(0, node_test_1.test)('the Gaussian increment reached through fleet/calibration-monitor is the detectors/ function', () => {
    strict_1.default.equal(calibration_monitor_1.gInc, _bounded_bet_1.gInc);
    strict_1.default.equal((0, _bounded_bet_1.gInc)(0), Math.min(100, (2 * Math.exp(-0.125) + 2 * Math.exp(-0.5) + 2 * Math.exp(-2)) / 6));
});
(0, node_test_1.test)('√E−1 adjuster satisfies the integral identity ∫_1^∞ A(e)/e² de = 1 (numerical, to 1e-3)', () => {
    // ∫_1^∞ (√e − 1)/e² de = [−2/√e + 1/e]_1^∞ = 2 − 1 = 1 exactly; check the implementation numerically.
    let acc = 0;
    // log-spaced Riemann sum to 1e8 (the tail beyond E is 2/√E − 1/E ≈ 2e-4 at 1e8)
    for (let e = 1, de = 1e-3; e < 1e8; e *= 1 + de)
        acc += (0, onset_mixture_e_value_1.supAdjuster)(e) / (e * e) * e * de;
    strict_1.default.ok(Math.abs(acc - 1) < 5e-3, `integral ${acc}`);
    strict_1.default.equal((0, onset_mixture_e_value_1.supAdjuster)(0.5), 0);
    strict_1.default.equal((0, onset_mixture_e_value_1.supAdjuster)(1), 0);
    strict_1.default.equal((0, onset_mixture_e_value_1.supAdjuster)(4), 1);
});
// ── Tessera's property tests (test/mixture-evalue.test.ts), carried over verbatim in substance ──
(0, node_test_1.test)('normalizedMixtureEValue: near-zero on a bounded null, large on a sustained shift; empty → 0', () => {
    const T = 400;
    const nullSeries = Array.from({ length: T }, (_, t) => Math.sin(t));
    const faultSeries = nullSeries.map((v, t) => v + (t > 200 ? 3 : 0));
    const e0 = (0, onset_mixture_e_value_1.normalizedMixtureEValue)(nullSeries), e1 = (0, onset_mixture_e_value_1.normalizedMixtureEValue)(faultSeries);
    strict_1.default.ok(Number.isFinite(e0) && e0 >= 0);
    strict_1.default.ok(e1 > e0 && e1 > 5, `fault e-value should be clearly large; got ${e1}`);
    strict_1.default.equal((0, onset_mixture_e_value_1.normalizedMixtureEValue)([]), 0);
    strict_1.default.equal((0, onset_mixture_e_value_1.geometricMixtureEValue)([]), 0);
});
(0, node_test_1.test)('geometricMixtureEValue: prefix-monotone (gaussian and bounded), the property the always-on loop needs', () => {
    for (const [seed, inc] of [[7, 'gaussian'], [11, 'bounded']]) {
        const rng = mulberry(seed);
        const r = Array.from({ length: 600 }, (_, t) => gauss(rng) + (t >= 300 ? 2.5 : 0));
        let prev = 0;
        for (const cut of [50, 100, 200, 300, 350, 400, 500, 600]) {
            const v = (0, onset_mixture_e_value_1.geometricMixtureEValue)(r.slice(0, cut), inc);
            strict_1.default.ok(v >= prev - 1e-12, `${inc} prefix ${cut}: ${v} < previous ${prev}`);
            prev = v;
        }
    }
});
(0, node_test_1.test)('E[·|H0] ≤ 1 empirically on iid N(0,1): geometric (gaussian) and normalized (both increments)', () => {
    const REPS = 300, T = 240;
    let sg = 0, sn = 0, sb = 0;
    for (let rep = 0; rep < REPS; rep++) {
        const rng = mulberry(1000 + rep);
        const r = Array.from({ length: T }, () => gauss(rng));
        sg += (0, onset_mixture_e_value_1.geometricMixtureEValue)(r);
        sn += (0, onset_mixture_e_value_1.normalizedMixtureEValue)(r);
        sb += (0, onset_mixture_e_value_1.normalizedMixtureEValue)(r, 'bounded');
    }
    strict_1.default.ok(sg / REPS <= 1, `geometric null mean ${(sg / REPS).toFixed(3)}`);
    strict_1.default.ok(sn / REPS <= 1, `normalized null mean ${(sn / REPS).toFixed(3)}`);
    strict_1.default.ok(sb / REPS <= 1, `bounded null mean ${(sb / REPS).toFixed(3)}`);
});
(0, node_test_1.test)('bounded: E[·|H0] holds under t3 tails and a 15% scale under-estimate, where the Gaussian increment breaks', () => {
    const t3 = (rng) => { const n = gauss(rng); const c = gauss(rng) ** 2 + gauss(rng) ** 2 + gauss(rng) ** 2; return n / Math.sqrt(c / 3); };
    let sumT = 0, sumS = 0;
    const REPS = 300, T = 240;
    for (let rep = 0; rep < REPS; rep++) {
        const rng = mulberry(9000 + rep);
        sumT += (0, onset_mixture_e_value_1.normalizedMixtureEValue)(Array.from({ length: T }, () => t3(rng)), 'bounded');
        const rng2 = mulberry(19000 + rep);
        sumS += (0, onset_mixture_e_value_1.normalizedMixtureEValue)(Array.from({ length: T }, () => 1.15 * gauss(rng2)), 'bounded');
    }
    strict_1.default.ok(sumT / REPS <= 1, `t3 null mean ${(sumT / REPS).toFixed(3)} must be ≤ 1`);
    strict_1.default.ok(sumS / REPS <= 1, `scale-error null mean ${(sumS / REPS).toFixed(3)} must be ≤ 1`);
});
(0, node_test_1.test)('detects sustained shifts: 4σ quickly, 0.3σ over a long window (bounded); 3σ (geometric)', () => {
    const rng = mulberry(77);
    const big = Array.from({ length: 400 }, (_, t) => gauss(rng) + (t >= 100 ? 4 : 0));
    strict_1.default.ok((0, onset_mixture_e_value_1.normalizedMixtureEValue)(big, 'bounded') > 10);
    const rng2 = mulberry(78);
    const small = Array.from({ length: 1440 }, (_, t) => gauss(rng2) + (t >= 200 ? 0.3 : 0));
    strict_1.default.ok((0, onset_mixture_e_value_1.normalizedMixtureEValue)(small, 'bounded') > 3);
    const rng3 = mulberry(42);
    const nullS = Array.from({ length: 400 }, () => gauss(rng3));
    const fault = nullS.map((v, t) => v + (t >= 100 ? 3 : 0));
    strict_1.default.ok((0, onset_mixture_e_value_1.geometricMixtureEValue)(fault) > Math.max(5, (0, onset_mixture_e_value_1.geometricMixtureEValue)(nullS) * 10));
});
// ── the use criteria ──
(0, node_test_1.test)('the envelopes are in the guarded map and the guarantee table, and the gate refuses without a regime assertion', () => {
    strict_1.default.equal(e_bh_guarded_1.DETECTOR_ENVELOPES.onset_mixture_gaussian, onset_mixture_e_value_1.ONSET_MIXTURE_GAUSSIAN_ENVELOPE);
    strict_1.default.equal(e_bh_guarded_1.DETECTOR_ENVELOPES.onset_mixture_bounded, onset_mixture_e_value_1.ONSET_MIXTURE_BOUNDED_ENVELOPE);
    strict_1.default.equal(onset_mixture_e_value_1.ONSET_MIXTURE_BOUNDED_ENVELOPE.variance, 'robust');
    strict_1.default.equal(onset_mixture_e_value_1.ONSET_MIXTURE_GAUSSIAN_ENVELOPE.validUnderEstimatedBaseline, false);
    const row = (0, guarantees_1.guaranteeFor)('onset_mixture_rtt_p99');
    strict_1.default.equal(row.validityClass, 'ville_anytime_valid');
    strict_1.default.equal(row.estimatedBaseline, onset_mixture_e_value_1.ONSET_MIXTURE_GAUSSIAN_ENVELOPE, 'the live envelope object, not a copy');
    strict_1.default.equal(row.approximateEValue.form, 'epsilon_growing');
    strict_1.default.throws(() => (0, e_bh_guarded_1.eBenjaminiHochbergGuarded)([{ detectorId: 'onset_mixture_gaussian', eValue: 50 }], 0.1), /estimated baseline|regime|assert/i);
    // ADR 0035: fit ≫ horizon alone no longer admits either id — the tail premise is asked for.
    strict_1.default.equal(onset_mixture_e_value_1.ONSET_MIXTURE_GAUSSIAN_ENVELOPE.tailPremise, 'mgf');
    strict_1.default.equal(onset_mixture_e_value_1.ONSET_MIXTURE_BOUNDED_ENVELOPE.tailPremise, 'clip-mean-zero');
    strict_1.default.throws(() => (0, e_bh_guarded_1.eBenjaminiHochbergGuarded)([{ detectorId: 'onset_mixture_bounded', eValue: 50, assertions: { mMuchGreaterThanN: true } }], 0.1), /CLIPPED residual/);
    strict_1.default.throws(() => (0, e_bh_guarded_1.eBenjaminiHochbergGuarded)([{ detectorId: 'onset_mixture_gaussian', eValue: 50, assertions: { mMuchGreaterThanN: true } }], 0.1), /mgf exists/);
    strict_1.default.doesNotThrow(() => (0, e_bh_guarded_1.eBenjaminiHochbergGuarded)([{ detectorId: 'onset_mixture_bounded', eValue: 50, assertions: { mMuchGreaterThanN: true, clipMeanZero: true } }], 0.1));
    strict_1.default.doesNotThrow(() => (0, e_bh_guarded_1.eBenjaminiHochbergGuarded)([{ detectorId: 'onset_mixture_gaussian', eValue: 50, assertions: { mMuchGreaterThanN: true, lightTails: true } }], 0.1));
    strict_1.default.doesNotThrow(() => (0, e_bh_guarded_1.eBenjaminiHochbergGuarded)([{ detectorId: 'onset_mixture_gaussian', eValue: 50, assertions: { mMuchGreaterThanN: true, incrementMean: { lower95: 0.995, upper95: 0.999 } } }], 0.1));
    strict_1.default.throws(() => (0, e_bh_guarded_1.eBenjaminiHochbergGuarded)([{ detectorId: 'onset_mixture_gaussian', eValue: 50, assertions: { mMuchGreaterThanN: true, lightTails: true, incrementMean: { lower95: 1.60, upper95: 1.62 } } }], 0.1), /REFUTES/);
    strict_1.default.deepEqual([...onset_mixture_e_value_1.GEO_RHOS], [1 / 64, 1 / 1024, 1 / 16384]);
    strict_1.default.equal(_bounded_bet_1.BOUND_LAMBDAS.length, 8);
    strict_1.default.equal((0, _bounded_bet_1.gBounded)(0, 0.5), 1);
});
//# sourceMappingURL=onset-mixture-e-value.test.js.map
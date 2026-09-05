"use strict";
// test/contrast.test.ts — the engine port of Tessera's contrast fit (per-shard/contrast.ts, C81 Part 1).
//
// Two halves. (1) LOCKSTEP against Tessera's COMPILED tools (tessera/tools/contrast.js and
// per-shard-whitening.js, built in place by Tessera's `tsc -p tsconfig.test.json`): every field of
// fitContrast / fitContrastFast / composeFit and every tick of applyContrast over 200 seeded streams
// of mixed φ, offset and scale — the C60 item 5 standard (0 mismatches). Skipped with a message when
// no Tessera checkout is reachable (CI); validation/contrast-null's harness runs the same comparison
// and records the counts in its manifest. (2) The construction's own properties (Tessera's
// test/contrast.test.ts, same seeds) and the envelope.
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
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
const contrast_1 = require("../per-shard/contrast");
function mulberry32(a) {
    return () => {
        a |= 0;
        a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
function gaussian(rng) {
    const u1 = Math.max(rng(), 1e-12), u2 = rng();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}
/** A persistent AR(1) contrast with an independent-baseline OFFSET (Tessera's test fixture). */
function offsetAr1(rng, n, phi, offset, scale) {
    const d = [];
    let x = gaussian(rng);
    for (let t = 0; t < n; t++) {
        x = phi * x + Math.sqrt(1 - phi * phi) * gaussian(rng);
        d.push(offset + scale * x);
    }
    return d;
}
/** Tessera's compiled tools, from the first checkout that has them (a sibling of the engine checkout,
 *  or of the worktree root two levels up). */
function tesseraTools() {
    const root = path.resolve(__dirname, '..', '..');
    const candidates = [path.resolve(root, '..', 'tessera'), path.resolve(root, '..', '..', '..', 'tessera')];
    for (const dir of candidates) {
        const c = path.join(dir, 'tools', 'contrast.js'), w = path.join(dir, 'tools', 'per-shard-whitening.js');
        if (fs.existsSync(c) && fs.existsSync(w)) {
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            return { contrast: require(c), whitening: require(w), dir };
        }
    }
    return null;
}
/** The lockstep comparison, exported for the study harness: counts every compared field/tick. */
function lockstepAgainstTessera(streams = 200) {
    const T = tesseraTools();
    if (!T)
        return null;
    let comparisons = 0, mismatches = 0;
    const eq = (a, b) => { comparisons++; if (!(a === b || (Number.isNaN(a) && Number.isNaN(b))))
        mismatches++; };
    for (let s = 0; s < streams; s++) {
        const rng = mulberry32(1000 + s);
        const phi = [0, 0.3, 0.6, 0.82, 0.95, -0.4][s % 6];
        const n = [40, 60, 300, 1000, 2000][s % 5];
        const d = offsetAr1(rng, n, phi, (s % 7) * 25 - 50, 0.5 + (s % 4));
        const a = (0, contrast_1.fitContrast)(d), b = T.contrast.fitContrast(d);
        eq(a.phi, b.phi);
        eq(a.loc, b.loc);
        eq(a.scale, b.scale);
        eq(a.center, b.center);
        const af = (0, contrast_1.fitContrastFast)(d), bf = T.contrast.fitContrastFast(d);
        eq(af.phi, bf.phi);
        eq(af.loc, bf.loc);
        eq(af.scale, bf.scale);
        eq(af.center, bf.center);
        const ac = (0, contrast_1.composeFit)(a, af), bc = T.contrast.composeFit(b, bf);
        eq(ac.phi, bc.phi);
        eq(ac.loc, bc.loc);
        eq(ac.scale, bc.scale);
        eq(ac.center, bc.center);
        const d2 = offsetAr1(rng, n, phi, (s % 5) * 10, 1 + (s % 3));
        const ra = (0, contrast_1.applyContrast)(d2, a), rb = T.contrast.applyContrast(d2, b);
        eq(ra.length, rb.length);
        for (let t = 0; t < ra.length; t++)
            eq(ra[t], rb[t]);
        const ea = (0, contrast_1.estimateContrastAr1)(d), eb = T.whitening.estimateAr1(d);
        eq(ea.phi, eb.phi);
        eq(ea.sigma2, eb.sigma2);
        eq((0, contrast_1.whitenContrast)(d[3], d[2], a.phi), T.whitening.whiten(d[3], d[2], b.phi));
        eq((0, contrast_1.whitenContrast)(d[0], null, a.phi), T.whitening.whiten(d[0], null, b.phi));
        eq((0, contrast_1.median)(d), T.contrast.median(d));
        eq((0, contrast_1.madScale)(d), T.contrast.madScale(d));
    }
    return { comparisons, mismatches, dir: T.dir };
}
(0, node_test_1.test)('LOCKSTEP: every field of fitContrast/fitContrastFast/composeFit and every tick of applyContrast equal Tessera\'s compiled tools (200 streams)', (t) => {
    const r = lockstepAgainstTessera(200);
    if (!r) {
        t.diagnostic('Tessera compiled tools not reachable; lockstep skipped (the study manifest records the count when they are)');
        t.skip();
        return;
    }
    strict_1.default.ok(r.comparisons > 100000, `expected > 100k comparisons, got ${r.comparisons}`);
    strict_1.default.equal(r.mismatches, 0, `${r.mismatches} of ${r.comparisons} comparisons mismatch against ${r.dir}`);
});
// ── Tessera's own property tests, same seeds (test/contrast.test.ts) ──────────────
(0, node_test_1.test)('median/madScale: robust location + scale (MAD×1.4826), floored positive', () => {
    strict_1.default.equal((0, contrast_1.median)([3, 1, 2]), 2);
    strict_1.default.ok((0, contrast_1.madScale)([0, 0, 0, 0, 10]) >= 1e-9);
    const r = mulberry32(5);
    const s = (0, contrast_1.madScale)(Array.from({ length: 2000 }, () => gaussian(r)));
    strict_1.default.ok(s > 0.9 && s < 1.1, `MAD scale of N(0,1) ≈ 1, got ${s.toFixed(3)}`);
});
(0, node_test_1.test)('CENTERS before whitening: a big baseline offset does not make the seed tick an outlier', () => {
    const d = offsetAr1(mulberry32(12345), 1000, 0.82, 70, 3);
    const std = (0, contrast_1.applyContrast)(d, (0, contrast_1.fitContrast)(d));
    strict_1.default.ok(Math.abs(std[0]) < 5, `seed tick should not carry the offset, got ${std[0].toFixed(1)}σ`);
    strict_1.default.ok(Math.max(...std.map(Math.abs)) < 6);
});
(0, node_test_1.test)('standardizes a healthy contrast to ~unit scale', () => {
    const d = offsetAr1(mulberry32(7), 1500, 0.6, 40, 2.5);
    const std = (0, contrast_1.applyContrast)(d, (0, contrast_1.fitContrast)(d));
    const m = std.reduce((s, x) => s + x, 0) / std.length;
    const v = std.reduce((s, x) => s + (x - m) ** 2, 0) / std.length;
    strict_1.default.ok(v > 0.5 && v < 2, `got ${v.toFixed(2)}`);
});
(0, node_test_1.test)('applyContrast is prefix-stable (causal)', () => {
    const d = offsetAr1(mulberry32(99), 400, 0.7, 10, 2);
    const fit = (0, contrast_1.fitContrast)(d);
    const whole = (0, contrast_1.applyContrast)(d, fit), prefix = (0, contrast_1.applyContrast)(d.slice(0, 120), fit);
    for (let i = 0; i < 120; i++)
        strict_1.default.ok(Math.abs(whole[i] - prefix[i]) < 1e-9);
});
// ── the pair and the envelope ───────────────────────────────────────────────────
(0, node_test_1.test)('contrastOf: a shared component cancels tick for tick; a length mismatch is refused', () => {
    const rng = mulberry32(3);
    const shared = Array.from({ length: 500 }, () => 5 * gaussian(rng));
    const u = Array.from({ length: 500 }, () => gaussian(rng)), v = Array.from({ length: 500 }, () => gaussian(rng));
    const d = (0, contrast_1.contrastOf)({ treatment: shared.map((c, i) => c + u[i]), control: shared.map((c, i) => c + v[i]) });
    for (let i = 0; i < 500; i++)
        strict_1.default.ok(Math.abs(d[i] - (u[i] - v[i])) < 1e-9);
    strict_1.default.throws(() => (0, contrast_1.contrastOf)({ treatment: [1, 2, 3], control: [1, 2] }), /same length/);
    const fit = (0, contrast_1.fitContrast)(d.slice(0, 300));
    strict_1.default.deepEqual((0, contrast_1.contrastResidual)({ treatment: shared.map((c, i) => c + u[i]), control: shared.map((c, i) => c + v[i]) }, fit), (0, contrast_1.applyContrast)(d, fit));
});
(0, node_test_1.test)('the envelope states the premise and carries the fit lengths as its regime', () => {
    strict_1.default.equal(contrast_1.CONTRAST_NULL_ENVELOPE.baseline, 'plug-in');
    strict_1.default.equal(contrast_1.CONTRAST_NULL_ENVELOPE.autocorrelation, 'ar1-whitened');
    strict_1.default.equal(contrast_1.CONTRAST_NULL_ENVELOPE.variance, 'robust');
    strict_1.default.ok(contrast_1.CONTRAST_NULL_ENVELOPE.premise.includes('treatment − control'));
    strict_1.default.deepEqual(contrast_1.CONTRAST_NULL_ENVELOPE.fitTicksMeasured, [60, 300, 2000]);
    strict_1.default.ok(Object.isFrozen(contrast_1.CONTRAST_NULL_ENVELOPE));
});
// ── the refusal record, pinned to the run; the gate; the registry and the guarantee row ─────────
const e_bh_guarded_1 = require("../fleet/e-bh-guarded");
const guarantees_1 = require("../guarantees");
const audit_1 = require("../types/audit");
const contrast_2 = require("../per-shard/contrast");
(0, node_test_1.test)('the envelope\'s admission is exactly the registered run\'s P2 cells (validation/contrast-null)', () => {
    const runDir = path.resolve(__dirname, '..', '..', 'validation', 'contrast-null', 'results', 'live', contrast_2.CONTRAST_NULL_RUN);
    const cells = JSON.parse(fs.readFileSync(path.join(runDir, 'cells.json'), 'utf8'));
    const manifest = JSON.parse(fs.readFileSync(path.join(runDir, 'manifest.json'), 'utf8'));
    strict_1.default.equal(manifest.exceptions, 0);
    strict_1.default.equal(manifest.quick, false);
    strict_1.default.equal(manifest.p1_study, 'FAILED');
    strict_1.default.equal(manifest.p3_study, 'FAILED');
    const p2 = cells.filter((c) => c.path === 'contrast' && c.variant === 'null');
    const expected = [];
    const seen = new Set();
    for (const x of p2) {
        const k = `${x.construction}|${x.level}|${x.m}`;
        if (seen.has(k))
            continue;
        seen.add(k);
        const xs = p2.filter((y) => y.construction === x.construction && y.level === x.level && y.m === x.m);
        const rates = xs.map((y) => y.rate_per_1000);
        expected.push({ construction: x.construction, level: x.level, fitTicks: x.m,
            heldOn: xs.filter((y) => y.verdict === 'HELD').map((y) => y.null), failedOn: xs.filter((y) => y.verdict === 'FAILED').map((y) => y.null),
            ratePer1000: [+Math.min(...rates).toFixed(3), +Math.max(...rates).toFixed(3)] });
    }
    strict_1.default.deepEqual(JSON.parse(JSON.stringify(contrast_1.CONTRAST_NULL_ENVELOPE.admission)), expected);
    // nothing admitted: the plug-in cards hold on no null below m = 2000, and no m holds on every Gaussian-innovation null
    strict_1.default.equal(contrast_1.CONTRAST_NULL_ENVELOPE.validUnderEstimatedBaseline, false);
    strict_1.default.equal(contrast_1.CONTRAST_NULL_ENVELOPE.minCalibration, undefined);
    strict_1.default.ok(contrast_1.CONTRAST_NULL_ENVELOPE.evidence.includes(contrast_2.CONTRAST_NULL_RUN));
});
(0, node_test_1.test)('the gate REFUSES a contrast e-value by name unless the caller asserts fit >> horizon or a true offset', () => {
    strict_1.default.equal((0, e_bh_guarded_1.envelopeFor)('contrast_null_mixture'), contrast_1.CONTRAST_NULL_ENVELOPE);
    strict_1.default.equal((0, e_bh_guarded_1.envelopeFor)('contrast_null_betting'), contrast_1.CONTRAST_NULL_ENVELOPE);
    strict_1.default.throws(() => (0, e_bh_guarded_1.eBenjaminiHochbergGuarded)([{ detectorId: 'contrast_null_mixture', eValue: 50 }], 0.1), /INVALID under an estimated baseline/);
    const admitted = (0, e_bh_guarded_1.eBenjaminiHochbergGuarded)([{ detectorId: 'contrast_null_mixture', eValue: 50, assertions: { mMuchGreaterThanN: true } }], 0.1);
    strict_1.default.equal(admitted.selected.length, 1, 'e = 50 against K/(q·k) = 10: selected once the caller asserts the regime');
    strict_1.default.doesNotThrow(() => (0, e_bh_guarded_1.eBenjaminiHochbergGuarded)([{ detectorId: 'contrast_null_betting', eValue: 50, assertions: { trueBaseline: true } }], 0.1));
});
(0, node_test_1.test)('the six contrast_null_{signal} ids are registered and resolve to the refusal row', () => {
    for (const sig of ['p99_latency', 'ttft', 'eval_score', 'tool_success_rate', 'downstream_err', 'cost_req']) {
        const id = `contrast_null_${sig}`;
        strict_1.default.ok(audit_1.DETECTOR_REGISTRY.A.includes(id), `${id} not in DETECTOR_REGISTRY.A`);
        const row = (0, guarantees_1.guaranteeFor)(id);
        strict_1.default.equal(row.estimatedBaseline, contrast_1.CONTRAST_NULL_ENVELOPE, 'the live envelope object, not a copy');
        strict_1.default.equal(row.approximateEValue.form, 'epsilon_growing');
        strict_1.default.ok(row.evidence.includes(contrast_2.CONTRAST_NULL_RUN) && row.evidence.includes('REFUSED'));
    }
    strict_1.default.equal(guarantees_1.ESTIMATED_BASELINE_GUARANTEES.contrast_null, contrast_1.CONTRAST_NULL_ENVELOPE);
    strict_1.default.equal(guarantees_1.APPROXIMATE_E_VALUE_BY_CONSTRUCTION.contrast_null.form, 'epsilon_growing');
});
//# sourceMappingURL=contrast.test.js.map
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// ADR 0030 (C62 b): the level-free mixture CS re-inverted at the e-BY level δ|S|/K, and the
// evidence surface carrying the inputs that make that possible.
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const e_by_1 = require("../fleet/e-by");
const mixture_confidence_sequence_1 = require("../detectors/mixture-confidence-sequence");
const _evidence_1 = require("../detectors/_evidence");
const lf = { S_t: 12.5, t: 40, sigma_squared: 1, sigma_squared_prior: 1 };
(0, node_test_1.test)('the level-free re-inversion reproduces the detector-level CS exactly', () => {
    for (const alpha of [0.05, 0.01, 1e-3, 0.4]) {
        const a = (0, mixture_confidence_sequence_1.mixtureConfidenceSequence)({ ...lf, alpha });
        const b = (0, mixture_confidence_sequence_1.mixtureConfidenceSequenceAt)(lf, alpha);
        strict_1.default.deepEqual(a, b);
        const v = lf.sigma_squared * lf.t + lf.sigma_squared_prior;
        const w = Math.sqrt(v * Math.log(v / (alpha * alpha * lf.sigma_squared_prior))) / lf.t;
        strict_1.default.ok(Math.abs(b.half_width - w) < 1e-12);
    }
    strict_1.default.throws(() => (0, mixture_confidence_sequence_1.mixtureConfidenceSequenceAt)({ ...lf, S_t: NaN }, 0.05), /finite/);
});
(0, node_test_1.test)('eByLevel is δ|S|/K with its domain enforced', () => {
    strict_1.default.equal((0, e_by_1.eByLevel)(0.1, 3, 20), 0.1 * 3 / 20);
    strict_1.default.equal((0, e_by_1.eByLevel)(0.1, 0, 20), 0);
    strict_1.default.equal((0, e_by_1.eByLevel)(0.05, 20, 20), 0.05);
    strict_1.default.throws(() => (0, e_by_1.eByLevel)(0.1, 21, 20), /\|S\|/);
    strict_1.default.throws(() => (0, e_by_1.eByLevel)(0.1, 1, 0), /K must/);
    strict_1.default.throws(() => (0, e_by_1.eByLevel)(1, 1, 5), /delta/);
    strict_1.default.throws(() => (0, e_by_1.eByLevel)(0.1, 1.5, 5), /\|S\|/);
});
(0, node_test_1.test)('e-BY intervals are the CS at δ|S|/K per selected signal, wider than at δ, and empty on no selection', () => {
    const sel = [{ id: 'a', level_free: lf }, { id: 'b', level_free: { ...lf, S_t: -3, t: 7 } }];
    const out = (0, e_by_1.eBenjaminiYekutieli)(sel, 20, 0.1);
    strict_1.default.equal(out.selected_count, 2);
    strict_1.default.equal(out.K, 20);
    strict_1.default.equal(out.alpha_i, 0.1 * 2 / 20);
    strict_1.default.equal(out.intervals.length, 2);
    for (const [i, s] of sel.entries()) {
        const cs = (0, mixture_confidence_sequence_1.mixtureConfidenceSequenceAt)(s.level_free, out.alpha_i);
        strict_1.default.deepEqual(out.intervals[i], { id: s.id, alpha_i: out.alpha_i, center: cs.center, half_width: cs.half_width, lower: cs.lower, upper: cs.upper });
        strict_1.default.ok(out.intervals[i].half_width > (0, mixture_confidence_sequence_1.mixtureConfidenceSequenceAt)(s.level_free, 0.1).half_width);
    }
    const none = (0, e_by_1.eBenjaminiYekutieli)([], 20, 0.1);
    strict_1.default.equal(none.intervals.length, 0);
    strict_1.default.equal(none.alpha_i, 0);
    strict_1.default.match(out.guarantee, /Thm 13\.7/);
    // selecting everything reports at δ itself
    const all = (0, e_by_1.eBenjaminiYekutieli)(Array.from({ length: 20 }, (_, i) => ({ id: String(i), level_free: lf })), 20, 0.1);
    strict_1.default.equal(all.alpha_i, 0.1);
});
(0, node_test_1.test)('the evidence surface carries the CS only when given one; nothing else on it moves', () => {
    const base = { log_wealth: 1, log_increment: 0.1, bet: null, n: 5, threshold: 20, threshold_kind: 'ville', log_peak_wealth: 1 };
    const without = (0, _evidence_1.buildEvidence)(base);
    strict_1.default.ok(!('confidence_sequence' in without));
    const cs = { level_free: lf, alpha: 0.05, ...(0, mixture_confidence_sequence_1.mixtureConfidenceSequenceAt)(lf, 0.05) };
    const withCs = (0, _evidence_1.buildEvidence)({ ...base, confidence_sequence: cs });
    strict_1.default.deepEqual(withCs.confidence_sequence, cs);
    const { confidence_sequence: _c, ...rest } = withCs;
    strict_1.default.deepEqual(rest, without);
});
// ── the shipped path: the Family A mixture verdict carries the CS with its level-free inputs ──
const run_nab_per_dataset_1 = require("../tools/run-nab-per-dataset");
const _page_cusum_mixture_1 = require("../detectors/_page-cusum-mixture");
(0, node_test_1.test)('the shipped mixture verdict carries confidence_sequence with level-free inputs that re-invert to it', () => {
    let seed = 0xBEEF;
    const rng = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
    const values = Array.from({ length: 500 }, () => rng() * 2 - 1);
    const { config } = (0, run_nab_per_dataset_1.buildPerDatasetConfig)(values, 'p99_latency', 0.15);
    const states = {};
    const ctx = { hourOfDay: 0, ticksSinceDeploy: 10, deployAgeDays: 1, trafficPct: 100 }; // the stub config's single cell is hour 0
    let seen = 0;
    for (let t = 0; t < 30; t++) {
        const out = (0, _page_cusum_mixture_1.evaluateFamilyAShadowMixture)(config, { p99_latency: 0.5 + rng() * 0.1 }, states, ctx);
        const v = out.find((d) => d.signal === 'p99_latency');
        if (!v?.evidence?.confidence_sequence)
            continue;
        seen++;
        const cs = v.evidence.confidence_sequence;
        const st = states.p99_latency;
        strict_1.default.equal(cs.level_free.t, st.n);
        strict_1.default.equal(cs.level_free.S_t, st.S_t);
        strict_1.default.ok(cs.level_free.sigma_squared_prior > 0 && cs.alpha > 0 && cs.alpha < 1);
        const again = (0, mixture_confidence_sequence_1.mixtureConfidenceSequenceAt)(cs.level_free, cs.alpha);
        strict_1.default.deepEqual({ center: cs.center, half_width: cs.half_width, lower: cs.lower, upper: cs.upper, excludes_zero: cs.excludes_zero }, again);
        // and e-BY can price it as one of K = 6 signals at δ = 0.1
        const by = (0, e_by_1.eBenjaminiYekutieli)([{ id: 'p99_latency', level_free: cs.level_free }], 6, 0.1);
        strict_1.default.ok(Math.abs(by.intervals[0].half_width - (0, mixture_confidence_sequence_1.mixtureConfidenceSequenceAt)(cs.level_free, 0.1 / 6).half_width) < 1e-12);
    }
    strict_1.default.ok(seen >= 20, `the CS should be on the shipped verdict on most ticks, saw ${seen}`);
});
//# sourceMappingURL=adr-0030-e-by.test.js.map
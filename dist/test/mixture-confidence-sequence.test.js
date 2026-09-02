"use strict";
// The mixture CS is the detector's own game inverted: the interval excludes 0 exactly when the
// mixture supermartingale on S_t reaches 1/α, and its edges are the roots of log M_t(S_t − tm)
// = log(1/α) in m.
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const mixture_confidence_sequence_1 = require("../detectors/mixture-confidence-sequence");
const family_a_mixture_supermartingale_1 = require("../detectors/family-a-mixture-supermartingale");
(0, node_test_1.test)('the interval edges are exactly where the shifted mixture reaches 1/α', () => {
    for (const [S, t, s2, rho, alpha] of [[3.2, 10, 1, 1, 0.05], [-40, 300, 2.5, 38, 0.01], [0.1, 1, 1, 1, 0.05]]) {
        const cs = (0, mixture_confidence_sequence_1.mixtureConfidenceSequence)({ S_t: S, t, sigma_squared: s2, sigma_squared_prior: rho, alpha });
        for (const edge of [cs.lower, cs.upper]) {
            const logM = (0, family_a_mixture_supermartingale_1.computeGaussianMixtureLogSupermartingale)(S - t * edge, t, s2, rho);
            strict_1.default.ok(Math.abs(logM - Math.log(1 / alpha)) < 1e-9, `edge ${edge}: log M = ${logM} vs ${Math.log(1 / alpha)}`);
        }
        // strictly inside: the game has not made money
        const inside = (0, family_a_mixture_supermartingale_1.computeGaussianMixtureLogSupermartingale)(S - t * cs.center, t, s2, rho);
        strict_1.default.ok(inside < Math.log(1 / alpha));
    }
});
(0, node_test_1.test)('excludes_zero ⇔ the detector fires on the same S_t', () => {
    for (let S = -30; S <= 30; S += 0.5) {
        const t = 50, s2 = 1, rho = 1, alpha = 0.05;
        const cs = (0, mixture_confidence_sequence_1.mixtureConfidenceSequence)({ S_t: S, t, sigma_squared: s2, sigma_squared_prior: rho, alpha });
        const fires = (0, family_a_mixture_supermartingale_1.computeGaussianMixtureLogSupermartingale)(S, t, s2, rho) >= Math.log(1 / alpha);
        strict_1.default.equal(cs.excludes_zero, fires, `S=${S}`);
    }
});
(0, node_test_1.test)('the half-width is Howard eq. 14 and shrinks like sqrt(log t / t)', () => {
    const w = (t) => (0, mixture_confidence_sequence_1.mixtureConfidenceSequence)({ S_t: 0, t, sigma_squared: 1, sigma_squared_prior: 1, alpha: 0.05 }).half_width;
    const closed = (t) => Math.sqrt((t + 1) * Math.log((t + 1) / (0.0025))) / t;
    for (const t of [1, 10, 100, 1000, 10000])
        strict_1.default.ok(Math.abs(w(t) - closed(t)) < 1e-12);
    strict_1.default.ok(w(10000) < w(1000) && w(1000) < w(100));
});
(0, node_test_1.test)('rejects malformed inputs', () => {
    strict_1.default.throws(() => (0, mixture_confidence_sequence_1.mixtureConfidenceSequence)({ S_t: 0, t: 0, sigma_squared: 1, sigma_squared_prior: 1, alpha: 0.05 }), /t must be/);
    strict_1.default.throws(() => (0, mixture_confidence_sequence_1.mixtureConfidenceSequence)({ S_t: 0, t: 1, sigma_squared: 1, sigma_squared_prior: 0, alpha: 0.05 }), /prior/);
    strict_1.default.throws(() => (0, mixture_confidence_sequence_1.mixtureConfidenceSequence)({ S_t: 0, t: 1, sigma_squared: 1, sigma_squared_prior: 1, alpha: 1 }), /alpha/);
});
// ── the wired field (registered outcome of 2026-09-mixture-cs, §3) ──
const family_a_mixture_supermartingale_2 = require("../detectors/family-a-mixture-supermartingale");
(0, node_test_1.test)('the mixture result carries the CS, and excludes_zero flips exactly at the first fire tick', () => {
    const params = { mixture_distribution: 'gaussian', gaussian_sigma_squared_prior: 1 };
    const state = (0, family_a_mixture_supermartingale_2.freshMixtureSupermartingaleState)();
    let firstFire = -1;
    for (let t = 0; t < 200; t++) {
        const r = (0, family_a_mixture_supermartingale_2.evaluatePageCusumMixtureSupermartingale)({
            signal: 's', x_centered: 0.75, live_value: 0.75, baseline_mean: 0, sigma_squared: 1, params, state, alpha: 0.05,
        });
        const cs = r.confidence_sequence;
        strict_1.default.ok(Math.abs(cs.center - state.S_t / (t + 1)) < 1e-12);
        if (firstFire < 0 && r.fire)
            firstFire = t;
        if (firstFire < 0)
            strict_1.default.equal(cs.excludes_zero, false, `t=${t} before the first fire`);
        if (t === firstFire)
            strict_1.default.equal(cs.excludes_zero, true, 'the CS excludes 0 exactly when the detector fires');
    }
    strict_1.default.ok(firstFire > 0, 'a 0.75σ shift fires within 200 ticks');
});
//# sourceMappingURL=mixture-confidence-sequence.test.js.map
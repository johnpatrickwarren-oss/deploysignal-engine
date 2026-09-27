"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// Family A evaluation honours `cfg.family_a_signals`, and the Bonferroni
// split defaults to the length of the evaluated list.
//
// Both Family A evaluators (mixture Page-CUSUM, betting e-process) must
// iterate `cfg.family_a_signals ?? FAMILY_A_PRIMARY_SIGNALS`, and when
// `cfg.bonferroni_factor` is unset the per-signal α is α_A / N for the N
// signals evaluated. An explicit `bonferroni_factor` wins.
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const _page_cusum_mixture_1 = require("../detectors/_page-cusum-mixture");
const betting_e_process_1 = require("../detectors/betting-e-process");
const _page_cusum_core_1 = require("../detectors/_page-cusum-core");
const ALPHA_A = 4e-4;
function perSignal() {
    return {
        baseline_mean: 0,
        baseline_sigma_squared: 1,
        baseline_mean_raw: 0,
        baseline_sigma_squared_raw: 1,
        tau_squared: 0.5,
        delta_min: 1.5,
        signal_class: 'gaussian_like',
    };
}
function buildConfig(opts) {
    const per_signal = {};
    for (const s of opts.cellSignals)
        per_signal[s] = perSignal();
    const cfg = {
        version: 'test',
        alpha_budget: { total: 1e-3, per_family: { A: ALPHA_A, C: 2e-4, D: 1e-4, E: 1e-4 } },
        baseline_cells: {
            dimensions: ['hour_of_day'],
            cells: [{ key: { hour_of_day: 0 }, confidence: 'high', n_samples: 1000, family_A: { per_signal } }],
            aggregate_fallback: { family_A: { per_signal: {} } },
        },
    };
    if (opts.familyASignals)
        cfg.family_a_signals = opts.familyASignals;
    if (opts.bonferroni !== undefined)
        cfg.bonferroni_factor = opts.bonferroni;
    return cfg;
}
const CTX = { hourOfDay: 0, ticksSinceDeploy: 100, deployAgeDays: 1, trafficPct: 100 };
function run(cfg, signals) {
    const live = {};
    for (const s of signals)
        live[s] = 0.1;
    const mixture = (0, _page_cusum_mixture_1.evaluateFamilyAShadowMixture)(cfg, live, {}, CTX);
    const betting = (0, betting_e_process_1.evaluateFamilyABettingShadow)(cfg, live, {}, CTX);
    return { mixture, betting };
}
const CUSTOM = ['queue_depth', 'gpu_util'];
const approx = (a, b) => strict_1.default.ok(a !== null && Math.abs(a - b) / b < 1e-9, `expected ${b}, got ${a}`);
(0, node_test_1.test)('(a) configured family_a_signals: both evaluators emit verdicts for exactly those signals', () => {
    // Cells carry params for the custom signals AND the six defaults, so an
    // evaluator that ignores the configured list would still emit the defaults.
    const cfg = buildConfig({ cellSignals: [...CUSTOM, ..._page_cusum_core_1.FAMILY_A_PRIMARY_SIGNALS], familyASignals: CUSTOM });
    const { mixture, betting } = run(cfg, [...CUSTOM, ..._page_cusum_core_1.FAMILY_A_PRIMARY_SIGNALS]);
    strict_1.default.deepEqual(mixture.map((v) => v.signal).sort(), [...CUSTOM].sort());
    strict_1.default.deepEqual(betting.map((v) => v.signal).sort(), [...CUSTOM].sort());
});
(0, node_test_1.test)('(b) no family_a_signals: the six defaults are evaluated with bonferroni 6', () => {
    const cfg = buildConfig({ cellSignals: _page_cusum_core_1.FAMILY_A_PRIMARY_SIGNALS });
    const { mixture, betting } = run(cfg, _page_cusum_core_1.FAMILY_A_PRIMARY_SIGNALS);
    strict_1.default.deepEqual(mixture.map((v) => v.signal), [..._page_cusum_core_1.FAMILY_A_PRIMARY_SIGNALS]);
    strict_1.default.deepEqual(betting.map((v) => v.signal), [..._page_cusum_core_1.FAMILY_A_PRIMARY_SIGNALS]);
    // mixture threshold = 1/α, α = α_A/6; betting threshold = 1/(0.5·α_A/6)
    for (const v of mixture)
        approx(v.threshold, 6 / ALPHA_A);
    for (const v of betting)
        approx(v.threshold, 12 / ALPHA_A);
});
(0, node_test_1.test)('(c) N configured signals, no bonferroni_factor: per-signal α = α_A / N', () => {
    const three = ['queue_depth', 'gpu_util', 'kv_cache_hit'];
    const cfg = buildConfig({ cellSignals: three, familyASignals: three });
    const { mixture, betting } = run(cfg, three);
    strict_1.default.equal(mixture.length, 3);
    strict_1.default.equal(betting.length, 3);
    for (const v of mixture)
        approx(v.threshold, 3 / ALPHA_A);
    for (const v of betting)
        approx(v.threshold, 6 / ALPHA_A);
});
(0, node_test_1.test)('(d) an explicit bonferroni_factor wins over the list length', () => {
    const cfg = buildConfig({ cellSignals: CUSTOM, familyASignals: CUSTOM, bonferroni: 10 });
    const { mixture, betting } = run(cfg, CUSTOM);
    strict_1.default.equal(mixture.length, 2);
    strict_1.default.equal(betting.length, 2);
    for (const v of mixture)
        approx(v.threshold, 10 / ALPHA_A);
    for (const v of betting)
        approx(v.threshold, 20 / ALPHA_A);
});
// ── fix round 1 ──
const _page_cusum_core_2 = require("../detectors/_page-cusum-core");
(0, node_test_1.test)('(e) duplicate names in family_a_signals: one update per tick, one verdict per distinct signal', () => {
    const cfg = buildConfig({ cellSignals: ['q'], familyASignals: ['q', 'q'] });
    const mixStates = {};
    const betStates = {};
    const N = 5;
    for (let t = 0; t < N; t++) {
        const mixture = (0, _page_cusum_mixture_1.evaluateFamilyAShadowMixture)(cfg, { q: 0.1 }, mixStates, CTX);
        const betting = (0, betting_e_process_1.evaluateFamilyABettingShadow)(cfg, { q: 0.1 }, betStates, CTX);
        strict_1.default.deepEqual(mixture.map((v) => v.signal), ['q']);
        strict_1.default.deepEqual(betting.map((v) => v.signal), ['q']);
        // factor = distinct count (1): mixture 1/α_A, betting 2/α_A
        approx(mixture[0].threshold, 1 / ALPHA_A);
        approx(betting[0].threshold, 2 / ALPHA_A);
    }
    strict_1.default.equal(mixStates.q.n, N);
    strict_1.default.equal(betStates.q.n, N);
});
(0, node_test_1.test)('(f) familyASignals dedupes a configured list in first-occurrence order; default is the frozen six', () => {
    strict_1.default.deepEqual([...(0, _page_cusum_core_2.familyASignals)({ family_a_signals: ['b', 'a', 'b', 'c', 'a'] })], ['b', 'a', 'c']);
    strict_1.default.equal((0, _page_cusum_core_2.familyASignals)({}), _page_cusum_core_1.FAMILY_A_PRIMARY_SIGNALS);
    strict_1.default.equal((0, _page_cusum_core_2.familyABonferroni)({ family_a_signals: ['q', 'q'] }), 1);
    strict_1.default.equal((0, _page_cusum_core_2.familyABonferroni)({ family_a_signals: ['q', 'q'], bonferroni_factor: 2 }), 2);
});
(0, node_test_1.test)('(g) empty family_a_signals: no verdicts and a factor of 1', () => {
    const cfg = buildConfig({ cellSignals: _page_cusum_core_1.FAMILY_A_PRIMARY_SIGNALS, familyASignals: [] });
    const { mixture, betting } = run(cfg, _page_cusum_core_1.FAMILY_A_PRIMARY_SIGNALS);
    strict_1.default.equal(mixture.length, 0);
    strict_1.default.equal(betting.length, 0);
    strict_1.default.equal((0, _page_cusum_core_2.familyABonferroni)(cfg), 1);
});
//# sourceMappingURL=family-a-signals-config.test.js.map
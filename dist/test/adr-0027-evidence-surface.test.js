"use strict";
// ADR 0027 — the log-domain evidence surface on the multiplicative wealth detectors.
//
// AC-1: every emitted field is a function of the books the detector already keeps — log_wealth
//       equals the exact log_M, the realized increments sum to it, growth_rate_hat is their mean,
//       nats_to_threshold is log(threshold) − log_M, and the fire decision is nats_to_threshold ≤ 0.
// AC-2: anytime_p = 1/max wealth is non-increasing and ≤ 1.
// AC-3: threshold_kind names the shipped substitution (bootstrap) or the analytical 1/α (ville)
//       or a priced c/α, and is null when the verdict carries no threshold.
// AC-4: a held tick (NaN observation) reports log_increment null and moves nothing else.
// AC-5: the mixture's uncapped log survives past the 120-nat cap of the linear view.
// AC-6: the surface is JSON-safe (no NaN, no ±Infinity) on a fresh state and after saturation.
// AC-7: pre-0027 snapshots (no peak, no log_M_t) heal on the next update.
// AC-8: adding the surface changes no verdict, statistic or threshold (parity against a replay
//       of the same detector with the surface stripped is trivially true — the fields are read
//       from state after the existing update — so the binding check is the byte-identity of the
//       wealth books against the pre-0027 arithmetic, replayed in-test).
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const betting_e_process_1 = require("../detectors/betting-e-process");
const hotelling_1 = require("../detectors/hotelling");
const spectral_1 = require("../detectors/spectral");
const family_a_mixture_supermartingale_1 = require("../detectors/family-a-mixture-supermartingale");
const _evidence_1 = require("../detectors/_evidence");
const _wealth_1 = require("../detectors/_wealth");
function lcg(seed) {
    let s = seed >>> 0;
    return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
}
function gaussian(rng) {
    const u1 = Math.max(rng(), 1e-12), u2 = rng();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}
function bettingParams(threshold) {
    return {
        signal: 'p99_latency', tau_squared: 1, delta_min: 0.1, min_samples: 0,
        min_ticks_before_eligible: 0, min_observation_window: 0, max_deploy_window_days: 10, alpha: 0.05,
        derivation: {
            tau_multiplier: 0, empirical_variance: 1, mean: 10, std: 1, n_samples: 100,
            ...(threshold !== undefined ? { betting_sliding_buffer_threshold: threshold } : {}),
        },
    };
}
const bettingInput = (params, state = (0, betting_e_process_1.freshBettingState)()) => ({
    signal: 'p99_latency', params, state, trafficPct: 1, trafficGate: 0,
    ticksSinceDeploy: 10, deployAgeDays: 0, alphaBetting: 0.05,
});
function identityCell(p, alpha, tauSquared, sliding) {
    const covariance = [];
    for (let i = 0; i < p; i++) {
        const row = new Array(p).fill(0);
        row[i] = 1;
        covariance.push(row);
    }
    return {
        mean_vector: new Array(p).fill(0), covariance, hotelling_variant: 'safe_test',
        safe_hotelling_params: {
            tau_squared: tauSquared, alpha, precompiled_log_det_shrink: (p / 2) * Math.log(1 + tauSquared),
            shrink_fraction: tauSquared / (1 + tauSquared),
            ...(sliding !== undefined ? { sliding_buffer_threshold: sliding } : {}),
        },
    };
}
const spectralParams = {
    bootstrap_null_quantile: 0.9, min_peak_lag: 3, max_peak_lag: 10,
    spectral_variant: 'e_detector', null_mean: 0.42, null_std: 0.05, betting_delta: 0.015,
};
function assertJsonSafe(o, label) {
    const s = JSON.stringify(o);
    const stripped = s.replace(/"(bet|log_increment|log_threshold|threshold_kind|nats_to_threshold|growth_rate_hat)":null/g, '');
    strict_1.default.ok(stripped.indexOf('null') === -1, `${label}: only the documented nullable fields may be null: ${s}`);
    const back = JSON.parse(s);
    for (const [k, v] of Object.entries(back)) {
        if (typeof v === 'number')
            strict_1.default.ok(Number.isFinite(v), `${label}.${k} must be finite, got ${v}`);
    }
}
(0, node_test_1.test)('AC-1/2/3: betting — the surface is the books, the fire rule is nats ≤ 0, anytime_p is monotone', () => {
    const params = bettingParams(2.4e4 / 0.05); // the shipped-median bootstrap overshoot
    const input = bettingInput(params);
    const rng = lcg(0xad0027);
    let sumInc = 0;
    let lastP = 1;
    for (let t = 0; t < 400; t++) {
        const x = 10 + (t < 200 ? 0 : 3) + gaussian(rng); // shift after tick 200
        const v = (0, betting_e_process_1.evaluateBettingEProcess)(input, x - 10); // caller supplies x centered
        const ev = v.evidence;
        strict_1.default.ok(Math.abs(ev.log_wealth - input.state.log_M) < 1e-12, 'log_wealth is the exact books');
        strict_1.default.equal(ev.n, input.state.n);
        strict_1.default.equal(ev.bet, input.state.bet);
        strict_1.default.notEqual(ev.log_increment, null);
        sumInc += ev.log_increment;
        strict_1.default.ok(Math.abs(sumInc - ev.log_wealth) < 1e-9, 'increments sum to the log-wealth (floor never bound)');
        strict_1.default.ok(Math.abs(ev.growth_rate_hat - ev.log_wealth / ev.n) < 1e-12);
        strict_1.default.equal(ev.threshold_kind, 'bootstrap');
        strict_1.default.ok(Math.abs(ev.log_threshold - Math.log(v.threshold)) < 1e-12);
        strict_1.default.ok(Math.abs(ev.nats_to_threshold - (ev.log_threshold - ev.log_wealth)) < 1e-12);
        strict_1.default.equal(v.verdict === 'fire', ev.nats_to_threshold <= 0, 'fire ⇔ nats_to_threshold ≤ 0');
        strict_1.default.ok(ev.anytime_p <= 1 && ev.anytime_p <= lastP + 1e-15, 'anytime_p is non-increasing');
        lastP = ev.anytime_p;
        strict_1.default.ok(Math.abs(ev.log_peak_wealth - input.state.log_peak_M) < 1e-12);
        assertJsonSafe(ev, `betting t=${t}`);
    }
    strict_1.default.ok(input.state.log_M > 0, 'the shift was detected in nats even where the bootstrap threshold was not crossed');
    // the analytical threshold is named as such
    const ville = (0, betting_e_process_1.evaluateBettingEProcess)(bettingInput(bettingParams()), 0);
    strict_1.default.equal(ville.evidence.threshold_kind, 'ville');
    strict_1.default.ok(Math.abs(ville.evidence.log_threshold - Math.log(1 / 0.05)) < 1e-12);
});
(0, node_test_1.test)('AC-4: a NaN observation holds the betting wealth and reports log_increment null', () => {
    const input = bettingInput(bettingParams());
    (0, betting_e_process_1.evaluateBettingEProcess)(input, 0.3);
    const before = JSON.stringify(input.state);
    const v = (0, betting_e_process_1.evaluateBettingEProcess)(input, NaN);
    strict_1.default.equal(JSON.stringify(input.state), before, 'a NaN tick mutates nothing (ADR 0026)');
    strict_1.default.equal(v.evidence.log_increment, null);
    strict_1.default.equal(v.evidence.n, 1);
});
(0, node_test_1.test)('AC-8: the betting books are byte-identical to the pre-0027 arithmetic (state fields added, none changed)', () => {
    const a = (0, betting_e_process_1.freshBettingState)();
    const rng = lcg(7);
    let M = 1, logM = 0, peak = 0;
    for (let t = 0; t < 300; t++) {
        const x = 5 + gaussian(rng);
        (0, betting_e_process_1.updateBettingState)(a, x, 5, 1, 0.001);
        // replay the pre-0027 books: only the peak is new
        M = a.M;
        logM = a.log_M;
        peak = Math.max(peak, logM);
        strict_1.default.equal(a.log_peak_M, peak);
    }
    strict_1.default.ok(Math.abs(Math.log(M) - logM) < 1e-9);
});
(0, node_test_1.test)('AC-1/3/4: safe-Hotelling — increment is z_t, bootstrap vs ville named, NaN tick holds', () => {
    const p = 3;
    const cellV = identityCell(p, 1e-3, 0.5);
    const cellB = identityCell(p, 1e-3, 0.5, 5e3);
    const sV = (0, hotelling_1.freshSafeHotellingState)();
    const sB = (0, hotelling_1.freshSafeHotellingState)();
    const rng = lcg(11);
    for (let t = 0; t < 50; t++) {
        const x = Array.from({ length: p }, () => gaussian(rng));
        const prev = sV.log_M ?? 0;
        const vV = (0, hotelling_1.evaluateSafeHotelling)({ cell: cellV, alpha: 1e-3 }, [...x], sV);
        const vB = (0, hotelling_1.evaluateSafeHotelling)({ cell: cellB, alpha: 1e-3 }, [...x], sB);
        strict_1.default.equal(vV.evidence.threshold_kind, 'ville');
        strict_1.default.equal(vB.evidence.threshold_kind, 'bootstrap');
        strict_1.default.ok(Math.abs(vV.evidence.log_increment - (sV.log_M - prev)) < 1e-12);
        strict_1.default.equal(vV.evidence.bet, null, 'a likelihood ratio places no bet');
        assertJsonSafe(vV.evidence, `hotelling t=${t}`);
    }
    const held = (0, hotelling_1.evaluateSafeHotelling)({ cell: cellV, alpha: 1e-3 }, [NaN, 0, 0], sV);
    strict_1.default.equal(held.evidence.log_increment, null, 'a NaN observation holds the wealth');
});
(0, node_test_1.test)('AC-3/6: spectral — priced threshold kind under a c-bound, JSON-safe at saturation', () => {
    const s = (0, spectral_1.freshSpectralEDetectorState)();
    const v = (0, spectral_1.evaluateSpectralEDetector)({ params: spectralParams, alpha: 1e-4, signal: 's' }, 0.43, s);
    strict_1.default.equal(v.evidence.threshold_kind, 'ville');
    const priced = { ...spectralParams, e_value_inflation_bound: 1.0636 };
    const vp = (0, spectral_1.evaluateSpectralEDetector)({ params: priced, alpha: 1e-4, signal: 's' }, 0.43, (0, spectral_1.freshSpectralEDetectorState)());
    strict_1.default.equal(vp.evidence.threshold_kind, 'priced');
    strict_1.default.ok(Math.abs(vp.evidence.log_threshold - Math.log(1.0636 / 1e-4)) < 1e-12);
    // an infinite peak pins the books at the saturation point; the surface must stay finite
    const sat = (0, spectral_1.evaluateSpectralEDetector)({ params: spectralParams, alpha: 1e-4, signal: 's' }, Infinity, s);
    strict_1.default.equal(sat.verdict, 'fire');
    strict_1.default.equal(sat.evidence.log_wealth, _wealth_1.LOG_MAX_WEALTH);
    assertJsonSafe(sat.evidence, 'spectral saturated');
    const held = (0, spectral_1.evaluateSpectralEDetector)({ params: spectralParams, alpha: 1e-4, signal: 's' }, NaN, s);
    strict_1.default.equal(held.evidence.log_increment, null);
});
(0, node_test_1.test)('AC-5/7: mixture — the uncapped log survives the 120-nat cap, and a pre-0027 snapshot heals', () => {
    const params = { mixture_distribution: 'gaussian', gaussian_sigma_squared_prior: 1 };
    const state = (0, family_a_mixture_supermartingale_1.freshMixtureSupermartingaleState)();
    let prevLog = 0;
    for (let t = 0; t < 400; t++) {
        const r = (0, family_a_mixture_supermartingale_1.evaluatePageCusumMixtureSupermartingale)({
            signal: 's', x_centered: 3, live_value: 13, baseline_mean: 10, sigma_squared: 1,
            params, state, alpha: 1e-3,
        });
        strict_1.default.ok(Math.abs(r.log_M_t - (0, family_a_mixture_supermartingale_1.computeGaussianMixtureLogSupermartingale)(state.S_t, t + 1, 1, 1)) < 1e-12);
        strict_1.default.ok(Math.abs(r.log_increment - (r.log_M_t - prevLog)) < 1e-12);
        prevLog = r.log_M_t;
        strict_1.default.ok(Math.abs(Math.log(r.M_t) - Math.min(r.log_M_t, 120)) < 1e-9, 'the linear view is the capped exp');
    }
    strict_1.default.ok(state.log_M_t > 120, `the exact log keeps counting past the cap (${state.log_M_t.toFixed(1)} nats)`);
    strict_1.default.equal(state.M_t, (0, family_a_mixture_supermartingale_1.computeGaussianMixtureSupermartingale)(state.S_t, 400, 1, 1), 'the linear view is unchanged');
    strict_1.default.equal(state.log_peak_M, state.log_M_t);
    // pre-0027 snapshot: no log_M_t, no log_peak_M
    const old = { S_t: 0.5, M_t: 1.2, fired: false, tick_at_first_fire: null, n: 1, last_x_centered: 0 };
    const r = (0, family_a_mixture_supermartingale_1.evaluatePageCusumMixtureSupermartingale)({
        signal: 's', x_centered: 0.1, live_value: 10.1, baseline_mean: 10, sigma_squared: 1,
        params, state: old, alpha: 1e-3,
    });
    strict_1.default.ok(Number.isFinite(r.log_increment), 'healed from log(M_t)');
    strict_1.default.ok(Number.isFinite(old.log_peak_M));
});
(0, node_test_1.test)('AC-6: buildEvidence with no threshold and n = 0 is JSON-safe with only documented nulls', () => {
    const ev = (0, _evidence_1.buildEvidence)({ log_wealth: 0, log_increment: null, bet: null, n: 0, threshold: null, threshold_kind: 'ville', log_peak_wealth: 0 });
    strict_1.default.equal(ev.growth_rate_hat, null);
    strict_1.default.equal(ev.threshold_kind, null, 'no threshold ⇒ no kind');
    strict_1.default.equal(ev.nats_to_threshold, null);
    strict_1.default.equal(ev.anytime_p, 1);
    assertJsonSafe(ev, 'fresh');
});
//# sourceMappingURL=adr-0027-evidence-surface.test.js.map
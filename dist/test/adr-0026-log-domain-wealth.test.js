"use strict";
// ADR 0026 — log-domain wealth for the multiplicative e-process detectors.
//
// The binding tests are the overflow cases (AC-1/2/4: behavior the pre-0024
// linear accumulation gets WRONG, replayed in-test as the oracle) and the
// parity cases (AC-3: in-range decision sequences and wealth books identical
// to the linear replay at 1e-9 relative tolerance). AC-5 binds the log-input
// e-BH variant against the linear procedure; AC-6 binds deserialization
// healing including the poisoned persisted-Infinity case.
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const hotelling_1 = require("../detectors/hotelling");
const betting_e_process_1 = require("../detectors/betting-e-process");
const spectral_1 = require("../detectors/spectral");
const _wealth_1 = require("../detectors/_wealth");
const e_bh_1 = require("../fleet/e-bh");
/** Identity-Σ safe-Hotelling cell (the minimal-cell construction products use). */
function identityCell(p, alpha, tauSquared) {
    const covariance = [];
    for (let i = 0; i < p; i++) {
        const row = new Array(p).fill(0);
        row[i] = 1;
        covariance.push(row);
    }
    return {
        mean_vector: new Array(p).fill(0),
        covariance,
        hotelling_variant: 'safe_test',
        safe_hotelling_params: {
            tau_squared: tauSquared,
            alpha,
            precompiled_log_det_shrink: (p / 2) * Math.log(1 + tauSquared),
            shrink_fraction: tauSquared / (1 + tauSquared),
        },
    };
}
/** Deterministic LCG so the parity fixtures are reproducible without Date/Math.random. */
function lcg(seed) {
    let s = seed >>> 0;
    return () => {
        s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
        return s / 4294967296;
    };
}
(0, node_test_1.test)('AC-1: the measured defect dies at the source — huge-shift safe-Hotelling wealth saturates at Number.MAX_VALUE, exact in log_M, JSON-safe', () => {
    const p = 4;
    const cell = identityCell(p, 1e-4, 1);
    const state = (0, hotelling_1.freshSafeHotellingState)();
    // δ=32-class observations: xᵀΣ⁻¹x = p·32² per tick ⇒ z_t ≈ 2048 — the
    // linear product is Infinity by tick 1's square; run 60 ticks anyway.
    const x = new Array(p).fill(32);
    // Linear-replay oracle (the pre-0024 accumulation), alongside.
    let linearM = 1;
    for (let t = 0; t < 60; t++) {
        const params = cell.safe_hotelling_params;
        const xSigmaInvX = x.reduce((s, v) => s + v * v, 0);
        const xSigmaPlusInvX = x.reduce((s, v) => s + (v * v) / (1 + params.tau_squared), 0);
        const z = -params.precompiled_log_det_shrink + 0.5 * xSigmaInvX - 0.5 * xSigmaPlusInvX;
        linearM = Math.max(1e-300, linearM * Math.exp(z));
        (0, hotelling_1.evaluateSafeHotelling)({ cell, alpha: 1e-4 }, [...x], state);
    }
    strict_1.default.equal(linearM, Infinity, 'oracle: the pre-0024 linear accumulation overflows');
    strict_1.default.equal(state.M, Number.MAX_VALUE, 'the view saturates finite');
    strict_1.default.ok(Number.isFinite(state.log_M), 'log books stay exact');
    strict_1.default.ok(state.log_M > _wealth_1.LOG_MAX_WEALTH, 'and are far above the saturation point');
    const roundTripped = JSON.parse(JSON.stringify(state));
    strict_1.default.equal(roundTripped.M, Number.MAX_VALUE, 'JSON round-trip carries no null');
});
(0, node_test_1.test)('AC-2: the absorbing state is gone — wealth driven above saturation decays back when the evidence reverses', () => {
    const p = 2;
    const cell = identityCell(p, 1e-4, 1);
    const state = (0, hotelling_1.freshSafeHotellingState)();
    const hot = new Array(p).fill(40);
    let linearM = 1;
    const step = (x) => {
        const params = cell.safe_hotelling_params;
        const a = x.reduce((s, v) => s + v * v, 0);
        const b = x.reduce((s, v) => s + (v * v) / (1 + params.tau_squared), 0);
        const z = -params.precompiled_log_det_shrink + 0.5 * a - 0.5 * b;
        linearM = Math.max(1e-300, linearM * Math.exp(z));
        (0, hotelling_1.evaluateSafeHotelling)({ cell, alpha: 1e-4 }, [...x], state);
    };
    for (let t = 0; t < 5; t++)
        step(hot);
    strict_1.default.equal(linearM, Infinity, 'oracle overflowed');
    strict_1.default.equal(state.M, Number.MAX_VALUE, 'view saturated');
    // Healthy ticks: z_t = −log_det_shrink < 0 at x = 0. Feed enough to bring
    // the exact log books back below the saturation point.
    const healthyTicks = Math.ceil((state.log_M - _wealth_1.LOG_MAX_WEALTH) / cell.safe_hotelling_params.precompiled_log_det_shrink) + 10;
    const calm = new Array(p).fill(0);
    for (let t = 0; t < healthyTicks; t++)
        step(calm);
    strict_1.default.equal(linearM, Infinity, 'the pre-0024 linear wealth is ABSORBED at Infinity forever');
    strict_1.default.ok(Number.isFinite(state.M) && state.M < Number.MAX_VALUE, `the log-domain view comes back down (M = ${state.M.toExponential(3)})`);
    strict_1.default.ok(Math.abs(Math.log(state.M) - state.log_M) < 1e-9, 'view ≡ exp(log books) once in range');
});
(0, node_test_1.test)('AC-3a: safe-Hotelling in-range parity — identical verdicts, log books ≡ linear replay at 1e-9', () => {
    const p = 3;
    const cell = identityCell(p, 1e-4, 0.5);
    const state = (0, hotelling_1.freshSafeHotellingState)();
    const rand = lcg(0xad0024);
    let linearM = 1;
    for (let t = 0; t < 200; t++) {
        // healthy-ish observations with occasional moderate excursions.
        const x = Array.from({ length: p }, () => (rand() - 0.5) * (t % 17 === 0 ? 6 : 2));
        const params = cell.safe_hotelling_params;
        const a = x.reduce((s, v) => s + v * v, 0);
        const b = x.reduce((s, v) => s + (v * v) / (1 + params.tau_squared), 0);
        const z = -params.precompiled_log_det_shrink + 0.5 * a - 0.5 * b;
        linearM = Math.max(1e-300, linearM * Math.exp(z));
        const v = (0, hotelling_1.evaluateSafeHotelling)({ cell, alpha: 1e-4 }, [...x], state);
        const linearVerdict = linearM >= 1 / 1e-4 ? 'fire' : 'clean';
        // after the first fire alphaConsumed makes subsequent 'fire' verdicts differ
        // in α accounting only; verdict string parity is what binds here.
        strict_1.default.equal(v.verdict, linearVerdict, `tick ${t}: verdict parity`);
        strict_1.default.ok(Math.abs(state.log_M - Math.log(linearM)) <= 1e-9 * Math.max(1, Math.abs(Math.log(linearM))), `tick ${t}: log books match linear replay`);
        strict_1.default.ok(Math.abs(state.M - linearM) <= 1e-9 * linearM, `tick ${t}: view matches linear replay`);
    }
});
(0, node_test_1.test)('AC-3b: betting in-range parity — wealth and fallback books match the linear replay', () => {
    const state = (0, betting_e_process_1.freshBettingState)();
    // Linear replay re-implements the pre-0024 update exactly (GRAPA/ONS bets
    // recomputed from the same running moments — shared deterministic inputs).
    const rand = lcg(0xbe77);
    let linearM = 1;
    let mean = 0;
    let m2 = 0;
    let bet = 0;
    let n = 0;
    const BET_CLIP = 1 - 1e-6;
    for (let t = 0; t < 500; t++) {
        const x = (rand() - 0.5) * 2 + (t > 250 ? 0.4 : 0); // drift onset mid-run
        const M = (0, betting_e_process_1.updateBettingState)(state, x, 0, 1, 0.01);
        // replay: boundedZ with B=3, sigma=1
        const zRaw = x / 3;
        const z = zRaw > 1 ? 1 : zRaw < -1 ? -1 : zRaw;
        let b = m2 > 0 ? mean / m2 : 0;
        if (!(Math.abs(b) <= BET_CLIP && Number.isFinite(b))) {
            const denomInner = 1 + bet * mean;
            if (!(m2 > 0) || Math.abs(denomInner) < 1e-9)
                b = 0;
            else {
                const grad = -mean / denomInner;
                const stepv = grad / Math.max(m2, 1e-6);
                b = bet - stepv;
                if (b > BET_CLIP)
                    b = BET_CLIP;
                if (b < -BET_CLIP)
                    b = -BET_CLIP;
            }
        }
        linearM = Math.max(1e-12, linearM * Math.max(0, 1 + b * z));
        bet = b;
        const n1 = n + 1;
        mean = mean + (z - mean) / n1;
        m2 = m2 + (z * z - m2) / n1;
        n = n1;
        strict_1.default.ok(Math.abs(M - linearM) <= 1e-9 * Math.max(1e-12, linearM), `tick ${t}: wealth parity (${M} vs ${linearM})`);
    }
    strict_1.default.ok(Math.abs(state.log_M - Math.log(linearM)) <= 1e-9 * Math.max(1, Math.abs(Math.log(linearM))), 'log books match');
});
(0, node_test_1.test)('AC-3c: spectral in-range parity — verdicts and wealth match the linear replay', () => {
    const params = {
        bootstrap_null_quantile: 0.9, min_peak_lag: 3, max_peak_lag: 10,
        spectral_variant: 'e_detector', null_mean: 0.42, null_std: 0.05, betting_delta: 0.015,
    };
    const state = (0, spectral_1.freshSpectralEDetectorState)();
    const rand = lcg(0x5bec);
    let linearM = 1;
    for (let t = 0; t < 300; t++) {
        const peak = 0.42 + (rand() - 0.5) * 0.1 + (t > 150 ? 0.05 : 0);
        const r = 0.015 / 0.05;
        const u = (peak - 0.42) / 0.05;
        const z = r * u - 0.5 * r * r;
        linearM = Math.max(1e-300, linearM * Math.exp(z));
        const v = (0, spectral_1.evaluateSpectralEDetector)({ params, alpha: 1e-4, signal: 's' }, peak, state);
        strict_1.default.ok(Math.abs(state.M - linearM) <= 1e-9 * linearM, `tick ${t}: wealth parity`);
        strict_1.default.equal(v.verdict === 'fire', linearM >= 1e4, `tick ${t}: verdict parity with the linear replay`);
    }
});
(0, node_test_1.test)('AC-4: betting long-run overflow — linear replay hits Infinity, log books stay exact, view saturates', () => {
    const state = (0, betting_e_process_1.freshBettingState)();
    let linearM = 1;
    let overflowedAt = -1;
    // Sustained maximal drift: x far beyond the clip ⇒ z = 1 every tick; GRAPA
    // bet → 1 ⇒ factor → ~2 per tick; the linear product overflows near tick
    // ~1100 (log2(MAX_VALUE) ≈ 1024 plus bet warm-up).
    for (let t = 0; t < 3000; t++) {
        (0, betting_e_process_1.updateBettingState)(state, 100, 0, 1, 0.01);
        if (Number.isFinite(linearM)) {
            // replay only the wealth factor via the state's own bet decision — the
            // moments are shared, so recompute the factor from the post-update bet
            // sequence is not available; instead replay a lower bound: factor ≥ 1
            // once bet > 0 with z = 1, so linear wealth ≥ product of (1 + bet_t).
            linearM = linearM * (1 + state.bet); // bet_t · z_t with z_t = 1
            if (!Number.isFinite(linearM))
                overflowedAt = t;
        }
    }
    strict_1.default.ok(overflowedAt > 0, `linear replay overflows (at tick ${overflowedAt})`);
    strict_1.default.equal(state.M, Number.MAX_VALUE, 'view saturates at MAX_VALUE, never Infinity');
    strict_1.default.ok(Number.isFinite(state.log_M) && state.log_M > _wealth_1.LOG_MAX_WEALTH, 'log books exact and above saturation');
    strict_1.default.equal(JSON.parse(JSON.stringify({ e: state.M })).e, Number.MAX_VALUE, 'JSON-safe');
});
(0, node_test_1.test)('AC-5: eBenjaminiHochbergLog ≡ eBenjaminiHochberg on in-range inputs (ties and permutations included), and correct beyond the linear range', () => {
    const rand = lcg(0xebff);
    for (let trial = 0; trial < 50; trial++) {
        const N = 1 + Math.floor(rand() * 40);
        const es = Array.from({ length: N }, () => {
            const u = rand();
            // mix: sub-1 e-values, moderate, large, and exact ties
            if (u < 0.25)
                return 0.5;
            if (u < 0.5)
                return rand() * 2;
            if (u < 0.75)
                return 10 + rand() * 100;
            return 1e6;
        });
        const q = 0.05 + rand() * 0.5;
        const lin = (0, e_bh_1.eBenjaminiHochberg)(es, q);
        const log = (0, e_bh_1.eBenjaminiHochbergLog)(es.map((e) => Math.log(e)), q);
        strict_1.default.deepEqual(log.selected, lin.selected, `trial ${trial}: selection parity`);
        strict_1.default.equal(log.K, lin.K, `trial ${trial}: K parity`);
    }
    // Beyond the linear range: log e-values 800 and 750 are both Infinity in
    // linear space; with N/q pushing R to depend on the true magnitudes the log
    // variant still ranks them exactly. Construct N=4 with two overflowing and
    // two tiny values at q small enough that selection is the two large ones.
    const logEs = [800, 750, Math.log(0.1), Math.log(0.2)];
    const out = (0, e_bh_1.eBenjaminiHochbergLog)(logEs, 0.05);
    strict_1.default.deepEqual(out.selected, [0, 1], 'log-only inputs select the truly-large pair');
    // and the linear path on the exp'd inputs (Infinity, Infinity, .1, .2) agrees
    // on the SET here — the log variant's added value is exact ordering + no
    // Infinity in any intermediate, asserted by construction above.
    const linInf = (0, e_bh_1.eBenjaminiHochberg)(logEs.map(Math.exp), 0.05);
    strict_1.default.deepEqual(linInf.selected, [0, 1], 'documented: linear set-selection survives overflow; the record does not');
});
(0, node_test_1.test)('AC-6: deserialization healing — pre-0024 states adopt log(M); a poisoned persisted Infinity heals to the saturation point', () => {
    // pre-0024 shape: no log_M field.
    const old = { M: 123.5, n: 7, alphaConsumed: 0 };
    const cell = identityCell(2, 1e-4, 1);
    (0, hotelling_1.evaluateSafeHotelling)({ cell, alpha: 1e-4 }, [0, 0], old);
    strict_1.default.ok(Number.isFinite(old.log_M), 'healed without NaN');
    const params = cell.safe_hotelling_params;
    strict_1.default.ok(Math.abs(old.log_M - (Math.log(123.5) - params.precompiled_log_det_shrink)) < 1e-12, 'adopted log(M) then applied the healthy-tick decrement');
    // poisoned persisted state from the defect era:
    const poisoned = { M: Infinity, n: 60, alphaConsumed: 1e-4 };
    (0, hotelling_1.evaluateSafeHotelling)({ cell, alpha: 1e-4 }, [0, 0], poisoned);
    strict_1.default.ok(Number.isFinite(poisoned.log_M), 'Infinity healed to the saturation point');
    strict_1.default.ok(Number.isFinite(poisoned.M), 'and the view is finite from the first post-upgrade tick');
    // direct helper checks
    strict_1.default.equal((0, _wealth_1.healLogWealth)(undefined, 0, -5), -5, 'nonpositive M heals to the floor');
    strict_1.default.equal((0, _wealth_1.healLogWealth)(3.25, Infinity, -5), 3.25, 'present log_M always wins');
    strict_1.default.equal((0, _wealth_1.wealthView)(_wealth_1.LOG_MAX_WEALTH + 1), Number.MAX_VALUE, 'view saturation');
    strict_1.default.ok(Math.abs((0, _wealth_1.wealthView)(1) - Math.E) < 1e-12, 'view identity in range');
});
//# sourceMappingURL=adr-0026-log-domain-wealth.test.js.map
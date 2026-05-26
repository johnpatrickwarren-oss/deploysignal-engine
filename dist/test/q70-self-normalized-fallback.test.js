"use strict";
// test/q70-self-normalized-fallback.test.ts — Q70 SLICE 2 math + stamping.
//
// Covers the §7 EmpiricalProcessLILBound math primitives (closed-form
// runtime evaluation + Markov-conservative C-constant solver +
// `buildLilBoundHyperparams` constructor) that ship in SLICE 2, plus
// the NAB per-dataset calibrator's fallback-stamping behavior.
//
// Anti-scope at SLICE 2 v0.1 (deferred to SLICE 3 with named owners):
//   - §6 BetaBinomialMixture bisection (sub-Bernoulli; activated only for
//     family_E_conformal on bounded_probability signals; NAB datasets
//     are unbounded so §7 LIL covers our case)
//   - Library-tight Brent-method C calibration (SLICE 2 uses the
//     Markov-conservative analytical upper bound `C = -2·log(α)`)
//   - Per-detector dispatch wiring (CUSUM log-scale vs LIL √V_t scale
//     units-mapping requires architect cross-check per Q70 spec
//     § Library cross-check status item 2)
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
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const fs = __importStar(require("node:fs"));
const self_normalized_e_process_fallback_1 = require("../detectors/self-normalized-e-process-fallback");
const run_nab_per_dataset_1 = require("../tools/run-nab-per-dataset");
// ── §7 LIL math primitives ─────────────────────────────────────────
(0, node_test_1.test)('Q70 SLICE 2 / §7 LIL — evaluateLilBound: closed-form at t=1 with t_min=1', () => {
    // bound(1) = A · sqrt((log(1 + log(1/1)) + C) / 1) = A · sqrt((log(1) + C))
    //          = A · sqrt(C)   since log(1) = 0
    const p = { variant: 'lil_bound', alpha: 1e-4, t_min: 1, A: 0.85, C: 18.42 };
    const v = (0, self_normalized_e_process_fallback_1.evaluateLilBound)(p, 1);
    const expected = 0.85 * Math.sqrt(18.42);
    strict_1.default.ok(Math.abs(v - expected) < 1e-9, `bound(1)=${v} expected=${expected}`);
});
(0, node_test_1.test)('Q70 SLICE 2 / §7 LIL — evaluateLilBound: bound shrinks with t (sqrt decay)', () => {
    const p = { variant: 'lil_bound', alpha: 1e-4, t_min: 1, A: 0.85, C: 18.42 };
    const b1 = (0, self_normalized_e_process_fallback_1.evaluateLilBound)(p, 10);
    const b2 = (0, self_normalized_e_process_fallback_1.evaluateLilBound)(p, 100);
    const b3 = (0, self_normalized_e_process_fallback_1.evaluateLilBound)(p, 1000);
    strict_1.default.ok(b1 > b2 && b2 > b3, `expected monotonic decrease; got ${b1} → ${b2} → ${b3}`);
});
(0, node_test_1.test)('Q70 SLICE 2 / §7 LIL — evaluateLilBound throws on t < t_min', () => {
    const p = { variant: 'lil_bound', alpha: 1e-4, t_min: 10, A: 0.85, C: 18.42 };
    strict_1.default.throws(() => (0, self_normalized_e_process_fallback_1.evaluateLilBound)(p, 5), /t \(5\) must be >= t_min \(10\)/);
});
(0, node_test_1.test)('Q70 SLICE 2 / §7 LIL — assertLilBoundHyperparams validates library asserts', () => {
    // α must be in (0,1)
    strict_1.default.throws(() => (0, self_normalized_e_process_fallback_1.assertLilBoundHyperparams)({ variant: 'lil_bound', alpha: 0, t_min: 1, A: 0.85, C: 1 }), /alpha/);
    strict_1.default.throws(() => (0, self_normalized_e_process_fallback_1.assertLilBoundHyperparams)({ variant: 'lil_bound', alpha: 1, t_min: 1, A: 0.85, C: 1 }), /alpha/);
    // t_min must be ≥ 1
    strict_1.default.throws(() => (0, self_normalized_e_process_fallback_1.assertLilBoundHyperparams)({ variant: 'lil_bound', alpha: 0.5, t_min: 0, A: 0.85, C: 1 }), /t_min/);
    // A must be > 1/sqrt(2) ≈ 0.7071
    strict_1.default.throws(() => (0, self_normalized_e_process_fallback_1.assertLilBoundHyperparams)({ variant: 'lil_bound', alpha: 0.5, t_min: 1, A: 0.5, C: 1 }), /A/);
    // C must be finite
    strict_1.default.throws(() => (0, self_normalized_e_process_fallback_1.assertLilBoundHyperparams)({ variant: 'lil_bound', alpha: 0.5, t_min: 1, A: 0.85, C: Infinity }), /C/);
    // Valid passes
    strict_1.default.doesNotThrow(() => (0, self_normalized_e_process_fallback_1.assertLilBoundHyperparams)({ variant: 'lil_bound', alpha: 1e-4, t_min: 1, A: 0.85, C: 18.42 }));
});
// ── C-constant solver ──────────────────────────────────────────────
(0, node_test_1.test)('Q70 SLICE 2 — computeLilCConstantConservative: matches Markov upper bound C = -2 log α', () => {
    // For α = 1e-4: C = -2 · log(1e-4) = 2 · 9.2103... ≈ 18.4207
    const c = (0, self_normalized_e_process_fallback_1.computeLilCConstantConservative)(1e-4);
    strict_1.default.ok(Math.abs(c - 18.42068) < 1e-3, `C(1e-4) = ${c}, expected ≈ 18.42`);
});
(0, node_test_1.test)('Q70 SLICE 2 — computeLilCConstantConservative: monotone decreasing in α', () => {
    // Smaller α → larger C → wider envelope
    const cTight = (0, self_normalized_e_process_fallback_1.computeLilCConstantConservative)(1e-4);
    const cLoose = (0, self_normalized_e_process_fallback_1.computeLilCConstantConservative)(0.05);
    strict_1.default.ok(cTight > cLoose, `tighter α should give larger C; got ${cTight} ≯ ${cLoose}`);
});
(0, node_test_1.test)('Q70 SLICE 2 — computeLilCConstantConservative rejects α outside (0,1)', () => {
    strict_1.default.throws(() => (0, self_normalized_e_process_fallback_1.computeLilCConstantConservative)(0), /alpha/);
    strict_1.default.throws(() => (0, self_normalized_e_process_fallback_1.computeLilCConstantConservative)(1), /alpha/);
    strict_1.default.throws(() => (0, self_normalized_e_process_fallback_1.computeLilCConstantConservative)(-0.1), /alpha/);
});
// ── buildLilBoundHyperparams constructor ──────────────────────────
(0, node_test_1.test)('Q70 SLICE 2 — buildLilBoundHyperparams: defaults match Q70.4 ASKs', () => {
    const p = (0, self_normalized_e_process_fallback_1.buildLilBoundHyperparams)(1e-4);
    strict_1.default.equal(p.variant, 'lil_bound');
    strict_1.default.equal(p.alpha, 1e-4);
    strict_1.default.equal(p.t_min, self_normalized_e_process_fallback_1.LIL_T_MIN_DEFAULT); // = 1, library canonical (ASK A)
    strict_1.default.equal(p.A, self_normalized_e_process_fallback_1.LIL_A_DEFAULT); // = 0.85, library canonical (ASK A)
    strict_1.default.ok(Math.abs(p.C - 18.42068) < 1e-3, `C should be Markov-conservative; got ${p.C}`);
});
(0, node_test_1.test)('Q70 SLICE 2 — buildLilBoundHyperparams: option overrides apply', () => {
    const p = (0, self_normalized_e_process_fallback_1.buildLilBoundHyperparams)(1e-4, { A: 0.9, t_min: 5 });
    strict_1.default.equal(p.A, 0.9);
    strict_1.default.equal(p.t_min, 5);
    // C is determined by α only in the conservative form
    strict_1.default.ok(Math.abs(p.C - 18.42068) < 1e-3);
});
// ── Variant dispatch ───────────────────────────────────────────────
(0, node_test_1.test)('Q70 SLICE 2 — evaluateSelfNormalizedBound dispatches LIL variant', () => {
    const p = (0, self_normalized_e_process_fallback_1.buildLilBoundHyperparams)(1e-4);
    const v = (0, self_normalized_e_process_fallback_1.evaluateSelfNormalizedBound)(p, 100);
    const direct = (0, self_normalized_e_process_fallback_1.evaluateLilBound)(p, 100);
    strict_1.default.equal(v, direct);
});
(0, node_test_1.test)('Q70 SLICE 2 — §6 BetaBinomial bound throws notImplementedSlice1 (SLICE 3 follow-on)', () => {
    // SLICE 2 ships §7 LIL only; §6 BetaBinomial is deferred to SLICE 3
    // per spec § Q70.2 architectural rationale (sub-Bernoulli specific;
    // family_E_conformal on bounded_probability signals only).
    strict_1.default.throws(() => (0, self_normalized_e_process_fallback_1.evaluateBetaBinomialBound)({
        variant: 'beta_binomial_mixture',
        alpha: 1e-4, v_opt: 100, alpha_opt: 0.05, g: 0.5, h: 0.5, is_one_sided: true,
    }, 100), /\[Q70 SLICE 1\] §6 BetaBinomialMixture/);
});
// ── NAB per-dataset calibrator stamping ────────────────────────────
(0, node_test_1.test)('Q70 SLICE 2 / calibrator — low-φ̂ data: no LIL fallback stamped', () => {
    // Synthetic iid Gaussian-like data; expected φ̂ ≈ 0.
    const N = 1000;
    const values = [];
    let seed = 0xCAFE;
    const rng = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
    for (let i = 0; i < N; i++)
        values.push(rng() * 2 - 1);
    const { provenance } = (0, run_nab_per_dataset_1.buildPerDatasetConfig)(values, 'p99_latency', 0.15);
    strict_1.default.ok(Math.abs(provenance.derived.ar1_phi) < 0.3, `expected near-zero φ̂; got ${provenance.derived.ar1_phi}`);
    strict_1.default.equal(provenance.self_normalized_fallback, undefined, 'low φ̂ should NOT trigger fallback');
});
(0, node_test_1.test)('Q70 SLICE 2 / calibrator — high-φ̂ data: LIL fallback stamped with hyperparams', () => {
    // Synthetic AR(1) data with φ = 0.9; expected φ̂ close to that.
    const N = 1000;
    const values = [];
    let prev = 0;
    let seed = 0xBEEF;
    const rng = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
    for (let i = 0; i < N; i++) {
        const eps = rng() * 2 - 1;
        prev = 0.9 * prev + eps;
        values.push(prev);
    }
    const { provenance } = (0, run_nab_per_dataset_1.buildPerDatasetConfig)(values, 'p99_latency', 0.15);
    strict_1.default.ok(Math.abs(provenance.derived.ar1_phi) >= 0.5, `expected high φ̂; got ${provenance.derived.ar1_phi}`);
    strict_1.default.ok(provenance.self_normalized_fallback, 'high φ̂ should trigger fallback stamping');
    strict_1.default.equal(provenance.self_normalized_fallback.reason, 'ar1_phi_exceeds_threshold');
    strict_1.default.equal(provenance.self_normalized_fallback.lil_hyperparams.variant, 'lil_bound');
    strict_1.default.equal(provenance.self_normalized_fallback.lil_hyperparams.alpha, 4e-4);
});
(0, node_test_1.test)('Q70 SLICE 2 / calibrator — NAB-style real dataset (φ ≈ 0.95) stamps fallback', () => {
    // Match the diagnostic finding on realKnownCause/ambient_temperature
    // (n_ticks=7267, calibration: mean=70.2, σ²=9.17, φ̂≈0.95).
    // Use a real NAB CSV if available; otherwise simulate.
    const nabCsv = '/Users/johnwarren/concord/NAB/data/realKnownCause/ambient_temperature_system_failure.csv';
    if (!fs.existsSync(nabCsv)) {
        // Skip if NAB repo not co-located; this test is opportunistic.
        return;
    }
    const raw = fs.readFileSync(nabCsv, 'utf8').split('\n').slice(1).filter((l) => l.trim().length > 0);
    const values = raw.map((line) => parseFloat(line.split(',')[1]));
    const { provenance } = (0, run_nab_per_dataset_1.buildPerDatasetConfig)(values, 'p99_latency', 0.15);
    strict_1.default.ok(provenance.derived.ar1_phi > 0.5, `NAB ambient_temperature should have high φ̂; got ${provenance.derived.ar1_phi}`);
    strict_1.default.ok(provenance.self_normalized_fallback, 'fallback should be stamped on high-φ̂ NAB data');
});
(0, node_test_1.test)('Q70 SLICE 2 / calibrator — stamped LIL hyperparams validate against library asserts', () => {
    // High-φ̂ data → stamped hyperparams should pass assertLilBoundHyperparams.
    const N = 500;
    const values = [];
    let prev = 0;
    let seed = 0xFACE;
    const rng = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
    for (let i = 0; i < N; i++) {
        const eps = rng() * 2 - 1;
        prev = 0.85 * prev + eps;
        values.push(prev);
    }
    const { provenance } = (0, run_nab_per_dataset_1.buildPerDatasetConfig)(values, 'p99_latency', 0.15);
    if (provenance.self_normalized_fallback) {
        strict_1.default.doesNotThrow(() => (0, self_normalized_e_process_fallback_1.assertLilBoundHyperparams)(provenance.self_normalized_fallback.lil_hyperparams));
    }
});
//# sourceMappingURL=q70-self-normalized-fallback.test.js.map
"use strict";
// test/q70-phase-e-slice10-substrate.test.ts — Phase E SLICE 10 substrate
// file format: schema validation + fit/load round-trip.
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
const os = __importStar(require("node:os"));
const path = __importStar(require("node:path"));
const fit_production_substrate_1 = require("../tools/fit-production-substrate");
const load_production_substrate_1 = require("../tools/load-production-substrate");
const production_ar_substrate_1 = require("../types/production-ar-substrate");
function syntheticAr1(N, phi, seed) {
    let s = seed;
    const rng = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
    const out = [];
    let prev = 0;
    for (let i = 0; i < N; i++) {
        const eps = (rng() - 0.5) * 2;
        prev = phi * prev + eps;
        out.push(prev);
    }
    return out;
}
// ── Schema validation ──────────────────────────────────────────────
(0, node_test_1.test)('SLICE 10 isProductionArSubstrate — rejects wrong version', () => {
    strict_1.default.equal((0, production_ar_substrate_1.isProductionArSubstrate)({ version: 'wrong-version' }), false);
    strict_1.default.equal((0, production_ar_substrate_1.isProductionArSubstrate)({ version: 'phase-e-slice10-v0' }), false);
});
(0, node_test_1.test)('SLICE 10 isProductionArSubstrate — rejects missing required fields', () => {
    strict_1.default.equal((0, production_ar_substrate_1.isProductionArSubstrate)({ version: 'phase-e-slice10-v1' }), false);
    strict_1.default.equal((0, production_ar_substrate_1.isProductionArSubstrate)({
        version: 'phase-e-slice10-v1',
        source: { signal_name: 's', n_observations: 100 },
        baseline: { mean: 0, sigma_squared_marginal: 1 },
        // ar1 missing
        generated_at: '2026-05-26T00:00:00Z',
    }), false);
});
(0, node_test_1.test)('SLICE 10 isProductionArSubstrate — accepts minimal valid substrate', () => {
    const minimal = {
        version: 'phase-e-slice10-v1',
        source: { signal_name: 'p99_latency', n_observations: 1000 },
        baseline: { mean: 100, sigma_squared_marginal: 25 },
        ar1: { phi: 0.5, sigma_squared_innovation: 18.75 },
        generated_at: '2026-05-26T00:00:00Z',
    };
    strict_1.default.equal((0, production_ar_substrate_1.isProductionArSubstrate)(minimal), true);
});
// ── fit + load round-trip ──────────────────────────────────────────
(0, node_test_1.test)('SLICE 10 fit + write + load round-trip preserves all fields', () => {
    const values = syntheticAr1(500, 0.7, 0xC0DE);
    const substrate = (0, fit_production_substrate_1.fitProductionSubstrate)(values, {
        signalName: 'p99_latency',
        description: 'unit test',
        fitArPCalibration: true,
        fitSeasonalDecomposition: false, // AR(1) data has no period
        fitSpectral: true,
    });
    const tmp = path.join(os.tmpdir(), `slice10-roundtrip-${Date.now()}.json`);
    fs.writeFileSync(tmp, JSON.stringify(substrate, null, 2));
    try {
        const loaded = (0, load_production_substrate_1.loadProductionSubstrate)(tmp);
        // Normalize via JSON round-trip on both sides so undefined fields
        // collapse the same way (JSON.stringify drops undefined).
        strict_1.default.deepEqual(JSON.parse(JSON.stringify(loaded)), JSON.parse(JSON.stringify(substrate)), 'round-trip should preserve all set fields');
    }
    finally {
        if (fs.existsSync(tmp))
            fs.unlinkSync(tmp);
    }
});
(0, node_test_1.test)('SLICE 10 fitProductionSubstrate — minimal substrate has only required fields', () => {
    const values = syntheticAr1(100, 0.3, 0xDEAD);
    const s = (0, fit_production_substrate_1.fitProductionSubstrate)(values, { signalName: 'minimal_signal' });
    strict_1.default.ok(s.version === 'phase-e-slice10-v1');
    strict_1.default.equal(s.source.signal_name, 'minimal_signal');
    strict_1.default.equal(s.ar_p, undefined, 'AR(p) opt-out by default');
    strict_1.default.equal(s.seasonal, undefined, 'seasonal opt-out by default');
    strict_1.default.equal(s.spectral, undefined, 'spectral opt-out by default');
});
(0, node_test_1.test)('SLICE 10 fitProductionSubstrate — opting into all fits populates all optional blocks (with enough data)', () => {
    // Use seasonal-friendly synthetic so the seasonal block actually populates.
    let s = 0xFEED;
    const rng = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
    const values = [];
    for (let i = 0; i < 2000; i++) {
        values.push(10 * Math.sin(2 * Math.PI * i / 24) + (rng() - 0.5) * 2);
    }
    const sub = (0, fit_production_substrate_1.fitProductionSubstrate)(values, {
        signalName: 'periodic',
        fitArPCalibration: true,
        fitSeasonalDecomposition: true,
        fitSpectral: true,
    });
    strict_1.default.ok(sub.ar_p, 'ar_p expected');
    strict_1.default.ok(sub.seasonal, 'seasonal expected on periodic input');
    strict_1.default.ok(sub.spectral, 'spectral expected');
    strict_1.default.ok(sub.seasonal.period > 0, 'seasonal period > 0 on periodic input');
});
(0, node_test_1.test)('SLICE 10 loadProductionSubstrate — throws on bad file', () => {
    const tmp = path.join(os.tmpdir(), `slice10-bad-${Date.now()}.json`);
    fs.writeFileSync(tmp, JSON.stringify({ version: 'wrong' }));
    try {
        strict_1.default.throws(() => (0, load_production_substrate_1.loadProductionSubstrate)(tmp), /invalid substrate/);
    }
    finally {
        fs.unlinkSync(tmp);
    }
});
// ── Substrate → consumer mappings ──────────────────────────────────
(0, node_test_1.test)('SLICE 10 substrateToFamilyAPerSignal — uses seasonal innovation σ² when present', () => {
    const sub = {
        version: 'phase-e-slice10-v1',
        source: { signal_name: 's', n_observations: 100 },
        baseline: { mean: 50, sigma_squared_marginal: 100 },
        ar1: { phi: 0.5, sigma_squared_innovation: 75 },
        seasonal: {
            period: 24,
            seasonal_means: new Array(24).fill(0),
            acf_at_period: 0.8,
            ar1_phi_deseasoned: 0.2,
            sigma_squared_innovation_deseasoned: 50,
        },
        generated_at: '2026-05-26T00:00:00Z',
    };
    const familyA = (0, load_production_substrate_1.substrateToFamilyAPerSignal)(sub);
    strict_1.default.equal(familyA.baseline_sigma_squared, 50, 'seasonal innovation σ² should be stamped');
    strict_1.default.equal(familyA.ar1_phi, 0.2, 'seasonal-deseasoned φ should be stamped');
});
(0, node_test_1.test)('SLICE 10 substrateToFamilyAPerSignal — falls back to AR(p) innovation when no seasonal', () => {
    const sub = {
        version: 'phase-e-slice10-v1',
        source: { signal_name: 's', n_observations: 100 },
        baseline: { mean: 50, sigma_squared_marginal: 100 },
        ar1: { phi: 0.5, sigma_squared_innovation: 75 },
        ar_p: {
            p: 3,
            phi: [0.5, 0.1, -0.05],
            sigma_squared_innovation: 60,
            ic_kind: 'aic',
            reflection_coefficients: [0.5, 0.1, -0.05],
        },
        generated_at: '2026-05-26T00:00:00Z',
    };
    const familyA = (0, load_production_substrate_1.substrateToFamilyAPerSignal)(sub);
    strict_1.default.equal(familyA.baseline_sigma_squared, 60, 'AR(p) innovation σ² should be stamped');
});
(0, node_test_1.test)('SLICE 10 substrateToFamilyAPerSignal — falls back to AR(1) when no AR(p)/seasonal', () => {
    const sub = {
        version: 'phase-e-slice10-v1',
        source: { signal_name: 's', n_observations: 100 },
        baseline: { mean: 50, sigma_squared_marginal: 100 },
        ar1: { phi: 0.5, sigma_squared_innovation: 75 },
        generated_at: '2026-05-26T00:00:00Z',
    };
    const familyA = (0, load_production_substrate_1.substrateToFamilyAPerSignal)(sub);
    strict_1.default.equal(familyA.baseline_sigma_squared, 75, 'AR(1) innovation σ² should be stamped');
    strict_1.default.equal(familyA.ar1_phi, 0.5, 'raw AR(1) φ when no seasonal');
});
(0, node_test_1.test)('SLICE 10 substrateToFamilyDPerSignal — uses substrate spectral when present', () => {
    const sub = {
        version: 'phase-e-slice10-v1',
        source: { signal_name: 's', n_observations: 100 },
        baseline: { mean: 50, sigma_squared_marginal: 100 },
        ar1: { phi: 0.5, sigma_squared_innovation: 75 },
        spectral: {
            bootstrap_null_quantile: 0.85,
            min_peak_lag: 3,
            max_peak_lag: 10,
            empirically_calibrated: true,
        },
        generated_at: '2026-05-26T00:00:00Z',
    };
    const familyD = (0, load_production_substrate_1.substrateToFamilyDPerSignal)(sub);
    strict_1.default.equal(familyD.bootstrap_null_quantile, 0.85);
});
(0, node_test_1.test)('SLICE 10 substrateToDispatchOpts — returns seasonal info when present', () => {
    const sub = {
        version: 'phase-e-slice10-v1',
        source: { signal_name: 's', n_observations: 100 },
        baseline: { mean: 50, sigma_squared_marginal: 100 },
        ar1: { phi: 0.5, sigma_squared_innovation: 75 },
        seasonal: {
            period: 24,
            seasonal_means: new Array(24).fill(0),
            acf_at_period: 0.8,
            ar1_phi_deseasoned: 0.2,
            sigma_squared_innovation_deseasoned: 50,
        },
        ar_p: {
            p: 2,
            phi: [0.3, 0.1],
            sigma_squared_innovation: 70,
            ic_kind: 'aic',
            reflection_coefficients: [0.3, 0.1],
        },
        generated_at: '2026-05-26T00:00:00Z',
    };
    const opts = (0, load_production_substrate_1.substrateToDispatchOpts)(sub);
    strict_1.default.equal(opts.prewhitenMean, 50);
    strict_1.default.equal(opts.prewhitenPhi, 0.2, 'seasonal-deseasoned φ');
    strict_1.default.deepEqual(opts.prewhitenPhiArray, [0.3, 0.1]);
    strict_1.default.equal(opts.seasonalPeriod, 24);
    strict_1.default.equal(opts.seasonalMeans?.length, 24);
});
//# sourceMappingURL=q70-phase-e-slice10-substrate.test.js.map
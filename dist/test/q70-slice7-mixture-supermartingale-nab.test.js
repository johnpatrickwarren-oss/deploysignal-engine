"use strict";
// test/q70-slice7-mixture-supermartingale-nab.test.ts — SLICE 7 wires
// the Howard-Ramdas-2021 mixture-supermartingale detector into NAB dispatch.
//
// SLICE 1-3 deferred per-detector dispatch wiring of the §7 LIL fallback
// pending architect cross-check of the application formula. SLICE 3's
// empirical attempt showed |S_n| ≥ √V_n · b(V_n) over-fires at 100% on
// iid H₀. SLICE 7 resolves the cross-check: the LIL bound is for
// empirical-CDF / quantile work (per confseq library docstring), NOT
// mean-shift. The architecturally correct anytime-valid construct for
// mean-shift detection is the closed-form Gaussian mixture-supermartingale
// (Howard-Ramdas-2021 §4.2), already shipped at
// `detectors/family-a-mixture-supermartingale.ts`.
//
// These tests pin the SLICE 7 wiring contract: the NAB dispatcher
// supports `family_A_mixture_supermartingale` as a detector family;
// the calibrator stamps `mixture_supermartingale_params` + `ar1_phi`
// in the per-signal config; the detector pre-whitens internally.
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
const run_nab_validation_1 = require("../tools/run-nab-validation");
const run_nab_per_dataset_1 = require("../tools/run-nab-per-dataset");
// ── Calibrator stamping ────────────────────────────────────────────
(0, node_test_1.test)('SLICE 7 calibrator — stub config carries mixture_supermartingale_params + ar1_phi', () => {
    // Synthetic AR(1) phi=0.85 data so the calibrator estimates a
    // meaningful phi and stamps the mixture params.
    const N = 500;
    const values = [];
    let prev = 0;
    let seed = 0xBEEF;
    const rng = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
    for (let i = 0; i < N; i++) {
        const eps = rng() * 2 - 1;
        prev = 0.85 * prev + eps;
        values.push(prev);
    }
    const { config } = (0, run_nab_per_dataset_1.buildPerDatasetConfig)(values, 'p99_latency', 0.15);
    const perSig = config.baseline_cells.aggregate_fallback.family_A.per_signal.p99_latency;
    strict_1.default.ok(perSig.mixture_supermartingale_params, 'mixture_supermartingale_params expected on stub config');
    strict_1.default.equal(perSig.mixture_supermartingale_params.mixture_distribution, 'gaussian', 'heavy_tail signal class → gaussian mixture');
    strict_1.default.ok(perSig.mixture_supermartingale_params.gaussian_sigma_squared_prior > 0, 'gaussian_sigma_squared_prior expected positive');
    strict_1.default.ok(typeof perSig.ar1_phi === 'number', 'ar1_phi expected on stub config (consumed by detector internal pre-whitening)');
});
// ── Dispatch case ─────────────────────────────────────────────────
(0, node_test_1.test)('SLICE 7 dispatch — family_A_mixture_supermartingale routes through HR-2021 detector', () => {
    const N = 200;
    const values = [];
    // First 100 ticks: ~N(0, 1). Last 100 ticks: ~N(2, 1) (mean shift).
    let seed = 0xCAFE;
    const rng = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
    for (let i = 0; i < N; i++) {
        const z = (rng() - 0.5) * 4; // ~U(-2, 2), variance ~1.33
        values.push((i < 100 ? 0 : 2) + z);
    }
    const { config, provenance } = (0, run_nab_per_dataset_1.buildPerDatasetConfig)(values, 'p99_latency', 0.15);
    const tmp = path.join(os.tmpdir(), `slice7-disp-${Date.now()}.json`);
    fs.writeFileSync(tmp, JSON.stringify(config));
    try {
        const firings = (0, run_nab_validation_1.runDetectorOverDataset)('family_A_mixture_supermartingale', values, tmp, 'p99_latency');
        strict_1.default.equal(firings.length, N, 'one firing decision per tick');
        // At least one fire should occur in the post-shift region (ticks 100+).
        const postShiftFires = firings.filter((f) => f.fire && f.tick >= 100);
        strict_1.default.ok(postShiftFires.length > 0, `expected detector to fire on 2σ mean shift; got ${postShiftFires.length} post-shift fires`);
        // Statistic field should carry M_t.
        strict_1.default.ok(firings.every((f) => f.statistic_value !== undefined), 'mixture-SM dispatch should populate statistic_value with M_t');
        // Pre-probationary fires excluded from final score by scorePostProbationary —
        // but the dispatch returns ALL firings; scoring happens upstream.
        void provenance;
    }
    finally {
        fs.unlinkSync(tmp);
    }
});
(0, node_test_1.test)('SLICE 7 dispatch — falls back to all-false when mixture params missing', () => {
    // Build a config WITHOUT mixture_supermartingale_params (signal_class
    // outside the deriveMixtureSupermartingaleParams allowlist). We force
    // this by overwriting the per_signal block after build.
    const values = [];
    for (let i = 0; i < 100; i++)
        values.push(Math.sin(i / 10));
    const { config } = (0, run_nab_per_dataset_1.buildPerDatasetConfig)(values, 'p99_latency', 0.15);
    // Delete the stamped mixture params to simulate a pre-SLICE-7 config.
    delete config.baseline_cells.aggregate_fallback.family_A.per_signal.p99_latency.mixture_supermartingale_params;
    const tmp = path.join(os.tmpdir(), `slice7-fallback-${Date.now()}.json`);
    fs.writeFileSync(tmp, JSON.stringify(config));
    try {
        const firings = (0, run_nab_validation_1.runDetectorOverDataset)('family_A_mixture_supermartingale', values, tmp, 'p99_latency');
        strict_1.default.equal(firings.length, values.length);
        strict_1.default.ok(firings.every((f) => f.fire === false), 'config without mixture params should produce silent (all-false) dispatch');
    }
    finally {
        fs.unlinkSync(tmp);
    }
});
// ── Architect decision marker ─────────────────────────────────────
(0, node_test_1.test)('SLICE 7 architect decision — LIL primitive deprecation comment is in place', () => {
    const filePath = fs.existsSync(path.resolve(__dirname, '..', 'detectors', 'self-normalized-e-process-fallback.ts'))
        ? path.resolve(__dirname, '..', 'detectors', 'self-normalized-e-process-fallback.ts')
        : path.resolve(__dirname, '..', '..', 'detectors', 'self-normalized-e-process-fallback.ts');
    const src = fs.readFileSync(filePath, 'utf8');
    strict_1.default.ok(src.includes('SLICE 7 ARCHITECT DECISION'), 'self-normalized-e-process-fallback.ts must carry the SLICE 7 architect decision marker '
        + 'explaining the LIL primitive scope correction');
    strict_1.default.ok(src.includes('mean-shift detection'), 'comment should explicitly note the LIL primitive is NOT for mean-shift detection');
    strict_1.default.ok(src.includes('family-a-mixture-supermartingale'), 'comment should point readers to the correct mean-shift construct');
});
//# sourceMappingURL=q70-slice7-mixture-supermartingale-nab.test.js.map
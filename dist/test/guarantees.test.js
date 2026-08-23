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
// test/guarantees.test.ts — the guarantee table is total, honest, and live.
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const audit_1 = require("../types/audit");
const guarantees_1 = require("../guarantees");
const core = __importStar(require("../core"));
const validity_envelope_1 = require("../detectors/validity-envelope");
const ALL_IDS = [
    ...audit_1.DETECTOR_REGISTRY.A, ...audit_1.DETECTOR_REGISTRY.B, ...audit_1.DETECTOR_REGISTRY.C,
    ...audit_1.DETECTOR_REGISTRY.D, ...audit_1.DETECTOR_REGISTRY.E,
];
(0, node_test_1.describe)('guarantee table (WORKLIST C4)', () => {
    (0, node_test_1.test)('total over the registry: every detector id resolves to exactly one row', () => {
        for (const id of ALL_IDS) {
            const row = (0, guarantees_1.guaranteeFor)(id);
            strict_1.default.ok(row, `no guarantee row for registry id '${id}'`);
        }
    });
    (0, node_test_1.test)('longest-prefix routing: the betting MMD id does not fall through to the retired row', () => {
        strict_1.default.equal((0, guarantees_1.guaranteeFor)('sequential_mmd_betting_e_process').validityClass, 'ville_anytime_valid');
        strict_1.default.equal((0, guarantees_1.guaranteeFor)('sequential_mmd').evidence.includes('Q68'), true);
    });
    (0, node_test_1.test)('axis-2 entries are the live envelope objects, not copies', () => {
        strict_1.default.equal((0, guarantees_1.guaranteeFor)('betting_e_process_ttft').estimatedBaseline, validity_envelope_1.BETTING_E_PROCESS_ENVELOPE);
        strict_1.default.equal((0, guarantees_1.guaranteeFor)('page_cusum_ttft').estimatedBaseline, validity_envelope_1.MIXTURE_SUPERMARTINGALE_ENVELOPE);
    });
    (0, node_test_1.test)('no unpriced alpha: only ville/priced/classical classes may spend', () => {
        for (const row of guarantees_1.GUARANTEE_TABLE) {
            if (row.alphaPolicy === 'none')
                continue;
            strict_1.default.notEqual(row.validityClass, 'heuristic', `heuristic row '${row.detector}' must not spend alpha`);
            strict_1.default.notEqual(row.validityClass, 'retracted', `retracted row '${row.detector}' must not spend alpha`);
            if (row.validityClass === 'bounded_priced') {
                strict_1.default.equal(row.alphaPolicy, 'priced_spend_requires_c_bound', `bounded_priced row '${row.detector}' may spend only under the c-bound`);
            }
        }
    });
    (0, node_test_1.test)('the Family D e-detector row carries the measured reclassification, dated', () => {
        const row = (0, guarantees_1.guaranteeFor)('spectral_e_detector_kv_cache');
        strict_1.default.equal(row.validityClass, 'bounded_priced');
        for (const needle of ['0.576', '2026-08-01', '1.0636', 'c/alpha']) {
            strict_1.default.ok(row.evidence.includes(needle), `evidence missing '${needle}'`);
        }
    });
    (0, node_test_1.test)('blanks are explicit: Families C, D, E carry no envelope and say so', () => {
        for (const id of ['hotelling_t2_safe', 'spectral_e_detector_kv_cache',
            'mahalanobis_conformal_baseline']) {
            strict_1.default.equal((0, guarantees_1.guaranteeFor)(id).estimatedBaseline, 'unrecorded');
        }
    });
    (0, node_test_1.test)('the retraction stays visible where the table lives', () => {
        strict_1.default.equal(guarantees_1.ESTIMATED_BASELINE_GUARANTEES.nuisance_robust_bf_e_value.validUnderEstimatedBaseline, false);
    });
    (0, node_test_1.test)('manifest round-trips as JSON with one entry per row', () => {
        const parsed = JSON.parse((0, guarantees_1.guaranteeManifest)());
        strict_1.default.equal(parsed.length, guarantees_1.GUARANTEE_TABLE.length);
    });
    (0, node_test_1.test)('the core.ts heuristic layer is covered: heuristic, spends no alpha, exports live', () => {
        strict_1.default.equal(guarantees_1.HEURISTIC_CORE_GUARANTEE.validityClass, 'heuristic');
        strict_1.default.equal(guarantees_1.HEURISTIC_CORE_GUARANTEE.alphaPolicy, 'none');
        strict_1.default.ok(Object.isFrozen(guarantees_1.HEURISTIC_CORE_GUARANTEE));
        // Every export the entry claims to cover actually exists in core.ts, so the entry
        // cannot drift from the module it describes.
        for (const name of guarantees_1.HEURISTIC_CORE_GUARANTEE.exports) {
            strict_1.default.ok(name in core, `HEURISTIC_CORE_GUARANTEE covers '${name}' but core.ts does not export it`);
        }
    });
    (0, node_test_1.test)('the Family B row points at the trend layer that sets its thresholds', () => {
        const row = (0, guarantees_1.guaranteeFor)('kv_saturation');
        strict_1.default.equal(row.family, 'B');
        strict_1.default.ok(row.implementation.includes('core.ts'), 'Family B implementation must name the core.ts trend layer');
        strict_1.default.ok(row.implementation.includes('HEURISTIC_CORE_GUARANTEE'));
    });
});
//# sourceMappingURL=guarantees.test.js.map
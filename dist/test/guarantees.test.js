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
const guarantees_1 = require("../guarantees");
const audit_1 = require("../types/audit");
const guarantees_2 = require("../guarantees");
const core = __importStar(require("../core"));
const validity_envelope_1 = require("../detectors/validity-envelope");
const ALL_IDS = [
    ...audit_1.DETECTOR_REGISTRY.A, ...audit_1.DETECTOR_REGISTRY.B, ...audit_1.DETECTOR_REGISTRY.C,
    ...audit_1.DETECTOR_REGISTRY.D, ...audit_1.DETECTOR_REGISTRY.E,
];
(0, node_test_1.describe)('guarantee table (WORKLIST C4)', () => {
    (0, node_test_1.test)('total over the registry: every detector id resolves to exactly one row', () => {
        for (const id of ALL_IDS) {
            const row = (0, guarantees_2.guaranteeFor)(id);
            strict_1.default.ok(row, `no guarantee row for registry id '${id}'`);
        }
    });
    (0, node_test_1.test)('longest-prefix routing: the betting MMD id does not fall through to the retired row', () => {
        strict_1.default.equal((0, guarantees_2.guaranteeFor)('sequential_mmd_betting_e_process').validityClass, 'ville_anytime_valid');
        strict_1.default.equal((0, guarantees_2.guaranteeFor)('sequential_mmd').evidence.includes('Q68'), true);
    });
    (0, node_test_1.test)('C64 (a): the six safe_t_e_value_* ids are registered and resolve to the terminal e-value row', () => {
        const signals = ['p99_latency', 'ttft', 'eval_score', 'tool_success_rate', 'downstream_err', 'cost_req'];
        for (const sig of signals) {
            const id = `safe_t_e_value_${sig}`;
            strict_1.default.ok(audit_1.DETECTOR_REGISTRY.A.includes(id), `${id} not in DETECTOR_REGISTRY.A`);
            const row = (0, guarantees_2.guaranteeFor)(id);
            strict_1.default.equal(row.validityClass, 'e_value_terminal');
            strict_1.default.equal(row.alphaPolicy, 'classical_epoch_alpha', 'one look per canary spends alpha once');
            strict_1.default.equal(row.estimatedBaseline, guarantees_2.ESTIMATED_BASELINE_GUARANTEES.safe_t_e_value, 'the live safe-t envelope');
            strict_1.default.equal(row.approximateEValue.form, 'e_value');
            strict_1.default.ok(row.evidence.includes('2026-09-03T18182Z'), 'evidence names the C64 (d) run');
        }
        // the row must not be mistaken for an e-process: the class is terminal, never ville
        strict_1.default.notEqual((0, guarantees_2.guaranteeFor)('safe_t_e_value_ttft').validityClass, 'ville_anytime_valid');
    });
    (0, node_test_1.test)('axis-2 entries are the live envelope objects, not copies', () => {
        strict_1.default.equal((0, guarantees_2.guaranteeFor)('betting_e_process_ttft').estimatedBaseline, validity_envelope_1.BETTING_E_PROCESS_ENVELOPE);
        strict_1.default.equal((0, guarantees_2.guaranteeFor)('page_cusum_ttft').estimatedBaseline, validity_envelope_1.MIXTURE_SUPERMARTINGALE_ENVELOPE);
    });
    (0, node_test_1.test)('no unpriced alpha: only ville/priced/classical classes may spend', () => {
        for (const row of guarantees_2.GUARANTEE_TABLE) {
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
        const row = (0, guarantees_2.guaranteeFor)('spectral_e_detector_kv_cache');
        strict_1.default.equal(row.validityClass, 'bounded_priced');
        for (const needle of ['0.576', '2026-08-01', '1.0636', 'c/alpha']) {
            strict_1.default.ok(row.evidence.includes(needle), `evidence missing '${needle}'`);
        }
    });
    (0, node_test_1.test)('blanks are explicit: Families C, D, E carry no envelope and say so', () => {
        for (const id of ['hotelling_t2_safe', 'spectral_e_detector_kv_cache',
            'mahalanobis_conformal_baseline']) {
            strict_1.default.equal((0, guarantees_2.guaranteeFor)(id).estimatedBaseline, 'unrecorded');
        }
    });
    (0, node_test_1.test)('the retraction stays visible where the table lives', () => {
        strict_1.default.equal(guarantees_2.ESTIMATED_BASELINE_GUARANTEES.nuisance_robust_bf_e_value.validUnderEstimatedBaseline, false);
    });
    (0, node_test_1.test)('manifest round-trips as JSON with one entry per row plus the heuristic core', () => {
        const parsed = JSON.parse((0, guarantees_2.guaranteeManifest)());
        strict_1.default.equal(parsed.length, guarantees_2.GUARANTEE_TABLE.length + 1);
        const core = parsed[parsed.length - 1];
        strict_1.default.equal(core.kind, 'heuristic_core');
        strict_1.default.equal(core.validityClass, 'heuristic');
        strict_1.default.equal(core.alphaPolicy, 'none');
    });
    (0, node_test_1.test)('the core.ts heuristic layer is covered: heuristic, spends no alpha, exports live', () => {
        strict_1.default.equal(guarantees_2.HEURISTIC_CORE_GUARANTEE.validityClass, 'heuristic');
        strict_1.default.equal(guarantees_2.HEURISTIC_CORE_GUARANTEE.alphaPolicy, 'none');
        strict_1.default.ok(Object.isFrozen(guarantees_2.HEURISTIC_CORE_GUARANTEE));
        // Every export the entry claims to cover actually exists in core.ts, so the entry
        // cannot drift from the module it describes.
        for (const name of guarantees_2.HEURISTIC_CORE_GUARANTEE.exports) {
            strict_1.default.ok(name in core, `HEURISTIC_CORE_GUARANTEE covers '${name}' but core.ts does not export it`);
        }
    });
    (0, node_test_1.test)('the Family B row points at the trend layer that sets its thresholds', () => {
        const row = (0, guarantees_2.guaranteeFor)('kv_saturation');
        strict_1.default.equal(row.family, 'B');
        strict_1.default.ok(row.implementation.includes('core.ts'), 'Family B implementation must name the core.ts trend layer');
        strict_1.default.ok(row.implementation.includes('HEURISTIC_CORE_GUARANTEE'));
    });
});
// ── Axis 3 (C61, 2026-09-02): the (epsilon, delta)-approximate e-value form ──────────────
(0, node_test_1.test)('axis 3 is total: every row and the core layer state an approximate-e-value form', () => {
    for (const row of guarantees_2.GUARANTEE_TABLE) {
        strict_1.default.ok(row.approximateEValue && row.approximateEValue.form, `${row.detector}: no axis 3`);
    }
    strict_1.default.equal(guarantees_2.HEURISTIC_CORE_GUARANTEE.approximateEValue.form, 'not_e_value');
});
(0, node_test_1.test)('axis 3 is consistent with axes 1 and 2', () => {
    for (const row of guarantees_2.GUARANTEE_TABLE) {
        const a = row.approximateEValue;
        // a genuine e-value claim needs a recorded envelope; nothing in the registry table qualifies today
        if (a.form === 'e_value')
            strict_1.default.notEqual(row.estimatedBaseline, 'unrecorded', `${row.detector}: e_value with no envelope`);
        // a Ville label whose envelope records the estimation premise false cannot be 'e_value'
        if (row.validityClass === 'ville_anytime_valid' && row.estimatedBaseline !== 'unrecorded'
            && row.estimatedBaseline.validUnderEstimatedBaseline === false) {
            strict_1.default.notEqual(a.form, 'e_value', `${row.detector}: premise false but claimed e_value`);
        }
        // a priced row is an (epsilon, 0) form with a measured horizon and K
        if (row.validityClass === 'bounded_priced') {
            strict_1.default.equal(a.form, 'epsilon');
            if (a.form === 'epsilon') {
                strict_1.default.ok(a.epsilon > 0 && a.horizon > 0 && a.calibration_windows !== undefined);
            }
        }
        // classical / heuristic / retracted rows are not e-values
        if (row.validityClass === 'classical_epoch' || row.validityClass === 'heuristic') {
            strict_1.default.equal(a.form, 'not_e_value', `${row.detector}: ${row.validityClass} must be not_e_value`);
        }
        if (a.form === 'epsilon')
            strict_1.default.ok(a.epsilon >= 0 && a.source.length > 0);
        if (a.form === 'epsilon_growing')
            strict_1.default.ok(a.law.length > 20 && a.source.length > 0);
    }
});
(0, node_test_1.test)('the Family A plug-in rows carry the growing-epsilon law with the measured kappa', () => {
    const betting = (0, guarantees_2.guaranteeFor)('betting_e_process_ttft').approximateEValue;
    strict_1.default.equal(betting.form, 'epsilon_growing');
    if (betting.form === 'epsilon_growing')
        strict_1.default.equal(betting.kappa, 0.8445);
    strict_1.default.equal((0, guarantees_2.guaranteeFor)('page_cusum_ttft').approximateEValue.form, 'epsilon_growing');
});
(0, node_test_1.test)('the constructions: three e-values inside their envelopes and one constant epsilon', () => {
    strict_1.default.equal(guarantees_1.APPROXIMATE_E_VALUE_BY_CONSTRUCTION.safe_t_e_value.form, 'e_value');
    strict_1.default.equal(guarantees_1.APPROXIMATE_E_VALUE_BY_CONSTRUCTION.universal_inference_e_value.form, 'e_value');
    strict_1.default.equal(guarantees_1.APPROXIMATE_E_VALUE_BY_CONSTRUCTION.sequential_ui_e_process.form, 'e_value');
    const bf = guarantees_1.APPROXIMATE_E_VALUE_BY_CONSTRUCTION.nuisance_robust_bf_e_value;
    strict_1.default.equal(bf.form, 'epsilon');
    if (bf.form === 'epsilon')
        strict_1.default.ok(Math.abs(bf.epsilon - 0.155) < 1e-9);
});
(0, node_test_1.test)('the manifest carries axis 3 on every row', () => {
    const parsed = JSON.parse((0, guarantees_2.guaranteeManifest)());
    for (const r of parsed)
        strict_1.default.ok(r.approximateEValue?.form, 'manifest row without axis 3');
});
//# sourceMappingURL=guarantees.test.js.map
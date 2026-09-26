"use strict";
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
const validity_envelope_1 = require("../detectors/validity-envelope");
// The DeploySignal-shaped fixture: six Family A signals, one Family D signal, sixteen heuristic
// ids. Since v0.8.0-pre the library ships no registry instance; this fixture keeps the totality
// proof concrete (the test 'a consumer with its own signals…' proves it for an arbitrary set).
const SIX_SIGNALS = ['p99_latency', 'ttft', 'eval_score', 'tool_success_rate', 'downstream_err', 'cost_req'];
const SIXTEEN_HEURISTICS = [
    'kv_saturation', 'hbm_elevation', 'hbm_spill_roll', 'mfu_collapse',
    'slowbleed', 'collective', 'capacity', 'gpu_eff', 'compound_lat',
    'tok_econ', 'behavioral', 'eval_quality_drop', 'refusal_spike',
    'output_len_drift', 'tool_call_degradation', 'quality_warning',
];
const FIXTURE_REGISTRY = (0, audit_1.detectorRegistryFor)({ signals: SIX_SIGNALS, familyDSignals: ['kv_cache'], heuristics: SIXTEEN_HEURISTICS });
const ALL_IDS = (0, audit_1.allDetectorIds)(FIXTURE_REGISTRY);
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
            strict_1.default.ok(FIXTURE_REGISTRY.A.includes(id), `${id} not in the fixture registry`);
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
    (0, node_test_1.test)('manifest round-trips as JSON with one entry per row', () => {
        const m = JSON.parse((0, guarantees_2.guaranteeManifest)());
        strict_1.default.equal(m.length, guarantees_2.GUARANTEE_TABLE.length);
    });
    (0, node_test_1.test)('the Family B row names the trend layer that sets its thresholds, now DeploySignal\'s own', () => {
        const row = (0, guarantees_2.guaranteeFor)('kv_saturation');
        strict_1.default.ok(row.implementation.includes('core.ts'), 'Family B implementation must name the core.ts trend layer');
        strict_1.default.ok(row.implementation.includes('DeploySignal'), 'and say whose it is since v0.8.0-pre');
    });
});
// ── Axis 3 (C61, 2026-09-02): the (epsilon, delta)-approximate e-value form ──────────────
(0, node_test_1.test)('axis 3 is total: every row and the core layer state an approximate-e-value form', () => {
    for (const row of guarantees_2.GUARANTEE_TABLE) {
        strict_1.default.ok(row.approximateEValue && row.approximateEValue.form, `${row.detector}: no axis 3`);
    }
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
// ── ADR 0033: the registry is generic; the guarantee table is total over any instance ────────
const audit_2 = require("../types/audit");
(0, node_test_1.describe)('detector registry (ADR 0033)', () => {
    (0, node_test_1.test)('a six-signal registry: every per-signal kind × every signal, kind-major, plus the joint-vector kinds', () => {
        const sig = [...SIX_SIGNALS];
        const A = ['mSPRT', 'page_cusum', 'betting_e_process', 'safe_t_e_value', 'contrast_null', 'onset_mixture']
            .flatMap((k) => sig.map((s) => `${k}_${s}`));
        strict_1.default.deepEqual([...FIXTURE_REGISTRY.A], A);
        strict_1.default.deepEqual([...FIXTURE_REGISTRY.B], [...SIXTEEN_HEURISTICS]);
        strict_1.default.deepEqual([...FIXTURE_REGISTRY.C], [
            'hotelling_t2_joint_vector', 'sequential_mmd', 'hotelling_t2_safe', 'sequential_mmd_e_process',
            'sequential_mmd_betting_e_process',
        ]);
        strict_1.default.deepEqual([...FIXTURE_REGISTRY.D], ['spectral_peak_acf_kv_cache', 'spectral_e_detector_kv_cache']);
        strict_1.default.deepEqual([...FIXTURE_REGISTRY.E], ['mahalanobis_conformal_baseline']);
        strict_1.default.equal(ALL_IDS.length, 36 + 16 + 5 + 2 + 1);
    });
    (0, node_test_1.test)('a consumer with its own signals gets a registry the guarantee table is total over', () => {
        const r = (0, audit_1.detectorRegistryFor)({ signals: ['path_loss_7', 'rtt_p99'], familyDSignals: ['hbm_temp'] });
        strict_1.default.equal(r.A.length, audit_2.DETECTOR_KINDS.A.length * 2);
        strict_1.default.equal(r.D.length, audit_2.DETECTOR_KINDS.D.length);
        strict_1.default.deepEqual([...r.B], [], 'no heuristics unless the consumer names them');
        strict_1.default.equal((0, audit_1.allDetectorIds)(r).length, r.A.length + r.C.length + r.D.length + r.E.length);
        for (const id of (0, audit_1.allDetectorIds)(r)) {
            const row = (0, guarantees_2.guaranteeFor)(id);
            strict_1.default.ok(row, `no guarantee row for '${id}'`);
            strict_1.default.equal(row.family, (0, audit_2.detectorKindOf)(id).family, `family disagrees for '${id}'`);
        }
        // the same kind resolves to the same row whatever the signal is called
        strict_1.default.equal((0, guarantees_2.guaranteeFor)('betting_e_process_rtt_p99'), (0, guarantees_2.guaranteeFor)('betting_e_process_ttft'));
        strict_1.default.equal((0, guarantees_2.guaranteeFor)('safe_t_e_value_path_loss_7').validityClass, 'e_value_terminal');
        strict_1.default.equal(Object.isFrozen(r) && Object.isFrozen(r.A), true);
    });
    (0, node_test_1.test)('detectorKindOf: longest kind-prefix wins; heuristics and unknown ids are undefined', () => {
        strict_1.default.deepEqual((0, audit_2.detectorKindOf)('sequential_mmd_betting_e_process'), { family: 'C', kind: 'sequential_mmd_betting_e_process' });
        strict_1.default.deepEqual((0, audit_2.detectorKindOf)('sequential_mmd'), { family: 'C', kind: 'sequential_mmd' });
        strict_1.default.deepEqual((0, audit_2.detectorKindOf)('page_cusum_anything'), { family: 'A', kind: 'page_cusum' });
        strict_1.default.deepEqual((0, audit_2.detectorKindOf)('spectral_e_detector_x'), { family: 'D', kind: 'spectral_e_detector' });
        strict_1.default.equal((0, audit_2.detectorKindOf)('kv_saturation'), undefined);
        strict_1.default.equal((0, audit_2.detectorKindOf)('page_cusum'), undefined, 'a per-signal kind needs a signal');
    });
});
(0, node_test_1.test)('ADR 0036: twin rows resolve by prefix, carry live envelopes, and claim a genuine e-value', () => {
    const rate = (0, guarantees_2.guaranteeFor)('twin_rate_http_5xx');
    const sign = (0, guarantees_2.guaranteeFor)('twin_sign_p99_ms');
    strict_1.default.ok(rate && sign);
    strict_1.default.equal(rate.estimatedBaseline, guarantees_2.ESTIMATED_BASELINE_GUARANTEES.twin_rate);
    strict_1.default.equal(sign.estimatedBaseline, guarantees_2.ESTIMATED_BASELINE_GUARANTEES.twin_sign);
    strict_1.default.equal(rate.validityClass, 'ville_anytime_valid');
    strict_1.default.equal(guarantees_1.APPROXIMATE_E_VALUE_BY_CONSTRUCTION.twin_rate.form, 'e_value');
    strict_1.default.equal(guarantees_1.APPROXIMATE_E_VALUE_BY_CONSTRUCTION.twin_sign.form, 'e_value');
    strict_1.default.match(rate.evidence, /REGISTERED, NOT RUN/);
});
//# sourceMappingURL=guarantees.test.js.map
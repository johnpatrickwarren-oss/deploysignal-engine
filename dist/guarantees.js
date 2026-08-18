"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ESTIMATED_BASELINE_GUARANTEES = exports.GUARANTEE_TABLE = void 0;
exports.guaranteeFor = guaranteeFor;
exports.guaranteeManifest = guaranteeManifest;
const validity_envelope_1 = require("./detectors/validity-envelope");
const safe_t_e_value_1 = require("./detectors/safe-t-e-value");
const universal_inference_e_value_1 = require("./detectors/universal-inference-e-value");
const sequential_ui_1 = require("./detectors/sequential-ui");
exports.GUARANTEE_TABLE = Object.freeze([
    {
        idPrefixes: ['mSPRT_', 'page_cusum_'],
        family: 'A',
        detector: 'Gaussian mixture supermartingale (Howard-Ramdas 2021)',
        implementation: 'detectors/family-a-mixture-supermartingale.ts',
        validityClass: 'ville_anytime_valid',
        estimatedBaseline: validity_envelope_1.MIXTURE_SUPERMARTINGALE_ENVELOPE,
        alphaPolicy: 'ville_spend',
        evidence: 'ADR 0004 PR E envelope; plug-in invalidity Tessera ADR 0014 (E[e|H0] -> ~3e9 at n>>m).',
    },
    {
        idPrefixes: ['betting_e_process_'],
        family: 'A',
        detector: 'betting e-process (aGRAPA/ONS, Waudby-Smith-Ramdas)',
        implementation: 'detectors/betting-e-process.ts',
        validityClass: 'ville_anytime_valid',
        estimatedBaseline: validity_envelope_1.BETTING_E_PROCESS_ENVELOPE,
        alphaPolicy: 'ville_spend',
        evidence: 'ADR 0004 PR E envelope; plug-in invalidity Tessera ADR 0008 (E[e|H0] -> ~1e8).',
    },
    {
        idPrefixes: [
            'kv_saturation', 'hbm_elevation', 'hbm_spill_roll', 'mfu_collapse', 'slowbleed',
            'collective', 'capacity', 'gpu_eff', 'compound_lat', 'tok_econ', 'behavioral',
            'eval_quality_drop', 'refusal_spike', 'output_len_drift', 'tool_call_degradation',
            'quality_warning',
        ],
        family: 'B',
        detector: 'structural signature rules (16)',
        implementation: 'DeploySignal engine/gates/_health-defs.ts (no engine implementation; ids here for audit compat)',
        validityClass: 'heuristic',
        estimatedBaseline: 'unrecorded',
        alphaPolicy: 'none',
        evidence: 'Hand-tuned rules by design; measured against the shipped Ville arms 2026-08-04 '
            + '(deploysignal studies/drift-regime-sweep): no drift regime where a rule detects and the '
            + 'mixture portfolio does not.',
    },
    {
        idPrefixes: ['hotelling_t2_joint_vector'],
        family: 'C',
        detector: 'Hotelling T^2, chi-square variant (Wilson-Hilferty threshold)',
        implementation: 'detectors/hotelling.ts',
        validityClass: 'classical_epoch',
        estimatedBaseline: 'unrecorded',
        alphaPolicy: 'classical_epoch_alpha',
        evidence: 'Per-tick chi-square threshold; no wealth process.',
    },
    {
        idPrefixes: ['hotelling_t2_safe'],
        family: 'C',
        detector: 'safe-Hotelling (Grunwald GROW safe test)',
        implementation: 'detectors/_hotelling-safe.ts',
        validityClass: 'ville_anytime_valid',
        estimatedBaseline: 'unrecorded',
        alphaPolicy: 'ville_spend',
        evidence: 'Safe-test construction; E[e|H0] = 1 iff compiled parameters are the truth '
            + '(_hotelling-safe.ts:110-112) — axis-2 unrecorded, not established.',
    },
    {
        idPrefixes: ['sequential_mmd_betting_e_process', 'sequential_mmd_e_process'],
        family: 'C',
        detector: 'sequential-MMD betting e-process (Shekhar-Ramdas 2023, Q67 v2 canonical)',
        implementation: 'detectors/family-c-betting-e-process.ts, detectors/sequential-mmd.ts',
        validityClass: 'ville_anytime_valid',
        estimatedBaseline: 'unrecorded',
        alphaPolicy: 'ville_spend',
        evidence: 'Betting construction on RFF witnesses; classical bootstrap-null retired at Q68.',
    },
    {
        idPrefixes: ['sequential_mmd'],
        family: 'C',
        detector: 'MMD classical bootstrap-null (retired; id kept for replay compat)',
        implementation: 'removed at Q68',
        validityClass: 'classical_epoch',
        estimatedBaseline: 'unrecorded',
        alphaPolicy: 'none',
        evidence: 'Q68 classical retirement; audit readers may still see the id in v1 replays.',
    },
    {
        idPrefixes: ['spectral_peak_acf_'],
        family: 'D',
        detector: 'spectral peak-ACF, bootstrap_null variant',
        implementation: 'detectors/spectral.ts',
        validityClass: 'classical_epoch',
        estimatedBaseline: 'unrecorded',
        alphaPolicy: 'classical_epoch_alpha',
        evidence: 'Bootstrap quantile threshold. Known defect: at N bootstraps the threshold cannot '
            + 'resolve alpha_D finer than 1/N (AR(1) path N=500 -> 2e-3); finer alphas book alpha not delivered.',
    },
    {
        idPrefixes: ['spectral_e_detector_'],
        family: 'D',
        detector: 'spectral e-detector (Shin-Ramdas-Rinaldo 2022, disjoint windows + priced c-bound)',
        implementation: 'detectors/spectral.ts',
        validityClass: 'bounded_priced',
        estimatedBaseline: 'unrecorded',
        alphaPolicy: 'priced_spend_requires_c_bound',
        evidence: 'H0 battery 2026-08-01: rolling windows FAR 0.576 vs nominal 0.05 at ORACLE '
            + 'parameters (increments share 29/30 samples; martingale-difference fails) -> reclassified '
            + 'heuristic. Disjoint windows (d3d6d06): FAR 0.0005, but E[M_T|H0] = 1.0636 (T=300), '
            + '1.1076 (T=900) at K=400-window calibration — refuted as an e-process under finite-K '
            + 'calibration at every K measured; exact-moment cells 1.0257 not-refuted / 1.1184 '
            + 'FAIL-marginal (family-d-emean run-20260818T222835Z; C54: state K beside T). Violation '
            + 'bounded. Priced c-bound (bb56070): firing at c/alpha restores FDR <= alpha. '
            + 'e_value_inflation_bound ABSENT means unpriced inflation.',
    },
    {
        idPrefixes: ['mahalanobis_conformal_baseline'],
        family: 'E',
        detector: 'weighted-conformal Mahalanobis novelty',
        implementation: 'detectors/conformal.ts',
        validityClass: 'exact_finite_sample',
        estimatedBaseline: 'unrecorded',
        alphaPolicy: 'classical_epoch_alpha',
        evidence: 'Exactness is per evaluation and BY ASSUMPTION of the plug-in Gaussian model: the '
            + 'default calibration set is synthesized exact chi_p (no held-out real data — DeploySignal '
            + 'tools/calibrators/family-e.ts). The weighted_e_value variant is Ville-classed '
            + '(conformal.ts) under the same assumption; unweighted/weighted variants are per-tick '
            + 'threshold tests with no wealth process.',
    },
]);
/** Estimated-baseline (axis-2) defaults and the retraction, keyed by construction rather than
 *  registry id — these are inputs a CONSUMER may route to the FDR path, not per-signal detectors. */
exports.ESTIMATED_BASELINE_GUARANTEES = Object.freeze({
    safe_t_e_value: safe_t_e_value_1.SAFE_T_ENVELOPE,
    universal_inference_e_value: universal_inference_e_value_1.UI_MEAN_SHIFT_ENVELOPE,
    sequential_ui_e_process: sequential_ui_1.SEQUENTIAL_UI_ENVELOPE,
    /** RETRACTED 2026-07-02: E[BF|H0] ~= 1.155 at every calibration length. Kept so the retraction
     *  is visible where the guarantee table lives; see the envelope's own file header. */
    nuisance_robust_bf_e_value: validity_envelope_1.NUISANCE_ROBUST_BF_ENVELOPE,
});
/** The guarantee row for a registry detector id, by prefix match. Returns undefined only for ids
 *  outside DETECTOR_REGISTRY; test/guarantees.test.ts proves totality over the registry. */
function guaranteeFor(id) {
    // Longest-prefix wins so 'sequential_mmd_betting_e_process' does not fall through to the
    // retired 'sequential_mmd' row.
    let best;
    let bestLen = -1;
    for (const row of exports.GUARANTEE_TABLE) {
        for (const p of row.idPrefixes) {
            if ((id === p || id.startsWith(p)) && p.length > bestLen) {
                best = row;
                bestLen = p.length;
            }
        }
    }
    return best;
}
/** Machine-readable dump (WS2 shape: generated from code, echoable into audit artifacts). */
function guaranteeManifest() {
    return JSON.stringify(exports.GUARANTEE_TABLE.map((r) => ({
        ...r,
        estimatedBaseline: r.estimatedBaseline === 'unrecorded' ? 'unrecorded' : { ...r.estimatedBaseline },
    })), null, 2);
}
//# sourceMappingURL=guarantees.js.map
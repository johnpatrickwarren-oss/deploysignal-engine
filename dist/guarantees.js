"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ESTIMATED_BASELINE_GUARANTEES = exports.APPROXIMATE_E_VALUE_BY_CONSTRUCTION = exports.HEURISTIC_CORE_GUARANTEE = exports.GUARANTEE_TABLE = void 0;
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
        approximateEValue: {
            form: 'epsilon_growing',
            law: 'E[M_n|H0] under an m-sample plug-in baseline grows without bound in n '
                + '(validity-envelope.ts: ~3e9 at n >> m); the per-tick rate is unmeasured for the '
                + 'mixture (the betting path measures kappa/m). Exact at oracle parameters (H0 battery '
                + 'N1 CLEARED); NaN on right-skewed and 8.5e46 on t3 increments (C23).',
            source: 'Tessera ADR 0014; knowledge stats/validity-premise-chain; detector-audit-sequential-2026-08-05',
        },
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
        approximateEValue: {
            form: 'epsilon_growing',
            law: 'per-tick increment excess kappa/m under an m-sample calibration (the GRAPA loop '
                + 'converges on the calibration bias), so epsilon_T = exp(kappa·T/m) − 1: unbounded in T. '
                + 'Measured 1.029 / 1.009 / 1.002 per tick at m = 30 / 100 / 500; martingale exact at '
                + 'oracle parameters (0.9999956).',
            kappa: 0.8445,
            source: 'grapa-stability run-20260819T040000Z (C58); detector-audit-sequential-2026-08-05 (C23)',
        },
    },
    {
        idPrefixes: ['safe_t_e_value_'],
        family: 'A',
        detector: 'safe two-sample t e-value (right-Haar / GROW), terminal read at the end of a canary',
        implementation: 'detectors/safe-t-e-value.ts',
        validityClass: 'e_value_terminal',
        estimatedBaseline: safe_t_e_value_1.SAFE_T_ENVELOPE,
        alphaPolicy: 'classical_epoch_alpha',
        evidence: 'C64 (d) valid-path power study (deploysignal studies/valid-path-power, run '
            + '2026-09-03T18182Z): with KNOWN phi, 1.0000 detection at the K1 canonical 1.5 sd on the '
            + '100-tick canary (floor 0.50), 0 of 524 null crossings at alpha = 0.05, exactly '
            + 'scale-invariant across the four corpus signals. Registered ship rule routed this '
            + 'construction (knowledge stats/valid-path-power-2026-09-03). Read ONCE per signal at the '
            + 'terminal tick: the e-value is not an e-process, so per-tick peeking is not licensed. '
            + 'Envelope: maxPhiValid 0.95; with an ESTIMATED phi the e-BH-relevant mean needs '
            + 'calibration >= ~100 (file header, ADR 0005).',
        approximateEValue: {
            form: 'e_value',
            note: 'sigma integrated out exactly: E[e|H0] = 1 at every calibration length with known phi '
                + '(APPROXIMATE_E_VALUE_BY_CONSTRUCTION.safe_t_e_value carries the out-of-envelope '
                + 'measurement, mean(e) = 9,710 at estimated phi = 0.9 from 100 samples).',
        },
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
        implementation: 'DeploySignal engine/gates/_health-defs.ts (rule bodies; ids here for audit '
            + 'compat). Threshold machinery is THIS package\'s core.ts trend layer — _health-defs.ts '
            + 'imports trendStrength/effectiveThreshold from @johnpatrickwarren-oss/deploysignal-engine/core '
            + 'and sets every rule threshold through it. See HEURISTIC_CORE_GUARANTEE.',
        validityClass: 'heuristic',
        estimatedBaseline: 'unrecorded',
        alphaPolicy: 'none',
        evidence: 'Hand-tuned rules by design; measured against the shipped Ville arms 2026-08-04 '
            + '(deploysignal studies/drift-regime-sweep): no drift regime where a rule detects and the '
            + 'mixture portfolio does not.',
        approximateEValue: { form: 'not_e_value', reason: 'threshold rules; no expectation claim of any kind.' },
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
        approximateEValue: { form: 'not_e_value', reason: 'a per-tick p-value test; enters a budget only via a calibrator (Ramdas–Wang 2025 Prop. 2.5, Thm 11.5).' },
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
            + '(_hotelling-safe.ts:110-112) — axis-2 unrecorded, not established. The SHIPPED '
            + 'threshold is a bootstrap (1−alpha) quantile of max wealth, not 1/alpha '
            + '(sliding_buffer_threshold; median 3.6e76 × 1/alpha over 34,481 compiled cells, '
            + 'knowledge stats/ville-guarantee-is-empirical): a crossing-rate calibration on an '
            + 'unstated class (Ramdas–Wang 2025 Lemma 15.1), which licenses no e-value claim.',
        approximateEValue: { form: 'unrecorded' },
    },
    {
        idPrefixes: ['sequential_mmd_betting_e_process', 'sequential_mmd_e_process'],
        family: 'C',
        detector: 'sequential-MMD betting e-process (Shekhar-Ramdas 2023, Q67 v2 canonical)',
        implementation: 'detectors/family-c-betting-e-process.ts, detectors/sequential-mmd.ts',
        validityClass: 'ville_anytime_valid',
        estimatedBaseline: 'unrecorded',
        alphaPolicy: 'ville_spend',
        evidence: 'Betting construction on RFF witnesses; classical bootstrap-null retired at Q68. '
            + 'Construction premise REFUTED at exact parameters 2026-08-19 (C57): the streaming witness '
            + 'is not conditionally centered; detector retired from DeploySignal compiles (C21), '
            + 'certification REFUSE.',
        approximateEValue: {
            form: 'epsilon_growing',
            law: 'increment estimator 1.001303 / 1.001234 (corr / diag) at EXACT compiled parameters, '
                + 'the lambda·b channel; E[S_900|H0] ≈ 5, i.e. epsilon_900 ≈ 4 and growing with T.',
            source: 'family-c-witness-centering run 2026-08-19 (C57)',
        },
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
        approximateEValue: { form: 'not_e_value', reason: 'classical bootstrap-null p-value; removed.' },
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
        approximateEValue: { form: 'not_e_value', reason: 'a bootstrap-quantile p-value test per evaluation; no wealth process.' },
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
        approximateEValue: {
            form: 'epsilon',
            epsilon: 0.0636,
            horizon: 300,
            calibration_windows: 400,
            note: 'epsilon = c − 1 (Def. 10.1, delta = 0); 0.1076 at T = 900 (K = 400), 0.1184 at T = 900 '
                + 'at exact moments, 1.4934 at K = 100 / T = 900 — grows with T, shrinks with K, so the '
                + 'price is valid only up to the measured horizon at the stated K (SpectralInflationBound '
                + 'carries both, C54). FDR <= alpha·(1+epsilon) by Thm 10.24 when the bound is set.',
            source: 'family-d-emean run-20260818T222835Z (C54/C55)',
        },
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
        approximateEValue: {
            form: 'not_e_value',
            reason: 'the shipped kinds (unweighted / weighted) are per-tick conformal p-value tests, and '
                + 'the p is not established super-uniform (parametric-bootstrap calibration, '
                + 'knowledge stats/family-e-budget-ruling); the weighted_e_value kind is unmeasured '
                + '(unrecorded) and unreachable under the default compiler path.',
        },
    },
]);
/** The core.ts heuristic layer, covered explicitly (2026-08-22). core.ts ships a second
 *  statistical layer — TrendBuffer window summaries, trendStrength, effectiveThreshold,
 *  computeVerdict, WARMUP_CONFIG — that is NOT a registry detector, so the table above cannot
 *  reach it and test/guarantees.test.ts's totality check does not cover it. This entry is its
 *  guarantee row: heuristic, spends no alpha, and its constants have no derivation trace.
 *
 *  Constants (all hand-tuned): stable = cv < 0.04 && |slopeNorm| > 0.002 (core.ts:90);
 *  slopeScore = rawSlope/0.05, stabilityBonus 0.2 (linear falloff to cv 0.10), noisePenalty
 *  (cv-0.15)/0.15 capped 0.5 (core.ts:162-165, mirrored in summarizeWindow core.ts:145-149).
 *
 *  Provenance: vendored at pin deploysignal main@5a72371 (2026-05-16), sync policy
 *  vendored-at-pin, DO-NOT-modify-without-ADR (core.ts:1-5). No derivation exists in this repo
 *  or the knowledge wiki (checked 2026-08-21).
 *
 *  Production surface (traced 2026-08-21): the ONLY production caller is DeploySignal
 *  engine/gates/_health-defs.ts, i.e. the Family B structural rules — the row above. The layer
 *  does not modulate any alpha-spending detector. In-repo callers are
 *  test/core-trend-threshold.test.ts and type references only. */
exports.HEURISTIC_CORE_GUARANTEE = Object.freeze({
    exports: Object.freeze(['TrendBuffer', 'trendStrength', 'effectiveThreshold', 'computeVerdict', 'WARMUP_CONFIG']),
    implementation: 'core.ts (vendored from DeploySignal engine/core.ts at main@5a72371, 2026-05-16)',
    validityClass: 'heuristic',
    estimatedBaseline: 'unrecorded',
    alphaPolicy: 'none',
    evidence: 'Hand-tuned constants with no derivation trace; sole production caller is the Family B '
        + 'row (DeploySignal engine/gates/_health-defs.ts). Coverage added 2026-08-22 after external '
        + 'review flagged the layer as outside the guarantee table.',
    approximateEValue: { form: 'not_e_value', reason: 'heuristic trend layer; no expectation claim.' },
});
/** Axis 3 for the constructions in ESTIMATED_BASELINE_GUARANTEES, keyed the same way. These are
 *  the portfolio's genuine e-values inside their envelopes, and the one CONSTANT epsilon on the
 *  record. */
exports.APPROXIMATE_E_VALUE_BY_CONSTRUCTION = Object.freeze({
    safe_t_e_value: {
        form: 'e_value',
        note: 'right-Haar / GROW: sigma integrated out exactly, an e-value at every calibration length '
            + 'with KNOWN phi; outside the envelope (estimated phi at 0.9 from a 100-sample window) '
            + 'mean(e) = 9,710 — knowledge stats/terminal-evalue-2026-08-02; maxPhiValid 0.95.',
    },
    universal_inference_e_value: {
        form: 'e_value',
        note: 'split LRT, an e-value with no regularity conditions (E[e|H0] ≈ 0.13–0.17: ~6× slack '
            + 'from the fixed split); valid at every phi, inert above maxPhiPowered 0.8.',
    },
    sequential_ui_e_process: {
        form: 'e_value',
        note: 'E[E_tau] <= 1 at every stopping time including near-unit-root (ADR 0025); the free-phi '
            + 'null absorbs small steps (valid and inert against +3 sd on clustersynth).',
    },
    nuisance_robust_bf_e_value: {
        form: 'epsilon',
        epsilon: 0.155,
        horizon: 0,
        calibration_windows: 'exact',
        note: 'RETRACTED: E[BF|H0] = (1+2x)/sqrt((1+x)(1+3x)) ≈ 1.155 at EVERY calibration length — the '
            + 'one constant epsilon in the portfolio (horizon 0 = single-shot). FDR <= 1.155·alpha if '
            + 'used as-is; deprecated for safe-t.',
        source: 'engine ADR 0005; knowledge stats/invalid-nuisance-robust-bf-e-value',
    },
});
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
/** Machine-readable dump (WS2 shape: generated from code, echoable into audit artifacts).
 *  The core.ts heuristic layer (HEURISTIC_CORE_GUARANTEE) is appended as a trailing entry with
 *  `kind: 'heuristic_core'` — it is not a registry detector, so it carries no idPrefixes/family. */
function guaranteeManifest() {
    const rows = exports.GUARANTEE_TABLE.map((r) => ({
        ...r,
        estimatedBaseline: r.estimatedBaseline === 'unrecorded' ? 'unrecorded' : { ...r.estimatedBaseline },
    }));
    return JSON.stringify([...rows, { kind: 'heuristic_core', ...exports.HEURISTIC_CORE_GUARANTEE }], null, 2);
}
//# sourceMappingURL=guarantees.js.map
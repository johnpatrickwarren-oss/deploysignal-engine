"use strict";
// types/detector-registry.ts — detector KINDS, and a registry built for a consumer's own signals.
//
// ADR 0033 (2026-09-23). Until v0.7.0-pre the registry was one literal list in types/audit.ts whose
// per-signal ids were spelled out for DeploySignal's six LLM-serving signals (`page_cusum_ttft`,
// `betting_e_process_cost_req`, ...). The guarantee table is keyed by that registry, so a consumer
// with other signals — Tessera-RNG's path-classes, Tessera's shard metrics — had no id to ask
// "what does this detector guarantee?" about. This module separates the two things the literal
// list had fused:
//
//   KIND    — what the engine ships: a detector construction with a guarantee row
//             (`page_cusum`, `betting_e_process`, `safe_t_e_value`, ...). Engine-owned.
//   SIGNAL  — what a consumer observes. Consumer-owned; the engine never names one.
//
// A registry is `detectorRegistryFor({ signals })`: every per-signal kind crossed with the
// consumer's signals, plus the joint-vector kinds whose id is the kind itself. guarantees.ts
// resolves any such id by longest kind-prefix, so `guaranteeFor` is total over every registry this
// function can build (test/guarantees.test.ts proves it for an arbitrary signal set).
//
// Since v0.8.0-pre the library ships no instance: DeploySignal builds its own in its own tree, as
// does any other consumer (test/guarantees.test.ts keeps a six-signal fixture to prove totality).
Object.defineProperty(exports, "__esModule", { value: true });
exports.DETECTOR_KINDS = void 0;
exports.detectorRegistryFor = detectorRegistryFor;
exports.allDetectorIds = allDetectorIds;
exports.detectorKindOf = detectorKindOf;
/** Detector kinds by family. A per-signal kind's id is `${kind}_${signal}`; a joint-vector kind's
 *  id is the kind. Provenance of each name is in the guarantee table row that carries it. */
exports.DETECTOR_KINDS = Object.freeze({
    /** Family A — per signal. `mSPRT` is Page-CUSUM's legacy emission id (ARCHITECT-REPLY-34 D2),
     *  kept as a read-time alias for v1 audit replay; `page_cusum` is the forward id. */
    A: Object.freeze(['mSPRT', 'page_cusum', 'betting_e_process', 'safe_t_e_value', 'contrast_null', 'onset_mixture']),
    /** Family C — joint vector; the id is the kind. `sequential_mmd_betting_e_process` (Q67 v2,
     *  Shekhar–Ramdas 2023) was unregistered until 2026-07-31 — see deploysignal/engine/guarantees.ts. */
    C: Object.freeze([
        'hotelling_t2_joint_vector', 'sequential_mmd', 'hotelling_t2_safe', 'sequential_mmd_e_process',
        'sequential_mmd_betting_e_process',
    ]),
    /** Family D — per signal. */
    D: Object.freeze(['spectral_peak_acf', 'spectral_e_detector']),
    /** Family E — joint vector; the id is the kind. */
    E: Object.freeze(['mahalanobis_conformal_baseline']),
});
function perSignal(kinds, signals) {
    // Kind-major order: every signal of the first kind, then the next kind — the order the literal
    // list had, which audit readers and the golden tables may depend on.
    return Object.freeze(kinds.flatMap((k) => signals.map((s) => `${k}_${s}`)));
}
/** Build the detector registry for a consumer's signal set. Pure; the result is frozen. */
function detectorRegistryFor(spec) {
    return Object.freeze({
        A: perSignal(exports.DETECTOR_KINDS.A, spec.signals),
        B: Object.freeze([...(spec.heuristics ?? [])]),
        C: exports.DETECTOR_KINDS.C,
        D: perSignal(exports.DETECTOR_KINDS.D, spec.familyDSignals ?? []),
        E: exports.DETECTOR_KINDS.E,
    });
}
/** Every id in a registry, family order A, B, C, D, E. */
function allDetectorIds(registry) {
    return [...registry.A, ...registry.B, ...registry.C, ...registry.D, ...registry.E];
}
/** The kind an id was built from, by longest kind-prefix (so `sequential_mmd_betting_e_process`
 *  resolves to itself, not to `sequential_mmd`). Undefined for a Family B heuristic or an unknown
 *  id — the guarantee table, not this function, is the authority on what such an id guarantees. */
function detectorKindOf(id) {
    let best;
    let bestLen = -1;
    for (const family of ['A', 'C', 'D', 'E']) {
        for (const kind of exports.DETECTOR_KINDS[family]) {
            const perSig = family === 'A' || family === 'D';
            const hit = perSig ? id.startsWith(`${kind}_`) : id === kind;
            if (hit && kind.length > bestLen) {
                best = { family, kind };
                bestLen = kind.length;
            }
        }
    }
    return best;
}
//# sourceMappingURL=detector-registry.js.map
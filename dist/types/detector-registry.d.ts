/** Detector kinds by family. A per-signal kind's id is `${kind}_${signal}`; a joint-vector kind's
 *  id is the kind. Provenance of each name is in the guarantee table row that carries it. */
export declare const DETECTOR_KINDS: Readonly<{
    /** Family A — per signal. `mSPRT` is Page-CUSUM's legacy emission id (ARCHITECT-REPLY-34 D2),
     *  kept as a read-time alias for v1 audit replay; `page_cusum` is the forward id. */
    A: readonly ["mSPRT", "page_cusum", "betting_e_process", "safe_t_e_value", "contrast_null"];
    /** Family C — joint vector; the id is the kind. `sequential_mmd_betting_e_process` (Q67 v2,
     *  Shekhar–Ramdas 2023) was unregistered until 2026-07-31 — see deploysignal/engine/guarantees.ts. */
    C: readonly ["hotelling_t2_joint_vector", "sequential_mmd", "hotelling_t2_safe", "sequential_mmd_e_process", "sequential_mmd_betting_e_process"];
    /** Family D — per signal. */
    D: readonly ["spectral_peak_acf", "spectral_e_detector"];
    /** Family E — joint vector; the id is the kind. */
    E: readonly ["mahalanobis_conformal_baseline"];
}>;
export type DetectorKindA = typeof DETECTOR_KINDS.A[number];
export type DetectorKindC = typeof DETECTOR_KINDS.C[number];
export type DetectorKindD = typeof DETECTOR_KINDS.D[number];
export type DetectorKindE = typeof DETECTOR_KINDS.E[number];
export type DetectorKind = DetectorKindA | DetectorKindC | DetectorKindD | DetectorKindE;
/** The id of a per-signal kind applied to one signal. */
export type PerSignalDetectorId<K extends string, S extends string> = `${K}_${S}`;
/** What a consumer supplies to build its registry. */
export interface DetectorRegistrySpec<SA extends string, SD extends string, B extends string> {
    /** The consumer's Family A signals. */
    signals: readonly SA[];
    /** Signals the Family D spectral detectors run on, if any (DeploySignal: `kv_cache`). */
    familyDSignals?: readonly SD[];
    /** Family B ids. Heuristic structural signatures are consumer policy with no engine
     *  implementation (engine/consumer charter); they appear in a registry only so audit records
     *  can name them, and the guarantee table classes every one of them `heuristic`. */
    heuristics?: readonly B[];
}
export interface DetectorRegistry<SA extends string = string, SD extends string = string, B extends string = string> {
    readonly A: readonly PerSignalDetectorId<DetectorKindA, SA>[];
    readonly B: readonly B[];
    readonly C: readonly DetectorKindC[];
    readonly D: readonly PerSignalDetectorId<DetectorKindD, SD>[];
    readonly E: readonly DetectorKindE[];
}
/** Build the detector registry for a consumer's signal set. Pure; the result is frozen. */
export declare function detectorRegistryFor<SA extends string, SD extends string = never, B extends string = never>(spec: DetectorRegistrySpec<SA, SD, B>): DetectorRegistry<SA, SD, B>;
/** Every id in a registry, family order A, B, C, D, E. */
export declare function allDetectorIds(registry: DetectorRegistry): readonly string[];
/** The kind an id was built from, by longest kind-prefix (so `sequential_mmd_betting_e_process`
 *  resolves to itself, not to `sequential_mmd`). Undefined for a Family B heuristic or an unknown
 *  id — the guarantee table, not this function, is the authority on what such an id guarantees. */
export declare function detectorKindOf(id: string): {
    family: 'A' | 'C' | 'D' | 'E';
    kind: DetectorKind;
} | undefined;
//# sourceMappingURL=detector-registry.d.ts.map
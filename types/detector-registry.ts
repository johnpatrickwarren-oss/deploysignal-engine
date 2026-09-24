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

/** Detector kinds by family. A per-signal kind's id is `${kind}_${signal}`; a joint-vector kind's
 *  id is the kind. Provenance of each name is in the guarantee table row that carries it. */
export const DETECTOR_KINDS = Object.freeze({
  /** Family A — per signal. `mSPRT` is Page-CUSUM's legacy emission id (ARCHITECT-REPLY-34 D2),
   *  kept as a read-time alias for v1 audit replay; `page_cusum` is the forward id. */
  A: Object.freeze(['mSPRT', 'page_cusum', 'betting_e_process', 'safe_t_e_value', 'contrast_null'] as const),
  /** Family C — joint vector; the id is the kind. `sequential_mmd_betting_e_process` (Q67 v2,
   *  Shekhar–Ramdas 2023) was unregistered until 2026-07-31 — see deploysignal/engine/guarantees.ts. */
  C: Object.freeze([
    'hotelling_t2_joint_vector', 'sequential_mmd', 'hotelling_t2_safe', 'sequential_mmd_e_process',
    'sequential_mmd_betting_e_process',
  ] as const),
  /** Family D — per signal. */
  D: Object.freeze(['spectral_peak_acf', 'spectral_e_detector'] as const),
  /** Family E — joint vector; the id is the kind. */
  E: Object.freeze(['mahalanobis_conformal_baseline'] as const),
});

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

function perSignal<K extends string, S extends string>(
  kinds: readonly K[], signals: readonly S[],
): readonly PerSignalDetectorId<K, S>[] {
  // Kind-major order: every signal of the first kind, then the next kind — the order the literal
  // list had, which audit readers and the golden tables may depend on.
  return Object.freeze(kinds.flatMap((k) => signals.map((s) => `${k}_${s}` as PerSignalDetectorId<K, S>)));
}

/** Build the detector registry for a consumer's signal set. Pure; the result is frozen. */
export function detectorRegistryFor<SA extends string, SD extends string = never, B extends string = never>(
  spec: DetectorRegistrySpec<SA, SD, B>,
): DetectorRegistry<SA, SD, B> {
  return Object.freeze({
    A: perSignal(DETECTOR_KINDS.A, spec.signals),
    B: Object.freeze([...(spec.heuristics ?? [])]),
    C: DETECTOR_KINDS.C,
    D: perSignal(DETECTOR_KINDS.D, spec.familyDSignals ?? []),
    E: DETECTOR_KINDS.E,
  });
}

/** Every id in a registry, family order A, B, C, D, E. */
export function allDetectorIds(registry: DetectorRegistry): readonly string[] {
  return [...registry.A, ...registry.B, ...registry.C, ...registry.D, ...registry.E];
}

/** The kind an id was built from, by longest kind-prefix (so `sequential_mmd_betting_e_process`
 *  resolves to itself, not to `sequential_mmd`). Undefined for a Family B heuristic or an unknown
 *  id — the guarantee table, not this function, is the authority on what such an id guarantees. */
export function detectorKindOf(id: string): { family: 'A' | 'C' | 'D' | 'E'; kind: DetectorKind } | undefined {
  let best: { family: 'A' | 'C' | 'D' | 'E'; kind: DetectorKind } | undefined;
  let bestLen = -1;
  for (const family of ['A', 'C', 'D', 'E'] as const) {
    for (const kind of DETECTOR_KINDS[family]) {
      const perSig = family === 'A' || family === 'D';
      const hit = perSig ? id.startsWith(`${kind}_`) : id === kind;
      if (hit && kind.length > bestLen) { best = { family, kind }; bestLen = kind.length; }
    }
  }
  return best;
}

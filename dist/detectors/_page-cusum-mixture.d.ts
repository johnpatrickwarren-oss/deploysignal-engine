import type { CompiledConfig, DetectorVerdict } from '../types';
import { type MixtureSupermartingaleState } from './family-a-mixture-supermartingale';
import { type CUSUMStates } from './_page-cusum-core';
import type { FamilyAShadowCtx } from './_page-cusum-classical';
export type MixtureSupermartingaleStates = {
    [signal: string]: MixtureSupermartingaleState;
};
/** Per-tick mixture-supermartingale Page-CUSUM evaluator. Parallel to
 *  `evaluateFamilyAShadow` (classical) but consumes the Howard-Ramdas-2021
 *  Ville-bounded variant + AR(1) pre-whitening (Q66.A.b H1'). */
export declare function evaluateFamilyAShadowMixture(cfg: CompiledConfig, liveMetrics: Record<string, number | undefined>, states: MixtureSupermartingaleStates, ctx: FamilyAShadowCtx): DetectorVerdict[];
/** Q68 Phase-3.d.C consolidation — top-level Family A Page-CUSUM dispatch
 *  wrapper. Always delegates to Howard-Ramdas-2021 mixture-supermartingale
 *  variant (Ville-bounded; methodology-resampler-mode invariant by
 *  construction). Classical variant retired at Q68 close; the
 *  `cusumStates` parameter is preserved in the signature for caller
 *  backward-compat (TrendBuffer.cusumStates allocation pattern) but is
 *  unused in the runtime path. */
export declare function evaluateFamilyA(cfg: CompiledConfig, liveMetrics: Record<string, number | undefined>, _cusumStates: CUSUMStates, mixtureStates: MixtureSupermartingaleStates, ctx: FamilyAShadowCtx): DetectorVerdict[];
//# sourceMappingURL=_page-cusum-mixture.d.ts.map
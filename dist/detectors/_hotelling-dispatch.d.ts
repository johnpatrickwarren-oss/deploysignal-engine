import type { DetectorVerdict, FamilyCPerCell, TenantTier, SafeHotellingState } from '../types';
/** Unified context the Record<HotellingVariant, Evaluator> receives.
 *  Each evaluator reads only the fields its variant needs. */
export interface HotellingDispatchCtx {
    params: FamilyCPerCell;
    r: number[];
    alphaHotelling: number;
    threshold: number;
    states?: Record<string, SafeHotellingState>;
    tier: TenantTier | null;
    hourOfDay: number;
    dayOfWeek?: number;
}
export type HotellingVariant = 'chi_square' | 'safe_test';
type HotellingEvaluator = (ctx: HotellingDispatchCtx) => DetectorVerdict;
/** Variant→evaluator dispatch map. Adding a variant = adding a key. */
export declare const HOTELLING_EVALUATORS: Record<HotellingVariant, HotellingEvaluator>;
/** Resolve a cell's declared variant to the effective dispatch key.
 *  Normalizes `undefined` → `'chi_square'` for backward-compat. Falls
 *  `safe_test` back to `chi_square` when compile-time params or
 *  runtime state is missing (preserves pre-D-54-2 semantics). Passes
 *  through any other value so the caller's Record lookup can throw
 *  on unknowns (feedback_no_skip_test_policy). */
export declare function hotellingVariantForDispatch(raw: FamilyCPerCell['hotelling_variant'], hasParams: boolean, hasStates: boolean): HotellingVariant;
export {};
//# sourceMappingURL=_hotelling-dispatch.d.ts.map
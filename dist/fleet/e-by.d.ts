import type { LevelFreeMixtureCs } from '../types/verdict-extensions/evidence-surface';
/** The e-BY level for one selected signal: δ·|S|/K. Throws on an empty universe, a selected
 *  count outside [0, K], or δ outside (0, 1). With |S| = 0 nothing is reported and the level is 0
 *  by the formula; callers get an empty interval list rather than a level. */
export declare function eByLevel(delta: number, selectedCount: number, K: number): number;
export interface EBySelected {
    /** the signal's identity, echoed on the output. */
    id: string;
    /** the evidence surface's `confidence_sequence.level_free` for this signal at its stopping time. */
    level_free: LevelFreeMixtureCs;
}
export interface EByInterval {
    id: string;
    /** δ|S|/K, the level this interval is reported at. */
    alpha_i: number;
    center: number;
    half_width: number;
    lower: number;
    upper: number;
}
export interface EByOutput {
    /** the FCR target. */
    delta: number;
    /** the universe size the selection was made from. */
    K: number;
    /** |S|. */
    selected_count: number;
    /** δ|S|/K; 0 when nothing is selected. */
    alpha_i: number;
    /** one interval per selected signal, input order. */
    intervals: ReadonlyArray<EByInterval>;
    /** the guarantee, verbatim, so a surface that carries the numbers carries their meaning. */
    guarantee: 'FCR <= delta for any selection rule and any dependence, given level-free e-CIs (Ramdas-Wang 2025 Thm 13.7)';
}
/** e-BY on the mixture confidence sequence. `K` is the number of signals the selection was made
 *  from (all of them, not the selected ones); `selected` carries the chosen signals' level-free
 *  inputs at the tick the report is made (a stopping time). Pure; does not mutate inputs. */
export declare function eBenjaminiYekutieli(selected: ReadonlyArray<EBySelected>, K: number, delta: number): EByOutput;
//# sourceMappingURL=e-by.d.ts.map
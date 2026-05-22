/** True iff `Q72_TRACE` env var is set to a non-empty value. */
export declare function q72TraceEnabled(): boolean;
/** Emit the once-per-process header at first call. Captures runtime
 *  identity (pid, node version, platform, argv) so the trace consumer
 *  can attribute records to a (Darwin vs Linux) × (seed) tuple. */
export declare function q72EmitProcessHeader(): void;
/** Emit per-cell header on first dispatch to that cell. Captures the
 *  betting_e_process_params snapshot + first-N baseline pool entries
 *  (so substrate divergence between platforms — different bandwidth
 *  or different baseline pool seed output — is observable upstream of
 *  the per-tick state delta).
 *
 *  `pool_first_5` carries the first 5 baseline-pool vectors verbatim;
 *  if Darwin and Linux produce differently-seeded pools (e.g.,
 *  Math.random leakage despite our deterministic seed function), the
 *  divergence shows up here before any tick-level delta. */
export declare function q72EmitCellHeader(cellKey: string, bettingParams: Record<string, unknown>, poolFirst5: ReadonlyArray<ReadonlyArray<number>>, poolSize: number): void;
/** Per-tick state snapshot. Captures BOTH the predecessor state (state
 *  values at function entry) AND the computed deltas this tick produces
 *  — so the consumer can identify whether divergence is (a) carried
 *  forward from a prior tick (state values diverge at entry) or (b)
 *  introduced fresh this tick (entry equal but compute output differs). */
export interface Q72TickRecord {
    cell_key: string;
    tick_id: number;
    /** state values BEFORE this tick's update */
    log_S_t_pre: number;
    ons_lambda_pre: number;
    ons_inverse_hessian_pre: number;
    witness_running_max: number;
    q_count: number;
    q_running_sum_hash: number;
    /** live input snapshot */
    v_first_3: ReadonlyArray<number>;
    v_sum: number;
    /** computed this tick */
    F_t: number;
    wealth_factor: number;
    log_factor: number;
    /** state values AFTER this tick's update */
    log_S_t_post: number;
    ons_lambda_post: number;
    ons_inverse_hessian_post: number;
    /** verdict */
    verdict: string;
    fired_this_tick: boolean;
}
export declare function q72EmitTick(rec: Q72TickRecord): void;
//# sourceMappingURL=_q72-trace.d.ts.map
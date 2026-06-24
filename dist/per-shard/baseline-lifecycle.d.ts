/** Default trailing window (ticks) over which alarms are counted (Tessera ADR 0011 RATE_WINDOW). */
export declare const DEFAULT_RATE_WINDOW = 150;
/** Default alarm count within the window that marks the baseline stale (Tessera RATE_THRESH). */
export declare const DEFAULT_RATE_THRESHOLD = 4;
/** Default ticks to suppress re-triggering after a re-record (Tessera COOLDOWN). */
export declare const DEFAULT_COOLDOWN = 150;
export interface BaselineLifecycleOptions {
    /** Trailing tick window over which alarms are counted. Default {@link DEFAULT_RATE_WINDOW}. */
    window?: number;
    /** ≥ this many alarms within `window` ⇒ baseline stale ⇒ re-record. Default {@link DEFAULT_RATE_THRESHOLD}. */
    rateThreshold?: number;
    /** After a re-record, suppress re-triggering for this many ticks. Default {@link DEFAULT_COOLDOWN}. */
    cooldown?: number;
}
export interface BaselineLifecycleState {
    /** Trailing alarm-count window (ticks). */
    readonly window: number;
    /** Alarm count within `window` that triggers a re-record. */
    readonly rateThreshold: number;
    /** Post-re-record suppression length (ticks). */
    readonly cooldown: number;
    /** Number of ticks consumed so far (the index of the NEXT update). */
    tick: number;
    /** Tick indices of the recent alarms still within `window` (a bounded deque, oldest first). */
    alarmTicks: number[];
    /** Earliest tick at which a re-record may trigger again (post-cooldown). */
    cooldownUntil: number;
    /** Current baseline epoch: 0 at start, +1 on each re-record. The consumer tags its baseline with this. */
    epoch: number;
    /** Total re-records signalled over the lifetime of this state. */
    reRecords: number;
}
export interface BaselineLifecycleUpdate {
    /** True on the tick the trailing alarm rate first crosses the threshold (post-cooldown) — the consumer
     *  should re-record its baseline and advance to the new epoch (already reflected in `state.epoch`). */
    reRecord: boolean;
    /** Alarm count currently within the trailing window (after this tick). */
    recentAlarms: number;
}
/** Fresh lifecycle state. `window`/`rateThreshold`/`cooldown` default to the Tessera ADR 0011 values.
 *  @throws RangeError on a non-integer/out-of-range option. */
export declare function freshBaselineLifecycle(opts?: BaselineLifecycleOptions): BaselineLifecycleState;
/** Advance the lifecycle by one tick. Pass `fired = true` iff the consumer's detector alarmed on this
 *  tick. Returns `{ reRecord }` — true when the trailing alarm rate (≥ `rateThreshold` alarms within the
 *  last `window` ticks, and past the post-re-record cooldown) marks the baseline stale.
 *
 *  On a re-record the alarm window RESETS (a fresh epoch starts): behaviorally IDENTICAL to the Tessera
 *  reference (which never clears, relying on cooldown) whenever `cooldown ≥ window` — including the
 *  default 150/150 — and strictly safer for `cooldown < window`, where clearing prevents a re-record
 *  storm while the stale-epoch alarms age out (verified by fuzzing: 0 mismatches at cooldown ≥ window;
 *  never more re-records than the reference below it). Mutates `state` in place. */
export declare function updateBaselineLifecycle(state: BaselineLifecycleState, fired: boolean): BaselineLifecycleUpdate;
//# sourceMappingURL=baseline-lifecycle.d.ts.map
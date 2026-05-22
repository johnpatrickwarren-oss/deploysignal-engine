import type { Reversibility } from './reversibility-source';
import type { Verdict } from '../types';
/** Discriminated union of concrete orchestrator-side actions that the
 *  translator can produce. Rollback-class actions carry a human-readable
 *  reason so downstream consumers (ticketing, Slack approval, etc.)
 *  have context without re-computing it. */
export type ReversibilityAction = {
    action: 'rollback';
} | {
    action: 'pause_and_alarm';
    reason: string;
} | {
    action: 'human_confirmation_required';
    reason: string;
} | {
    action: 'proceed';
} | {
    action: 'extend';
} | {
    action: 'baking';
} | {
    action: 'suppressed';
    reason: string;
};
/**
 * Translate verdict × reversibility into a concrete orchestrator
 * action. Pure function — no state, no I/O. Easy to unit-test every
 * combination in isolation.
 *
 * Non-rollback verdicts pass through unchanged — reversibility only
 * affects the rollback interpretation. `'baking'` is the engine's
 * internal pre-terminal state; consumers typically filter it out, but
 * passing it through keeps the translator total rather than partial.
 */
export declare function translateVerdict(verdict: Verdict, reversibility: Reversibility, verdict_reason?: string): ReversibilityAction;
//# sourceMappingURL=reversibility-translator.d.ts.map
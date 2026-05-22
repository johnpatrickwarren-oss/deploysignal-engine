/** Concrete reversibility values. Post-classification output is always
 *  one of these three — the classifier's default-fallback resolves
 *  missing annotations to `'forward_only'`. */
export type Reversibility = 'reversible' | 'forward_only' | 'conditional';
export interface ReversibilityAnnotationSource {
    /**
     * Return the platform-annotated reversibility for a deploy, or `null`
     * when no annotation is available. The classifier converts `null` to
     * the default-fallback value (`'forward_only'`).
     */
    getReversibility(deploy_id: string): Reversibility | null;
}
/** Default source. Every deploy receives `null` → default-fallback
 *  applies at the classifier. Orchestrator uses this when the caller
 *  doesn't thread a real source through — guarantees backward compat
 *  with pre-#5 callers and frees new callers from boilerplate. */
export declare class NoReversibilitySource implements ReversibilityAnnotationSource {
    getReversibility(_deploy_id: string): Reversibility | null;
}
/** Test fixture. Pins a specific value (or explicit `null`) for every
 *  deploy_id. Useful for unit tests that want deterministic annotation
 *  behavior without constructing a Record. */
export declare class InlineReversibilitySource implements ReversibilityAnnotationSource {
    private readonly value;
    constructor(value: Reversibility | null);
    getReversibility(_deploy_id: string): Reversibility | null;
}
/** Runway synthetic source. Reads from a keyed Record, typically
 *  populated from a scenario JSON file at test setup. Unknown deploy
 *  IDs fall through to `null` → default-fallback applies. */
export declare class ScenarioReversibilitySource implements ReversibilityAnnotationSource {
    private readonly annotations;
    constructor(annotations: Record<string, Reversibility>);
    getReversibility(deploy_id: string): Reversibility | null;
}
//# sourceMappingURL=reversibility-source.d.ts.map
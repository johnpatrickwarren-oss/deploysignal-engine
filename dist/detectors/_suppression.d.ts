import type { SchemaContinuityRecord } from '../types';
/** Per-family suppression decision per Addition #8 §Consequences at L2.
 *  Returns the set of families that should suppress for a signal under
 *  the given continuity class. `'*'` means "all families". */
export declare function familiesToSuppress(klass: SchemaContinuityRecord['schema_continuity']): Array<'A' | 'B' | 'C' | 'D' | 'E'> | '*';
/** Convenience: should a specific family suppress given this class? */
export declare function shouldSuppress(klass: SchemaContinuityRecord['schema_continuity'], family: 'A' | 'B' | 'C' | 'D' | 'E'): boolean;
//# sourceMappingURL=_suppression.d.ts.map
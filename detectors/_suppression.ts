// detectors/_suppression.ts — the per-family schema-continuity suppression rule.
//
// Moved out of l0/schema-continuity.ts on 2026-09-23 (ADR 0033, the library boundary). Seven
// detectors consulted `shouldSuppress` from the L0 ingestion adapter, which made the detector layer
// depend on a consumer-shaped adapter. The rule is a pure function of a continuity class and a
// family id — Addition #8's table, unchanged — so it lives with the detectors that apply it.
// `adapters/l0/schema-continuity.ts` re-exports both names, so every existing import path holds.

import type { SchemaContinuityRecord } from '../types';

/** Per-family suppression decision per Addition #8 §Consequences at L2.
 *  Returns the set of families that should suppress for a signal under
 *  the given continuity class. `'*'` means "all families". */
export function familiesToSuppress(
  klass: SchemaContinuityRecord['schema_continuity'],
): Array<'A' | 'B' | 'C' | 'D' | 'E'> | '*' {
  switch (klass) {
    case 'continuous': return [];
    case 'extended':   return [];  // no suppression; C/E may pick up new dim on rebaseline
    case 'breaking':   return ['A', 'C', 'D', 'E'];  // per-signal A/D; C/E suppress entirely
    case 'observability_stack': return '*';
  }
}

/** Convenience: should a specific family suppress given this class? */
export function shouldSuppress(
  klass: SchemaContinuityRecord['schema_continuity'],
  family: 'A' | 'B' | 'C' | 'D' | 'E',
): boolean {
  const list = familiesToSuppress(klass);
  if (list === '*') return true;
  return list.indexOf(family) >= 0;
}


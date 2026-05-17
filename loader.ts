// engine/loader.ts — Tessera R14 (SLICE 2 carry-forwards): compiled-artifact JSON loader.
//
// Pure-function loader for the CompiledConfig JSON artifact (inherited DeploySignal
// compiled-config format extended by Tessera R02 Delta 4 + R10 Delta 2 schema additions).
//
// Accepts a JSON string, validates required fields, returns a typed CompiledConfig.
// Does NOT perform deep structural validation of nested optional fields — required-field
// presence + version non-empty is the SLICE 2 scope. Full validation is Phase 2+ scope.
//
// Tessera-original code (NOT vendored from DeploySignal). Extracts to the shared
// npm package at Tessera Phase 2 close.

import type { CompiledConfig } from './types/config';

const REQUIRED_FIELDS: ReadonlyArray<keyof CompiledConfig> = [
  'version',
  'compiler_version',
  'compiled_at',
  'baseline_ref',
  'alpha_budget',
];

/**
 * Parse and validate a CompiledConfig JSON string.
 *
 * Throws SyntaxError on malformed JSON (propagated from JSON.parse).
 * Throws Error on missing required fields or empty version string.
 *
 * @param json - JSON string produced by JSON.stringify(compiledConfig) or equivalent.
 * @returns Typed CompiledConfig ready for runtime consumption.
 */
export function loadCompiledConfig(json: string): CompiledConfig {
  const raw: unknown = JSON.parse(json);

  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new Error('CompiledConfig must be a JSON object');
  }

  const obj = raw as Record<string, unknown>;

  for (const field of REQUIRED_FIELDS) {
    if (!(field in obj)) {
      throw new Error(`CompiledConfig missing required field: ${field}`);
    }
  }

  if (typeof obj['version'] !== 'string' || obj['version'].length === 0) {
    throw new Error('CompiledConfig.version must be a non-empty string');
  }

  const alphaBudget = obj['alpha_budget'];
  if (
    typeof alphaBudget !== 'object' ||
    alphaBudget === null ||
    typeof (alphaBudget as Record<string, unknown>)['total'] !== 'number'
  ) {
    throw new Error('CompiledConfig.alpha_budget.total must be a number');
  }

  return raw as CompiledConfig;
}

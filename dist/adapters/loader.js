"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadCompiledConfig = loadCompiledConfig;
const REQUIRED_FIELDS = [
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
function loadCompiledConfig(json) {
    const raw = JSON.parse(json);
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
        throw new Error('CompiledConfig must be a JSON object');
    }
    const obj = raw;
    for (const field of REQUIRED_FIELDS) {
        if (!(field in obj)) {
            throw new Error(`CompiledConfig missing required field: ${field}`);
        }
    }
    if (typeof obj['version'] !== 'string' || obj['version'].length === 0) {
        throw new Error('CompiledConfig.version must be a non-empty string');
    }
    const alphaBudget = obj['alpha_budget'];
    if (typeof alphaBudget !== 'object' ||
        alphaBudget === null ||
        typeof alphaBudget['total'] !== 'number') {
        throw new Error('CompiledConfig.alpha_budget.total must be a number');
    }
    return raw;
}
//# sourceMappingURL=loader.js.map
import type { CompiledConfig } from './types/config';
/**
 * Parse and validate a CompiledConfig JSON string.
 *
 * Throws SyntaxError on malformed JSON (propagated from JSON.parse).
 * Throws Error on missing required fields or empty version string.
 *
 * @param json - JSON string produced by JSON.stringify(compiledConfig) or equivalent.
 * @returns Typed CompiledConfig ready for runtime consumption.
 */
export declare function loadCompiledConfig(json: string): CompiledConfig;
//# sourceMappingURL=loader.d.ts.map
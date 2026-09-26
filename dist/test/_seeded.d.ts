/** 32-bit LCG (Numerical Recipes constants), output in (0, 1). */
export declare function lcg(seed: number): () => number;
/** Poisson draw: Knuth below mean 30, rounded normal approximation above. */
export declare function poisson(rng: () => number, mean: number): number;
//# sourceMappingURL=_seeded.d.ts.map
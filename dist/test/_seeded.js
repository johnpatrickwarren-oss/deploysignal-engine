"use strict";
// test/_seeded.ts — deterministic generators for the twin tests (ADR 0036). Not a test file: the
// runner's glob is dist/test/*.test.js.
Object.defineProperty(exports, "__esModule", { value: true });
exports.lcg = lcg;
exports.poisson = poisson;
/** 32-bit LCG (Numerical Recipes constants), output in (0, 1). */
function lcg(seed) {
    let s = seed >>> 0;
    return () => {
        s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
        return (s + 0.5) / 4294967296;
    };
}
/** Poisson draw: Knuth below mean 30, rounded normal approximation above. */
function poisson(rng, mean) {
    if (mean <= 0)
        return 0;
    if (mean > 30) {
        const z = Math.sqrt(-2 * Math.log(rng())) * Math.cos(2 * Math.PI * rng());
        return Math.max(0, Math.round(mean + Math.sqrt(mean) * z));
    }
    const L = Math.exp(-mean);
    let k = 0;
    let p = 1;
    do {
        k++;
        p *= rng();
    } while (p > L);
    return k - 1;
}
//# sourceMappingURL=_seeded.js.map
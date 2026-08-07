// validation/coverage/lib/inject.mjs — the six fault-class injection generators (K1-K6).
// Pure functions: given a series (or matrix) and injection params, return a NEW
// series/matrix with the fault applied from index `at` onward. No I/O, no shared state,
// nothing mutated.
//
// The seeded RNG is copied here rather than imported across studies (global constraint:
// "do not import across studies"), sourced from validation/h0-battery/harness/nulls.mjs:7-17
// (`rng`, `gaussFrom`) — the function validation/terminal-evalue/harness/run.mjs:6 imports
// under those names and drives at run.mjs:85. run.mjs does not define a PRNG inline; it
// imports this one. Note for the record: this is a Numerical-Recipes-style linear
// congruential generator, not the mulberry32 xorshift algorithm the task brief names it
// after — kept here under its original name (`rng`) rather than relabelled, since the
// algorithm actually running in the harness is the LCG, not mulberry32.
export function rng(seed) {
  let s = seed >>> 0;
  return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
}

export function gaussFrom(r) {
  return () => {
    const u = Math.max(r(), 1e-12);
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r());
  };
}

/** K1: per-metric step shift. Adds delta*sigma to series[at..]. */
export function injectStep(series, { sigma, at, delta }) {
  return series.map((v, t) => (t >= at ? v + delta * sigma : v));
}

/** K2: group-in-unison. Adds eps*sigma to every series in `matrix` from `at`. */
export function injectUnison(matrix, { sigma, at, eps }) {
  return matrix.map((series) => injectStep(series, { sigma, at, delta: eps }));
}

/** K3: sub-threshold oscillation. Adds amp*sigma*sin(2*pi*freq*(t-at)) for t>=at. */
export function injectOscillation(series, { sigma, at, amp, freq }) {
  return series.map((v, t) => (
    t >= at ? v + amp * sigma * Math.sin(2 * Math.PI * freq * (t - at)) : v
  ));
}

/** K4: far-outside-norm point. Adds mult*sigma at exactly index `at`. */
export function injectPoint(series, { sigma, at, mult }) {
  return series.map((v, t) => (t === at ? v + mult * sigma : v));
}

/** K5: slow drift. Adds slope*(t-at)*sigma for t>=at. */
export function injectDrift(series, { sigma, at, slope }) {
  return series.map((v, t) => (t >= at ? v + slope * (t - at) * sigma : v));
}

/**
 * K6: distributional shape change. From `at`, REPLACES (does not add to) each value
 * with sigma*z, z a two-component mixture with matched mean and variance:
 *   z = (b ? +d/2 : -d/2) + w*s,  b ~ Bernoulli(0.5), w ~ N(0,1),
 *   s = sqrt(max(0, 1 - d*d/4))  =>  E[z] = 0, Var[z] = 1.
 * opts.rng is the seeded uniform generator (drives both `b` and, via gaussFrom, `w`).
 */
export function injectShapeMix(series, { sigma, at, d, rng: r }) {
  const g = gaussFrom(r);
  const s = Math.sqrt(Math.max(0, 1 - (d * d) / 4));
  return series.map((v, t) => {
    if (t < at) return v;
    const b = r() < 0.5;
    const w = g();
    const z = (b ? d / 2 : -d / 2) + w * s;
    return sigma * z;
  });
}

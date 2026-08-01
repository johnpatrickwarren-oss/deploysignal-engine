// harness/nulls.mjs — the battery of §3. Every generator emits a null: no
// change is injected, so every fire is a false alarm.
//
// Seeded throughout. The seed is recorded in each run manifest; the harness is
// replayable even though the detectors are not stochastic.

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

/** Standard-normal, iid. */
function iidGauss(r) { const g = gaussFrom(r); return () => g(); }

/** AR(1) with unit marginal variance, so nulls differ in dependence only. */
function ar1(r, phi) {
  const g = gaussFrom(r);
  let prev = g();
  const sd = Math.sqrt(1 - phi * phi);
  return () => (prev = phi * prev + sd * g());
}

/** Lognormal standardised to mean 0, variance 1 — right-skewed, matched moments. */
function lognormal(r, sigma = 0.75) {
  const g = gaussFrom(r);
  const m = Math.exp(sigma * sigma / 2);
  const v = (Math.exp(sigma * sigma) - 1) * Math.exp(sigma * sigma);
  const sd = Math.sqrt(v);
  return () => (Math.exp(sigma * g()) - m) / sd;
}

/** Student-t_3 standardised to unit variance — heavy-tailed, matched moments.
 *  t_3 has variance 3, hence the /sqrt(3). */
function t3(r) {
  const g = gaussFrom(r);
  return () => {
    const z = g();
    const chi = g() ** 2 + g() ** 2 + g() ** 2;
    return (z / Math.sqrt(chi / 3)) / Math.sqrt(3);
  };
}

/** The registered battery. `windows` selects rolling vs disjoint for detectors
 *  that read a windowed statistic (§3, N1 vs N7). */
export const NULLS = [
  { id: 'N1', label: 'iid Gaussian, oracle params, disjoint windows',
    gen: iidGauss, params: 'oracle', windows: 'disjoint' },
  { id: 'N2-m30', label: 'iid Gaussian, estimated params m=30',
    gen: iidGauss, params: 'estimated', m: 30, windows: 'disjoint' },
  { id: 'N2-m100', label: 'iid Gaussian, estimated params m=100',
    gen: iidGauss, params: 'estimated', m: 100, windows: 'disjoint' },
  { id: 'N2-m500', label: 'iid Gaussian, estimated params m=500',
    gen: iidGauss, params: 'estimated', m: 500, windows: 'disjoint' },
  { id: 'N3-p03', label: 'AR(1) phi=0.3, oracle', gen: (r) => ar1(r, 0.3), params: 'oracle', windows: 'disjoint' },
  { id: 'N3-p06', label: 'AR(1) phi=0.6, oracle', gen: (r) => ar1(r, 0.6), params: 'oracle', windows: 'disjoint' },
  { id: 'N3-p09', label: 'AR(1) phi=0.9, oracle', gen: (r) => ar1(r, 0.9), params: 'oracle', windows: 'disjoint' },
  { id: 'N4-p06-m100', label: 'AR(1) phi=0.6, estimated m=100',
    gen: (r) => ar1(r, 0.6), params: 'estimated', m: 100, windows: 'disjoint' },
  { id: 'N4-p09-m100', label: 'AR(1) phi=0.9, estimated m=100',
    gen: (r) => ar1(r, 0.9), params: 'estimated', m: 100, windows: 'disjoint' },
  { id: 'N5', label: 'right-skewed lognormal, moment-matched, oracle',
    gen: lognormal, params: 'oracle', windows: 'disjoint' },
  { id: 'N6', label: 'heavy-tailed t3, moment-matched, oracle',
    gen: t3, params: 'oracle', windows: 'disjoint' },
  { id: 'N7', label: 'iid Gaussian, oracle params, ROLLING windows (shipped config)',
    gen: iidGauss, params: 'oracle', windows: 'rolling' },
];

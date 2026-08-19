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

/** Amendment A4 (C27) — AR(1) with t3 innovations, unit marginal variance: the composition of
 *  N3 and N6, the two departures every phi-aware detector clears individually. The marginal law
 *  is the process's own, not t3. */
function ar1T3(r, phi) {
  const src = t3(r);
  let prev = src();
  const sd = Math.sqrt(1 - phi * phi);
  return () => (prev = phi * prev + sd * src());
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
  { id: 'N3-p03', label: 'AR(1) phi=0.3, oracle', gen: (r) => ar1(r, 0.3), phi: 0.3, params: 'oracle', windows: 'disjoint' },
  { id: 'N3-p06', label: 'AR(1) phi=0.6, oracle', gen: (r) => ar1(r, 0.6), phi: 0.6, params: 'oracle', windows: 'disjoint' },
  { id: 'N3-p09', label: 'AR(1) phi=0.9, oracle', gen: (r) => ar1(r, 0.9), phi: 0.9, params: 'oracle', windows: 'disjoint' },
  { id: 'N4-p06-m100', label: 'AR(1) phi=0.6, estimated m=100',
    gen: (r) => ar1(r, 0.6), phi: 0.6, params: 'estimated', m: 100, windows: 'disjoint' },
  { id: 'N4-p09-m100', label: 'AR(1) phi=0.9, estimated m=100',
    gen: (r) => ar1(r, 0.9), phi: 0.9, params: 'estimated', m: 100, windows: 'disjoint' },
  { id: 'N5', label: 'right-skewed lognormal, moment-matched, oracle',
    gen: lognormal, params: 'oracle', windows: 'disjoint' },
  { id: 'N6', label: 'heavy-tailed t3, moment-matched, oracle',
    gen: t3, params: 'oracle', windows: 'disjoint' },
  { id: 'N7', label: 'iid Gaussian, oracle params, ROLLING windows (shipped config)',
    gen: iidGauss, params: 'oracle', windows: 'rolling' },
];

/** Amendment A4 (C27) — the combined-stress cell: N3-p09 x N6 together. Existing N1-N7
 *  clearances are evidence about isolated departures only.
 *
 *  Exported SEPARATELY from NULLS, deliberately: the detector-audit, coverage and
 *  certification harnesses import NULLS wholesale under registrations that name N1-N7
 *  verbatim, so growing the shared array would silently change what any future execution
 *  of those harnesses covers. The battery runner concatenates this in; a study that wants
 *  N8 opts in by amendment, the way A4 did. */
export const N8_COMBINED = {
  id: 'N8', label: 'AR(1) phi=0.9 with t3 innovations, oracle params, disjoint (combined stress)',
  gen: (r) => ar1T3(r, 0.9), phi: 0.9, params: 'oracle', windows: 'disjoint',
};

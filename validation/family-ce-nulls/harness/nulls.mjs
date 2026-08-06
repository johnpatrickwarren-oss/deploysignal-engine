// harness/nulls.mjs — the H₀ laws of PREREGISTRATION §4.
//
// Every generator here is a NULL. Baseline history and live traffic are drawn
// from the SAME law, so nothing changes at any tick and every fire is a false
// alarm. That is the whole design: the question is not "does the detector
// notice a change" but "does the detector stay quiet when the healthy law is
// not the Gaussian its reference pool is built from".
//
// The mixture law has, by construction, the same mean vector and the same
// covariance matrix as the Gaussian law it is paired with. It differs only in
// shape. `sequential-mmd.ts#generateBaselinePool` synthesizes the P-side pool
// as z = L·w, w ~ N(0,I) — it can represent the first two moments exactly and
// nothing beyond them.

import { P, cholesky, covarianceCorr, covarianceDiag } from './bundle.mjs';

export function mulberry32(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function gaussFrom(r) {
  return () => {
    let u = r();
    while (u === 0) u = r();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r());
  };
}

/** Two-component equal-weight mixture ½N(−a, s²) + ½N(+a, s²), standardised
 *  to mean 0 and variance 1 by a² + s² = 1.
 *
 *  a = 0.9 ⇒ s = 0.4359. Ashman's D = √2·(2a)/√(2s²) = 4.13; D > 2 is the
 *  usual "cleanly separated / visibly bimodal" line, and the equal-weight
 *  bimodality condition a > s holds with room (0.900 vs 0.436). */
export const MIX_A = 0.9;
export const MIX_S = Math.sqrt(1 - MIX_A * MIX_A);
export const ASHMAN_D = Math.SQRT2 * (2 * MIX_A) / Math.sqrt(2 * MIX_S * MIX_S);
/** Excess kurtosis of the standardised mixture: 3 − 3 ... = −2a⁴ ... computed
 *  directly. E[u⁴] = 3s⁴ + 6a²s² + a⁴; excess = E[u⁴] − 3. */
export const MIX_EXCESS_KURTOSIS =
  3 * MIX_S ** 4 + 6 * MIX_A ** 2 * MIX_S ** 2 + MIX_A ** 4 - 3;

function drawUnit(law, r, g) {
  if (law === 'gauss') return g();
  return (r() < 0.5 ? -1 : 1) * MIX_A + MIX_S * g();
}

/** The registered H₀ cells. `sigma` is the TRUE covariance of the relative
 *  deviations; `law` is the shape of the standardised coordinates before the
 *  Cholesky rotation. Gaussian and mixture cells at the same `sigma` are
 *  moment-matched to each other exactly. */
export const NULLS = [
  {
    id: 'HC-gauss-corr', law: 'gauss', sigma: 'corr', control: true,
    label: 'Gaussian H₀, correlated Σ (ρ^|i−j|, ρ=0.3) — CONTROL',
  },
  {
    id: 'HC-mix-corr', law: 'mix', sigma: 'corr', control: false,
    label: 'bimodal-mixture H₀, same Σ as HC-gauss-corr, same mean',
  },
  {
    id: 'HC-mix-diag', law: 'mix', sigma: 'diag', control: false,
    label: 'bimodal-mixture H₀, diagonal Σ — every marginal exactly bimodal',
  },
  {
    id: 'HC-gauss-diag', law: 'gauss', sigma: 'diag', control: true,
    label: 'Gaussian H₀, diagonal Σ — CONTROL for HC-mix-diag',
  },
];

const CHOL = { corr: cholesky(covarianceCorr()), diag: cholesky(covarianceDiag()) };

/** A stream of relative-deviation vectors under `spec`. */
export function deviationStream(spec, seed) {
  const r = mulberry32(seed);
  const g = gaussFrom(r);
  const L = CHOL[spec.sigma];
  return () => {
    const u = new Array(P);
    for (let k = 0; k < P; k++) u[k] = drawUnit(spec.law, r, g);
    const z = new Array(P);
    for (let i = 0; i < P; i++) {
      let s = 0;
      for (let j = 0; j <= i; j++) s += L[i][j] * u[j];
      z[i] = s;
    }
    return z;
  };
}

/** Per-coordinate diagnostics used in §4 to substantiate "visibly bimodal"
 *  AFTER the Cholesky rotation, which is where correlation can wash bimodality
 *  out. Reports sample excess kurtosis per coordinate; a clean two-component
 *  mixture is platykurtic (negative), a Gaussian is 0. */
export function shapeDiagnostics(spec, seed, n = 200000) {
  const draw = deviationStream(spec, seed);
  const m = new Array(P).fill(0);
  const m2 = new Array(P).fill(0);
  const m4 = new Array(P).fill(0);
  const buf = [];
  for (let t = 0; t < n; t++) buf.push(draw());
  for (const z of buf) for (let i = 0; i < P; i++) m[i] += z[i];
  for (let i = 0; i < P; i++) m[i] /= n;
  for (const z of buf) {
    for (let i = 0; i < P; i++) {
      const d = z[i] - m[i];
      m2[i] += d * d;
      m4[i] += d * d * d * d;
    }
  }
  const out = [];
  for (let i = 0; i < P; i++) {
    const v = m2[i] / n;
    out.push({ coord: i, mean: m[i], sd: Math.sqrt(v), excess_kurtosis: m4[i] / n / (v * v) - 3 });
  }
  return out;
}

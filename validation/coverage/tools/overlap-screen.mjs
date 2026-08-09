// C50 pre-registration probe 2: the A-overlaps-B asymmetry, isolated on an IID substrate.
//
// Under strided A the 2,250 A-ticks are a stride-4 sample of the SAME 9,000-tick span the 45
// contiguous B-blocks tile, so every B_j shares ~1 tick in 4 with A while the live window
// shares none. The block-conformal rank identity needs T(live) and T(B_j) i.i.d. GIVEN A;
// partial self-inclusion of B_j in A breaks that conditional symmetry. On drifting telemetry
// the effect is inseparable from the drift, so it is measured here on an i.i.d. substrate
// where drift is absent by construction and any departure from uniform p is the overlap alone.
//
// Generator, disclosed: mulberry32(seed) uniforms -> Box-Muller standard normals. Probe seed
// base 7.1e8. No registered seed (all <= 1e8) and no registered study RNG is touched.

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const ENGINE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const require = createRequire(import.meta.url);
const acc = require(path.join(ENGINE_ROOT, 'dist/detectors/shape-ecdf-accumulator.js'));

const W = 150, NA = 2250, M = 45, SPAN = 9000, STRIDE = 4, LIVE_WINDOWS = 4;
const KAPPA = 0.682;
const R = Number(process.argv[2] ?? 400);

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function normals(rng, n) {
  const out = new Array(n);
  for (let i = 0; i < n; i += 2) {
    const u1 = Math.max(rng(), 1e-12), u2 = rng();
    const r = Math.sqrt(-2 * Math.log(u1)), th = 2 * Math.PI * u2;
    out[i] = r * Math.cos(th);
    if (i + 1 < n) out[i + 1] = r * Math.sin(th);
  }
  return out;
}

const arms = {
  // A = stride-4 sample of the 9,000-tick span; B = contiguous ticks 2250..9000. A n B != 0.
  overlap: (span) => {
    const a = [];
    for (let t = 0; t < SPAN; t += STRIDE) a.push(span[t]);
    return [...a, ...span.slice(2250, 9000)];
  },
  // A = ticks 0..2250; B = contiguous ticks 2250..9000. A n B = 0. (The pre-C50 layout.)
  disjoint: (span) => span.slice(0, SPAN),
  // THE DISJOINT FULL-SPAN ALTERNATIVE the C50 review found (correction append, F2): A = every
  // 4th BLOCK of 150 (15 blocks = 2250 ticks, spread over the whole span), B = the other 45
  // blocks, contiguous 150-tick slices, in order. Disjoint AND full-span AND block-contiguous, at
  // the frozen n_A = 2250 / m = 45. Refutes 'the overlap is forced'.
  block_strided: (span) => {
    const a = [], b = [];
    for (let blk = 0; blk < SPAN / W; blk++) {
      const slice = span.slice(blk * W, (blk + 1) * W);
      if (blk % STRIDE === 0) a.push(...slice); else b.push(...slice);
    }
    if (a.length !== NA) throw new Error(`block_strided: nA=${a.length} != ${NA}`);
    if (b.length !== M * W) throw new Error(`block_strided: |B|=${b.length} != ${M * W}`);
    return [...a, ...b];
  },
  // A = stride-4 sample of an INDEPENDENT 9,000-tick span; B = contiguous 2250..9000 of this
  // one. Strided A with the overlap removed — isolates striding from overlap.
  strided_independent_A: (span, spanB) => {
    const a = [];
    for (let t = 0; t < SPAN; t += STRIDE) a.push(spanB[t]);
    return [...a, ...span.slice(2250, 9000)];
  },
};

const res = {};
for (const k of Object.keys(arms)) res[k] = { e: [], p: [], cross: 0, n: 0 };

for (let r = 0; r < R; r++) {
  const rng = mulberry32(710000000 + r);
  const span = normals(rng, SPAN);
  const spanB = normals(rng, SPAN);
  const live = [];
  for (let w = 0; w < LIVE_WINDOWS; w++) live.push(normals(rng, W));
  for (const [name, build] of Object.entries(arms)) {
    const cal = acc.calibrateEcdfAccumulator(build(span, spanB), { W, nA: NA, m: M });
    let logM = 0, crossed = false;
    for (const win of live) {
      const o = acc.ecdfAccumulatorWindow(win, cal);
      res[name].e.push(o.e); res[name].p.push(o.p);
      logM += Math.log(o.e);
      if (logM >= Math.log(20)) crossed = true;
    }
    res[name].n++;
    if (crossed) res[name].cross++;
  }
}

// exact null under uniform p on the (m+1)-point grid
let s = 0;
for (let k = 1; k <= M + 1; k++) s += Math.pow(k, KAPPA - 1);
const E_NULL = KAPPA * Math.pow(M + 1, -KAPPA) * s;

const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const sd = (a) => { const m = mean(a); return Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / (a.length - 1)); };
// The three arms score the SAME live windows against differently-built references, so the
// arm difference is PAIRED and its SE is far smaller than either arm's own.
for (const other of ['disjoint', 'strided_independent_A', 'block_strided']) {
  const d = res.overlap.e.map((x, i) => x - res[other].e[i]);
  const m = mean(d), se = sd(d) / Math.sqrt(d.length);
  console.log(`PAIRED overlap - ${other.padEnd(22)} delta E[e] = ${m.toFixed(6)} +- ${se.toFixed(6)} (${(m / se).toFixed(2)} SE)`);
  const dp = res.overlap.p.map((x, i) => x - res[other].p[i]);
  const mp = mean(dp), sep = sd(dp) / Math.sqrt(dp.length);
  console.log(`       ${''.padEnd(22)}   delta E[p] = ${mp.toFixed(6)} +- ${sep.toFixed(6)} (${(mp / sep).toFixed(2)} SE)`);
}
console.log(`exact E[e|null] at m=${M}: ${E_NULL.toFixed(6)}   R=${R} draws x ${LIVE_WINDOWS} windows`);
for (const [name, o] of Object.entries(res)) {
  const m = mean(o.e), se = sd(o.e) / Math.sqrt(o.e.length);
  console.log(`${name.padEnd(24)} mean e=${m.toFixed(6)} (SE ${se.toFixed(6)}, gap ${((m - E_NULL) / se).toFixed(2)} SE)  mean p=${mean(o.p).toFixed(6)} (uniform grid mean ${((M + 2) / (2 * (M + 1))).toFixed(6)})  P(p<=1/46)=${(o.p.filter((x) => x <= 1 / (M + 1) + 1e-12).length / o.p.length).toFixed(4)} (uniform ${(1 / (M + 1)).toFixed(4)})  crossings=${o.cross}/${o.n}`);
}

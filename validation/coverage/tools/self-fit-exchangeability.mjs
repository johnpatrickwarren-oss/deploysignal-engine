// validation/coverage/tools/self-fit-exchangeability.mjs — Amendment v2.C47.1 (WORKLIST C47 item 1).
//
// A PROBE, not a harness: it writes no run directory, emits no cell, and feeds
// validation/certification/lib/collect.mjs nothing. See ./README.md for the discipline this file is
// held to, including the seed rule (probe bases >= 6e8; this probe's base is 6.3e8).
//
// WHAT IT MEASURES. point_tail_bet_e_value's conformal p is exactly super-uniform for a reference
// whose median and MAD are FIXED. calibrateTailBet fits them on the SAME 10,000 held-out rows whose
// deviations it then ranks against (detectors/point-tail-bet-e-value.ts:85-92), so the
// (calibration, live) scores are not exactly exchangeable: an O(1/n)-approximate, anti-conservative
// departure (K4.1.10). This probe measures its SIZE, against an out-of-fold construction whose
// exchangeability is exact.
//
// THE MAD CANCELS, and this probe asserts it rather than assuming it (C47.1.1). countGte compares
// |a_i - m|/mad against |x - m|/mad and mad > 0 is enforced at :89-91, so p is invariant to mad and
// the departure is driven by the MEDIAN alone. K4.1.10's "a median/MAD pulled slightly toward
// itself" is one term too wide, corrected at C47.1.1.
//
// TWO CONSTRUCTIONS, differing ONLY in which sample the reference is fitted on. Both are scored by
// the real, unmodified module -- the calibrator, kappa, countGte and the (1+rank)/(n+1) form are
// shared code, so the comparison cannot be an artefact of a second implementation of the thing
// under test.
//
//   AS-BUILT      reference fitted on A; the n ranked scores are |A_i - m_A|/MAD_A
//   OUT-OF-FOLD   reference fitted on B (disjoint); the n ranked scores are |A_i - m_B|/MAD_B
//
// Conditional on B, the out-of-fold arm's A_1..A_n and x are i.i.d. and independent of B, so their
// scores are i.i.d., hence exchangeable, hence p is EXACTLY super-uniform. It is the construction
// the restructure of C47.1.3 outcome (b) would build.
//
// THE ENDPOINTS ARE EXACT, NOT MONTE CARLO (C47.1.2). p(x) is a step function of |x - m|, so both
// endpoints are closed-form integrals against the substrate CDF. That removes the live-point
// sampling noise entirely and leaves only the calibration draw's own variance, most of which the
// pairing removes too -- which is what makes a 1e-5-scale reading possible at all.
//
// WHAT IT DOES NOT MEASURE (C47.1.4): the single-calibration-draw effect. The pairing cancels it by
// construction, and on this construction it is an order of magnitude larger -- see the ideal-vs-run
// table this probe prints.

import { createRequire } from 'node:module';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { rng, gaussFrom } from '../lib/inject.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const tailBet = createRequire(import.meta.url)(
  path.join(HERE, '..', '..', '..', 'dist/detectors/point-tail-bet-e-value.js'));

// ── frozen at C47.1.2, and none of these may move after the probe has run ─────────────────────
const N_CAL = 10_000;          // §6's registered row count and the module's own floor (:82)
const THRESHOLD = 20;          // 1/alpha, §3
const SEED_BASE = 6.3e8;       // C47.1.2; probe discipline is >= 6e8 (README)
const R_DEFAULT = 4_000;       // C47.1.2
const SE_ESCALATION = 3e-5;    // C47.1.2's registered escalation trigger
const R_ESCALATED = 40_000;    // C47.1.2
// C47.1.3's outcome threshold: 10% of the distance from the registered run's lower_95 to the bar.
const RUN_LOWER_95 = 0.0017464003916289452;   // run-20260808T133859Z arm 32 S2, as committed
const ALPHA_BAR = 0.05;                       // the card's own falsifier
const OUTCOME_THRESHOLD = (ALPHA_BAR - RUN_LOWER_95) * 0.1;
const PREDICTION_BAND = 1e-4;                 // C47.1.3's prediction, with its own falsifier

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? Number(process.argv[i + 1]) : d; };

// ── Phi, at RELATIVE accuracy ─────────────────────────────────────────────────────────────────
// A polynomial erfc with ~1.5e-7 ABSOLUTE error is worthless here: the endpoint is P ~ 1e-3 built
// from tail probabilities ~1e-3, and a 1.5e-7 absolute floor is 1e-4 relative on the very quantity
// being differenced at 1e-5. This is the regularised incomplete gamma Q(1/2, z^2) = erfc(z),
// series below the crossover and Lentz continued fraction above, both to ~1e-15 relative.
const LN_GAMMA_HALF = Math.log(Math.sqrt(Math.PI));

function gammQHalf(x) {                        // Q(1/2, x) for x >= 0
  const a = 0.5;
  if (x === 0) return 1;
  if (x < a + 1) {                             // series for P(a,x), then Q = 1 - P
    let ap = a, sum = 1 / a, del = sum;
    for (let i = 1; i < 1000; i++) {
      ap += 1;
      del *= x / ap;
      sum += del;
      if (Math.abs(del) < Math.abs(sum) * 1e-17) break;
    }
    return 1 - sum * Math.exp(-x + a * Math.log(x) - LN_GAMMA_HALF);
  }
  const TINY = 1e-300;                         // Lentz, modified
  let b = x + 1 - a, c = 1 / TINY, d = 1 / b, h = d;
  for (let i = 1; i < 1000; i++) {
    const an = -i * (i - a);
    b += 2;
    d = an * d + b; if (Math.abs(d) < TINY) d = TINY;
    c = b + an / c; if (Math.abs(c) < TINY) c = TINY;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < 1e-17) break;
  }
  return Math.exp(-x + a * Math.log(x) - LN_GAMMA_HALF) * h;
}

const erfc = (z) => (z >= 0 ? gammQHalf(z * z) : 2 - gammQHalf(z * z));
/** P(X <= z) for X ~ N(0,1), at relative accuracy in both tails. */
const Phi = (z) => 0.5 * erfc(-z / Math.SQRT2);

// ── the two exact endpoints, given one calibration ────────────────────────────────────────────
/** The largest rank j with e_j = kappa*((1+j)/(n+1))^(kappa-1) >= THRESHOLD. C47.1.2 fixes it at 26
 *  for kappa = 0.1, n = 10,000; it is DERIVED here from the module's own kappa rather than typed. */
function maxFiringRank(n, kappa) {
  let K = -1;
  for (let j = 0; j <= n; j++) {
    if (kappa * Math.pow((1 + j) / (n + 1), kappa - 1) >= THRESHOLD) K = j; else break;
  }
  return K;
}

/** exceedance = P_x(e(x) >= THRESHOLD) and E_x[e(x)], both EXACT given (median, mad, sortedScores),
 *  for x ~ N(0,1). p(x) is a step function of |x - m|: rank = j exactly when |x - m|/mad falls in
 *  (s[n-j-1], s[n-j]], so both endpoints are sums against F(t) = P(|x - m| <= mad*t). */
function exactEndpoints(cal, K, kappa) {
  const s = cal.sortedScores;
  const n = s.length;
  const m = cal.median, mad = cal.mad;
  // F(s[k]) for every k, plus the two sentinels: F below s[0]'s left edge is 0, F(s[n]) = 1.
  const F = (t) => Phi(m + mad * t) - Phi(m - mad * t);
  // exceedance = sum_{j<=K} P(rank = j) = 1 - F(s[n-K-1]).
  const exceedance = 1 - F(s[n - K - 1]);
  // E[e] = sum_j e_j * (F(s[n-j]) - F(s[n-j-1])).
  let eMean = 0;
  let upper = 1;                               // F(s[n]) := 1
  for (let j = 0; j <= n; j++) {
    const lowerIdx = n - j - 1;
    const lower = lowerIdx < 0 ? 0 : F(s[lowerIdx]);
    eMean += kappa * Math.pow((1 + j) / (n + 1), kappa - 1) * (upper - lower);
    upper = lower;
  }
  return { exceedance, eMean };
}

/** The out-of-fold TailBetCalibration: reference fitted on `ref`, the n ranked scores taken from
 *  `scored`. Deliberately the SAME object shape calibrateTailBet returns, so the real
 *  pointTailBetEValue scores both arms through identical code. */
function outOfFoldCalibration(scored, ref) {
  const sortedRef = [...ref].sort((a, b) => a - b);
  const mid = sortedRef.length >> 1;
  const m = sortedRef.length % 2 === 0 ? (sortedRef[mid - 1] + sortedRef[mid]) / 2 : sortedRef[mid];
  const refDevs = ref.map((x) => Math.abs(x - m)).sort((a, b) => a - b);
  const dmid = refDevs.length >> 1;
  const mad = refDevs.length % 2 === 0 ? (refDevs[dmid - 1] + refDevs[dmid]) / 2 : refDevs[dmid];
  assert.ok(mad > 0, 'out-of-fold MAD is 0 (degenerate reference)');
  return { median: m, mad, sortedScores: scored.map((x) => Math.abs(x - m) / mad).sort((a, b) => a - b) };
}

// ── generators ────────────────────────────────────────────────────────────────────────────────
// PRIMARY: the study's own PRNG, one continuously-advanced stream across all replicates (C1.2's
// corrected form, so the probe cannot reproduce the rank-1 lattice C1.3 recorded).
const studyStream = (seed) => gaussFrom(rng(seed));

// SECONDARY, C47.1.2's registered substrate-robustness arm, reported as a disclosed sensitivity and
// never as the headline: splitmix64 counter + Box-Muller on two independent 53-bit uniforms. It
// shares no state, no multiplier and no output path with the study PRNG, so a 1e-5-scale reading
// that survives both is not an artefact of the 32-bit LCG.
function splitmixStream(seed) {
  let s = BigInt(seed) & 0xffffffffffffffffn;
  const M = 0xffffffffffffffffn;
  const next = () => {
    s = (s + 0x9e3779b97f4a7c15n) & M;
    let z = s;
    z = ((z ^ (z >> 30n)) * 0xbf58476d1ce4e5b9n) & M;
    z = ((z ^ (z >> 27n)) * 0x94d049bb133111ebn) & M;
    z = z ^ (z >> 31n);
    return Number(z >> 11n) / 9007199254740992;      // 53-bit uniform in [0,1)
  };
  return () => {
    const u = Math.max(next(), 1e-300);
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * next());
  };
}

// ── wiring checks: nothing below is a measurement ─────────────────────────────────────────────
function wiringChecks(kappa, K) {
  // (1) Phi at relative accuracy, against published erfc values.
  for (const [z, want] of [[1, 0.15729920705028513], [3, 2.2090496998585441e-5], [5, 1.5374597944280351e-12]]) {
    const got = erfc(z);
    assert.ok(Math.abs(got / want - 1) < 1e-12, `erfc(${z}) = ${got}, published ${want}`);
  }
  assert.ok(Math.abs(Phi(0) - 0.5) < 1e-15);

  // (2) K is the registered 26 (C47.1.2), derived from the module's own kappa.
  assert.equal(K, 26, `maxFiringRank gives ${K}, C47.1.2 registers 26`);

  // (3) THE MAD CANCELLATION (C47.1.1), asserted rather than assumed: rescaling mad by any positive
  //     factor leaves every p and every e identical. This is the correction to K4.1.10's
  //     attribution, and it is checked against the REAL module.
  const g = studyStream(SEED_BASE + 1);
  const rows = Array.from({ length: N_CAL }, g);
  const cal = tailBet.calibrateTailBet(rows);
  for (const factor of [0.5, 1, 3.7, 1000]) {
    const scaled = {
      median: cal.median,
      mad: cal.mad * factor,
      sortedScores: cal.sortedScores.map((s) => s / factor),
    };
    for (const x of [-4.1, -0.3, 0, 0.7, 2.9, 5.5]) {
      const a = tailBet.pointTailBetEValue(x, cal);
      const b = tailBet.pointTailBetEValue(x, scaled);
      assert.equal(a.p, b.p, `MAD cancellation: p moved at factor ${factor}, x = ${x}`);
      assert.equal(a.e, b.e, `MAD cancellation: e moved at factor ${factor}, x = ${x}`);
    }
  }

  // (4) The exact endpoint agrees with the real module evaluated pointwise. A coarse deterministic
  //     grid quadrature of the same integral, on the same calibration -- so an error in the rank
  //     algebra or in the F() sentinels shows up here rather than in the answer.
  const exact = exactEndpoints(cal, K, kappa);
  let quadExc = 0, quadE = 0;
  const lo = -9, hi = 9, steps = 360_000, h = (hi - lo) / steps;
  for (let i = 0; i < steps; i++) {
    const x = lo + (i + 0.5) * h;
    const w = Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI) * h;
    const { e } = tailBet.pointTailBetEValue(x, cal);
    quadE += e * w;
    if (e >= THRESHOLD) quadExc += w;
  }
  assert.ok(Math.abs(exact.exceedance - quadExc) < 2e-6,
    `exact exceedance ${exact.exceedance} vs module quadrature ${quadExc}`);
  assert.ok(Math.abs(exact.eMean - quadE) < 2e-5,
    `exact E[e] ${exact.eMean} vs module quadrature ${quadE}`);

  // (5) The out-of-fold calibration is a valid TailBetCalibration the real module accepts, and its
  //     median/MAD are NOT the self-fit ones (a probe that built the same object twice would report
  //     an excess of exactly zero and look like a clean result).
  const B = Array.from({ length: N_CAL }, g);
  const oof = outOfFoldCalibration(rows, B);
  assert.notEqual(oof.median, cal.median, 'out-of-fold reference must differ from the self-fit one');
  assert.equal(oof.sortedScores.length, N_CAL, 'the out-of-fold arm ranks the same n scores');
  assert.ok(Number.isFinite(tailBet.pointTailBetEValue(3, oof).e));
}

// ── the run ───────────────────────────────────────────────────────────────────────────────────
function replicate(draw, K, kappa) {
  const A = new Array(N_CAL);
  const B = new Array(N_CAL);
  for (let i = 0; i < N_CAL; i++) A[i] = draw();
  for (let i = 0; i < N_CAL; i++) B[i] = draw();
  const self = exactEndpoints(tailBet.calibrateTailBet(A), K, kappa);
  const oof = exactEndpoints(outOfFoldCalibration(A, B), K, kappa);
  return {
    dExc: self.exceedance - oof.exceedance,
    dE: self.eMean - oof.eMean,
    selfExc: self.exceedance, oofExc: oof.exceedance,
    selfE: self.eMean, oofE: oof.eMean,
  };
}

function summarise(xs) {
  const n = xs.length;
  const mean = xs.reduce((a, b) => a + b, 0) / n;
  const varr = n > 1 ? xs.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1) : 0;
  const se = Math.sqrt(varr / n);
  return { n, mean, sd: Math.sqrt(varr), se };
}

function arm(label, streamFor, R, K, kappa) {
  const draw = streamFor;
  const dExc = [], dE = [], selfExc = [], oofExc = [], selfE = [], oofE = [];
  for (let r = 0; r < R; r++) {
    const out = replicate(draw, K, kappa);
    dExc.push(out.dExc); dE.push(out.dE);
    selfExc.push(out.selfExc); oofExc.push(out.oofExc);
    selfE.push(out.selfE); oofE.push(out.oofE);
  }
  return {
    label,
    R,
    excess: summarise(dExc),
    excessE: summarise(dE),
    self: { exceedance: summarise(selfExc), eMean: summarise(selfE) },
    oof: { exceedance: summarise(oofExc), eMean: summarise(oofE) },
  };
}

function report(a) {
  const f = (x, d = 10) => (Number.isFinite(x) ? x.toFixed(d) : String(x));
  console.log(`\n── ${a.label}  (R = ${a.R}) ─────────────────────────────────────────────`);
  console.log(`  as-built exceedance   ${f(a.self.exceedance.mean)}  se ${f(a.self.exceedance.se, 12)}`);
  console.log(`  out-of-fold exceedance${f(a.oof.exceedance.mean).padStart(14)}  se ${f(a.oof.exceedance.se, 12)}`);
  console.log(`  PAIRED EXCESS         ${f(a.excess.mean, 12)}  se ${f(a.excess.se, 12)}  sd ${f(a.excess.sd, 12)}`);
  console.log(`  as-built E[e]         ${f(a.self.eMean.mean)}  se ${f(a.self.eMean.se, 12)}`);
  console.log(`  out-of-fold E[e]      ${f(a.oof.eMean.mean)}  se ${f(a.oof.eMean.se, 12)}`);
  console.log(`  PAIRED E[e] EXCESS    ${f(a.excessE.mean, 12)}  se ${f(a.excessE.se, 12)}`);
}

const kappa = tailBet.KAPPA;
const K = maxFiringRank(N_CAL, kappa);

console.log('Amendment v2.C47.1 — the K4 self-fit exchangeability probe');
console.log(`  n = ${N_CAL}, kappa = ${kappa}, THRESHOLD = ${THRESHOLD}, K = ${K}, seed base = ${SEED_BASE}`);
wiringChecks(kappa, K);
console.log('  wiring checks: erfc relative accuracy, K = 26, MAD cancellation vs the real module,');
console.log('                 exact endpoints vs module quadrature, out-of-fold object validity — all pass');

// The exchangeable ideal, in closed form: rank is uniform on {0..n} under exact exchangeability.
const idealExc = (K + 1) / (N_CAL + 1);
let idealE = 0;
for (let j = 1; j <= N_CAL + 1; j++) idealE += kappa * Math.pow(j / (N_CAL + 1), kappa - 1);
idealE /= (N_CAL + 1);
console.log(`\n  exchangeable ideal at n = ${N_CAL}:  exceedance ${idealExc}  E[e] ${idealE}`);
console.log('  run-20260808T133859Z arm 32 S2:      exceedance 0.001855  mean_e 0.527556');
console.log('  (C47.1.4: those are ONE draw\'s realization, conservative, and NOT the self-fit)');

let R = arg('--r', R_DEFAULT);
let primary = arm('PRIMARY — study PRNG (lib/inject.mjs), one advanced stream', studyStream(SEED_BASE), R, K, kappa);
report(primary);

// C47.1.2's registered escalation, applied by rule and not by choice.
if (primary.excess.se > SE_ESCALATION) {
  console.log(`\n  paired se ${primary.excess.se} > ${SE_ESCALATION} — C47.1.2's registered escalation FIRES`);
  const escalated = arm('PRIMARY (escalated) — study PRNG', studyStream(SEED_BASE), R_ESCALATED, K, kappa);
  report(escalated);
  console.log('  BOTH readings are reported, the R = 4,000 one included (C47.1.2).');
  primary = escalated;
} else {
  console.log(`\n  paired se ${primary.excess.se} <= ${SE_ESCALATION} — escalation does NOT fire (C47.1.2)`);
}

const secondary = arm('DISCLOSED SENSITIVITY — splitmix64 stream (C47.1.2)', splitmixStream(SEED_BASE + 77), R, K, kappa);
report(secondary);

const gap = Math.abs(primary.excess.mean - secondary.excess.mean);
const tol = Math.max(primary.excess.se, secondary.excess.se);
console.log(`\n  generator agreement: |${primary.excess.mean} - ${secondary.excess.mean}| = ${gap}`);
console.log(`                       against max(se) = ${tol} -> ${gap > tol ? 'GENERATOR-DEPENDENT — neither number is the answer (C47.1.2)' : 'agree within one se'}`);

const excess = primary.excess.mean;
console.log('\n── C47.1.3, the registered disposition ─────────────────────────────────');
console.log(`  measured excess                 ${excess}`);
console.log(`  outcome threshold               ${OUTCOME_THRESHOLD}   (10% of 0.05 - ${RUN_LOWER_95})`);
console.log(`  as a fraction of that distance  ${(excess / (ALPHA_BAR - RUN_LOWER_95) * 100).toFixed(6)} %`);
console.log(`  as a fraction of the ideal level ${(excess / idealExc * 100).toFixed(6)} %`);
console.log(`  OUTCOME                         ${Math.abs(excess) < OUTCOME_THRESHOLD ? '(a) NEGLIGIBLE — quantified, no restructure' : '(b) MATERIAL — out-of-fold restructure named as a future change'}`);
console.log(`  prediction |excess| <= ${PREDICTION_BAND}      ${Math.abs(excess) <= PREDICTION_BAND ? 'HELD' : 'REFUTED'}`);
console.log(`  sign (K4.1.10: anti-conservative) ${excess > 0 ? 'HELD — excess > 0' : 'CONTRADICTED — excess <= 0, K4.1.10\'s direction claim'}`);
console.log(`  E[e] <= 1 on both arms          self ${primary.self.eMean.mean <= 1} / out-of-fold ${primary.oof.eMean.mean <= 1}`);

// harness/exploratory-oracle-sigma.mjs
//
// ⚠️ EXPLORATORY AND POST-HOC. Not in PREREGISTRATION.md. Run after the
// registered arms had already been scored and written, because all three
// registered hypotheses were dead and the residual needed a name. Nothing
// here is confirmatory; it exists to point the NEXT registration at the right
// target. Any number it produces must be labelled as post-hoc wherever quoted.
//
// The question. A2 replaced μ_P^φ with the exact mean embedding of N(0, Σ̂)
// and the violation barely moved. So the reference pool is faithful to Σ̂ —
// which leaves the possibility that Σ̂ itself is not the law the live data has.
// `family-ce-nulls-2026-08-03` measured trace(Σ̂)/trace(Σ_true) = 1.131 on
// these very arms, not shrinking between n=600 and n=10,000.
//
// So: X1 embeds the TRUE generative Σ instead of the compiled Σ̂, changing
// nothing else. If the excess collapses, the mechanism is MCD's covariance,
// not the pool and not the bettor.

import path from 'node:path';
import { createRequire } from 'node:module';
import {
  ENGINE_ROOT, buildBundle, rowsFromDeviations, liveMetricsFrom, EVAL_CTX,
  bettingC, P, covarianceCorr, covarianceDiag,
} from '../../family-ce-nulls/harness/bundle.mjs';
import { NULLS, deviationStream } from '../../family-ce-nulls/harness/nulls.mjs';

const require = createRequire(import.meta.url);
const rff = require(path.join(ENGINE_ROOT, 'dist', 'detectors', 'family-c-rff.js'));

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const N = Number(arg('--n', 2000));
const T = Number(arg('--t', 300));
const BUNDLES = Number(arg('--bundles', 10));
const BASELINE_N = 600;
const SEED = 20260803;

/** Exact mean embedding of N(0, S) — same closed form as arm A2, but S is a
 *  parameter instead of always being the compiled covariance. */
function analyticRffMean(S, fm) {
  const D = fm.D, d = fm.d, scale = Math.sqrt(2 / D);
  const out = new Array(D);
  for (let i = 0; i < D; i++) {
    const w = fm.omega[i];
    let v = 0;
    for (let r = 0; r < d; r++) {
      let s = 0;
      for (let c = 0; c < d; c++) s += S[r][c] * w[c];
      v += w[r] * s;
    }
    out[i] = scale * Math.exp(-0.5 * v) * Math.cos(fm.b[i]);
  }
  return out;
}

function trace(S) { let t = 0; for (let i = 0; i < S.length; i++) t += S[i][i]; return t; }

function summarise(xs) {
  const n = xs.length;
  const mean = xs.reduce((a, b) => a + b, 0) / n;
  const varr = xs.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1);
  const se = Math.sqrt(varr / n);
  return { mean, lo: mean - 1.645 * se, hi: mean + 1.645 * se };
}

for (const spec of NULLS.filter((s) => s.control)) {
  const SIGMA_TRUE = spec.sigma === 'corr' ? covarianceCorr() : covarianceDiag();
  for (const armId of ['A2-recheck', 'X1-oracle-sigma']) {
    const incs = []; const maxLogs = []; const traceRatios = [];
    const perBundle = Math.ceil(N / BUNDLES);
    let done = 0;
    for (let b = 0; b < BUNDLES && done < N; b++) {
      const baseSeed = SEED + 1000003 * b + spec.id.length * 7919;
      const baseDraw = deviationStream(spec, baseSeed);
      const rows = rowsFromDeviations(Array.from({ length: BASELINE_N }, baseDraw));
      const { cfg, famC } = buildBundle(rows);
      const bp = famC.betting_e_process_params;
      const fm = rff.computeRffFeatureMap(
        bp.rff_seed, bp.rff_dim, famC.mean_vector.length, bp.kernel_bandwidth_sigma);
      traceRatios.push(trace(famC.covariance) / trace(SIGMA_TRUE));
      bp.baseline_rff_mean = analyticRffMean(
        armId === 'X1-oracle-sigma' ? SIGMA_TRUE : famC.covariance, fm);
      for (let i = 0; i < perBundle && done < N; i++, done++) {
        const draw = deviationStream(spec, SEED + 7919 * done + 31 * b);
        const states = {};
        const exps = []; let maxLog = 0;
        for (let t = 0; t < T; t++) {
          const live = liveMetricsFrom(draw(), famC.mean_vector);
          const k1 = Object.keys(states).find((k) => k.startsWith('__fc_betting'));
          const before = k1 ? states[k1].log_S_t : 0;
          const v = bettingC.evaluateFamilyCBettingEProcess(cfg, live, states, EVAL_CTX);
          if (v.verdict === 'suppressed') { exps.push(1); continue; }
          const k2 = Object.keys(states).find((k) => k.startsWith('__fc_betting'));
          exps.push(Math.exp(states[k2].log_S_t - before));
          if (states[k2].log_S_t > maxLog) maxLog = states[k2].log_S_t;
        }
        incs.push(exps.reduce((a, x) => a + x, 0) / exps.length);
        maxLogs.push(maxLog);
      }
    }
    const s = summarise(incs);
    const fire = maxLogs.filter((m) => m >= Math.log(20)).length / done;
    const tr = traceRatios.reduce((a, x) => a + x, 0) / traceRatios.length;
    process.stdout.write(
      `${spec.id.padEnd(15)} ${armId.padEnd(16)} inc=${s.mean.toFixed(6)} `
      + `[${s.lo.toFixed(6)}, ${s.hi.toFixed(6)}] fire@0.05=${fire.toFixed(4)} `
      + `trace(sigmahat)/trace(true)=${tr.toFixed(4)} `
      + `verdict=${s.lo > 1 ? 'REFUTED' : s.hi < 1.0005 ? 'CLEARED' : 'inconclusive'}\n`);
  }
}

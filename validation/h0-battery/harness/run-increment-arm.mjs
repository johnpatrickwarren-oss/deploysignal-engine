// harness/run-increment-arm.mjs — Amendment A6: the increment arm for the onset-mixture object.
//
//   node harness/run-increment-arm.mjs --mode live [--n 2000] [--t 2000]
//   node harness/run-increment-arm.mjs --mode sim  (writes under results/sim/, git-ignored)
//
// A separate file from run.mjs, for A3's reason: its output directory is prefixed `inc-`, not
// `run-`, so analysis/run_endpoints.mjs never selects it. It reuses nulls.mjs, A5.2's
// standardiser from detectors.mjs and the engine's own estimator; it re-implements nothing.
// The estimand (A6.1): the marginal mean of the SHIPPED increment — gInc, or gBounded at each
// registered λ — on the standardised residual, pooled over N trajectories × T ticks.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { rng, gaussFrom, NULLS, N8_COMBINED } from './nulls.mjs';
import { standardiser } from './detectors.mjs';

const require = createRequire(import.meta.url);
const MON = require('../../../dist/fleet/calibration-monitor.js');
const INC = require('../../../dist/detectors/_bounded-bet.js');

const STUDY = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
export const STUDY_ID = '2026-09-h0-battery-onset-mixture-increment';
export const SEED = 20260924;
export const REGISTRATION_COMMIT = '126023a';
export const PIN_VERSION = '0.9.0-pre';
export const BOUND = 1.0005;            // the card-falsifier bound (A3.4, A6.2)
export const HOUSE_BOUND = 1;           // detector-audit PREREGISTRATION §3
export const NULL_IDS = ['N1', 'N3-p09', 'N5', 'N6', 'N8'];

const ALL_NULLS = [...NULLS, N8_COMBINED];
export const SPECS = NULL_IDS.map((id) => ALL_NULLS.find((n) => n.id === id));
const lamId = (l) => `bounded_l${l < 0 ? 'm' : 'p'}${String(Math.abs(l)).replace('.', '')}`;
export const KINDS = [
  { id: 'gaussian', label: 'gInc — Gaussian-LR mixture increment, capped at 100', f: (r) => INC.gInc(r), lambda: null },
  ...INC.BOUND_LAMBDAS.map((l) => ({ id: lamId(l), label: `gBounded — linear bounded bet, λ = ${l}, clip ${INC.BOUND_CLIP}`, f: (r) => INC.gBounded(r, l), lambda: l })),
];

/** A6.3 — the registered predictions, derived by quadrature before the harness existed. */
const E_CLIP_LOGNORMAL = -0.02772;
export function registeredPrediction(nullId, kind) {
  const gaussianLike = nullId === 'N1' || nullId === 'N3-p09';
  const heavy = nullId === 'N6' || nullId === 'N8';
  if (kind.lambda === null) {
    const v = gaussianLike ? 0.99775 : heavy ? 1.61281 : 1.91833;
    return { value: v, tolerance: gaussianLike ? 0.003 : 0.05 };
  }
  if (nullId === 'N5') return { value: 1 + kind.lambda * E_CLIP_LOGNORMAL / INC.BOUND_CLIP, tolerance: 0.001 };
  return { value: 1, tolerance: 0.001 };
}

/** One cell: pooled increment estimator over N trajectories × T ticks (A6.1, A6.2 seeds). */
export function measureCell(spec, kind, N, T) {
  const est = MON.freshIncrementEstimator();
  for (let i = 0; i < N; i++) {
    const r = rng(SEED + 7919 * i + spec.id.length * 104729 + kind.id.length);
    const src = spec.gen(r);
    const std = standardiser({ mu: 0, sigma: 1, phi: spec.phi ?? 0 });
    for (let t = 0; t < T; t++) MON.updateIncrementEstimator(est, Math.log(kind.f(std(src()))));
  }
  const inc = MON.incrementEstimate(est);
  const pred = registeredPrediction(spec.id, kind);
  const verdict = inc.lower95 > BOUND ? 'REFUTED' : inc.upper95 < BOUND ? 'CLEARED' : 'inconclusive';
  const houseRuleVerdict = inc.lower95 > HOUSE_BOUND ? 'REFUTED' : inc.upper95 < BOUND ? 'CLEARED' : 'inconclusive';
  return {
    detector: `family_A_onset_mixture_increment_${kind.id}`, family: 'A', arm: 'A6',
    increment_kind: kind.id, increment_label: kind.label, lambda: kind.lambda,
    null_id: spec.id, null_label: spec.label, params: 'oracle', phi: spec.phi ?? 0,
    trajectories: N, ticks: T, n: inc.n,
    increment_estimator: inc,
    registered_prediction: pred.value, prediction_tolerance: pred.tolerance,
    prediction_gap: inc.mean - pred.value,
    prediction_within_tolerance: Math.abs(inc.mean - pred.value) <= pred.tolerance,
    verdict,
    verdict_rule: `A6.2: REFUTED iff lower95 > ${BOUND}, CLEARED iff upper95 < ${BOUND}, else inconclusive (engine incrementEstimate, two-sided normal-theory 95%)`,
    house_rule_verdict: houseRuleVerdict,
    house_rule: `detector-audit PREREGISTRATION §3: REFUTED iff lower95 > ${HOUSE_BOUND}, CLEARED iff upper95 < ${BOUND}. Recorded beside the scored token, no verdict authority.`,
  };
}

/** A6.4.3 — the generators' standardised draws have unit variance to within 3% on 200,000 draws. */
export function generatorVarianceCheck(nDraws = 200000) {
  const out = {};
  for (const spec of SPECS) {
    const r = rng(99); const src = spec.gen(r); const std = standardiser({ mu: 0, sigma: 1, phi: spec.phi ?? 0 });
    let s = 0, s2 = 0;
    for (let t = 0; t < nDraws; t++) { const v = std(src()); s += v; s2 += v * v; }
    const mean = s / nDraws; out[spec.id] = s2 / nDraws - mean * mean;
  }
  return out;
}

function main() {
  const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
  const MODE = arg('--mode', 'sim');
  const N = Number(arg('--n', 2000));
  const T = Number(arg('--t', 2000));
  const pkg = JSON.parse(fs.readFileSync(path.join(STUDY, '..', '..', 'package.json'), 'utf8'));
  const gitSha = execSync('git rev-parse HEAD', { cwd: path.join(STUDY, '..', '..') }).toString().trim();
  if (pkg.version !== PIN_VERSION) { console.error(`NOT EXECUTABLE (A6.4.1): engine is ${pkg.version}, pinned to ${PIN_VERSION}`); process.exit(3); }
  const variances = generatorVarianceCheck();
  for (const [id, v] of Object.entries(variances)) if (Math.abs(v - 1) > 0.03) { console.error(`NOT EXECUTABLE (A6.4.3): ${id} standardised variance ${v.toFixed(4)}`); process.exit(3); }

  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
  const outDir = path.join(STUDY, 'results', MODE === 'live' ? 'live' : 'sim', `inc-${stamp}`);
  if (fs.existsSync(outDir)) { console.error(`refusing to reuse ${outDir}`); process.exit(1); }
  fs.mkdirSync(path.join(outDir, 'cells'), { recursive: true });

  const cells = [];
  for (const spec of SPECS) {
    for (const kind of KINDS) {
      const c = { ...measureCell(spec, kind, N, T), mode: MODE, engine_version: pkg.version, git_sha: gitSha };
      cells.push(c);
      fs.writeFileSync(path.join(outDir, 'cells', `${c.detector}__${spec.id}.json`), JSON.stringify(c, null, 2));
      const e = c.increment_estimator;
      console.log(`${kind.id.padEnd(12)} ${spec.id.padEnd(7)} mean=${e.mean.toFixed(5)} [${e.lower95.toFixed(5)}, ${e.upper95.toFixed(5)}] max/mean=${e.maxToMean.toFixed(1)} pred=${c.registered_prediction.toFixed(5)} gap=${c.prediction_gap >= 0 ? '+' : ''}${c.prediction_gap.toFixed(5)} ${c.prediction_within_tolerance ? 'in-tol' : 'OUT-OF-TOL'} ${c.verdict}`);
    }
  }
  // A6.4.2 — the standardisation and cap-arithmetic checks, on the run's own N1 cells.
  const n1g = cells.find((c) => c.null_id === 'N1' && c.increment_kind === 'gaussian');
  const n1b = cells.find((c) => c.null_id === 'N1' && c.increment_kind === 'bounded_lp01');
  const notExecutable = [];
  if (n1g.verdict === 'REFUTED' || Math.abs(n1g.increment_estimator.mean - 0.99775) > 0.003) notExecutable.push(`A6.4.2: N1 gaussian mean ${n1g.increment_estimator.mean.toFixed(5)} / ${n1g.verdict}`);
  if (n1b.verdict === 'REFUTED') notExecutable.push(`A6.4.2: N1 bounded λ=0.1 ${n1b.verdict}`);
  fs.writeFileSync(path.join(outDir, 'summary.json'), JSON.stringify({ cells }, null, 1) + '\n');
  fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify({
    study: STUDY_ID, arm: 'A6', mode: MODE, engine_version: pkg.version, git_sha: gitSha,
    registration_commit: REGISTRATION_COMMIT, supersedes: null, node: process.version,
    seed: SEED, n: N, ticks: T, nulls: NULL_IDS, kinds: KINDS.map((k) => k.id), bound: BOUND,
    generator_variances: variances, not_executable: notExecutable.length ? notExecutable : null,
    generated_at: stamp, argv: process.argv.slice(2),
  }, null, 2));
  if (notExecutable.length) {
    fs.writeFileSync(path.join(outDir, 'NOT-EXECUTABLE.json'), JSON.stringify({ reasons: notExecutable }, null, 2));
    console.error(`NOT EXECUTABLE — preserved unscored: ${notExecutable.join('; ')}`);
    process.exit(3);
  }
  console.log(`\n${cells.length} cells -> ${path.relative(STUDY, outDir)}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();

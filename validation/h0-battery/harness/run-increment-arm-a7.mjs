// harness/run-increment-arm-a7.mjs — Amendment A7: the increment arm for the two Family-A wealths.
//
//   node harness/run-increment-arm-a7.mjs --mode live [--n 2000] [--t 2000]
//   node harness/run-increment-arm-a7.mjs --mode sim  (writes under results/sim/, git-ignored)
//
// A separate file (A6.5's precedent): output prefixed `inc-`, never selected by
// analysis/run_endpoints.mjs. It drives the battery's own adapters for the two constructions
// (harness/detectors.mjs, each calling the shipped module with oracle μ = 0, σ = 1 and the null's φ,
// the module's own AR(1) whitening) and reads the per-tick wealth ratio exp(Δ log M) — the
// detector-audit §3 instrument on the A6 nulls. Two estimators (A7.1): the engine's pooled
// incrementEstimate (recorded) and the trajectory-level interval (verdict authority). The
// divergence rule I2 (A7.2) scores the mixture's heavy-tail cells where no interval can.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { rng, gaussFrom, NULLS, N8_COMBINED } from './nulls.mjs';
import { DETECTORS, standardiser } from './detectors.mjs';

const require = createRequire(import.meta.url);
const MON = require('../../../dist/fleet/calibration-monitor.js');

const STUDY = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
export const STUDY_ID = '2026-09-h0-battery-family-a-increment';
export const SEED = 20260925;
export const REGISTRATION_COMMIT = '98f9e88';
export const PIN_VERSION = '0.10.0-pre';
export const BOUND = 1.0005;            // the card-falsifier bound (A3.4, A7.2)
export const HOUSE_BOUND = 1;           // detector-audit PREREGISTRATION §3
export const DIVERGENCE_BOUND = 1e4;    // A7.2 I2: Markov at level 1e-4 on a non-negative increment
export const NULL_IDS = ['N1', 'N3-p09', 'N5', 'N6', 'N8'];
export const ALPHA = 0.05;              // the adapters' firing level; wealth does not depend on it

const ALL_NULLS = [...NULLS, N8_COMBINED];
export const SPECS = NULL_IDS.map((id) => ALL_NULLS.find((n) => n.id === id));
export const CONSTRUCTIONS = ['family_A_betting_e_process', 'family_A_mixture_supermartingale']
  .map((id) => ({ id, adapter: DETECTORS.find((d) => d.id === id), cellId: `${id}_increment` }));

/** A7.3 — the registered predictions, derived by quadrature before the harness existed. */
export const E_Z_LOGNORMAL = -0.00924, E_Z2_LOGNORMAL = 0.08156;
export function registeredPrediction(nullId, constructionId) {
  const heavy = nullId === 'N5' || nullId === 'N6' || nullId === 'N8';
  if (constructionId === 'family_A_betting_e_process') {
    if (nullId === 'N5') return { value: 1 + E_Z_LOGNORMAL * E_Z_LOGNORMAL / E_Z2_LOGNORMAL, tolerance: 0.0003, expected: 'REFUTED' };
    return { value: 1, tolerance: 0.0005, expected: 'CLEARED' };
  }
  if (heavy) return { value: null, tolerance: null, expected: 'DIVERGENT' };
  return { value: 1, tolerance: 0.003, expected: 'CLEARED' };
}

function trajectoryEstimator(means) {
  const n = means.length;
  const mean = means.reduce((a, b) => a + b, 0) / n;
  const varr = n > 1 ? means.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1) : 0;
  const se = Math.sqrt(varr / n);
  return { n, mean, sd: Math.sqrt(varr), se, lower95: mean - 1.96 * se, upper95: mean + 1.96 * se };
}

/** One cell (A7.1, A7.2): the shipped adapter on N trajectories × T ticks of the raw null series. */
export function measureCell(spec, construction, N, T) {
  const pooled = MON.freshIncrementEstimator();
  const trajMeans = [];
  let nonFinite = 0;
  for (let i = 0; i < N; i++) {
    const r = rng(SEED + 7919 * i + spec.id.length * 104729 + construction.id.length);
    const src = spec.gen(r);
    const inst = construction.adapter.make({ mu: 0, sigma: 1, phi: spec.phi ?? 0, alpha: ALPHA, windows: spec.windows });
    let sum = 0, k = 0;
    for (let t = 0; t < T; t++) {
      const before = inst.logM();
      inst.step(src());
      const after = inst.logM();
      const d = after - before;
      if (!Number.isFinite(d)) { nonFinite++; continue; }
      MON.updateIncrementEstimator(pooled, d);
      sum += Math.exp(d); k++;
    }
    if (k) trajMeans.push(sum / k);
  }
  const inc = MON.incrementEstimate(pooled);
  const traj = trajectoryEstimator(trajMeans);
  const divergent = inc.mean >= DIVERGENCE_BOUND;
  const byInterval = traj.lower95 > BOUND ? 'REFUTED' : traj.upper95 < BOUND ? 'CLEARED' : 'inconclusive';
  const verdict = divergent ? 'REFUTED' : byInterval;
  const houseRuleVerdict = traj.lower95 > HOUSE_BOUND ? 'REFUTED' : traj.upper95 < BOUND ? 'CLEARED' : 'inconclusive';
  const pred = registeredPrediction(spec.id, construction.id);
  const gap = pred.value === null ? null : traj.mean - pred.value;
  const within = pred.expected === 'DIVERGENT' ? divergent : (Math.abs(gap) <= pred.tolerance && verdict === pred.expected);
  return {
    detector: construction.cellId, construction: construction.id, family: 'A', arm: 'A7',
    null_id: spec.id, null_label: spec.label, params: 'oracle', phi: spec.phi ?? 0,
    trajectories: N, ticks: T, n: inc.n, non_finite_increments: nonFinite,
    increment_estimator: inc,
    trajectory_estimator: traj,
    divergent,
    registered_prediction: pred.value, prediction_tolerance: pred.tolerance, registered_expectation: pred.expected,
    prediction_gap: gap, prediction_within_tolerance: within,
    verdict, interval_verdict: byInterval,
    verdict_rule: `A7.2: on trajectory_estimator, REFUTED iff lower95 > ${BOUND}, CLEARED iff upper95 < ${BOUND}, else inconclusive; I2 DIVERGENT iff the pooled mean >= ${DIVERGENCE_BOUND} (Markov, level 1e-4), scored REFUTED`,
    house_rule_verdict: houseRuleVerdict,
    house_rule: `detector-audit PREREGISTRATION §3: REFUTED iff lower95 > ${HOUSE_BOUND}, CLEARED iff upper95 < ${BOUND}. Recorded beside the scored token, no verdict authority.`,
  };
}

/** A7.4.3 — A6.4.3's variance check on the standardised generators, and every N5 draw finite. */
export function generatorChecks(nDraws = 200000) {
  const variances = {}; let n5NonFinite = 0;
  for (const spec of SPECS) {
    const r = rng(99); const src = spec.gen(r); const std = standardiser({ mu: 0, sigma: 1, phi: spec.phi ?? 0 });
    let s = 0, s2 = 0;
    for (let t = 0; t < nDraws; t++) { const x = src(); if (spec.id === 'N5' && !Number.isFinite(x)) n5NonFinite++; const v = std(x); s += v; s2 += v * v; }
    const mean = s / nDraws; variances[spec.id] = s2 / nDraws - mean * mean;
  }
  return { variances, n5NonFinite };
}

function main() {
  const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
  const MODE = arg('--mode', 'sim');
  const N = Number(arg('--n', 2000));
  const T = Number(arg('--t', 2000));
  const pkg = JSON.parse(fs.readFileSync(path.join(STUDY, '..', '..', 'package.json'), 'utf8'));
  const gitSha = execSync('git rev-parse HEAD', { cwd: path.join(STUDY, '..', '..') }).toString().trim();
  if (pkg.version !== PIN_VERSION) { console.error(`NOT EXECUTABLE (A7.4.1): engine is ${pkg.version}, pinned to ${PIN_VERSION}`); process.exit(3); }
  const { variances, n5NonFinite } = generatorChecks();
  for (const [id, v] of Object.entries(variances)) if (Math.abs(v - 1) > 0.03) { console.error(`NOT EXECUTABLE (A7.4.3): ${id} standardised variance ${v.toFixed(4)}`); process.exit(3); }
  if (n5NonFinite) { console.error(`NOT EXECUTABLE (A7.4.3): ${n5NonFinite} non-finite N5 draws`); process.exit(3); }

  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
  const outDir = path.join(STUDY, 'results', MODE === 'live' ? 'live' : 'sim', `inc-${stamp}`);
  if (fs.existsSync(outDir)) { console.error(`refusing to reuse ${outDir}`); process.exit(1); }
  fs.mkdirSync(path.join(outDir, 'cells'), { recursive: true });

  const cells = [];
  for (const construction of CONSTRUCTIONS) {
    for (const spec of SPECS) {
      const c = { ...measureCell(spec, construction, N, T), mode: MODE, engine_version: pkg.version, git_sha: gitSha };
      cells.push(c);
      fs.writeFileSync(path.join(outDir, 'cells', `${c.detector}__${spec.id}.json`), JSON.stringify(c, null, 2));
      const e = c.trajectory_estimator, p = c.increment_estimator;
      console.log(`${construction.id.padEnd(34)} ${spec.id.padEnd(7)} traj=${e.mean.toExponential(4)} [${e.lower95.toExponential(3)}, ${e.upper95.toExponential(3)}] pooled=${p.mean.toExponential(3)} max/mean=${p.maxToMean.toFixed(1)} expect=${c.registered_expectation} ${c.prediction_within_tolerance ? 'in-tol' : 'OUT-OF-TOL'} ${c.verdict}${c.divergent ? ' (divergent)' : ''}`);
    }
  }
  // A7.4.2 — the harness checks on the run's own N1 cells.
  const n1b = cells.find((c) => c.null_id === 'N1' && c.construction === 'family_A_betting_e_process');
  const n1m = cells.find((c) => c.null_id === 'N1' && c.construction === 'family_A_mixture_supermartingale');
  const notExecutable = [];
  if (n1b.verdict === 'REFUTED' || Math.abs(n1b.trajectory_estimator.mean - 1) > 0.0005) notExecutable.push(`A7.4.2: N1 betting ${n1b.trajectory_estimator.mean.toFixed(6)} / ${n1b.verdict}`);
  if (n1m.verdict === 'REFUTED' || Math.abs(n1m.trajectory_estimator.mean - 1) > 0.003) notExecutable.push(`A7.4.2: N1 mixture ${n1m.trajectory_estimator.mean.toFixed(6)} / ${n1m.verdict}`);
  fs.writeFileSync(path.join(outDir, 'summary.json'), JSON.stringify({ cells }, null, 1) + '\n');
  fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify({
    study: STUDY_ID, arm: 'A7', mode: MODE, engine_version: pkg.version, git_sha: gitSha,
    registration_commit: REGISTRATION_COMMIT, supersedes: null, node: process.version,
    seed: SEED, n: N, ticks: T, nulls: NULL_IDS, constructions: CONSTRUCTIONS.map((c) => c.id), bound: BOUND, divergence_bound: DIVERGENCE_BOUND,
    generator_variances: variances, n5_non_finite_draws: n5NonFinite, not_executable: notExecutable.length ? notExecutable : null,
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

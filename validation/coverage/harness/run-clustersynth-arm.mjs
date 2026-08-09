// validation/coverage/harness/run-clustersynth-arm.mjs — the K6 T2 clustersynth arm.
//
// Design frozen by ../PREREGISTRATION.md Amendment v2.K6 (K6.12: "THE T2 CLUSTERSYNTH ARM,
// VALIDITY-ONLY") and Amendment v2.K6.1 (K6.1.3: the T2 field list — the plan's own literal
// line SUPERSEDED, named explicitly; K6.1.4: t2_pooled_lower_95 and per-row k/n registered).
// This is the C22-fix vindication test — the predecessor (shape-kurtosis-e-value.ts) fired
// on 82% of healthy clustersynth shards (knowledge/stats/shape-clustersynth-2026-08-05);
// `shape_block_conformal_bet`'s CONTIGUITY answer to C22 is checked here directly against
// independent telemetry, not merely against this study's own synthetic T1 battery.
//
// VALIDITY-ONLY (K6.12's own ruling): faults:false, healthy shards only. No detection_rate,
// no shift_sigma, no S3 candidacy of any kind for these cells — endpoint is healthy crossing
// rate vs alpha, per coordinate AND pooled.
//
// BINDING FIELD-NAME CONSTRAINT (K6.1.3, superseding the plan's own literal Task-11 "Files:"
// bullet, which would VOID the run if followed): T2 cells carry `t2_crossing_rate` (NOT
// `crossing_rate`), `t2_verdict` (NOT `verdict`) on the pooled row, and NO `fault_class` at
// all — keeping every T2 cell invisible to `isValidityCell`/`isPowerCell`/`coverageFor`
// (validation/certification/lib/score.mjs), the same K3.3.3 `step_blindness_probe_rate`
// precedent applied here.
//
// Shard-realization call, checked against validation/shape-battery/harness/run-clustersynth.mjs
// (the plan's own citation for "how the engine consumes it"): cs.buildScenario(...) ->
// sc.gpuIds -> per shard, cs.realizeShard(sc.seed, gid, sc.ctx, sc.graph, sc.applier,
// undefined, heavyTailsDf) -> a named-counter row per tick (COUNTERS, p=5 coordinates).
//
// Harness discipline (matching run-battery.mjs's own three rules):
//   1. Every external interface read before wiring, at a line: clustersynth's buildScenario/
//      realizeShard/COUNTERS (this comment block), shapeBetWindow/shapeBetWealth/
//      calibrateShapeBlocks (detectors/shape-block-conformal-bet.ts, cited in K6.2).
//   2. NO bare catch, except the ONE registered exception K6.12 itself names: calibration's
//      own degenerate-reference guard throw, caught per (shard, coordinate) and RECORDED
//      (skipped-with-reason), never silently swallowed and never left to abort the arm.
//   3. Determinism: nothing in the measurement path reads the clock; the clock only names
//      the run dir. The scenario seed is the registered K6_T2_SCENARIO_SEED, asserted against
//      its registered literal at startup, same convention as run-battery.mjs's
//      assertRegistryAgreement().
//
// clustersynth resolution is WORKTREE-SAFE: validation/shape-battery/harness/
// run-clustersynth.mjs resolves clustersynth as a sibling of ENGINE_ROOT
// (`path.resolve(ENGINE_ROOT, '..', 'clustersynth')`), which breaks under a git worktree
// (ENGINE_ROOT's own parent is the worktree container, e.g. ~/.sdd-worktrees, not the
// sibling-repos directory the primary checkout lives in). `git rev-parse --git-common-dir`
// always resolves to the PRIMARY checkout's .git, worktree or not — resolving clustersynth
// relative to that instead is the fix, checked directly against this worktree at Task 11.
//
// Results are append-only, same convention as run-battery.mjs: the run refuses to overwrite
// an existing run dir. COVERAGE_RESULTS_DIR relocates the results root so tests never write
// under validation/coverage/results/live.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { createRequire } from 'node:module';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const STUDY = path.dirname(HERE);
const ENGINE_ROOT = path.resolve(STUDY, '..', '..');
const require = createRequire(import.meta.url);
const shapeBlockBet = require(path.join(ENGINE_ROOT, 'dist/detectors/shape-block-conformal-bet.js'));
// Amendment v2.K6A.1, K6A.1.11: the K6-slow accumulator's own T2 validity arm — K6.12's
// construction applied UNCHANGED with detector: 'shape_ecdf_accumulator', at the m = 45 geometry
// that amendment derives by arithmetic rather than discovers at run time.
const shapeEcdfAcc = require(path.join(ENGINE_ROOT, 'dist/detectors/shape-ecdf-accumulator.js'));

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };

// ── registered constants (K6.12) ───────────────────────────────────────────────
const K6_T2_SCENARIO_SEED = 20260842;    // BASE_SEED(20260807) + 35, K6.12
if (K6_T2_SCENARIO_SEED !== 20260807 + 35) throw new Error('run-clustersynth-arm: K6_T2_SCENARIO_SEED != BASE_SEED + 35');
const FAMILY = 'gb200';
const PODS = 1;
const DT_S = 30;
const REGISTERED_STEPS = 9600;           // K6.12: window.steps
const REGISTERED_SHARDS = 120;           // K6.12: sc.gpuIds.slice(0, 120), CLUSTERSYNTH-PREREG.md's default
const REFERENCE_TICKS = 9000;            // K6.12/K6.3: fixed regardless of --steps; floor(9000/30)=300
const THRESHOLD = 20;                    // 1/alpha, ALPHA=0.05, same class endpoint as K6.10
const ALPHA = 0.05;

// ── the two T2 candidates, keyed by detector id ───────────────────────────────────────────────
// K6.12 registered this arm for shape_block_conformal_bet; Amendment v2.K6A.1 K6A.1.11 registers
// it for shape_ecdf_accumulator with the SAME scenario, shards, counters, skip accounting and
// field names, and ONE difference stated as arithmetic: W = 150 cannot be fed m = 500, because
// 500*150 = 75,000 >> the 9,000 reference ticks the scenario supplies. Preserving the frozen 1:3
// A/B ratio instead gives A = 2,250 and B = 6,750 -> m = floor(6750/150) = 45 blocks EXACTLY
// (2,250 + 45*150 = 9,000), with 600/150 = 4 live windows. Both consequences K6A.1.11 registers
// are carried here rather than rediscovered: T2's m is 45 and NOT T1's 500, and the T2 healthy
// falsifier is very nearly VACUOUS at this W (per-window ceiling 0.834782 nats, so a crossing is
// possible only at window 4 and needs S_4 >= 14.2347 of a maximum 4*log 46 = 15.3146 against
// E[S_4|null] = 3.7535; predicted T2 pooled healthy crossing 0.0000).
const K6SLOW_T2_SCENARIO_SEED = 20260855; // BASE_SEED(20260807) + 48, K6A.1.9
if (K6SLOW_T2_SCENARIO_SEED !== 20260807 + 48) throw new Error('run-clustersynth-arm: K6SLOW_T2_SCENARIO_SEED != BASE_SEED + 48');

const T2_DETECTORS = Object.freeze({
  shape_block_conformal_bet: Object.freeze({
    W: shapeBlockBet.W_K6,
    mRegistered: 300,                    // floor(9000/30), K6.3
    aTicks: null,                        // no A/B split: the whole reference is blocked
    scenarioSeed: K6_T2_SCENARIO_SEED,
    prereg: '../PREREGISTRATION.md (Amendment v2.K6, K6.12; Amendment v2.K6.1, K6.1.3/K6.1.4)',
    calibrate: (reference) => shapeBlockBet.calibrateShapeBlocks(reference, shapeBlockBet.W_K6),
    wealthLog: (windows, cal) => shapeBlockBet.shapeBetWealth(windows, cal).log,
    windowE: null,
    // K6.1.3 fixes THIS arm's field set and registers no increment field on it, so none is
    // emitted here: v2.K6A.2 K6A.2.6's t2 increment prediction belongs to the accumulator.
    emitIncrement: false,
  }),
  shape_ecdf_accumulator: Object.freeze({
    W: shapeEcdfAcc.W_K6SLOW,
    mRegistered: 45,                     // K6A.1.11, by the arithmetic in this block's comment
    aTicks: 2250,                        // the frozen 1:3 ratio against B = 6,750
    scenarioSeed: K6SLOW_T2_SCENARIO_SEED,
    prereg: '../PREREGISTRATION.md (Amendment v2.K6A.1, K6A.1.11 + K6A.1.9; K6.12/K6.1.3 applied unchanged)',
    calibrate: (reference) => shapeEcdfAcc.calibrateEcdfAccumulator(reference, { W: shapeEcdfAcc.W_K6SLOW, nA: 2250, m: 45 }),
    wealthLog: (windows, cal) => shapeEcdfAcc.ecdfAccumulatorWealth(windows, cal).log,
    windowE: (window, cal) => shapeEcdfAcc.ecdfAccumulatorWindow(window, cal).e,
    emitIncrement: true,                 // v2.K6A.2 K6A.2.6's registered T2 prediction
  }),
});
const DETECTOR = arg('--detector', 'shape_block_conformal_bet');
const SPEC = T2_DETECTORS[DETECTOR];
if (!SPEC) {
  throw new Error(`run-clustersynth-arm: --detector "${DETECTOR}" is not a registered T2 candidate `
    + `(${Object.keys(T2_DETECTORS).join(' | ')})`);
}
const W = SPEC.W;
if (DETECTOR === 'shape_block_conformal_bet' && W !== 30) throw new Error(`run-clustersynth-arm: shapeBlockBet.W_K6 is ${W}, PREREGISTRATION.md K6.1 registers 30`);
if (DETECTOR === 'shape_ecdf_accumulator' && W !== 150) throw new Error(`run-clustersynth-arm: shapeEcdfAcc.W_K6SLOW is ${W}, PREREGISTRATION.md K6A.1.2 registers 150`);
// The A/B arithmetic, asserted rather than trusted: it is what makes m exact and not floored.
if (SPEC.aTicks !== null && SPEC.aTicks + SPEC.mRegistered * W !== REFERENCE_TICKS) {
  throw new Error(`run-clustersynth-arm: ${DETECTOR}'s A(${SPEC.aTicks}) + m(${SPEC.mRegistered})*W(${W}) `
    + `!= the ${REFERENCE_TICKS} reference ticks the scenario supplies (K6A.1.11)`);
}
const SCENARIO_SEED = SPEC.scenarioSeed;

const STEPS = Number(arg('--steps', REGISTERED_STEPS));      // smoke override
const REQUESTED_SHARDS = Number(arg('--shards', REGISTERED_SHARDS)); // smoke override
if (STEPS <= REFERENCE_TICKS) {
  throw new Error(`run-clustersynth-arm: --steps ${STEPS} must exceed the fixed reference slice ${REFERENCE_TICKS}`);
}
const LIVE_TICKS = STEPS - REFERENCE_TICKS;

// Test-only hook, named: forces the FIRST (shard, coordinate) pair's 9,000-tick reference
// into a constant block, so calibrateShapeBlocks's own degenerate-reference guard
// (assertNonDegenerate, shape-block-conformal-bet.ts) throws for that pair — a positive
// control proving the skip-with-reason path can actually fire (K6.12's own registered
// finding: "the guard firing on real telemetry is itself a registered finding, not an error
// to suppress"). Cannot fire by accident (unset env var leaves it false), recorded in the
// manifest, same convention as run-battery.mjs's COVERAGE_FORCE_SPECTRAL_DEGENERATE.
const FORCE_DEGENERATE = process.env.COVERAGE_T2_FORCE_DEGENERATE === '1';
// Test-only hook, named: forces EVERY (shard, coordinate) pair's reference into a constant
// block, so the pooled row's own n===0 path (post-Task-11a review, Important 4: t2_verdict
// fail-open at n=0) is exercised end to end, not merely asserted in isolation. Cannot fire by
// accident, recorded in the manifest, same convention as FORCE_DEGENERATE above.
const FORCE_ALL_DEGENERATE = process.env.COVERAGE_T2_FORCE_ALL_DEGENERATE === '1';

// ── clustersynth resolution, worktree-safe (see module header) ────────────────
function resolveClustersynthRoot() {
  if (process.env.CLUSTERSYNTH_ROOT) return path.resolve(process.env.CLUSTERSYNTH_ROOT);
  let commonDir;
  try {
    commonDir = execSync('git rev-parse --git-common-dir', { cwd: ENGINE_ROOT, encoding: 'utf8' }).trim();
  } catch (err) {
    throw new Error(`run-clustersynth-arm: could not resolve git-common-dir from ${ENGINE_ROOT}: ${err.message}`);
  }
  const gitDir = path.isAbsolute(commonDir) ? commonDir : path.resolve(ENGINE_ROOT, commonDir);
  const primaryRepoRoot = path.dirname(gitDir); // strip the trailing /.git
  return path.resolve(primaryRepoRoot, '..', 'clustersynth');
}
const CLUSTERSYNTH_ROOT = resolveClustersynthRoot();
const CLUSTERSYNTH_INDEX = path.join(CLUSTERSYNTH_ROOT, 'dist', 'index.js');
if (!fs.existsSync(CLUSTERSYNTH_INDEX)) {
  throw new Error(`run-clustersynth-arm: clustersynth not found at ${CLUSTERSYNTH_INDEX} `
    + '(resolved via git-common-dir sibling; override with CLUSTERSYNTH_ROOT if the checkout lives elsewhere)');
}
const cs = await import(`file://${CLUSTERSYNTH_INDEX}`);

// K6.12: "a named-counter row per tick (COUNTERS, clustersynth/dist/harness/factor-model.js:28-33:
// gpu_temp_c, power_w, sm_util, hbm_bw_gbps, nvlink_tx_gbps — p=5 coordinates, checked directly
// against the export)." Cross-checked at startup, same discipline as run-battery.mjs's window
// assertions: a coordinate-count drift crashes here rather than silently mismatching the
// registered p=5.
const COUNTER_NAMES = cs.COUNTERS.map((c) => c.name);
if (COUNTER_NAMES.length !== 5) {
  throw new Error(`run-clustersynth-arm: clustersynth COUNTERS has ${COUNTER_NAMES.length} entries, K6.12 registers p=5`);
}

// run.mjs:50-52's one-sided 95% lower bound on a rate, copied verbatim (run-battery.mjs's own
// citation), used here for the pooled row's t2_pooled_lower_95 (K6.1.4).
const lower95 = (k, n) => {
  const p = k / n, z = 1.645, d = 1 + z * z / n;
  const c = p + z * z / (2 * n), h = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n));
  return Math.max(0, (c - h) / d);
};

// ── run ──────────────────────────────────────────────────────────────────────
const t0 = Date.now();

// K6.12's registered scenario: faults:false (healthy only), family/pods/window fixed.
const sc = cs.buildScenario({ family: FAMILY, pods: PODS, seed: SCENARIO_SEED, window: { steps: STEPS, dt_s: DT_S }, faults: false });
const shardIds = sc.gpuIds.slice(0, REQUESTED_SHARDS);
if (shardIds.length < REQUESTED_SHARDS) {
  throw new Error(`run-clustersynth-arm: scenario only has ${sc.gpuIds.length} shards, requested ${REQUESTED_SHARDS}`);
}

const cells = [];
let forcedOnce = false;

for (const shardId of shardIds) {
  // K6.12: cs.realizeShard(sc.seed, gid, sc.ctx, sc.graph, sc.applier, undefined, heavyTailsDf)
  // — heavyTailsDf is undefined (no heavyTails in this arm's registered scenario config,
  // matching run-clustersynth.mjs's own C1-healthy-arm convention).
  const rec = cs.realizeShard(sc.seed, shardId, sc.ctx, sc.graph, sc.applier, undefined, undefined);
  for (const counter of COUNTER_NAMES) {
    const series = rec[counter];
    if (!series || series.length !== STEPS) {
      throw new Error(`run-clustersynth-arm: shard ${shardId} counter ${counter}: expected ${STEPS} ticks, got ${series?.length}`);
    }
    let reference = series.slice(0, REFERENCE_TICKS);
    if (FORCE_DEGENERATE && !forcedOnce) {
      // Positive control (test-only, see module header): a constant block makes m2=0 for
      // every reference block, so calibrateShapeBlocks's assertNonDegenerate throws.
      reference = reference.map(() => reference[0]);
      forcedOnce = true;
    }
    if (FORCE_ALL_DEGENERATE) {
      reference = reference.map(() => reference[0]);
    }
    const live = series.slice(REFERENCE_TICKS, STEPS);

    let cal = null, skipped = false, skipReason = null;
    // K6.12: "Task 11's adapter must catch that throw per (shard, coordinate) and record it,
    // not let it abort the whole arm." The ONE registered exception to "no bare catch."
    try {
      cal = SPEC.calibrate(reference);
    } catch (err) {
      skipped = true;
      skipReason = err?.message ?? String(err);
    }

    let k = null, n = null, t2CrossingRate = null, nRefBlocks = null, nLiveWindows = null;
    let windowEs = null;
    if (!skipped) {
      nRefBlocks = cal.m;
      if (nRefBlocks !== SPEC.mRegistered) {
        throw new Error(`run-clustersynth-arm: shard ${shardId} ${counter}: n_reference_blocks ${nRefBlocks} `
          + `!= registered ${SPEC.mRegistered} (${DETECTOR === 'shape_ecdf_accumulator' ? 'K6A.1.11' : 'K6.3'})`);
      }
      const windows = [];
      for (let w = 0; (w + 1) * W <= live.length; w++) windows.push(live.slice(w * W, w * W + W));
      nLiveWindows = windows.length;
      // K6.12: "a crossing iff wealth >= 20 at any of the 20 disjoint live-window checkpoints
      // (K6.10's own any-prefix reading, reused at this arm's own 20-window span)."
      const log = SPEC.wealthLog(windows, cal);
      const crossed = log.some((l) => l >= Math.log(THRESHOLD));
      // Amendment v2.K6A.2, K6A.2.6: the T2 increment mean is a REGISTERED prediction of its own
      // (0.960274 at m = 45, band [0.94, 0.98]) because the null law shifts with m and T1's
      // 0.9914 must not be carried across — a T2 reading near 0.99 would indicate the wrong m.
      // Prefixed `t2_` like every other field on this arm (K6.1.3's binding rule), so it can
      // never be read as the S2 instrument `increment_estimator` by the certification scorer.
      if (SPEC.emitIncrement) windowEs = windows.map((w) => SPEC.windowE(w, cal));
      // K6.1.4: k=1 if this pair crossed, 0 otherwise (a single binary outcome, not a
      // sub-count over its windows); n=1, the row's own weight.
      k = crossed ? 1 : 0;
      n = 1;
      t2CrossingRate = k;
    }

    // K6.1.3's registered field set (superseding the plan's own literal line, which would
    // VOID the run): t2_crossing_rate (not crossing_rate), no fault_class at all.
    cells.push({
      detector: DETECTOR,
      arm: 'T2-clustersynth',
      counter,
      shard_id: shardId,
      n_reference_blocks: nRefBlocks,
      n_live_windows: nLiveWindows,
      k,
      n,
      t2_crossing_rate: t2CrossingRate,
      ...(windowEs ? { t2_increment_mean: windowEs.reduce((a, b) => a + b, 0) / windowEs.length } : {}),
      skipped,
      skip_reason: skipReason,
      substrate_tier: 'T2',
    });
  }
  process.stderr.write(`shard ${shardId} realized (${COUNTER_NAMES.length} counters)\n`);
}

// Per-coordinate pooled summary row (K6.12: "plus a pooled summary row per coordinate").
// K6.1.4: k = sum(k_i), n = count of non-skipped pairs.
for (const counter of COUNTER_NAMES) {
  const rows = cells.filter((c) => c.arm === 'T2-clustersynth' && c.counter === counter && !c.skipped);
  const skippedCount = cells.filter((c) => c.arm === 'T2-clustersynth' && c.counter === counter && c.skipped).length;
  const k = rows.reduce((a, c) => a + c.k, 0);
  const n = rows.length;
  const incs = rows.map((c) => c.t2_increment_mean).filter((x) => typeof x === 'number');
  cells.push({
    detector: DETECTOR,
    arm: 'T2-clustersynth-coordinate',
    counter,
    k,
    n,
    t2_crossing_rate: n ? k / n : null,
    ...(incs.length ? { t2_increment_mean: incs.reduce((a, b) => a + b, 0) / incs.length } : {}),
    skipped_count: skippedCount,
    substrate_tier: 'T2',
  });
}

// One overall pooled row (K6.12: "and one overall pooled row"). K6.13's T2 stop condition
// reads t2_pooled_lower_95 (K6.1.4) on THIS row — the pooled k/n across ALL scored
// (shard, coordinate) pairs, not any single coordinate's own rate.
{
  const rows = cells.filter((c) => c.arm === 'T2-clustersynth' && !c.skipped);
  const skippedCount = cells.filter((c) => c.arm === 'T2-clustersynth' && c.skipped).length;
  const k = rows.reduce((a, c) => a + c.k, 0);
  const n = rows.length;
  const t2CrossingRate = n ? k / n : null;
  const t2PooledLower95 = n ? lower95(k, n) : NaN;
  const incs = rows.map((c) => c.t2_increment_mean).filter((x) => typeof x === 'number');
  cells.push({
    detector: DETECTOR,
    arm: 'T2-clustersynth-pooled',
    counter: null,
    k,
    n,
    t2_crossing_rate: t2CrossingRate,
    ...(incs.length ? { t2_increment_mean: incs.reduce((a, b) => a + b, 0) / incs.length } : {}),
    t2_pooled_lower_95: t2PooledLower95,
    // K6.13's own T2 stop condition, same vocabulary as K3.1.3/K6.7 (run.mjs:115): a fired
    // stop condition = REFUTED, filed as 'FAIL'; otherwise 'not-refuted'. Bug fix
    // (post-Task-11a review, Important 4): n===0 (every pair skipped) previously fell through
    // to 'not-refuted' via `n && ... ? 'FAIL' : 'not-refuted'` — a falsy `n` short-circuits the
    // ternary's condition to false, silently reading as "cleared" when nothing was actually
    // measured. NOT-EXECUTABLE (A3b's vocabulary, run-battery.mjs's own fallback token) is the
    // honest reading of a vacuous pooled row.
    t2_verdict: n === 0 ? 'NOT-EXECUTABLE' : (t2PooledLower95 > ALPHA ? 'FAIL' : 'not-refuted'),
    skipped_count: skippedCount,
    substrate_tier: 'T2',
  });
  process.stderr.write(`\npooled: k=${k} n=${n} t2_crossing_rate=${t2CrossingRate === null ? 'n/a' : t2CrossingRate.toFixed(4)} `
    + `t2_pooled_lower_95=${Number.isFinite(t2PooledLower95) ? t2PooledLower95.toFixed(4) : 'n/a'} `
    + `skipped=${skippedCount}\n`);
}

// ── manifest and append-only write (mirrors run-battery.mjs's own convention) ─────────────
let gitSha = null;
try { gitSha = execSync('git rev-parse HEAD', { cwd: ENGINE_ROOT }).toString().trim(); } catch { gitSha = null; }
const enginePin = JSON.parse(fs.readFileSync(path.join(ENGINE_ROOT, 'package.json'), 'utf8')).version;

const outRoot = process.env.COVERAGE_RESULTS_DIR
  ? path.resolve(process.env.COVERAGE_RESULTS_DIR)
  : path.join(STUDY, 'results');
// Only a run at the registered shard count AND the registered scenario steps, with no test
// hook engaged, may write to results/live — the loadEvidence evidence path
// (validation/certification/lib/collect.mjs:138). Anything else (a smaller --shards/--steps
// smoke, or the forced-degenerate hook) lands in results/sim, run-battery.mjs's own convention.
const MODE = (REQUESTED_SHARDS === REGISTERED_SHARDS && STEPS === REGISTERED_STEPS && !FORCE_DEGENERATE && !FORCE_ALL_DEGENERATE) ? 'live' : 'sim';
const stamp = `${new Date().toISOString().replace(/[-:.]/g, '').slice(0, 15)}Z`;
const outDir = path.join(outRoot, MODE, `run-t2-${stamp}`);
if (fs.existsSync(outDir)) {
  throw new Error(`run-clustersynth-arm: ${outDir} exists; results are append-only and this run refuses to overwrite`);
}
fs.mkdirSync(outDir, { recursive: true });

fs.writeFileSync(path.join(outDir, 'summary.json'), `${JSON.stringify({ cells }, null, 1)}\n`);
fs.writeFileSync(path.join(outDir, 'manifest.json'), `${JSON.stringify({
  // 'clustersynth' in the study name is belt-and-suspenders with the explicit `tier` below —
  // tierOfStudy (validation/certification/lib/constants.mjs) checks the explicit tier FIRST,
  // but a study name carrying the substring is the same convention every other clustersynth
  // study in this repo already uses (validation/shape-battery's 'shape-clustersynth' /
  // 'clustersynth-ui').
  study: 'coverage-t2-clustersynth',
  prereg: SPEC.prereg,
  detector: DETECTOR,
  git_sha: gitSha,
  engine_pin: enginePin,
  engine_version: enginePin,
  node: process.version,
  mode: MODE,
  smoke: !(REQUESTED_SHARDS === REGISTERED_SHARDS && STEPS === REGISTERED_STEPS),
  tier: 'T2',
  family: FAMILY,
  pods: PODS,
  dt_s: DT_S,
  faults: false,
  scenario_seed: SCENARIO_SEED,
  registered_shards: REGISTERED_SHARDS,
  registered_steps: REGISTERED_STEPS,
  shards: REQUESTED_SHARDS,
  steps: STEPS,
  reference_ticks: REFERENCE_TICKS,
  reference_a_ticks: SPEC.aTicks,
  n_reference_blocks_registered: SPEC.mRegistered,
  live_ticks: LIVE_TICKS,
  w: W,
  alpha: ALPHA,
  threshold: THRESHOLD,
  counters: COUNTER_NAMES,
  t2_force_degenerate_hook: FORCE_DEGENERATE,
  t2_force_all_degenerate_hook: FORCE_ALL_DEGENERATE,
  clustersynth_root: CLUSTERSYNTH_ROOT,
  generated_at: stamp,
}, null, 1)}\n`);

process.stderr.write(`\n${cells.length} cells -> ${outDir}\nelapsed ${(Date.now() - t0) / 1000}s\n`);

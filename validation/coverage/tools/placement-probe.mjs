// C50 pre-registration probe: the three A placements on a NON-REGISTERED clustersynth
// scenario seed, plus the drift shape of each counter.
//
// Purpose: derive the strided-A prediction for the registered rerun from evidence rather
// than assumption. The registered T2 scenario seed is 20260855 (K6A.1.11) and is NOT
// touched here. Probe seed base 7.0e8 — above every registered seed (<= 1e8) and not one
// of the eight named K6-probe bases (1.7e9 .. 4.1e9).
//
// Usage: node placement-probe.mjs <seed> <shards>

import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { createRequire } from 'node:module';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ENGINE_ROOT = path.resolve(HERE, '..', '..', '..');
const require = createRequire(import.meta.url);
const acc = require(path.join(ENGINE_ROOT, 'dist/detectors/shape-ecdf-accumulator.js'));

// The harness's own resolveClustersynthRoot (../harness/run-clustersynth-arm.mjs), copied rather
// than hand-rolled: `git rev-parse --git-common-dir` always resolves to the PRIMARY checkout, so
// this is correct inside a git worktree, where a plain `../../clustersynth` is not.
function resolveClustersynthRoot() {
  if (process.env.CLUSTERSYNTH_ROOT) return path.resolve(process.env.CLUSTERSYNTH_ROOT);
  const commonDir = execSync('git rev-parse --git-common-dir', { cwd: ENGINE_ROOT, encoding: 'utf8' }).trim();
  const gitDir = path.isAbsolute(commonDir) ? commonDir : path.resolve(ENGINE_ROOT, commonDir);
  return path.resolve(path.dirname(gitDir), '..', 'clustersynth');
}

const CLUSTERSYNTH_ROOT = resolveClustersynthRoot();
if (!fs.existsSync(path.join(CLUSTERSYNTH_ROOT, 'dist', 'index.js'))) {
  throw new Error(`placement-probe: clustersynth not built at ${CLUSTERSYNTH_ROOT}/dist/index.js`);
}
const cs = await import(`file://${path.join(CLUSTERSYNTH_ROOT, 'dist', 'index.js')}`);

const SEED = Number(process.argv[2] ?? 700000001);
const SHARDS = Number(process.argv[3] ?? 120);
const ARMS = (process.argv[4] ?? '').split(',').filter(Boolean);
const STEPS = 9600, REF = 9000, W = 150, NA = 2250, M = 45, KAPPA = 0.682;
const THRESH = Math.log(20);
const STRIDE = REF / NA; // 4

const layouts = {
  frontA: (ref) => ref.slice(0, REF),                                        // A=[0,2250) B=[2250,9000)
  backA: (ref) => [...ref.slice(6750, 9000), ...ref.slice(0, 6750)],         // A=[6750,9000) B=[0,6750)
  stridedA: (ref) => {                                                        // A=every 4th tick, B=[2250,9000)
    const a = [];
    for (let t = 0; t < REF; t += STRIDE) a.push(ref[t]);
    if (a.length !== NA) throw new Error(`stridedA: nA=${a.length} != ${NA}`);
    return [...a, ...ref.slice(2250, 9000)];
  },
  // the disjoint full-span alternative (correction append F2): A = every 4th BLOCK, B = the other 45
  blockStridedA: (ref) => {
    const a = [], b = [];
    for (let blk = 0; blk < REF / W; blk++) {
      const slice = ref.slice(blk * W, (blk + 1) * W);
      if (blk % STRIDE === 0) a.push(...slice); else b.push(...slice);
    }
    if (a.length !== NA) throw new Error(`blockStridedA: nA=${a.length}`);
    return [...a, ...b];
  },
  // residual-DOF arm: strided A but the OTHER contiguous B
  stridedA_frontB: (ref) => {
    const a = [];
    for (let t = 0; t < REF; t += STRIDE) a.push(ref[t]);
    return [...a, ...ref.slice(0, 6750)];
  },
};

if (ARMS.length) {
  for (const k of Object.keys(layouts)) if (!ARMS.includes(k)) delete layouts[k];
  if (Object.keys(layouts).length !== ARMS.length) throw new Error(`unknown arm in ${ARMS}`);
}

const sc = cs.buildScenario({ family: 'gb200', pods: 1, seed: SEED, window: { steps: STEPS, dt_s: 30 }, faults: false });
const shardIds = sc.gpuIds.slice(0, SHARDS);
const COUNTERS = cs.COUNTERS.map((c) => c.name);

const out = {};
for (const name of Object.keys(layouts)) {
  out[name] = {};
  for (const c of COUNTERS) out[name][c] = { crossings: 0, n: 0, incs: [], firstShardP: null, pAll: [] };
}
// drift shape: per-counter mean of each of the 64 disjoint 150-tick blocks of the 9600-tick span
const drift = {};
for (const c of COUNTERS) drift[c] = new Array(Math.floor(STEPS / W)).fill(0);
let driftN = 0;

const t0 = Date.now();
for (const shardId of shardIds) {
  const rec = cs.realizeShard(sc.seed, shardId, sc.ctx, sc.graph, sc.applier, undefined, undefined);
  driftN++;
  for (const counter of COUNTERS) {
    const series = rec[counter];
    for (let b = 0; b * W + W <= STEPS; b++) {
      let s = 0;
      for (let i = b * W; i < b * W + W; i++) s += series[i];
      drift[counter][b] += s / W;
    }
    const ref = series.slice(0, REF);
    const live = series.slice(REF, STEPS);
    const windows = [];
    for (let w = 0; (w + 1) * W <= live.length; w++) windows.push(live.slice(w * W, w * W + W));
    for (const [name, build] of Object.entries(layouts)) {
      let cal;
      try { cal = acc.calibrateEcdfAccumulator(build(ref), { W, nA: NA, m: M }); }
      catch (err) { out[name][counter].skip = (out[name][counter].skip ?? 0) + 1; continue; }
      const es = [], ps = [];
      let logM = 0, crossed = false;
      for (const win of windows) {
        const r = acc.ecdfAccumulatorWindow(win, cal);
        es.push(r.e); ps.push(r.p);
        logM += Math.log(r.e);
        if (logM >= THRESH) crossed = true;
      }
      const o = out[name][counter];
      o.n++;
      if (crossed) o.crossings++;
      o.incs.push(es.reduce((a, b) => a + b, 0) / es.length);
      o.pAll.push(ps.reduce((a, b) => a + b, 0) / ps.length);
      if (o.firstShardP === null) o.firstShardP = ps.map((x) => x.toFixed(4));
    }
  }
  if (driftN % 20 === 0) process.stderr.write(`  ${driftN}/${shardIds.length} shards (${((Date.now() - t0) / 1000).toFixed(0)}s)\n`);
}

const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
console.log(JSON.stringify({
  probe_seed: SEED, shards: SHARDS, geometry: { W, nA: NA, m: M, stride: STRIDE, phase: 0 },
  drift: Object.fromEntries(Object.entries(drift).map(([c, v]) => [c, v.map((x) => +(x / driftN).toFixed(4))])),
  arms: Object.fromEntries(Object.entries(out).map(([name, byC]) => [name,
    Object.fromEntries(Object.entries(byC).map(([c, o]) => [c, {
      crossings: o.crossings, n: o.n, skip: o.skip ?? 0,
      inc_mean: +mean(o.incs).toFixed(6),
      mean_p: +mean(o.pAll).toFixed(6),
      first_shard_p: o.firstShardP,
    }]))])),
  elapsed_s: +((Date.now() - t0) / 1000).toFixed(1),
}, null, 1));

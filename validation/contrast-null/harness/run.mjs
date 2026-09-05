// validation/contrast-null/harness/run.mjs — the registered harness for 2026-09-contrast-null (C81 Part 1),
// PREREGISTRATION.md §1–§7. Imports the h0-battery's nulls and adapters (neither executes on import); drives
// the committed dist/ for the contrast fit, the e-SR, the calibration monitor and the plug-in φ estimator.
// Deterministic: one seeded LCG per replication, ticks outer, streams inner (shared, treatment, control).
// No catch anywhere: a throw aborts and the partial directory is kept unscored. Cells run in worker
// threads (one per cell), each deterministic from its registered seeds regardless of scheduling.
//
//   node validation/contrast-null/harness/run.mjs --mode live
//   node validation/contrast-null/harness/run.mjs --mode sim --quick     (N = 8, results/sim/, never scored)

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { rng, NULLS, N8_COMBINED } from '../../h0-battery/harness/nulls.mjs';
import { DETECTORS } from '../../h0-battery/harness/detectors.mjs';
import { render } from '../analysis/report.mjs';

const STUDY = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const ROOT = path.resolve(STUDY, '../..');
const require = createRequire(path.join(ROOT, 'package.json'));
const contrast = require(path.join(ROOT, 'dist/per-shard/contrast.js'));
const esr = require(path.join(ROOT, 'dist/detectors/e-sr-mean-shift.js'));
const cm = require(path.join(ROOT, 'dist/fleet/calibration-monitor.js'));
const famA = require(path.join(ROOT, 'dist/detectors/family-a-mixture-supermartingale.js'));

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const MODE = arg('--mode', 'sim');
const QUICK = process.argv.includes('--quick');
if (MODE === 'live' && QUICK) { console.error('--quick may not write under results/live'); process.exit(1); }

// ── registered constants (§1–§3) ──
const N = QUICK ? 8 : 500;
const SEED = 20260904;
const T_MON = 2000, NU_OFFSET = 500;
const M_LIST = [60, 300, 2000];
const KAPPA = 1, DELTA = 1.5;
const NULL_IDS = ['N1', 'N3-p03', 'N3-p06', 'N3-p09', 'N5', 'N6', 'N8'];
const ALPHAS = [0.05, 0.01];
const ALPHA_ARL = 1e-3;
const ALPHA_CAL = 0.01;
const GAUSS_LAMBDAS = [0.5, 1, 2, -0.5, -1, -2];
const BOUND_LAMBDAS = cm.BOUND_LAMBDAS, BOUND_CLIP = cm.BOUND_CLIP;
const BOUNDED_PRESENT = fs.readFileSync(path.join(ROOT, 'dist/detectors/e-sr-mean-shift.js'), 'utf8').includes('bounded');
const ALL_NULLS = [...NULLS, N8_COMBINED];
const SHARED_SPEC = ALL_NULLS.find((n) => n.id === 'N3-p09');
const MIX = DETECTORS.find((d) => d.id === 'family_A_mixture_supermartingale');
const BET = DETECTORS.find((d) => d.id === 'family_A_betting_e_process');
if (!MIX || !BET || !SHARED_SPEC) throw new Error('adapter or shared-component generator missing');

const sha256 = (p) => createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const git = (cwd, ...a) => execFileSync('git', a.length ? a : ['rev-parse', 'HEAD'], { cwd }).toString().trim();

/** §1: one replication's three streams from one generator, ticks outer, streams inner. */
function draw(seed, spec, T) {
  const r = rng(seed);
  const genC = SHARED_SPEC.gen(r), genU = spec.gen(r), genV = spec.gen(r);
  const c = new Array(T), u = new Array(T), v = new Array(T);
  for (let t = 0; t < T; t++) { c[t] = KAPPA * genC(); u[t] = genU(); v[t] = genV(); }
  return { c, u, v };
}
/** §1: the pair under a variant. */
function pair(s, variant, nu, delta) {
  const T = s.c.length, x = new Array(T), y = new Array(T);
  for (let t = 0; t < T; t++) {
    const step = t >= nu ? delta : 0;
    x[t] = s.c[t] + s.u[t] + (variant === 'null' ? 0 : step);
    y[t] = s.c[t] + s.v[t] + (variant === 'shared' ? step : 0);
  }
  return { x, y };
}

const CONSTRUCTIONS = [
  { id: 'family_A_mixture_supermartingale', levels: ALPHAS, contract: 'per-run' },
  { id: 'family_A_betting_e_process', levels: ALPHAS, contract: 'per-run' },
  { id: 'e_sr_mean_shift', levels: [ALPHA_ARL], contract: 'arl' },
  ...(BOUNDED_PRESENT ? [{ id: 'e_sr_mean_shift_bounded', levels: [ALPHA_ARL], contract: 'arl' }] : []),
];
const MONITORS = [
  { id: 'calibration_monitor_gaussian', kind: 'gaussian', levels: [ALPHA_CAL], contract: 'per-run' },
  { id: 'calibration_monitor_bounded', kind: 'bounded', levels: [ALPHA_CAL], contract: 'per-run' },
];
const finite = (x, what) => { if (!Number.isFinite(x)) throw new Error(`non-finite ${what}`); return x; };

/** First alert tick (≥ m) per construction@level on a standardized residual stream r (contrast path: the
 *  cards run at (0, 1, 0)); -1 = never. `extraLevels` lets the instrument check add 1e-4. */
function alertsOnResidual(r, m, extraLevels = []) {
  const T = r.length, out = {};
  const levels = [...ALPHAS, ...extraLevels];
  for (const c of [MIX, BET]) for (const a of levels) {
    const inst = c.make({ mu: 0, sigma: 1, phi: 0, alpha: a }); let t = -1;
    for (let s = m; s < T; s++) { if (inst.step(r[s])) { finite(inst.logM(), `${c.id} logM at fire`); t = s; break; } }
    finite(inst.logM(), `${c.id} logM at end`);
    out[`${c.id}@${a}`] = t;
  }
  for (const bounded of BOUNDED_PRESENT ? [false, true] : [false]) {
    const params = bounded ? { alpha_arl: ALPHA_ARL, increment: 'bounded' } : { alpha_arl: ALPHA_ARL };
    const st = esr.freshESrMeanShiftState(params); let t = -1;
    for (let s = m; s < T; s++) { const v = esr.evaluateESrMeanShift(r[s], params, st); finite(v.log_M, 'e-SR log_M'); if (v.fired) { t = s; break; } }
    out[`${bounded ? 'e_sr_mean_shift_bounded' : 'e_sr_mean_shift'}@${ALPHA_ARL}`] = t;
  }
  for (const mon of MONITORS) {
    const st = cm.freshCalibrationMonitor({ alpha: ALPHA_CAL, incrementKind: mon.kind }); let t = -1;
    for (let s = m; s < T; s++) { cm.updateCalibration(st, r[s]); if (!st.passing) { t = s; break; } }
    out[`${mon.id}@${ALPHA_CAL}`] = t;
  }
  return out;
}
/** §2: the temporal comparator on the treatment unit alone, head [0, m) fitted the plug-in way. */
function temporalFit(x, m) {
  let mu = 0; for (let t = 0; t < m; t++) mu += x[t]; mu /= m;
  let v = 0; for (let t = 0; t < m; t++) v += (x[t] - mu) ** 2; v /= m;
  const phi = famA.computePerSignalAr1Phi(x.slice(0, m), mu);
  return { mu, sigma: Math.sqrt(v), phi };
}
function alertsTemporal(x, m, fit, extraLevels = []) {
  const T = x.length, out = {};
  const levels = [...ALPHAS, ...extraLevels];
  for (const c of [MIX, BET]) for (const a of levels) {
    const inst = c.make({ mu: fit.mu, sigma: fit.sigma, phi: fit.phi, alpha: a }); let t = -1;
    for (let s = m; s < T; s++) { if (inst.step(x[s])) { finite(inst.logM(), `${c.id} temporal logM at fire`); t = s; break; } }
    finite(inst.logM(), `${c.id} temporal logM at end`);
    out[`${c.id}@${a}`] = t;
  }
  for (const bounded of BOUNDED_PRESENT ? [false, true] : [false]) {
    const params = bounded ? { alpha_arl: ALPHA_ARL, increment: 'bounded' } : { alpha_arl: ALPHA_ARL };
    const st = esr.freshESrMeanShiftState(params); let t = -1;
    for (let s = m; s < T; s++) {
      const v = esr.evaluateESrMeanShift(esr.standardizeAr1Residual(x[s], x[s - 1], fit.mu, fit.sigma, fit.phi), params, st);
      finite(v.log_M, 'temporal e-SR log_M'); if (v.fired) { t = s; break; }
    }
    out[`${bounded ? 'e_sr_mean_shift_bounded' : 'e_sr_mean_shift'}@${ALPHA_ARL}`] = t;
  }
  return out;
}
/** The contrast path on a pair: fit on d[0, m), residual on the whole (causal). */
function contrastPath(p, m) {
  const d = contrast.contrastOf({ treatment: p.x, control: p.y });
  const fit = contrast.fitContrast(d.slice(0, m));
  const r = contrast.applyContrast(d, fit);
  for (let t = 0; t < r.length; t++) finite(r[t], `contrast residual at t=${t}`);
  return { fit, r };
}

/** P1 accumulators per increment family and λ over pooled null-variant monitoring residuals. */
function freshP1() {
  const mk = (lams, fn) => lams.map((lam) => ({ lambda: lam, n: 0, sum: 0, sum2: 0, max: -Infinity, fn }));
  return {
    gaussian: mk(GAUSS_LAMBDAS, (r, lam) => Math.exp(lam * r - 0.5 * lam * lam)),
    bounded: mk(BOUND_LAMBDAS, (r, lam) => 1 + lam * Math.max(-BOUND_CLIP, Math.min(BOUND_CLIP, r)) / BOUND_CLIP),
  };
}
function accumulateP1(p1, r, m) {
  for (const fam of ['gaussian', 'bounded']) for (const cell of p1[fam]) {
    for (let t = m; t < r.length; t++) { const g = cell.fn(r[t], cell.lambda); cell.n++; cell.sum += g; cell.sum2 += g * g; if (g > cell.max) cell.max = g; }
  }
}

/** One cell: N replications × 3 variants × 2 paths. Returns the replication rows and the P1 sums. */
function runCell(cellDef) {
  const spec = ALL_NULLS.find((n) => n.id === cellDef.null);
  const m = cellDef.m, T = m + T_MON, nu = m + NU_OFFSET;
  const p1 = freshP1();
  const rows = [];
  for (let i = 0; i < N; i++) {
    const seed = SEED + 7919 * i + 1_000_000 * cellDef.j;
    const s = draw(seed, spec, T);
    const row = { cell: cellDef.id, i, seed, variants: {} };
    for (const variant of ['null', 'shared', 'treatment']) {
      const p = pair(s, variant, nu, DELTA);
      const { fit, r } = contrastPath(p, m);
      if (variant === 'null') { accumulateP1(p1, r, m); row.fit = { phi: fit.phi, scale: fit.scale, center: fit.center, loc: fit.loc }; }
      const tf = temporalFit(p.x, m);
      if (variant === 'null') row.temporal_fit = tf;
      row.variants[variant] = { contrast: alertsOnResidual(r, m), temporal: alertsTemporal(p.x, m, tf) };
    }
    rows.push(row);
  }
  const p1out = {};
  for (const fam of ['gaussian', 'bounded']) p1out[fam] = p1[fam].map(({ lambda, n, sum, sum2, max }) => ({ lambda, n, sum, sum2, max }));
  return { rows, p1: p1out };
}

// ── worker entry ──
if (!isMainThread) {
  parentPort.postMessage(runCell(workerData.cell));
} else {
  main();
}

async function main() {
  // ── run directory ──
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
  const runDir = path.join(STUDY, 'results', MODE === 'live' ? 'live' : 'sim', `run-${stamp}`);
  if (fs.existsSync(runDir)) { console.error(`refusing to reuse ${runDir}`); process.exit(1); }
  fs.mkdirSync(runDir, { recursive: true });
  const t0 = Date.now();

  // ── §4 (iv): the Tessera lockstep, the same comparison as test/contrast.test.ts ──
  const lockstep = lockstepAgainstTessera();
  console.log('lockstep', JSON.stringify(lockstep));
  if (lockstep !== 'absent' && lockstep.mismatches !== 0) { console.error('NOT-EXECUTABLE: lockstep mismatches'); fs.writeFileSync(path.join(runDir, 'NOT-EXECUTABLE.json'), JSON.stringify({ lockstep }, null, 2) + '\n'); process.exit(3); }

  // ── §4 (i)–(iii): instrument check on seed SEED, N1, m = 300 ──
  const N1 = ALL_NULLS.find((n) => n.id === 'N1');
  const m0 = 300, T0 = m0 + T_MON, nu0 = m0 + NU_OFFSET;
  const s0 = draw(SEED, N1, T0);
  const instrument = { step3_fires: {}, shared_max_abs_residual_diff: null, clean_quiet: {}, ok: true };
  {
    const { r } = contrastPath(pair(s0, 'treatment', nu0, 3), m0);
    const a = alertsOnResidual(r, m0);
    for (const c of CONSTRUCTIONS) {
      const lvl = c.contract === 'arl' ? ALPHA_ARL : ALPHAS[0];
      const t = a[`${c.id}@${lvl}`]; instrument.step3_fires[c.id] = t;
      // Amendment A2: the e-SR reads [m, T) (its ARL contract makes a pre-ν alarm a 39% event on 500 ticks).
      if (!(t >= (c.contract === 'arl' ? m0 : nu0) && t < T0)) instrument.ok = false;
    }
  }
  {
    const rNull = contrastPath(pair(s0, 'null', nu0, 3), m0).r, rShared = contrastPath(pair(s0, 'shared', nu0, 3), m0).r;
    let mx = 0; for (let t = 0; t < T0; t++) mx = Math.max(mx, Math.abs(rNull[t] - rShared[t]));
    instrument.shared_max_abs_residual_diff = mx;
    if (!(mx < 1e-9)) instrument.ok = false;
    const a = alertsOnResidual(rNull, m0, [1e-4]);
    for (const id of ['family_A_mixture_supermartingale', 'family_A_betting_e_process']) {
      const t = a[`${id}@${1e-4}`]; instrument.clean_quiet[id] = t;
      // Amendment A1: (iii) reads the mixture; the betting card's reading is recorded, and P2 measures it.
      if (id === 'family_A_mixture_supermartingale' && t !== -1) instrument.ok = false;
    }
  }
  console.log('instrument check', JSON.stringify(instrument));
  if (!instrument.ok) { console.error('NOT-EXECUTABLE: instrument check failed'); fs.writeFileSync(path.join(runDir, 'NOT-EXECUTABLE.json'), JSON.stringify(instrument, null, 2) + '\n'); process.exit(3); }

  // ── the grid (§1), one worker per cell ──
  const cellsDef = [];
  for (const nid of NULL_IDS) for (const m of M_LIST) cellsDef.push({ id: `${nid}-m${m}`, null: nid, m, j: cellsDef.length });
  const results = await runCells(cellsDef);
  const reps = [], p1 = [];
  for (const cellDef of cellsDef) {
    const res = results[cellDef.j];
    reps.push(...res.rows);
    for (const fam of ['gaussian', 'bounded']) for (const c of res.p1[fam]) {
      const mean = c.sum / c.n, sd = Math.sqrt(Math.max(0, (c.sum2 - c.n * mean * mean) / (c.n - 1))), se = sd / Math.sqrt(c.n);
      p1.push({ cell: cellDef.id, null: cellDef.null, m: cellDef.m, family: fam, lambda: c.lambda, n: c.n, mean, se, max_to_mean: c.max / mean,
        held: mean <= 1 + 3 * se ? 'HELD' : 'FAILED', off_centre: Math.abs(mean - 1) > 3 * se });
    }
  }

  // ── endpoints (§3) ──
  const floor = Math.floor, sqrt = Math.sqrt;
  const barFor = (contract, level) => contract === 'arl'
    ? (() => { const E = N * (1 - Math.exp(-level * T_MON)); return floor(E + 3 * sqrt(E)); })()
    : floor(N * level + 3 * sqrt(N * level * (1 - level)));
  const median = (xs) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[s.length >> 1] : null; };
  const cells = [];
  for (const cellDef of cellsDef) {
    const rs = reps.filter((r) => r.cell === cellDef.id);
    const nu = cellDef.m + NU_OFFSET, end = cellDef.m + T_MON;
    for (const pathId of ['contrast', 'temporal']) {
      const cons = pathId === 'contrast' ? [...CONSTRUCTIONS, ...MONITORS] : CONSTRUCTIONS;
      for (const c of cons) for (const level of c.levels) {
        const key = `${c.id}@${level}`, bar = barFor(c.contract, level);
        // P2 — null variant: any alert in monitoring
        const tsNull = rs.map((r) => r.variants.null[pathId][key]);
        const alerting = tsNull.filter((t) => t >= 0).length;
        cells.push({ cell: cellDef.id, null: cellDef.null, m: cellDef.m, path: pathId, variant: 'null', construction: c.id, level, n: N,
          alerting, rate_per_1000: 1000 * alerting / (N * T_MON), bar, verdict: alerting <= bar ? 'HELD' : 'FAILED' });
        // P3 / P4 — shared / treatment variants: among replications quiet before ν
        for (const variant of ['shared', 'treatment']) {
          const ts = rs.map((r) => r.variants[variant][pathId][key]);
          const adm = ts.filter((t) => t < 0 || t >= nu);
          const post = adm.filter((t) => t >= nu && t < end);
          const isMonitor = c.id.startsWith('calibration_monitor');
          const entry = { cell: cellDef.id, null: cellDef.null, m: cellDef.m, path: pathId, variant, construction: c.id, level, n: N,
            admissible: adm.length, alerting: post.length, detection: adm.length ? post.length / adm.length : null,
            median_delay: median(post.map((t) => t - nu)), bar: variant === 'shared' ? bar : (c.id === 'family_A_mixture_supermartingale' && level === 0.05 ? 0.5 : null) };
          if (variant === 'shared') entry.verdict = isMonitor ? null : (post.length <= bar ? 'HELD' : 'FAILED');
          else entry.verdict = entry.bar === null || entry.detection === null ? null : (entry.detection >= 0.5 ? 'HELD' : 'FAILED');
          cells.push(entry);
        }
      }
    }
  }
  const p1Cells = cellsDef.map((cd) => {
    const fams = {};
    for (const fam of ['gaussian', 'bounded']) { const xs = p1.filter((p) => p.cell === cd.id && p.family === fam); fams[fam] = { held: xs.filter((p) => p.held === 'HELD').length, of: xs.length }; }
    return { cell: cd.id, null: cd.null, m: cd.m, gaussian_held: fams.gaussian.held, gaussian_of: fams.gaussian.of, bounded_held: fams.bounded.held, bounded_of: fams.bounded.of,
      verdict: (fams.gaussian.held === fams.gaussian.of || fams.bounded.held === fams.bounded.of) ? 'HELD' : 'FAILED' };
  });

  const manifest = {
    study: '2026-09-contrast-null', register: 'knowledge WORKLIST C81 (Part 1)', mode: MODE, quick: QUICK,
    engine: { sha: git(ROOT), version: JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version, node: process.version },
    hashes: {
      harness: sha256(fileURLToPath(import.meta.url)), registration: sha256(path.join(STUDY, 'PREREGISTRATION.md')),
      report: sha256(path.join(STUDY, 'analysis/report.mjs')), nulls: sha256(path.join(ROOT, 'validation/h0-battery/harness/nulls.mjs')),
      detectors: sha256(path.join(ROOT, 'validation/h0-battery/harness/detectors.mjs')),
      contrast_ts: sha256(path.join(ROOT, 'per-shard/contrast.ts')), contrast_js: sha256(path.join(ROOT, 'dist/per-shard/contrast.js')),
    },
    lockstep, bounded_esr: BOUNDED_PRESENT ? 'present' : 'absent',
    constants: { N, SEED, T_MON, NU_OFFSET, M_LIST, KAPPA, DELTA, NULL_IDS, ALPHAS, ALPHA_ARL, ALPHA_CAL, GAUSS_LAMBDAS, BOUND_LAMBDAS, BOUND_CLIP },
    cells: cellsDef.length, replications: reps.length, instrument, exceptions: 0, runtime_ms: Date.now() - t0,
    p1_study: p1Cells.every((c) => c.verdict === 'HELD') ? 'HELD' : 'FAILED',
    p3_study: cells.filter((c) => c.variant === 'shared' && c.path === 'contrast' && c.verdict !== null).every((c) => c.verdict === 'HELD') ? 'HELD' : 'FAILED',
  };
  fs.writeFileSync(path.join(runDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  fs.writeFileSync(path.join(runDir, 'cells.json'), JSON.stringify(cells, null, 1) + '\n');
  fs.writeFileSync(path.join(runDir, 'p1.json'), JSON.stringify(p1, null, 1) + '\n');
  fs.writeFileSync(path.join(runDir, 'p1_cells.json'), JSON.stringify(p1Cells, null, 1) + '\n');
  fs.writeFileSync(path.join(runDir, 'reps.jsonl'), reps.map((r) => JSON.stringify(r)).join('\n') + '\n');
  fs.writeFileSync(path.join(runDir, 'REPORT.md'), render(runDir));
  console.log(`\n${cellsDef.length} cells, ${reps.length} replications, ${cells.length} endpoint cells -> ${path.relative(STUDY, runDir)}; ${manifest.runtime_ms} ms; P1 ${manifest.p1_study}; P3 ${manifest.p3_study}`);
  for (const c of cells.filter((c) => c.variant === 'null' && c.path === 'contrast')) console.log(`${c.cell.padEnd(12)} ${c.construction.padEnd(34)} ${String(c.level).padEnd(6)} alerting ${String(c.alerting).padStart(3)} bar ${String(c.bar).padStart(3)} ${c.verdict.padEnd(6)} rate/1000 ${c.rate_per_1000.toFixed(3)}`);
}

function runCells(cellsDef) {
  const width = Math.max(1, Math.min(os.cpus().length, cellsDef.length));
  const results = new Array(cellsDef.length);
  let next = 0;
  return new Promise((resolve, reject) => {
    let active = 0;
    const launch = () => {
      while (active < width && next < cellsDef.length) {
        const cell = cellsDef[next++]; active++;
        const w = new Worker(fileURLToPath(import.meta.url), { workerData: { cell }, argv: process.argv.slice(2) });
        w.once('message', (res) => { results[cell.j] = res; console.log(`cell ${cell.id} done (${res.rows.length} reps)`); });
        w.once('error', reject);
        w.once('exit', (code) => { if (code !== 0) return reject(new Error(`worker for ${cell.id} exited ${code}`)); active--; if (next >= cellsDef.length && active === 0) resolve(results); else launch(); });
      }
    };
    launch();
  });
}

/** The same comparison as test/contrast.test.ts (same seeds, 200 streams), against Tessera's compiled tools. */
function lockstepAgainstTessera() {
  const candidates = [path.resolve(ROOT, '..', 'tessera'), path.resolve(ROOT, '..', '..', '..', 'tessera')];
  const dir = candidates.find((d) => fs.existsSync(path.join(d, 'tools/contrast.js')) && fs.existsSync(path.join(d, 'tools/per-shard-whitening.js')));
  if (!dir) return 'absent';
  const T = { contrast: require(path.join(dir, 'tools/contrast.js')), whitening: require(path.join(dir, 'tools/per-shard-whitening.js')) };
  const mulberry32 = (a) => () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const gaussian = (r) => { const u1 = Math.max(r(), 1e-12), u2 = r(); return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2); };
  const offsetAr1 = (r, n, phi, offset, scale) => { const d = []; let x = gaussian(r); for (let t = 0; t < n; t++) { x = phi * x + Math.sqrt(1 - phi * phi) * gaussian(r); d.push(offset + scale * x); } return d; };
  let comparisons = 0, mismatches = 0;
  const eq = (a, b) => { comparisons++; if (!(a === b || (Number.isNaN(a) && Number.isNaN(b)))) mismatches++; };
  for (let s = 0; s < 200; s++) {
    const r = mulberry32(1000 + s);
    const phi = [0, 0.3, 0.6, 0.82, 0.95, -0.4][s % 6], n = [40, 60, 300, 1000, 2000][s % 5];
    const d = offsetAr1(r, n, phi, (s % 7) * 25 - 50, 0.5 + (s % 4));
    const a = contrast.fitContrast(d), b = T.contrast.fitContrast(d);
    eq(a.phi, b.phi); eq(a.loc, b.loc); eq(a.scale, b.scale); eq(a.center, b.center);
    const af = contrast.fitContrastFast(d), bf = T.contrast.fitContrastFast(d);
    eq(af.phi, bf.phi); eq(af.loc, bf.loc); eq(af.scale, bf.scale); eq(af.center, bf.center);
    const ac = contrast.composeFit(a, af), bc = T.contrast.composeFit(b, bf);
    eq(ac.phi, bc.phi); eq(ac.loc, bc.loc); eq(ac.scale, bc.scale); eq(ac.center, bc.center);
    const d2 = offsetAr1(r, n, phi, (s % 5) * 10, 1 + (s % 3));
    const ra = contrast.applyContrast(d2, a), rb = T.contrast.applyContrast(d2, b);
    eq(ra.length, rb.length); for (let t = 0; t < ra.length; t++) eq(ra[t], rb[t]);
    const ea = contrast.estimateContrastAr1(d), eb = T.whitening.estimateAr1(d);
    eq(ea.phi, eb.phi); eq(ea.sigma2, eb.sigma2);
    eq(contrast.whitenContrast(d[3], d[2], a.phi), T.whitening.whiten(d[3], d[2], b.phi));
    eq(contrast.whitenContrast(d[0], null, a.phi), T.whitening.whiten(d[0], null, b.phi));
    eq(contrast.median(d), T.contrast.median(d)); eq(contrast.madScale(d), T.contrast.madScale(d));
  }
  return { comparisons, mismatches, tessera_sha: git(dir), dir };
}

// harness/run.mjs — the GRAPA/ONS stability measurement of PREREGISTRATION.md (C58).
// Append-only; never overwrites a run.
//
//   node harness/run.mjs --mode live
//   node harness/run.mjs --mode sim    (writes under results/sim/, git-ignored shakedown)
//
// `--mode` selects the output directory and nothing else. The instrument drives
// dist/detectors/betting-e-process.js (updateBettingState) and reads the detector's OWN
// state per tick — never a reimplementation of the dynamics (PREREG §3, §5).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { NULLS } from '../../h0-battery/harness/nulls.mjs';
import { streamRng } from '../../family-d-emean/harness/seed.mjs';

const require = createRequire(import.meta.url);
const betting = require('../../../dist/detectors/betting-e-process.js');

const STUDY = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const ENG = path.join(STUDY, '..', '..');
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const MODE = arg('--mode', 'sim');

// ── Registered constants (PREREG §3). None is a flag. ────────────────────────────────
const N = 2000;
const T = 300;
const ALPHA = 0.05;
const LOG_FIRE = Math.log(1 / ALPHA);
const SNAPSHOTS = [50, 100, 200, 300];
const CELLS = [
  { idx: 0, id: 'N1' },
  { idx: 1, id: 'N2-m30' },
  { idx: 2, id: 'N2-m100' },
  { idx: 3, id: 'N2-m500' },
  { idx: 4, id: 'N5' },
  { idx: 5, id: 'N6' },
];

const nullById = (id) => {
  const n = NULLS.find((x) => x.id === id);
  if (!n) throw new Error(`null ${id} not in battery`);
  return n;
};

/** One trajectory. Returns per-snapshot {bet, logM}, the full bet sequence (for the §5
 *  reproduction check when requested), per-tick log-increments summary, fallback timing,
 *  and sup logM. Estimated cells draw the m-sample calibration from the SAME stream first,
 *  exactly the h0-battery construction (population sd). */
function trajectory(cellId, seedTriple, keepBets) {
  const spec = nullById(cellId);
  const r = streamRng(...seedTriple);
  const src = spec.gen(r);
  let mu = 0, sigma2 = 1;
  if (spec.params === 'estimated') {
    const cal = Array.from({ length: spec.m }, src);
    const cm = cal.reduce((a, b) => a + b, 0) / cal.length;
    const cv = cal.reduce((a, b) => a + (b - cm) ** 2, 0) / cal.length;
    mu = cm; sigma2 = cv > 0 ? cv : 1;
  }
  const state = betting.freshBettingState();
  const snaps = [];
  const bets = keepBets ? [] : null;
  let prevLogM = 0;
  let sumExpInc = 0, nInc = 0, maxAbsInc = 0, nonFinite = 0;
  let firstFallbackTick = -1, prevFallbacks = 0, lateFallbacks = 0;
  let supLogM = -Infinity;
  let si = 0;
  for (let t = 1; t <= T; t++) {
    const x = src();
    betting.updateBettingState(state, x, mu, sigma2, ALPHA, 0);
    const inc = state.log_M - prevLogM;
    prevLogM = state.log_M;
    if (!Number.isFinite(inc)) { nonFinite++; } else {
      sumExpInc += Math.exp(inc); nInc++;
      const a = Math.abs(inc); if (a > maxAbsInc) maxAbsInc = a;
    }
    if (state.onsFallbackCount > prevFallbacks) {
      if (firstFallbackTick < 0) firstFallbackTick = t;
      if (t >= 101) lateFallbacks += state.onsFallbackCount - prevFallbacks;
      prevFallbacks = state.onsFallbackCount;
    }
    if (state.log_M > supLogM) supLogM = state.log_M;
    if (bets) bets.push(state.bet);
    if (t === SNAPSHOTS[si]) { snaps.push({ n: t, bet: state.bet, logM: state.log_M }); si++; }
  }
  return { snaps, bets, sumExpInc, nInc, maxAbsInc, nonFinite, firstFallbackTick, lateFallbacks, supLogM };
}

/** OLS slope of y on x. */
function slope(xs, ys) {
  const n = xs.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) { num += (xs[i] - mx) * (ys[i] - my); den += (xs[i] - mx) ** 2; }
  return num / den;
}

// ── Run directory (append-only) ──────────────────────────────────────────────────────
const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
const runDir = path.join(STUDY, 'results', MODE === 'live' ? 'live' : 'sim', `run-${stamp}`);
if (fs.existsSync(runDir)) { console.error(`refusing to reuse ${runDir}`); process.exit(1); }
fs.mkdirSync(path.join(runDir, 'cells'), { recursive: true });

// ── §5 executability: the harness must reproduce the detector's own trajectory ───────
let reproMismatches = 0;
for (const cell of CELLS) {
  for (let i = 0; i < 10; i++) {
    const a = trajectory(cell.id, [cell.idx, 0, i + 1], true);
    const b = trajectory(cell.id, [cell.idx, 0, i + 1], true);
    if (JSON.stringify(a.bets) !== JSON.stringify(b.bets)) reproMismatches++;
  }
}
const executable = reproMismatches === 0;
console.log(`§5 reproduction check: ${reproMismatches} mismatches over 60 paired drives -> ${executable ? 'EXECUTABLE' : 'NOT-EXECUTABLE'}`);

// ── Cells ────────────────────────────────────────────────────────────────────────────
const cells = [];
for (const cellSpec of CELLS) {
  const perSnap = SNAPSHOTS.map(() => ({ bets: [], logMs: [] }));
  let sumExpInc = 0, nInc = 0, maxAbsInc = 0, nonFinite = 0;
  let earlyFallback = 0, lateFallbackTicks = 0, fires = 0;
  for (let i = 0; i < N; i++) {
    const tr = trajectory(cellSpec.id, [cellSpec.idx, 0, i + 1], false);
    tr.snaps.forEach((s, k) => { perSnap[k].bets.push(s.bet); perSnap[k].logMs.push(s.logM); });
    sumExpInc += tr.sumExpInc; nInc += tr.nInc; nonFinite += tr.nonFinite;
    if (tr.maxAbsInc > maxAbsInc) maxAbsInc = tr.maxAbsInc;
    if (tr.firstFallbackTick > 0 && tr.firstFallbackTick <= 2) earlyFallback++;
    lateFallbackTicks += tr.lateFallbacks;
    if (tr.supLogM >= LOG_FIRE) fires++;
  }
  const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
  const varr = (a) => { const m = mean(a); return a.reduce((x, y) => x + (y - m) ** 2, 0) / (a.length - 1); };
  const snapStats = SNAPSHOTS.map((n, k) => ({
    n,
    lambda_mean: mean(perSnap[k].bets),
    lambda_var: varr(perSnap[k].bets),
    logM_mean: mean(perSnap[k].logMs),
  }));
  const lamSe300 = Math.sqrt(snapStats[3].lambda_var / N);
  cells.push({
    study: '2026-08-grapa-stability',
    detector: 'family_A_betting_e_process', family: 'A',
    null_id: cellSpec.id, control: 'grapa-stability',   // identity-tuple disambiguator vs other pooled studies
    alpha: null, shift_sigma: null,
    n: N, ticks: T,
    snapshots: snapStats,
    lambda_var_slope: slope(SNAPSHOTS.map(Math.log), snapStats.map((s) => Math.log(s.lambda_var))),
    logM_slope: slope(SNAPSHOTS.map(Math.log), snapStats.map((s) => s.logM_mean)),
    lambda300_mean: snapStats[3].lambda_mean, lambda300_se: lamSe300,
    increment_estimator: sumExpInc / nInc,
    nonfinite_increments: nonFinite, max_abs_increment: maxAbsInc,
    fire_rate: fires / N,
    early_fallback_rate: earlyFallback / N,
    late_fallback_rate: lateFallbackTicks / (N * 200),
    mode: MODE, control_state: 'pending',
  });
}

// ── Endpoints (PREREG §2/§4) ─────────────────────────────────────────────────────────
const byId = (id) => cells.find((c) => c.null_id === id);
const n1 = byId('N1');
const p1 = { slope: n1.lambda_var_slope, mean_ok: Math.abs(n1.lambda300_mean) < 2 * n1.lambda300_se,
  held: n1.lambda_var_slope >= -1.3 && n1.lambda_var_slope <= -0.7 && Math.abs(n1.lambda300_mean) < 2 * n1.lambda300_se };
const p2 = { slope: n1.logM_slope, held: n1.logM_slope >= -0.75 && n1.logM_slope <= -0.25 };
const p3 = { increment_estimator: n1.increment_estimator,
  held: n1.increment_estimator >= 0.9995 && n1.increment_estimator <= 1.0005 };
const ms = [30, 100, 500];
const excess = ms.map((m) => byId(`N2-m${m}`).increment_estimator - 1);
// least squares for excess = kappa/m: kappa = sum(e/m) / sum(1/m^2)
const kappa = ms.reduce((a, m, i) => a + excess[i] / m, 0) / ms.reduce((a, m) => a + 1 / (m * m), 0);
const residuals = ms.map((m, i) => Math.abs(m * excess[i] - kappa) / kappa);
const p4 = { excess, kappa, residuals,
  held: kappa >= 0.7 && kappa <= 1.1 && residuals.every((r) => r <= 0.25) };
const p5cells = [byId('N5'), byId('N6')];
const p5 = {
  nonfinite: p5cells.map((c) => c.nonfinite_increments),
  max_abs_increment: p5cells.map((c) => c.max_abs_increment),
  fire_rate: p5cells.map((c) => c.fire_rate),
  held: p5cells.every((c) => c.nonfinite_increments === 0 && c.max_abs_increment <= 13.9
    && c.fire_rate >= 0 && c.fire_rate <= 0.10),
};
const p6 = { early_fallback_rate: n1.early_fallback_rate, late_fallback_rate: n1.late_fallback_rate,
  held: n1.early_fallback_rate >= 0.95 && n1.late_fallback_rate <= 0.05 };

const finalState = executable ? 'passed' : 'failed';
for (const c of cells) {
  c.control_state = finalState;
  fs.writeFileSync(path.join(runDir, 'cells', `${c.null_id}.json`), JSON.stringify(c, null, 2));
}
const verdict = (p) => (executable ? (p.held ? 'HELD' : 'REFUTED') : 'NOT-EXECUTABLE');
const endpoints = { executable, repro_mismatches: reproMismatches,
  P1: { ...p1, verdict: verdict(p1) }, P2: { ...p2, verdict: verdict(p2) },
  P3: { ...p3, verdict: verdict(p3) }, P4: { ...p4, verdict: verdict(p4) },
  P5: { ...p5, verdict: verdict(p5) }, P6: { ...p6, verdict: verdict(p6) } };
fs.writeFileSync(path.join(runDir, 'endpoints-grapa-stability.json'), JSON.stringify(endpoints, null, 2));
fs.writeFileSync(path.join(runDir, 'manifest.json'), JSON.stringify({
  study: '2026-08-grapa-stability', mode: MODE,
  git_sha: execSync('git rev-parse HEAD', { cwd: ENG }).toString().trim(),
  engine_version: JSON.parse(fs.readFileSync(path.join(ENG, 'package.json'), 'utf8')).version,
  node: process.version, command: process.argv.slice(1).join(' '),
  sizes: { N, T, SNAPSHOTS, ALPHA },
  seed_scheme: 'per-stream splitmix64 (family-d-emean/harness/seed.mjs); triple (cellIdx, 0, traj+1); §5 reproduction drives reuse the same triples',
  billing: 'no model calls; pure simulation',
}, null, 2));

for (const [k, p] of Object.entries(endpoints)) {
  if (k === 'executable' || k === 'repro_mismatches') continue;
  console.log(`${k}: ${p.verdict}  ${JSON.stringify({ ...p, verdict: undefined }).slice(0, 150)}`);
}
console.log(`run: ${runDir}`);

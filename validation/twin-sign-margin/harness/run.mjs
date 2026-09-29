// validation/twin-sign-margin/harness/run.mjs — study 2026-10-twin-sign-margin (ADR 0037). Registered
// in ../PREREGISTRATION.md before this file existed; generator, cells, seeds and bars are §1–§5 there.
// Drives the committed dist/ (run `npx tsc` first). Synthetic cells step detectors/twin-contrast.js as
// twin-null did; the replay cells step per-shard/twin-gate.js over DeploySignal's stored tick bodies.
//
//   node validation/twin-sign-margin/harness/run.mjs [--smoke]
//   TWIN_AA_REAL_RUNS=<dir of AA-l<lane>-r<k>-<UTC>.jsonl>  (default: ../deploysignal/studies/twin-aa-real/results/runs)

import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync, readdirSync, readFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const require = createRequire(import.meta.url);
const twin = require('../../../dist/detectors/twin-contrast.js');
const gate = require('../../../dist/per-shard/twin-gate.js');

const HERE = dirname(fileURLToPath(import.meta.url));
const SMOKE = process.argv.includes('--smoke');
const R = SMOKE ? 20 : 1000, ALPHA = 0.05, TRAFFIC = 2000, DAY = 1440;
const BAR = ALPHA + 2.58 * Math.sqrt((ALPHA * (1 - ALPHA)) / R);
const RUNS_DIR = resolve(HERE, process.env.TWIN_AA_REAL_RUNS ?? '../../../../deploysignal/studies/twin-aa-real/results/runs');

function lcg(seed) {
  let s = seed >>> 0;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return (s + 0.5) / 4294967296; };
}
function gaussian(rng) { return Math.sqrt(-2 * Math.log(rng())) * Math.cos(2 * Math.PI * rng()); }
function poisson(rng, mean) {
  if (mean <= 0) return 0;
  if (mean > 30) return Math.max(0, Math.round(mean + Math.sqrt(mean) * gaussian(rng)));
  const L = Math.exp(-mean); let k = 0, p = 1;
  do { k++; p *= rng(); } while (p > L);
  return k - 1;
}
function split(rng, n, w) {
  return Math.min(n, Math.max(0, Math.round(n * w + Math.sqrt(n * w * (1 - w)) * gaussian(rng))));
}
function centeredLognormal(rng) { return Math.exp(0.75 * gaussian(rng)) - Math.exp(0.28125); }

// §3, in registered order.
const CELLS = [
  { id: 'V-m0-d0', group: 'V', m: 0, d: 0, r: 0, T: 2000 },
  { id: 'V-m0.02-d0', group: 'V', m: 0.02, d: 0, r: 0, T: 2000 },
  { id: 'V-m0.02-d0.005', group: 'V', m: 0.02, d: 0.005, r: 0, T: 2000 },
  { id: 'V-m0.02-d0.01', group: 'V', m: 0.02, d: 0.01, r: 0, T: 2000 },
  { id: 'V-m0.02-d0.018', group: 'V', m: 0.02, d: 0.018, r: 0, T: 2000 },
  { id: 'M-m0-d0.01', group: 'M', m: 0, d: 0.01, r: 0, T: 2000 },
  { id: 'P-m0.02-r0.03', group: 'P', m: 0.02, d: 0, r: 0.03, T: 300 },
  { id: 'P-m0.02-r0.04', group: 'P', m: 0.02, d: 0, r: 0.04, T: 300 },
  { id: 'P-m0.02-r0.08', group: 'P', m: 0.02, d: 0, r: 0.08, T: 300 },
  { id: 'Q-m0.02-r0.01', group: 'Q', m: 0.02, d: 0, r: 0.01, T: 300 },
  { id: 'Q-m0.02-r0.08-proceed', group: 'Q', m: 0.02, d: 0, r: 0.08, T: 300 },
];
const REPLAY_MARGINS = [0.10, 0.25, 0.50];

function specFor(cell) {
  return { id: 'm', kind: 'sign', worse: 'higher', tolerance: 0.1, ...(cell.m > 0 ? { margin: { relative: cell.m } } : {}) };
}

function replicate(cell, rng) {
  const spec = specFor(cell);
  const sigma = 0.1, phi = 0.5, innov = sigma * Math.sqrt(1 - phi * phi);
  let aC = sigma * gaussian(rng), aK = sigma * gaussian(rng);
  let st = twin.initTwinMetric();
  let rollbackAt = -1, proceedAt = -1;
  for (let t = 0; t < cell.T; t++) {
    aC = phi * aC + innov * gaussian(rng); aK = phi * aK + innov * gaussian(rng);
    const season = 1 + 0.5 * Math.sin((2 * Math.PI * t) / DAY);
    const level = 100 * season * (t >= 800 && t < 900 ? 3 : 1);
    const n = poisson(rng, TRAFFIC * season);
    const nc = split(rng, n, 0.5), nk = n - nc;
    const obs = {
      canary: level + 10 * aC + (30 * centeredLognormal(rng)) / Math.sqrt(Math.max(nc, 1)) + (cell.d + cell.r) * level,
      control: level + 10 * aK + (30 * centeredLognormal(rng)) / Math.sqrt(Math.max(nk, 1)),
    };
    st = twin.updateTwinMetric(spec, st, obs);
    const ev = twin.twinMetricEvidence(st);
    if (rollbackAt < 0 && ev.rollbackE >= 1 / ALPHA) rollbackAt = t;
    if (proceedAt < 0 && ev.proceedE >= 1 / ALPHA) proceedAt = t;
    if (rollbackAt >= 0 && proceedAt >= 0) break;
  }
  return { rollbackAt, proceedAt };
}

function median(xs) { if (xs.length === 0) return null; const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; }
function se(p) { return Math.sqrt((p * (1 - p)) / R); }

const results = [];
CELLS.forEach((cell, i) => {
  const rng = lcg(20261001 + 7919 * i);
  const rb = [], pr = [], rb60 = [];
  for (let r = 0; r < R; r++) {
    const out = replicate(cell, rng);
    if (out.rollbackAt >= 0) { rb.push(out.rollbackAt); if (out.rollbackAt < 60) rb60.push(out.rollbackAt); }
    if (out.proceedAt >= 0) pr.push(out.proceedAt);
  }
  const row = {
    id: cell.id, group: cell.group, m: cell.m, d: cell.d, r: cell.r, T: cell.T,
    rollbackRate: rb.length / R, rollbackSE: se(rb.length / R), medianRollbackTick: median(rb),
    rollbackBy60: rb60.length / R, proceedRate: pr.length / R, proceedSE: se(pr.length / R), medianProceedTick: median(pr),
  };
  if (cell.group === 'V' && cell.m > 0) row.verdict = row.rollbackRate <= BAR ? 'PASS' : 'FAIL';
  if (cell.group === 'V' && cell.m === 0) row.verdict = row.rollbackRate <= BAR ? 'PASS' : 'FAIL'; // twin-null P1 reproduced
  if (cell.group === 'M') row.verdict = row.rollbackRate >= 0.9 ? 'PASS' : row.rollbackRate < 0.5 ? 'NOT-EXECUTABLE' : 'FAIL';
  if (cell.id === 'P-m0.02-r0.08') row.verdict = row.rollbackBy60 >= 0.95 ? 'PASS' : 'FAIL';
  if (cell.id === 'Q-m0.02-r0.01') row.verdict = row.proceedRate >= 0.9 && row.rollbackRate <= BAR ? 'PASS' : 'FAIL';
  if (cell.id === 'Q-m0.02-r0.08-proceed') row.verdict = row.proceedRate <= ALPHA ? 'PASS' : 'FAIL';
  results.push(row);
  process.stdout.write(`${cell.id}: rollback ${row.rollbackRate.toFixed(4)} (by60 ${row.rollbackBy60.toFixed(3)}, median ${row.medianRollbackTick}) proceed ${row.proceedRate.toFixed(4)} (median ${row.medianProceedTick})${row.verdict ? ' ' + row.verdict : ''}\n`);
});

// E5 — replay of the 44 real runs through the gate, two metrics as the T3 registration declared.
const REG = { alphaRollback: 0.05, alphaProceed: 1e-12, alphaSrm: 0.001, canaryWeight: 0.5, maxTicks: 60 };
const replay = { runs_dir: RUNS_DIR, files: 0, margins: {} };
if (!existsSync(RUNS_DIR)) throw new Error(`replay input missing: ${RUNS_DIR} (set TWIN_AA_REAL_RUNS)`);
const files = readdirSync(RUNS_DIR).filter((f) => /^AA-l\d-r\d+-\d{8}T\d{6}Z\.jsonl$/.test(f)).sort();
replay.files = files.length;
const bodies = files.map((f) => {
  const lines = readFileSync(join(RUNS_DIR, f), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
  const scored = lines.filter((l) => l.type === 'window' && l.scored_tick).map((l) => l.body);
  return { file: f, run: Number(/-r(\d+)-/.exec(f)[1]), lane: Number(/-l(\d)-/.exec(f)[1]), scored };
});
for (const m of [0, ...REPLAY_MARGINS]) {
  const cfg = { ...REG, metrics: [
    { id: 'http_5xx', kind: 'rate', worse: 'higher', tolerance: 0.2 },
    { id: 'p99_latency', kind: 'sign', worse: 'higher', tolerance: 0.15, ...(m > 0 ? { margin: { relative: m } } : {}) },
  ] };
  const rows = bodies.map((b) => {
    let state = gate.initTwinGate(cfg); let decision = null;
    for (const body of b.scored) {
      const input = {
        canaryRequests: body.canary_requests, controlRequests: body.control_requests,
        observations: {
          http_5xx: body.observations?.http_5xx ? { canaryEvents: body.observations.http_5xx.canary_events, canaryTotal: body.observations.http_5xx.canary_total, controlEvents: body.observations.http_5xx.control_events, controlTotal: body.observations.http_5xx.control_total } : undefined,
          p99_latency: body.observations?.p99_latency,
        },
      };
      ({ state, decision } = gate.stepTwinGate(cfg, state, input));
      if (decision.verdict === 'rollback' || decision.verdict === 'proceed' || decision.verdict === 'invalid_experiment') break;
    }
    return { run: b.run, lane: b.lane, verdict: decision?.verdict ?? null, tick: decision?.tick ?? null, fired: (decision?.metrics ?? []).filter((x) => x.rollbackE >= x.rollbackThreshold).map((x) => x.id) };
  });
  replay.margins[m] = { rollbacks: rows.filter((r) => r.verdict === 'rollback').length, of: rows.length, runs: rows.filter((r) => r.verdict === 'rollback').map((r) => ({ run: r.run, tick: r.tick, fired: r.fired })), verdicts: rows };
  process.stdout.write(`replay m=${m}: ${replay.margins[m].rollbacks}/${rows.length} rollback${m === 0 ? ' (unmargined: must reproduce the T3 report\'s 12/44)' : ''}\n`);
}

const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
const out = join(HERE, '..', 'results', `${SMOKE ? 'smoke' : 'run'}-${stamp}`);
if (existsSync(out)) throw new Error(`${out} exists`);
mkdirSync(out, { recursive: true });
const git = (c) => execSync(c, { cwd: HERE, encoding: 'utf8' }).trim();
const manifest = {
  study_id: '2026-10-twin-sign-margin', smoke: SMOKE, generated_at: new Date().toISOString(),
  engine_head: git('git rev-parse HEAD'), tracked_changes: git('git status --porcelain --untracked-files=no').split('\n').filter(Boolean),
  engine_version: require('../../../package.json').version, node: process.version, R, ALPHA, BAR, replay_input: RUNS_DIR, replay_files: files,
};
writeFileSync(join(out, 'manifest.json'), JSON.stringify(manifest, null, 1) + '\n');
writeFileSync(join(out, 'cells.json'), JSON.stringify(results, null, 1) + '\n');
writeFileSync(join(out, 'replay.json'), JSON.stringify(replay, null, 1) + '\n');
const E = {
  E1: { cells: results.filter((r) => r.group === 'V' && r.m > 0).map((r) => ({ id: r.id, rate: r.rollbackRate, verdict: r.verdict })), verdict: results.filter((r) => r.group === 'V' && r.m > 0).every((r) => r.verdict === 'PASS') ? 'PASS' : 'FAIL' },
  E2: { cell: results.find((r) => r.group === 'M'), verdict: results.find((r) => r.group === 'M').verdict },
  E3: { cell: results.find((r) => r.id === 'P-m0.02-r0.08'), verdict: results.find((r) => r.id === 'P-m0.02-r0.08').verdict, reported: results.filter((r) => r.group === 'P' && r.id !== 'P-m0.02-r0.08').map((r) => ({ id: r.id, rollbackBy60: r.rollbackBy60, rollbackRate: r.rollbackRate, medianRollbackTick: r.medianRollbackTick })) },
  E4: { cells: results.filter((r) => r.group === 'Q').map((r) => ({ id: r.id, proceedRate: r.proceedRate, rollbackRate: r.rollbackRate, verdict: r.verdict })), verdict: results.filter((r) => r.group === 'Q').every((r) => r.verdict === 'PASS') ? 'PASS' : 'FAIL' },
  E5: { reported: Object.fromEntries(Object.entries(replay.margins).map(([m, v]) => [m, `${v.rollbacks}/${v.of}`])), verdict: 'reported, no verdict' },
  twin_null_P1_reproduced: results.find((r) => r.id === 'V-m0-d0').verdict,
};
E.ship_rule = E.E1.verdict === 'PASS' && E.E2.verdict === 'PASS' && E.E3.verdict === 'PASS' && E.E4.verdict === 'PASS' ? 'MET' : E.E2.verdict === 'NOT-EXECUTABLE' ? 'NOT EXECUTABLE' : 'NOT MET';
writeFileSync(join(out, 'endpoints.json'), JSON.stringify(E, null, 1) + '\n');
console.log(`\nE1 ${E.E1.verdict}  E2 ${E.E2.verdict}  E3 ${E.E3.verdict}  E4 ${E.E4.verdict}  E5 ${JSON.stringify(E.E5.reported)}  ship rule ${E.ship_rule}\nwritten: ${out}`);

// harness/run-sequential-ui.mjs — detector audit, sequential_ui_e_process.
//
// The h0-battery deferred this one: "its interface consumes a whole prefix per
// tick (O(T^2)); driving it needs a different adapter shape." It does not need
// a per-tick adapter — the function takes the whole series and returns the
// log-E path, so one call per trajectory yields every increment.
//
// INSTRUMENT, corrected after a first run produced 1.1e8: this is an
// e-PROCESS, not a test martingale. `logE[s] = numLog - nullLogLikSup(ns, s)`
// has a denominator RE-MAXIMISED over the null at every tick, and the envelope
// claims `E[E_tau] <= 1 at every stopping time -- BY CONSTRUCTION`, which is
// strictly weaker than a per-tick supermartingale. So the increment estimator
// does NOT apply: `E[exp(delta log E)] <= 1` need not hold tick-by-tick for a
// valid e-process, and reading it as a verdict is a category error.
//
// Scored: the stopped mean `E[E_tau]` (uninformative below 1, strong evidence
// of violation above it, per WORKLIST C24) and the crossing rate, to which
// Ville applies. The increment is RECORDED for contrast and scored by nothing.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { NULLS, rng, gaussFrom } from '../../h0-battery/harness/nulls.mjs';

const require = createRequire(import.meta.url);
const HERE = path.dirname(fileURLToPath(import.meta.url));
const STUDY = path.dirname(HERE);
const ENGINE_ROOT = path.resolve(STUDY, '..', '..');
const sui = require(path.join(ENGINE_ROOT, 'dist', 'detectors', 'sequential-ui.js'));

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const MODE = arg('--mode', 'sim');
const N = Number(arg('--n', 1000));
const T = Number(arg('--t', 200));
const SEED = 20260805;
const ALPHA = 0.05;

function summarise(xs) {
  const n = xs.length;
  const mean = xs.reduce((a, b) => a + b, 0) / n;
  const varr = n > 1 ? xs.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1) : 0;
  const se = Math.sqrt(varr / n);
  return { n, mean, sd: Math.sqrt(varr), se,
    lower95_one_sided: mean - 1.645 * se, upper95_one_sided: mean + 1.645 * se };
}

const cells = [];
const t0 = Date.now();

for (const spec of NULLS) {
  if (spec.id === 'N7') continue;          // rolling/disjoint: no windowed statistic here
  const incs = [], terminals = [], maxLogs = [];
  for (let i = 0; i < N; i++) {
    const r = rng(SEED + 7919 * i + spec.id.length * 104729);
    const g = gaussFrom(r);
    const draw = spec.gen(r, g);
    const xs = [];
    for (let t = 0; t < T; t++) xs.push(draw());
    let res;
    try { res = sui.sequentialUiMeanShiftEProcess(xs); }
    catch (e) { continue; }
    const logE = res.logE ?? res.log_e ?? null;
    if (!logE || !logE.length) continue;
    const exps = [];
    let maxLog = 0, prev = 0;
    for (const le of logE) {
      if (!Number.isFinite(le)) continue;
      exps.push(Math.exp(le - prev));
      prev = le;
      if (le > maxLog) maxLog = le;
    }
    if (exps.length) incs.push(exps.reduce((a, b) => a + b, 0) / exps.length);
    terminals.push(Math.exp(Math.min(prev, 700)));
    maxLogs.push(maxLog);
  }
  const inc = summarise(incs), term = summarise(terminals);
  const fires = maxLogs.filter((m) => m >= Math.log(1 / ALPHA)).length;
  cells.push({
    detector: 'sequential_ui_e_process', null_id: spec.id, null_label: spec.label,
    n: incs.length, ticks: T, alpha: ALPHA,
    increment_estimator: inc, terminal_mean: term,
    crossing_rate: fires / Math.max(maxLogs.length, 1),
    increment_recorded_not_scored: inc.mean,
    verdict: term.mean > 1 ? 'REFUTED (stopped mean above 1)'
      : (fires / Math.max(maxLogs.length, 1)) > ALPHA ? 'REFUTED (crossing above alpha)'
        : 'not-refuted',
    // C24: a terminal mean ABOVE 1 is strong evidence of violation and understates it.
    terminal_flag: term.mean > 1 ? 'ABOVE-1 (violation evidence)' : 'below 1 (uninformative)',
    mode: MODE,
  });
  const c = cells[cells.length - 1];
  process.stderr.write(
    `sequential_ui ${spec.id.padEnd(12)} inc=${inc.mean.toFixed(6)} `
    + `[${inc.lower95_one_sided.toFixed(6)},${inc.upper95_one_sided.toFixed(6)}] ${c.verdict.padEnd(12)} `
    + `mean(e)=${term.mean.toExponential(3)} ${c.terminal_flag.padEnd(30)} `
    + `cross=${c.crossing_rate.toFixed(4)} (${((Date.now() - t0) / 1000).toFixed(0)}s)\n`);
}

const gitSha = execSync('git rev-parse HEAD', { cwd: ENGINE_ROOT }).toString().trim();
const outDir = path.join(STUDY, 'results', MODE === 'live' ? 'live' : 'sim',
  `sui-${new Date().toISOString().replace(/[-:.]/g, '').slice(0, 15)}Z`);
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'summary.json'), `${JSON.stringify({ cells }, null, 1)}\n`);
fs.writeFileSync(path.join(outDir, 'manifest.json'), `${JSON.stringify({
  study: 'detector-audit-sequential-ui', prereg: '../PREREGISTRATION.md + WORKLIST C24',
  node: process.version, seed: SEED, n: N, ticks: T, alpha: ALPHA,
  git_sha: gitSha, mode: MODE, elapsed_s: (Date.now() - t0) / 1000,
}, null, 1)}\n`);
process.stderr.write(`\nwrote ${outDir}\n`);

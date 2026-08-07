// harness/phi-sweep.mjs -- is the near-unit-root gap an identifiability limit?
// Registered by ../PHI-IDENTIFIABILITY-PREREG.md; made a recording run by
// ../PHI-IDENTIFIABILITY-ADDENDUM-2026-08-07.md. Append-only.
//
// Endpoints frozen at the 2026-08-05 pre-registration and unchanged here: the grid, m,
// n_test, N, alpha, the +3 sigma shift, the mulberry32 stream seeded 4242 + i*7919 and the
// Box-Muller transform below. The addendum adds a results directory, per-cell files, error
// counting, and it corrects the absolute dist path (change (ii), a defect: run from a
// worktree the old path measured the MAIN checkout's build, not the branch under test).
import fs from 'node:fs'; import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const STUDY = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const ENG = path.join(STUDY, '..', '..');
const R = path.join(ENG, 'dist', 'detectors') + path.sep;
const ui = require(R + 'universal-inference-e-value.js');
const st = require(R + 'safe-t-e-value.js');

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const MODE = arg('--mode', 'sim');
// Registered N is 2000. --n exists for the rule-1 smoke check only; the manifest records
// whichever N ran, so a smoke run cannot be mistaken for the study.
const N = Number(arg('--n', 2000));
const M = 100, NT = 100, ALPHA = 0.05, SEED_BASE = 4242;
const GRID = [0, 0.3, 0.6, 0.8, 0.9, 0.95, 0.99];

function mul(s0){let s=s0>>>0;return()=>{s=(s+0x6D2B79F5)>>>0;let t=s;t=Math.imul(t^(t>>>15),t|1);
 t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};}
function gf(r){let sp=null;return()=>{if(sp!==null){const v=sp;sp=null;return v;}
 const u1=Math.max(r(),1e-300),u2=r();const rr=Math.sqrt(-2*Math.log(u1)),th=2*Math.PI*u2;sp=rr*Math.sin(th);return rr*Math.cos(th);};}

// Same estimator as ../POWER-PER-CELL-ADDENDUM-2026-08-07.md change (a): one-sided 95%
// normal-approximation lower bound on mean(e), max(0, mu - 1.645*s/sqrt(n)), s with an
// (n-1) denominator. Carries evidence only ABOVE 1 -- see that addendum and
// knowledge/stats/terminal-mean-is-not-measurable.
const meanOf = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
const sdOf = (xs) => { const n = xs.length; if (n < 2) return NaN; const mu = meanOf(xs);
  return Math.sqrt(xs.reduce((a, b) => a + (b - mu) ** 2, 0) / (n - 1)); };
const meanLower95 = (xs) => { if (xs.length < 2) return NaN; const sd = sdOf(xs);
  return Number.isFinite(sd) ? Math.max(0, meanOf(xs) - 1.645 * sd / Math.sqrt(xs.length)) : NaN; };
const lower95 = (k, n) => { const p = k / n, z = 1.645, d = 1 + z * z / n;
  const c = p + z * z / (2 * n), h = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n));
  return Math.max(0, (c - h) / d); };

// The registered null-id grammar (validation/certification/lib/nulls.mjs:54), whose header
// names this sweep as a user of it. phi = 0 is iid Gaussian with mu/sigma estimated from a
// 100-point calibration window (N2-m100); phi > 0 is AR(1) with phi FITTED from that window
// (N4-p..), because this sweep passes no opts.ar1Phi to safe-t at any grid point.
const nullIdFor = (phi) => (phi === 0 ? `N2-m${M}` : `N4-p${String(phi).replace('0.', '0')}`);

const engineVersion = JSON.parse(fs.readFileSync(path.join(ENG, 'package.json'), 'utf8')).version;
const gitSha = execSync('git rev-parse HEAD', { cwd: ENG }).toString().trim();
const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
const runDir = path.join(STUDY, 'results', MODE === 'live' ? 'live' : 'sim', `run-${stamp}`);
fs.mkdirSync(path.join(runDir, 'cells'), { recursive: true });

const rate = (a) => (a.length ? a.filter((e) => e >= 1 / ALPHA).length / a.length : NaN);
// harness-discipline rule 2: no bare catch. Every swallowed exception is counted and
// printed; a nonzero count is part of the result. The denominators are unchanged -- still
// the count of finite values -- so the published rates reproduce.
let errors = 0;
const push = (arr, f) => { try { const e = f(); if (Number.isFinite(e)) arr.push(e); } catch { errors += 1; } };

console.log(' phi     UI exc@.05   UI power    safe-t exc@.05  safe-t power   errs');
for (const phi of GRID) {
  const ue = [], up = [], se = [], sp = [];
  const errs0 = errors;
  for (let i = 0; i < N; i++) {
    const r = mul(SEED_BASE + i * 7919), g = gf(r);
    let prev = 0; const sd = Math.sqrt(1 - phi * phi);
    const vals = []; for (let t = 0; t < M + NT; t++) { prev = phi * prev + sd * g(); vals.push(prev); }
    const shifted = vals.map((v, j) => (j >= M ? v + 3 : v));
    const cal = { start: 0, len: M }, tst = { start: M, len: NT };
    push(ue, () => ui.universalInferenceMeanShiftEValue(vals, cal, tst));
    push(up, () => ui.universalInferenceMeanShiftEValue(shifted, cal, tst));
    push(se, () => st.safeTwoSampleTEValue(vals, cal, tst));
    push(sp, () => st.safeTwoSampleTEValue(shifted, cal, tst));
  }
  const nullId = nullIdFor(phi);
  for (const [det, nullArm, powArm] of [['universal_inference', ue, up], ['safe_t', se, sp]]) {
    const k = nullArm.filter((e) => e >= 1 / ALPHA).length;
    const cell = { detector: det, null_id: nullId, m: M, alpha: ALPHA, n: nullArm.length, phi,
      exceedance: rate(nullArm), lower_95: lower95(k, nullArm.length),
      verdict: lower95(k, nullArm.length) > ALPHA ? 'FAIL' : 'not-refuted',
      mean_e: meanOf(nullArm), mean_e_sd: sdOf(nullArm), mean_e_lower_95: meanLower95(nullArm),
      p_e_ge_10: nullArm.filter((e) => e >= 10).length / nullArm.length,
      p99_e: [...nullArm].sort((a, b) => a - b)[Math.floor(0.99 * nullArm.length)],
      error_count: errors - errs0, mode: MODE, engine_version: engineVersion, git_sha: gitSha };
    fs.writeFileSync(path.join(runDir, 'cells', `${det}__${nullId}__a${ALPHA}.json`),
      JSON.stringify(cell, null, 2));
    const pr = rate(powArm);
    const power = { control: 'power_per_cell', detector: det, null_id: nullId, m: M, phi,
      shift_sigma: 3, n: powArm.length, rate_e_ge_20: pr,
      power_verdict: Number.isNaN(pr) ? 'not-measured' : (pr >= 0.5 ? 'powered' : 'INERT'),
      mode: MODE, engine_version: engineVersion, git_sha: gitSha };
    fs.writeFileSync(path.join(runDir, 'cells', `POWER__${det}__${nullId}.json`),
      JSON.stringify(power, null, 2));
  }
  console.log(`${phi.toFixed(2)}    ${rate(ue).toFixed(4).padStart(9)}  ${rate(up).toFixed(4).padStart(9)}` +
    `      ${rate(se).toFixed(4).padStart(9)}     ${rate(sp).toFixed(4).padStart(9)}  ${errors - errs0}`);
}

fs.writeFileSync(path.join(runDir, 'manifest.json'), JSON.stringify({
  study: '2026-08-phi-identifiability', mode: MODE, engine_version: engineVersion, git_sha: gitSha,
  node: process.version, seed_base: SEED_BASE, n: N, m: M, n_test: NT, alpha: ALPHA,
  shift_sigma: 3, phi_grid: GRID, generated_at: stamp,
  prereg: ['PHI-IDENTIFIABILITY-PREREG.md'],
  addenda: ['PHI-IDENTIFIABILITY-ADDENDUM-2026-08-07.md'],
  error_count: errors,
}, null, 2));
console.log(`\nerrors=${errors}  ${GRID.length * 4} cells -> ${path.relative(STUDY, runDir)}`);

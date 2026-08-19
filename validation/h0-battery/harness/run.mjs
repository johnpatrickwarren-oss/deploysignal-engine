// harness/run.mjs — runs the battery. Append-only; never overwrites a run.
//
//   node harness/run.mjs --mode live   [--n 2000] [--t 300]
//   node harness/run.mjs --mode sim    (writes under results/sim/, git-ignored)
//
// PREREGISTRATION §10/§11: the mode chooses the path. There is no flag that
// places a sim run under results/live/.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { rng, gaussFrom, NULLS, N8_COMBINED } from './nulls.mjs';
import { DETECTORS, OUT_OF_SCOPE } from './detectors.mjs';

const STUDY = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };

const MODE = arg('--mode', 'sim');
// Amendment A4 (C27): --only-null <id> filters the null loop and skips P2 (P2 belongs to the
// original registration and runs on N1). Like --mode, it selects scope; no generator, detector
// call, seed, or endpoint branches on it. The battery's null set is NULLS + N8 (A4.1).
const ONLY_NULL = arg('--only-null', null);
// A4.6 — the rerun supersedes the first N8 run (wrong study id), applied C1.6 shape.
const SUPERSEDES_N8 = [{
  study: '2026-07-h0-battery', run: 'run-20260819T014829Z',
  detectors: ['family_A_betting_e_process', 'family_A_mixture_supermartingale',
    'family_C_safe_hotelling', 'family_D_spectral_e_detector'],
  reason: 'A4.6 study-id defect: the first --only-null run stamped 2026-07-h0-battery, growing the per-study census A1.6/A2.4 registered as staying at 148; superseded by the rerun under study id 2026-08-h0-battery-n8',
}];
const BATTERY_NULLS = [...NULLS, N8_COMBINED].filter((n) => !ONLY_NULL || n.id === ONLY_NULL);
const N = Number(arg('--n', 2000));
const T = Number(arg('--t', 300));
const ALPHAS = [0.05, 0.01];
const SHIPPED_ALPHA = 1e-4;           // measured, scored by nothing (§4)
const SEED = 20260801;

const engineVersion = JSON.parse(
  fs.readFileSync(path.join(STUDY, '..', '..', 'package.json'), 'utf8')).version;
const gitSha = execSync('git rev-parse HEAD', { cwd: path.join(STUDY, '..', '..') }).toString().trim();

/** One trajectory. `shift` injects a step of `shift` sigma at tick 100 (P2, §5);
 *  0 is the null. Returns whether the detector fired, and when. */
function trajectory(det, nullSpec, alpha, seed, shift = 0) {
  const r = rng(seed);
  const g = gaussFrom(r);
  const src = nullSpec.gen(r);
  const draw = () => (det.vector ? Array.from({ length: det.vector }, src) : src());

  // ORACLE phi is part of "oracle parameters" (§3 N3). Withholding it disables the
  // Q66 AR(1) pre-whitening — the defect that superseded run-20260801T062824Z.
  const cfg = { mu: 0, sigma: 1, phi: nullSpec.params === 'oracle' ? (nullSpec.phi ?? 0) : 0,
                alpha, windows: nullSpec.windows };

  if (nullSpec.params === 'estimated') {
    // N4: phi is estimated too, from the same calibration window.
    // Estimate from a finite calibration window — the deployed regime (N2/N4).
    const cal = Array.from({ length: nullSpec.m }, src);
    const mu = cal.reduce((a, b) => a + b, 0) / cal.length;
    const sd = Math.sqrt(cal.reduce((a, b) => a + (b - mu) ** 2, 0) / cal.length) || 1;
    let num = 0, den = 0;
    for (let i = 1; i < cal.length; i++) { num += (cal[i] - mu) * (cal[i - 1] - mu); }
    for (let i = 0; i < cal.length; i++) { den += (cal[i] - mu) ** 2; }
    Object.assign(cfg, { mu, sigma: sd, phi: den > 0 ? Math.max(-0.95, Math.min(0.95, num / den)) : 0 });
  }
  if (det.calibrate) {
    // A windowed statistic has its own null moments; calibrate on the same law.
    Object.assign(cfg, det.calibrate(Array.from({ length: 3000 }, src), cfg));
  }

  const inst = det.make(cfg);
  const ONSET = 100;
  for (let t = 0; t < T; t++) {
    let x = draw();
    if (shift && t >= ONSET) x = det.vector ? x.map((v) => v + shift) : x + shift;
    if (inst.step(x)) return { fired: true, tick: t, logM: inst.logM() };
  }
  return { fired: false, tick: -1, logM: inst.logM() };
}

function cell(det, nullSpec, alpha) {
  let fires = 0;
  const logMs = [];
  for (let i = 0; i < N; i++) {
    const res = trajectory(det, nullSpec, alpha, SEED + i * 7919);
    if (res.fired) fires++;
    logMs.push(res.logM);
  }
  const rate = fires / N;
  // Exact-ish one-sided 95% lower bound (Wilson); P1 fails iff it exceeds alpha.
  const z = 1.645;
  const denom = 1 + z * z / N;
  const centre = rate + z * z / (2 * N);
  const half = z * Math.sqrt(rate * (1 - rate) / N + z * z / (4 * N * N));
  const lower = Math.max(0, (centre - half) / denom);
  return {
    detector: det.id, family: det.family, null_id: nullSpec.id, null_label: nullSpec.label,
    alpha, n: N, ticks: T, fires, fire_rate: rate, lower_95: lower,
    verdict: lower > alpha ? 'FAIL' : 'not-refuted',
    mean_logM: logMs.reduce((a, b) => a + b, 0) / logMs.length,
    mode: MODE, engine_version: engineVersion, git_sha: gitSha,
  };
}

const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
const runDir = path.join(STUDY, 'results', MODE === 'live' ? 'live' : 'sim', `run-${stamp}`);
if (fs.existsSync(runDir)) { console.error(`refusing to reuse ${runDir}`); process.exit(1); }
fs.mkdirSync(path.join(runDir, 'cells'), { recursive: true });

const only = arg('--only', null);
const cells = [];
for (const det of DETECTORS) {
  if (only && det.id !== only) continue;
  for (const nullSpec of BATTERY_NULLS) {
    for (const alpha of [...ALPHAS, SHIPPED_ALPHA]) {
      const c = cell(det, nullSpec, alpha);
      c.scored = alpha !== SHIPPED_ALPHA;      // §4: shipped alpha is descriptive
      cells.push(c);
      fs.writeFileSync(
        path.join(runDir, 'cells', `${det.id}__${nullSpec.id}__a${alpha}.json`),
        JSON.stringify(c, null, 2));
      const tag = c.scored ? c.verdict : 'descriptive';
      console.log(`${det.id.padEnd(36)} ${nullSpec.id.padEnd(12)} a=${String(alpha).padEnd(7)} ` +
        `rate=${c.fire_rate.toFixed(4)} lower=${c.lower_95.toFixed(4)} ${tag}`);
    }
  }
}

// ---- P2, the vacuous-pass guard (§5): 3-sigma step at tick 100, detect within 200.
// A4.3: an --only-null run skips P2 — it belongs to the original registration, on N1.
const p2 = [];
for (const det of ONLY_NULL ? [] : DETECTORS) {
  if (only && det.id !== only) continue;
  const n1 = NULLS.find((n) => n.id === 'N1');
  let detected = 0;
  for (let i = 0; i < N; i++) {
    const r = trajectory(det, n1, 0.05, SEED + i * 7919, 3);
    if (r.fired && r.tick >= 100 && r.tick <= 300) detected++;
  }
  const rate = detected / N;
  const rec = { detector: det.id, shift_sigma: 3, detection_rate: rate,
    verdict: rate < 0.50 ? 'FAIL' : 'pass', mode: MODE,
    engine_version: engineVersion, git_sha: gitSha };
  p2.push(rec);
  fs.writeFileSync(path.join(runDir, 'cells', `P2__${det.id}.json`), JSON.stringify(rec, null, 2));
  console.log(`P2 ${det.id.padEnd(36)} detection=${rate.toFixed(4)} ${rec.verdict}`);
}

fs.writeFileSync(path.join(runDir, 'manifest.json'), JSON.stringify({
  // A4.6: an --only-null run carries its own study id so the registered per-study censuses
  // (A1.6/A2.4: 148) stay literally true — the K6A class-instrument-arm design.
  study: ONLY_NULL ? '2026-08-h0-battery-n8' : '2026-07-h0-battery',
  mode: MODE, engine_version: engineVersion, git_sha: gitSha,
  registration_sha: '17cc3f8',
  // A4.3: the legacy stamp describes the 2026-08-01 rerun and is wrong provenance for an
  // --only-null run; full-battery runs keep it unchanged.
  supersedes: ONLY_NULL ? SUPERSEDES_N8 : { priorRun: 'run-20260801T062824Z', defect:
    'oracle phi was never threaded into the detector config, so N3/N4 ran with AR(1) pre-whitening disabled; and the mixture adapter passed ar1_phi under params where that detector reads it off input, so it never received phi at all. The prior runs measure detectors unaware of phi, not the registered oracle-parameter cell' }, node: process.version, seed: SEED, n: N, ticks: T,
  alphas: ALPHAS, shipped_alpha: SHIPPED_ALPHA, generated_at: stamp,
  out_of_scope: OUT_OF_SCOPE, argv: process.argv.slice(2),
}, null, 2));
console.log(`\n${cells.length} cells -> ${path.relative(STUDY, runDir)}`);

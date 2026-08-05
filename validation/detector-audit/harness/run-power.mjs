// harness/run-power.mjs — the power arm the sequential audit never had.
// Design frozen by ../POWER-PREREGISTRATION.md. Closes WORKLIST C29 for the
// sequential detectors.
//
// Harness discipline (knowledge/methodology/harness-discipline.md):
//  1. every external interface was smoke-checked before wiring — DETECTORS
//     adapters expose {step(x)->boolean, logM()->number}; spec.gen(r,g) yields
//     a unit-variance scalar draw, so a 3σ step is literally +3, matching the
//     h0-battery's own guard.
//  2. NO bare catch — every failure increments a counter that reaches the report.
//  3. no scripted string replace here; this is a new file, not an edit.
//
// Determinism: seeds are `SEED + 7919*i + <cell salt>`. Nothing in the
// measurement path reads the clock; the clock is used only to name the run dir.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { DETECTORS } from '../../h0-battery/harness/detectors.mjs';
import { NULLS, rng, gaussFrom } from '../../h0-battery/harness/nulls.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const STUDY = path.dirname(HERE);
const ENGINE_ROOT = path.resolve(STUDY, '..', '..');
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };

const N = Number(arg('--n', 2000));
const T = Number(arg('--t', 300));
const ONSET = 100;
const ALPHA = 0.05;
const SEED = 20260805;
const SHIFTS = [3.0, 0.75];
const SCORED = new Set([
  'family_A_betting_e_process',
  'family_A_mixture_supermartingale',
  'family_D_spectral_e_detector',
]);

function calibrate(spec, seedBase) {
  const m = spec.m ?? 100;
  const r = rng(seedBase);
  const draw = spec.gen(r, gaussFrom(r));
  const xs = [];
  for (let i = 0; i < m; i++) xs.push(draw());
  const mu = xs.reduce((a, b) => a + b, 0) / m;
  const v = xs.reduce((a, b) => a + (b - mu) ** 2, 0) / Math.max(1, m - 1);
  let phiHat = 0;
  if (spec.phi !== undefined) {
    let num = 0, den = 0;
    for (let i = 1; i < m; i++) { num += (xs[i] - mu) * (xs[i - 1] - mu); den += (xs[i - 1] - mu) ** 2; }
    phiHat = den > 0 ? num / den : 0;
  }
  return { mu, sigma: Math.sqrt(Math.max(v, 1e-12)), phi: phiHat };
}

const cells = [];
const t0 = Date.now();

for (const det of DETECTORS.filter((d) => SCORED.has(d.id))) {
  for (const spec of NULLS) {
    for (const shift of SHIFTS) {
      let fires = 0, done = 0;
      let adapterFailures = 0, nonFiniteWealth = 0, explosions = 0;
      for (let i = 0; i < N; i++) {
        const salt = spec.id.length * 104729 + det.id.length + Math.round(shift * 1000);
        const r = rng(SEED + 7919 * i + salt);
        const g = gaussFrom(r);
        const cfg = spec.params === 'estimated'
          ? { ...calibrate(spec, SEED + 31 * i + spec.id.length), alpha: ALPHA, windows: spec.windows }
          : { mu: 0, sigma: 1, phi: spec.phi ?? 0, alpha: ALPHA, windows: spec.windows };
        let inst;
        try { inst = det.make(cfg); }
        catch { adapterFailures += 1; continue; }
        const draw = spec.gen(r, g);
        let fired = false, broke = false;
        for (let t = 0; t < T; t++) {
          const x = draw() + (t >= ONSET ? shift : 0);
          let v;
          try { v = inst.step(x); }
          catch { adapterFailures += 1; broke = true; break; }
          if (v === true) { fired = true; break; }
        }
        if (!broke) {
          const lm = inst.logM();
          if (!Number.isFinite(lm)) nonFiniteWealth += 1;
          else if (lm > 700) explosions += 1;
          if (fired) fires += 1;
          done += 1;
        }
      }
      const notExecutable = (nonFiniteWealth + explosions) > 0.01 * Math.max(done, 1);
      const rate = done ? fires / done : NaN;
      cells.push({
        detector: det.id, null_id: spec.id, null_label: spec.label,
        params: spec.params ?? 'oracle', shift_sigma: shift,
        n: done, ticks: T, onset: ONSET, alpha: ALPHA,
        fires, detection_rate: rate,
        adapter_failures: adapterFailures,
        non_finite_wealth: nonFiniteWealth, wealth_explosions: explosions,
        verdict: notExecutable ? 'NOT-EXECUTABLE' : rate >= 0.50 ? 'POWERED' : 'INERT',
        not_executable_reason: notExecutable
          ? `numerical failure in ${nonFiniteWealth + explosions}/${done} trajectories `
            + '(non-finite or overflowing wealth) — a defect, not a measurement'
          : null,
      });
      const c = cells[cells.length - 1];
      process.stderr.write(
        `${det.id.padEnd(34)} ${spec.id.padEnd(12)} ${shift.toFixed(2)}s  `
        + `rate=${Number.isFinite(rate) ? rate.toFixed(4) : ' n/a  '}  ${c.verdict.padEnd(15)} `
        + `fail=${adapterFailures} nonfinite=${nonFiniteWealth} explode=${explosions}\n`);
    }
  }
}

const at3 = cells.filter((c) => c.shift_sigma === 3.0 && c.verdict !== 'NOT-EXECUTABLE');
const saturated = at3.length > 0 && at3.every((c) => c.detection_rate >= 0.99);

const sub = crypto.createHash('sha256');
for (const f of ['../../h0-battery/harness/nulls.mjs', '../../h0-battery/harness/detectors.mjs']) {
  sub.update(fs.readFileSync(path.resolve(HERE, f)));
}
const gitSha = execSync('git rev-parse HEAD', { cwd: ENGINE_ROOT }).toString().trim();
const enginePin = JSON.parse(fs.readFileSync(path.join(ENGINE_ROOT, 'package.json'), 'utf8')).version;

const stamp = `${new Date().toISOString().replace(/[-:.]/g, '').slice(0, 15)}Z`;
const outDir = path.join(STUDY, 'results', 'live', `power-${stamp}`);
if (fs.existsSync(outDir)) {
  throw new Error(`run-power: ${outDir} exists; results are append-only and this run refuses to overwrite`);
}
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'summary.json'), `${JSON.stringify({ cells }, null, 1)}\n`);
fs.writeFileSync(path.join(outDir, 'manifest.json'), `${JSON.stringify({
  study: 'detector-audit-power', prereg: '../POWER-PREREGISTRATION.md',
  closes: 'WORKLIST C29 (sequential detectors)',
  node: process.version, engine_pin: enginePin, git_sha: gitSha,
  substrate: 'h0-battery N1-N7 (nulls.mjs + detectors.mjs)',
  substrate_sha256: sub.digest('hex'),
  seed_scheme: 'SEED + 7919*i + (null.id.length*104729 + det.id.length + round(shift*1000))',
  seed: SEED, n: N, ticks: T, onset: ONSET, alpha: ALPHA, shifts: SHIFTS,
  detectors: [...SCORED], nulls: NULLS.map((s) => s.id),
  saturation_not_executable: saturated,
  elapsed_s: (Date.now() - t0) / 1000,
}, null, 1)}\n`);
process.stderr.write(`\nsaturated (NOT-EXECUTABLE cond 1): ${saturated}\nwrote ${outDir}\n`);

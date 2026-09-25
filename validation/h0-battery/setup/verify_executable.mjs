// setup/verify_executable.mjs — PREREGISTRATION §8. Prints "battery is
// EXECUTABLE" or the study does not run. Condition 3 is the important one:
// the harness must reproduce a KNOWN failure before any other cell is scored.
import fs from 'node:fs'; import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { rng, gaussFrom, NULLS } from '../harness/nulls.mjs';
import { DETECTORS, OUT_OF_SCOPE, ONSET_ARM, ONSET_ARM_PIN } from '../harness/detectors.mjs';

const STUDY = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const fail = (m) => { console.error(`NOT EXECUTABLE: ${m}`); process.exit(1); };

const pkg = JSON.parse(fs.readFileSync(path.join(STUDY, '..', '..', 'package.json'), 'utf8'));
// Amendment A5: the onset-mixture arm carries its own engine pin (A5.5.3); the original
// registration's pin is unchanged for full-battery runs.
const ARM = process.argv.includes('--arm') ? process.argv[process.argv.indexOf('--arm') + 1] : null;
const PIN = ARM === 'onset-mixture' ? ONSET_ARM_PIN.engine_version : '0.6.6-pre';
if (pkg.version !== PIN) fail(`engine is ${pkg.version}, pinned to ${PIN}${ARM ? ` for arm ${ARM}` : ''}`);
if (ARM === 'onset-mixture') {
  // A5.5.3 — the arm's own smoke checks, on N1 draws, T = 300.
  const T = 300;
  for (const d of ONSET_ARM) {
    const r = rng(3); const src = gaussFrom(r);
    const cfg = { mu: 0, sigma: 1, phi: 0, alpha: 0.05, windows: 'disjoint', ticks: T };
    const inst = d.make(cfg); const before = inst.logM();
    let firedBeforeHorizon = false;
    for (let t = 0; t < T; t++) { const f = inst.step(src()); if (f && t < T - 1) firedBeforeHorizon = true; }
    if (inst.logM() === before) fail(`${d.id} never advances its wealth — it would pass every null vacuously`);
    if (d.id.includes('normalized') && firedBeforeHorizon) fail(`${d.id} is the terminal instrument and fired before t = T−1`);
  }
  const geo = ONSET_ARM.find((d) => d.id === 'family_A_onset_mixture_geometric_gaussian');
  const r = rng(11); const src = gaussFrom(r);
  const inst = geo.make({ mu: 0, sigma: 1, phi: 0, alpha: 0.05, windows: 'disjoint', ticks: T });
  let firedAt = -1;
  for (let t = 0; t < T; t++) { if (inst.step(src() + (t >= 100 ? 3 : 0))) { firedAt = t; break; } }
  if (firedAt < 100 || firedAt > 300) fail(`geometric gaussian arm did not fire on a 3σ step within 200 ticks (fired at ${firedAt})`);
  console.log(`  arm smoke: four adapters advance; terminal arms wait for t = T−1; 3σ step fires the geometric arm at t=${firedAt}`);
}

for (const d of DETECTORS) {
  const r = rng(3); const src = gaussFrom(r);
  const cfg = { mu: 0, sigma: 1, phi: 0, alpha: 0.05, windows: 'rolling' };
  if (d.calibrate) Object.assign(cfg, d.calibrate(Array.from({ length: 3000 }, src), cfg));
  const inst = d.make(cfg); const before = inst.logM();
  for (let t = 0; t < 200; t++) inst.step(d.vector ? Array.from({ length: d.vector }, src) : src());
  if (inst.logM() === before) fail(`${d.id} never advances its wealth — it would pass every null vacuously`);
}
for (const o of OUT_OF_SCOPE) if (!o.reason) fail(`${o.id} is out of scope with no reason`);

const det = DETECTORS.find((d) => d.id === 'family_D_spectral_e_detector');
const n7 = NULLS.find((n) => n.id === 'N7');
let fires = 0; const N = 300;
for (let i = 0; i < N; i++) {
  const r = rng(1000 + i * 31); const src = n7.gen(r);
  const cfg = { mu: 0, sigma: 1, phi: 0, alpha: 0.05, windows: n7.windows };
  Object.assign(cfg, det.calibrate(Array.from({ length: 3000 }, src), cfg));
  const inst = det.make(cfg);
  for (let t = 0; t < 300; t++) if (inst.step(src())) { fires++; break; }
}
const rate = fires / N;
if (rate < 0.20) fail(`Family D under N7 fired at ${rate.toFixed(3)}; the known failure is ~0.57. The harness is wrong, not the detector (§7).`);
console.log(`  known-failure check: Family D / N7 / a=0.05 -> ${rate.toFixed(3)} (expected ~0.57)`);

if (!fs.readFileSync(path.join(STUDY, '..', '..', '.gitignore'), 'utf8').includes('h0-battery/results/sim'))
  fail('results/sim must be git-ignored (§11)');
const analysis = fs.readdirSync(path.join(STUDY, 'analysis')).filter((f) => f.endsWith('.mjs'));
if (analysis.length !== 1) fail(`analysis/ has ${analysis.length} scripts; exactly one is allowed`);
console.log('battery is EXECUTABLE');

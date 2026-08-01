// setup/verify_executable.mjs — PREREGISTRATION §8. Prints "battery is
// EXECUTABLE" or the study does not run. Condition 3 is the important one:
// the harness must reproduce a KNOWN failure before any other cell is scored.
import fs from 'node:fs'; import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { rng, gaussFrom, NULLS } from '../harness/nulls.mjs';
import { DETECTORS, OUT_OF_SCOPE } from '../harness/detectors.mjs';

const STUDY = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const fail = (m) => { console.error(`NOT EXECUTABLE: ${m}`); process.exit(1); };

const pkg = JSON.parse(fs.readFileSync(path.join(STUDY, '..', '..', 'package.json'), 'utf8'));
if (pkg.version !== '0.6.6-pre') fail(`engine is ${pkg.version}, pinned to 0.6.6-pre`);

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

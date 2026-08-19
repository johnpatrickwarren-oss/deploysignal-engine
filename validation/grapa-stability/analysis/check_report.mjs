// analysis/check_report.mjs — pins every number in REPORT.md to the canonical run's artifacts.
// Exit 1 on drift. Bound to the run by constant, per the family-d-emean convention.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const STUDY = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const RUN = 'run-20260819T040000Z';
const dir = path.join(STUDY, 'results', 'live', RUN);
const report = fs.readFileSync(path.join(STUDY, 'REPORT.md'), 'utf8');
const e = JSON.parse(fs.readFileSync(path.join(dir, 'endpoints-grapa-stability.json'), 'utf8'));
let bad = 0;
// The report uses the typographic minus sign; normalize pins to it.
const pin = (label, str) => {
  const t = String(str).replace(/^-/, '\u2212');
  if (!report.includes(t)) { console.error(`DRIFT ${label}: "${t}"`); bad++; }
};
const expect = (label, cond) => { if (!cond) { console.error(`DRIFT ${label}`); bad++; } };
expect('executable', e.executable === true && e.repro_mismatches === 0);
for (const k of ['P1', 'P2', 'P3', 'P4', 'P5', 'P6']) expect(`${k} HELD`, e[k].verdict === 'HELD');
pin('P1 slope', (Math.round(e.P1.slope * 1000) / 1000).toFixed(3));
pin('P2 slope', (Math.round(e.P2.slope * 1000) / 1000).toFixed(3));
pin('P3', e.P3.increment_estimator.toFixed(7));
pin('P4 kappa', e.P4.kappa.toFixed(4));
pin('P4 e30', e.P4.excess[0].toFixed(5));
pin('P4 e100', e.P4.excess[1].toFixed(5));
pin('P4 e500', e.P4.excess[2].toFixed(5));
pin('P5 max inc', e.P5.max_abs_increment[0].toFixed(4));
pin('P5 fire N5', e.P5.fire_rate[0].toFixed(4));
pin('P5 fire N6', e.P5.fire_rate[1].toFixed(4));
expect('P6 early = 1', e.P6.early_fallback_rate === 1);
pin('P6 late', (e.P6.late_fallback_rate * 100).toFixed(5) + '%');
if (bad) { console.error(`${bad} drift(s)`); process.exit(1); }
console.log(`REPORT.md is consistent with ${RUN}`);

// validation/nab/analysis/check_rerun_2026_09_29.mjs — pins RERUN-2026-09-29-REPORT.md to the four run
// directories it compares (exit 1 on drift). Study 2026-09-nab-rerun-v0.12.2 (C85 part 3).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const NAB = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const J = (p) => JSON.parse(fs.readFileSync(path.join(NAB, p), 'utf8'));
const report = fs.readFileSync(path.join(NAB, 'RERUN-2026-09-29-REPORT.md'), 'utf8');
let failed = 0; const check = (n, ok) => { if (!ok) { console.error(`FAIL ${n}`); failed++; } };
const pairs = [
  ['time-to-alert', 'run-20260905T025224Z', 'run-20260929T014900Z', (c) => `${c.detector}|${c.alpha}`],
  ['null-survival', 'run-20260905T050636Z', 'run-20260929T014948Z', (c) => `${c.arm}|${c.construction}|${c.level}`],
];
for (const [study, old, cur, key] of pairs) {
  const a = J(`${study}/results/live/${old}/cells.json`), b = J(`${study}/results/live/${cur}/cells.json`);
  const B = new Map(b.map((c) => [key(c), c]));
  const same = a.filter((c) => B.has(key(c)) && JSON.stringify(c) === JSON.stringify(B.get(key(c)))).length;
  check(`${study}: every 2026-09-05 cell reproduced`, same === a.length);
  check(`${study}: report names both runs`, report.includes(old) && report.includes(cur));
  const m = J(`${study}/results/live/${cur}/manifest.json`);
  check(`${study}: engine 0.12.2-pre`, m.engine_version === '0.12.2-pre' && m.engine_sha.startsWith('137124f') && report.includes('137124f'));
  check(`${study}: exceptions 0`, m.exceptions === 0);
  if (study === 'time-to-alert') check('time-to-alert: 7 cells', a.length === 7 && b.length === 7 && report.includes('7 cells'));
  if (study === 'null-survival') {
    check('null-survival: 44 cells reproduced, 4 added', a.length === 44 && b.length === 48 && report.includes('44 cells') && report.includes('Four new cells'));
    const bo = b.filter((c) => c.construction === 'e_sr_mean_shift_bounded');
    check('bounded e-SR: 4 cells, all HELD, alerting 19/22/22/21', bo.length === 4 && bo.every((c) => c.p1 === 'HELD') && bo.map((c) => c.alerting).join('/') === '19/22/22/21' && report.includes('19/22/22/21'));
    check('bounded e-SR bars 24/29/27/24', bo.map((c) => c.bar).join('/') === '24/29/27/24' && report.includes('24/29/27/24'));
    check('bounded e-SR by_end', bo.map((c) => c.p3_by_end.toFixed(3)).join('/') === '0.957/1.000/1.000/1.000' && report.includes('0.957/1.000/1.000/1.000'));
    check('bounded present', m.bounded_esr === 'present');
  }
}
if (failed) { console.error(`${failed} check(s) failed`); process.exit(1); }
console.log('check_rerun_2026_09_29: all checks passed');

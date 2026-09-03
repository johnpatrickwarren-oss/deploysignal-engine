// validation/arl-delay/analysis/check_report.mjs — pins REPORT.md to the run JSON by
// re-rendering it and diffing (exit 1 on drift), then checks any `--expect <file>` of
// `path.to.field=value` lines (dot paths into arl.json / delay.json / gates.json, cells
// addressed by index) so a wiki page's quoted numbers can be pinned to the same run.
//
//   node validation/arl-delay/analysis/check_report.mjs <run-dir> [--expect <file>]

import fs from 'node:fs';
import path from 'node:path';
import { render } from './report.mjs';

const runDir = path.resolve(process.argv[2]);
const committed = fs.readFileSync(path.join(runDir, 'REPORT.md'), 'utf8');
const fresh = render(runDir);
let failures = 0;
if (committed !== fresh) {
  failures++;
  const a = committed.split('\n'), b = fresh.split('\n');
  for (let i = 0; i < Math.max(a.length, b.length); i++) if (a[i] !== b[i]) { console.error(`REPORT.md drift at line ${i + 1}:\n  committed: ${a[i]}\n  fresh:     ${b[i]}`); break; }
}
const ei = process.argv.indexOf('--expect');
if (ei > 0) {
  const J = { arl: JSON.parse(fs.readFileSync(path.join(runDir, 'arl.json'), 'utf8')), delay: JSON.parse(fs.readFileSync(path.join(runDir, 'delay.json'), 'utf8')), gates: JSON.parse(fs.readFileSync(path.join(runDir, 'gates.json'), 'utf8')) };
  // a cell selector: arl[detector_id,null_id,alpha].field or delay[detector_id,injection,null_id,alpha].field or gates.G1.verdict
  for (const raw of fs.readFileSync(process.argv[ei + 1], 'utf8').split('\n')) {
    const line = raw.trim(); if (!line || line.startsWith('#')) continue;
    const [lhs, expected] = line.split('=').map((s) => s.trim());
    let got;
    const sel = /^(arl|delay)\[([^\]]+)\]\.(\w+)$/.exec(lhs);
    if (sel) {
      const keys = sel[2].split(',').map((s) => s.trim());
      const rows = J[sel[1]].filter((c) => (sel[1] === 'arl'
        ? c.detector_id === keys[0] && c.null_id === keys[1] && String(c.alpha) === keys[2]
        : c.detector_id === keys[0] && c.injection === keys[1] && c.null_id === keys[2] && String(c.alpha) === keys[3]));
      if (rows.length !== 1) { console.error(`selector ${lhs} matched ${rows.length} rows`); failures++; continue; }
      got = rows[0][sel[3]];
    } else {
      got = lhs.split('.').reduce((o, k) => (o == null ? undefined : o[k]), J);
    }
    const ok = typeof got === 'number' ? Math.abs(got - Number(expected)) <= 0.5 * 10 ** -(expected.split('.')[1]?.length ?? 0) : String(got) === expected;
    if (!ok) { console.error(`expect ${lhs} = ${expected}, got ${got}`); failures++; }
  }
}
if (failures) { console.error(`${failures} failure(s)`); process.exit(1); }
console.log('check_report: REPORT.md matches the run JSON' + (ei > 0 ? '; all expectations hold' : ''));

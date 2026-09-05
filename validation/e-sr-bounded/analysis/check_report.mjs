// validation/e-sr-bounded/analysis/check_report.mjs — pins REPORT.md to the run JSON (byte equality on
// re-render, exit 1 on drift) and checks any `--expect <file>` of `selector = value` lines:
// s2[null_id].field, s3[null_id,shift_sigma].field, h1.verdict, h2.ratio, h2[detector_id].field,
// h3.field, h4.field, manifest.field.
//
//   node validation/e-sr-bounded/analysis/check_report.mjs <run-dir> [--expect <file>]
import fs from 'node:fs';
import path from 'node:path';
import { render } from './report.mjs';

const runDir = path.resolve(process.argv[2]);
const J = (n) => JSON.parse(fs.readFileSync(path.join(runDir, n), 'utf8'));
const summary = J('summary.json'), comparison = J('comparison.json'), manifest = J('manifest.json');
let failures = 0;
const committed = fs.readFileSync(path.join(runDir, 'REPORT.md'), 'utf8'), fresh = render(summary, comparison, manifest);
if (committed !== fresh) { failures++; const a = committed.split('\n'), b = fresh.split('\n'); for (let i = 0; i < Math.max(a.length, b.length); i++) if (a[i] !== b[i]) { console.error(`REPORT.md drift at line ${i + 1}:\n  committed: ${a[i]}\n  fresh:     ${b[i]}`); break; } }
if (manifest.exceptions !== 0) { console.error(`manifest records ${manifest.exceptions} exceptions`); failures++; }
const ei = process.argv.indexOf('--expect');
if (ei > 0) {
  for (const raw of fs.readFileSync(process.argv[ei + 1], 'utf8').split('\n')) {
    const line = raw.trim(); if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('='); const lhs = line.slice(0, eq).trim(), expected = line.slice(eq + 1).trim();
    let got;
    const sel = /^(s2|s3|h2)\[([^\]]+)\]\.(\w+)$/.exec(lhs);
    if (sel) {
      const keys = sel[2].split(',').map((s) => s.trim());
      const rows = sel[1] === 's2' ? summary.cells.filter((c) => 'arl0_T' in c && c.null_id === keys[0])
        : sel[1] === 's3' ? summary.cells.filter((c) => 'delay_canonical' in c && c.null_id === keys[0] && String(c.shift_sigma) === keys[1])
        : comparison.H2.cells.filter((c) => c.detector_id === keys[0]);
      if (rows.length !== 1) { console.error(`selector ${lhs} matched ${rows.length}`); failures++; continue; }
      got = rows[0][sel[3]];
    } else {
      const D = { h1: comparison.H1, h2: comparison.H2, h3: comparison.H3, h4: comparison.H4, g0: comparison.G0, manifest };
      got = lhs.split('.').reduce((o, k) => (o == null ? undefined : o[k]), D);
    }
    const ok = typeof got === 'number' && !Number.isNaN(Number(expected)) ? Math.abs(got - Number(expected)) <= 0.5 * 10 ** -(expected.split('.')[1]?.length ?? 0) + 1e-12 : String(got) === expected;
    if (!ok) { console.error(`expect ${lhs} = ${expected}, got ${got}`); failures++; }
  }
}
if (failures) { console.error(`${failures} failure(s)`); process.exit(1); }
console.log('check_report: REPORT.md matches the run JSON' + (ei > 0 ? '; all expectations hold' : ''));

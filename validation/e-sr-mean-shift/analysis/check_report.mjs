// validation/e-sr-mean-shift/analysis/check_report.mjs — re-renders REPORT.md and diffs (exit 1 on
// drift); `--expect <file>` lines `h2.cells[<detector_id>,<nu>,<alpha>].field = v`,
// `h1.cells[<null>,<alpha>].field = v`, `h3.cells[<delta>].field = v`, `h4.cells[<null>].field = v`,
// or a dot path (`h5.b.mean_M_20 = v`, `manifest.verdicts.H1 = HELD`).
import fs from 'node:fs';
import path from 'node:path';
import { render } from './report.mjs';
const runDir = path.resolve(process.argv[2]);
let failures = 0;
const committed = fs.readFileSync(path.join(runDir, 'REPORT.md'), 'utf8'), fresh = render(runDir);
if (committed !== fresh) { failures++; const a = committed.split('\n'), b = fresh.split('\n'); for (let i = 0; i < Math.max(a.length, b.length); i++) if (a[i] !== b[i]) { console.error(`REPORT.md drift at line ${i + 1}:\n  committed: ${a[i]}\n  fresh:     ${b[i]}`); break; } }
const ei = process.argv.indexOf('--expect');
if (ei > 0) {
  const J = {}; for (const n of ['h1', 'h2', 'h3', 'h4', 'h5', 'manifest']) J[n] = JSON.parse(fs.readFileSync(path.join(runDir, `${n}.json`), 'utf8'));
  for (const raw of fs.readFileSync(process.argv[ei + 1], 'utf8').split('\n')) {
    const line = raw.trim(); if (!line || line.startsWith('#')) continue;
    const [lhs, expected] = line.split('=').map((s) => s.trim()); let got;
    const sel = /^(h1|h2|h3|h4)\.cells\[([^\]]+)\]\.(\w+)$/.exec(lhs);
    if (sel) {
      const keys = sel[2].split(',').map((s) => s.trim()); const rows = J[sel[1]].cells.filter((c) => (
        sel[1] === 'h2' ? c.detector_id === keys[0] && String(c.nu) === keys[1] && String(c.alpha) === keys[2]
          : sel[1] === 'h1' ? c.null_id === keys[0] && String(c.alpha) === keys[1]
            : sel[1] === 'h3' ? String(c.delta) === keys[0] : c.null_id === keys[0]));
      if (rows.length !== 1) { console.error(`selector ${lhs} matched ${rows.length} rows`); failures++; continue; }
      got = rows[0][sel[3]];
    } else got = lhs.split('.').reduce((o, k) => (o == null ? undefined : o[k]), J);
    const ok = typeof got === 'number' ? Math.abs(got - Number(expected)) <= 0.5 * 10 ** -(expected.split('.')[1]?.length ?? 0) : String(got) === expected;
    if (!ok) { console.error(`expect ${lhs} = ${expected}, got ${got}`); failures++; }
  }
}
if (failures) { console.error(`${failures} failure(s)`); process.exit(1); }
console.log('check_report: REPORT.md matches the run JSON' + (ei > 0 ? '; all expectations hold' : ''));

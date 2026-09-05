// validation/nab/null-survival/analysis/check_report.mjs — pins REPORT.md to the run JSON by re-rendering and
// diffing (exit 1 on drift), then checks any `--expect <file>` of `selector = value` lines. Selectors:
// cells[arm,construction,level].field, monitor[arm,kind].field, p4[construction,level].field, manifest.field.
import fs from 'node:fs';
import path from 'node:path';
import { render } from './report.mjs';
const runDir = path.resolve(process.argv[2]);
const committed = fs.readFileSync(path.join(runDir, 'REPORT.md'), 'utf8');
const fresh = render(runDir);
let failures = 0;
if (committed !== fresh) { failures++; const a = committed.split('\n'), b = fresh.split('\n'); for (let i = 0; i < Math.max(a.length, b.length); i++) if (a[i] !== b[i]) { console.error(`REPORT.md drift at line ${i + 1}:\n  committed: ${a[i]}\n  fresh:     ${b[i]}`); break; } }
const J = (n) => JSON.parse(fs.readFileSync(path.join(runDir, n), 'utf8'));
const manifest = J('manifest.json');
if (manifest.exceptions !== 0) { console.error(`manifest records ${manifest.exceptions} exceptions`); failures++; }
const ei = process.argv.indexOf('--expect');
if (ei > 0) {
  const D = { cells: J('cells.json'), monitor: J('monitor_cells.json'), p4: J('p4.json'), manifest };
  for (const raw of fs.readFileSync(process.argv[ei + 1], 'utf8').split('\n')) {
    const line = raw.trim(); if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('='); const lhs = line.slice(0, eq).trim(), expected = line.slice(eq + 1).trim();
    let got;
    const sel = /^(cells|monitor|p4)\[([^\]]+)\]\.(\w+)$/.exec(lhs);
    if (sel) {
      const k = sel[2].split(',').map((s) => s.trim());
      const hit = D[sel[1]].filter((c) => (sel[1] === 'cells' ? c.arm === k[0] && c.construction === k[1] && String(c.level) === k[2]
        : sel[1] === 'monitor' ? c.arm === k[0] && c.kind === k[1] : c.construction === k[0] && String(c.level) === k[1]));
      if (hit.length !== 1) { console.error(`selector ${lhs} matched ${hit.length}`); failures++; continue; }
      got = hit[0][sel[3]];
    } else got = lhs.split('.').reduce((o, kk) => (o == null ? undefined : o[kk]), D);
    const ok = typeof got === 'number' && !Number.isNaN(Number(expected)) ? Math.abs(got - Number(expected)) <= 0.5 * 10 ** -(expected.split('.')[1]?.length ?? 0) : String(got) === expected;
    if (!ok) { console.error(`expect ${lhs} = ${expected}, got ${got}`); failures++; }
  }
}
if (failures) { console.error(`${failures} failure(s)`); process.exit(1); }
console.log('check_report: REPORT.md matches the run JSON' + (ei > 0 ? '; all expectations hold' : ''));

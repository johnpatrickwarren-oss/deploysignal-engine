// Re-renders REPORT.md from the run's summary.json + manifest.json and requires byte equality.
//   node validation/e-detector-cert/analysis/check_report.mjs <run-dir>
import fs from 'node:fs';
import path from 'node:path';
import { render } from './report.mjs';
const dir = process.argv[2];
if (!dir) { console.error('usage: check_report.mjs <run-dir>'); process.exit(2); }
const summary = JSON.parse(fs.readFileSync(path.join(dir, 'summary.json'), 'utf8'));
const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
const expected = render(summary, manifest);
const actual = fs.readFileSync(path.join(dir, 'REPORT.md'), 'utf8');
if (expected !== actual) { console.error('REPORT.md does not match its data'); process.exit(1); }
console.log(`ok: REPORT.md matches summary.json (${summary.cells.length} cells)`);

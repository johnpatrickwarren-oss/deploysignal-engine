// Pins every number in REPORT.md to the run artifacts. Exit 1 on drift.
import fs from 'node:fs'; import path from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const STUDY = path.dirname(HERE);
const runDir = process.argv[2] ?? fs.readdirSync(path.join(STUDY, 'results', 'live'))
  .filter((d) => d.startsWith('power-')).sort().pop();
const abs = path.isAbsolute(runDir) ? runDir : path.join(STUDY, 'results', 'live', runDir);
const { cells } = JSON.parse(fs.readFileSync(path.join(abs, 'summary.json'), 'utf8'));
const report = fs.readFileSync(path.join(STUDY, 'REPORT.md'), 'utf8');
const get = (det, nul, shift) => cells.find(
  (c) => c.detector === det && c.null_id === nul && c.shift_sigma === shift);
let bad = 0;
const pin = (label, actual, expected) => {
  const ok = String(actual) === String(expected);
  if (!ok) { bad += 1; console.error(`DRIFT ${label}: artifact=${actual} report=${expected}`); }
  else console.log(`  ok  ${label} = ${actual}`);
};
const f4 = (x) => x.toFixed(4);
// Every figure quoted in REPORT.md, in order of appearance.
pin('betting N1 3.00', f4(get('family_A_betting_e_process', 'N1', 3).detection_rate), '1.0000');
pin('betting N1 0.75', f4(get('family_A_betting_e_process', 'N1', 0.75).detection_rate), '1.0000');
pin('betting N5 3.00', f4(get('family_A_betting_e_process', 'N5', 3).detection_rate), '0.0000');
pin('betting N5 0.75', f4(get('family_A_betting_e_process', 'N5', 0.75).detection_rate), '0.0000');
pin('betting N3-p09 0.75', f4(get('family_A_betting_e_process', 'N3-p09', 0.75).detection_rate), '0.2155');
pin('mixture N3-p09 0.75', f4(get('family_A_mixture_supermartingale', 'N3-p09', 0.75).detection_rate), '0.0000');
pin('mixture N4-p09 0.75', f4(get('family_A_mixture_supermartingale', 'N4-p09-m100', 0.75).detection_rate), '0.1615');
pin('mixture N5 verdict', get('family_A_mixture_supermartingale', 'N5', 3).verdict, 'NOT-EXECUTABLE');
pin('mixture N5 nonfinite', get('family_A_mixture_supermartingale', 'N5', 3).non_finite_wealth, 2000);
pin('spectral N1 3.00', f4(get('family_D_spectral_e_detector', 'N1', 3).detection_rate), '0.0000');
// Structural invariants the report asserts.
const totalFail = cells.reduce((a, c) => a + c.adapter_failures, 0);
pin('adapter failures across all cells', totalFail, 0);
const inertClearedCells = cells.filter((c) => c.verdict === 'INERT').length;
pin('INERT cell count', inertClearedCells, 27);
const inertExD = cells.filter((c) => c.verdict === 'INERT'
  && c.detector !== 'family_D_spectral_e_detector').length;
pin('INERT excluding family D', inertExD, 5);
for (const n of ['1.0000', '0.0000', '0.2155', '0.1615', 'NOT-EXECUTABLE', '27 of 42', '5 genuinely inert']) {
  if (!report.includes(n)) { bad += 1; console.error(`DRIFT: REPORT.md does not contain ${n}`); }
}
console.log(bad === 0 ? '\ncheck_report: OK' : `\ncheck_report: ${bad} DRIFT`);
process.exit(bad === 0 ? 0 : 1);

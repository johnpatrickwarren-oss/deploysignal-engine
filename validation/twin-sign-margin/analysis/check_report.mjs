// analysis/check_report.mjs — machine-checks REPORT.md against the run artifacts. Exit 1 on drift.
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const HERE = dirname(fileURLToPath(import.meta.url));
const STUDY = join(HERE, '..');
const report = readFileSync(join(STUDY, 'REPORT.md'), 'utf8');
const runs = readdirSync(join(STUDY, 'results')).filter((d) => d.startsWith('run-')).sort();
let failed = 0; const check = (n, ok) => { if (!ok) { console.error(`FAIL ${n}`); failed++; } };
check('exactly one run', runs.length === 1 && runs[0] === 'run-20260929T202805Z' && report.includes(runs[0]));
const R = join(STUDY, 'results', runs[0]);
const cells = JSON.parse(readFileSync(join(R, 'cells.json'), 'utf8'));
const E = JSON.parse(readFileSync(join(R, 'endpoints.json'), 'utf8'));
const replay = JSON.parse(readFileSync(join(R, 'replay.json'), 'utf8'));
const M = JSON.parse(readFileSync(join(R, 'manifest.json'), 'utf8'));
const cell = (id) => cells.find((c) => c.id === id);
// at run time only dist/ (rebuilt from the committed source, committed next) was modified; the report says so
check('manifest', M.R === 1000 && Math.abs(M.BAR - 0.0678) < 5e-5 && M.smoke === false && M.tracked_changes.every((l) => /^ ?M dist\//.test(l)) && M.tracked_changes.length === 6 && report.includes(M.engine_head.slice(0, 7)) && M.replay_files.length === 44 && report.includes('six compiled files under `dist/`'));
check('E1', E.E1.verdict === 'PASS' && cell('V-m0.02-d0').rollbackRate === 0 && cell('V-m0.02-d0.005').rollbackRate === 0.001 && cell('V-m0.02-d0.01').rollbackRate === 0 && cell('V-m0.02-d0.018').rollbackRate === 0.037 && report.includes('δ 0.018: 0.0370'));
check('E2', E.E2.verdict === 'PASS' && cell('M-m0-d0.01').rollbackRate === 1 && cell('M-m0-d0.01').medianRollbackTick === 31 && cell('M-m0-d0.01').rollbackBy60 === 0.769 && report.includes('1.0000 (median tick 31; 0.769 by tick 60)'));
check('E3', E.E3.verdict === 'PASS' && cell('P-m0.02-r0.08').rollbackBy60 === 1 && cell('P-m0.02-r0.08').medianRollbackTick === 8 && cell('P-m0.02-r0.04').rollbackBy60 === 1 && cell('P-m0.02-r0.04').medianRollbackTick === 11 && cell('P-m0.02-r0.03').rollbackBy60 === 0.782 && cell('P-m0.02-r0.03').medianRollbackTick === 31 && report.includes('0.782 by tick 60, median 31'));
check('E4', E.E4.verdict === 'PASS' && cell('Q-m0.02-r0.01').proceedRate === 1 && cell('Q-m0.02-r0.01').medianProceedTick === 17 && cell('Q-m0.02-r0.01').rollbackRate === 0.002 && cell('Q-m0.02-r0.08-proceed').proceedRate === 0 && report.includes('proceed 1.0000 (median 17), rollback 0.0020'));
check('E5 replay', replay.files === 44 && replay.margins['0'].rollbacks === 12 && replay.margins['0.1'].rollbacks === 2 && replay.margins['0.25'].rollbacks === 0 && replay.margins['0.5'].rollbacks === 0 && report.includes('m 0: 12/44; m 0.10: 2/44; m 0.25: 0/44; m 0.50: 0/44'));
check('replay m=0 reproduces the T3 rollback set', replay.margins['0'].runs.map((r) => r.run).sort((a, b) => a - b).join(',') === '26,29,32,35,39,44,45,47,54,57,59,62');
check('mislabelled cell reported', cell('V-m0-d0').rollbackRate === 0.144 && cell('V-m0-d0').medianRollbackTick === 56 && E.twin_null_P1_reproduced === 'FAIL' && report.includes('Measured 0.1440 (median tick 56)') && report.includes('A registration error, stated'));
check('ship rule', E.ship_rule === 'MET' && report.includes('Ship rule: MET') && report.includes('P5 not held'));
if (failed) { console.error(`${failed} check(s) failed`); process.exit(1); }
console.log(`check_report: all checks passed (${runs[0]})`);

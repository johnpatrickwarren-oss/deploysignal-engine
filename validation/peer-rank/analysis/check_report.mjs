import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const HERE = dirname(fileURLToPath(import.meta.url)); const STUDY = join(HERE, '..');
const RUN = 'run-20261003T131016Z';
const report = readFileSync(join(STUDY, 'REPORT.md'), 'utf8');
const J = JSON.parse(readFileSync(join(STUDY, 'results', RUN, 'results.json'), 'utf8'));
let failed = 0; const check = (n, ok) => { if (!ok) { console.error(`FAIL ${n}`); failed++; } };
const by = Object.fromEntries(J.results.map((r) => [r.cell, r]));
const X = { 'S2-rep': [0, null, 'PASS'], 'V4-m0.02': [0, null, 'PASS'], 'V16-m0.02': [0, null, 'PASS'], 'V4-d0.01': [0.0001, 22, 'PASS'], 'V4-d0.018': [0.0405, 25, 'PASS'], 'M4-m0-d0.01': [1, 23, 'reported'], 'P4-r0.04': [0.9999, 12, 'PASS'], 'P16-r0.04': [1, 12, 'reported'], 'P4-r0.03': [1, 24, 'reported'], 'Q4-r0.01': [0.0003, null, 'PASS'] };
check('run pinned', report.includes(RUN) && J.R === 10000 && J.engine.sha.startsWith('af805e8') && J.engine.dirty.length === 0 && report.includes('`af805e8`'));
check('bar', Math.abs(J.BAR - 0.0556) < 5e-5 && report.includes('bar 0.0556'));
check('cells in order', J.results.map((r) => r.cell).join() === Object.keys(X).join());
for (const [c, [rb, med, v]] of Object.entries(X)) { const r = by[c]; check(`${c}: ${rb} ${med} ${v}`, Math.abs(r.rollback - rb) < 5e-5 && (med === null ? r.rollback === 0 || c === 'Q4-r0.01' : r.tick.median === med) && r.verdict === v); }
check('V4-d0.018 by60 and p90', Math.abs(by['V4-d0.018'].rollback_by_60 - 0.0356) < 5e-5 && by['V4-d0.018'].tick.p90 === 70 && by['V4-d0.018'].tick.q25 === 17 && by['V4-d0.018'].tick.q75 === 41);
check('P4 by60, p90s', Math.abs(by['P4-r0.04'].rollback_by_60 - 0.9999) < 5e-5 && by['P4-r0.04'].tick.p90 === 20 && by['P16-r0.04'].tick.p90 === 17 && Math.abs(by['P4-r0.03'].rollback_by_60 - 0.9139) < 5e-5 && Math.abs(by['M4-m0-d0.01'].rollback_by_60 - 0.9129) < 5e-5);
check('Q4 proceed 0.9997 median 14', Math.abs(by['Q4-r0.01'].proceed - 0.9997) < 5e-5 && by['Q4-r0.01'].proceed_tick_median === 14 && report.includes('proceed 0.9997, median tick 14'));
check('S2 reproduction', by['S2-rep'].rep_max_rel_diff === 0 && report.includes('max relative wealth difference from the sign kind 0'));
check('endpoints', ['E1', 'E2', 'E3', 'E4'].every((e) => J.endpoints[e] === 'PASS') && J.ship_rule === 'MET' && report.includes('Ship rule MET'));
for (const q of ['fc71953', 'did not (a scripted edit failed before writing)', 'ADR 0039 ACCEPTED', '4.05%']) check(`quotes ${q}`, report.includes(q));
if (failed) { console.error(`${failed} check(s) failed`); process.exit(1); }
console.log('check_report: all checks passed');

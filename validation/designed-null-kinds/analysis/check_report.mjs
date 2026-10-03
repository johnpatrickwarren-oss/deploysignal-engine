// analysis/check_report.mjs — pins REPORT.md to results/run-20261003T123340Z/results.json. Exit 1 on drift.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const HERE = dirname(fileURLToPath(import.meta.url)); const STUDY = join(HERE, '..');
const RUN = 'run-20261003T123340Z';
const report = readFileSync(join(STUDY, 'REPORT.md'), 'utf8');
const J = JSON.parse(readFileSync(join(STUDY, 'results', RUN, 'results.json'), 'utf8'));
let failed = 0; const check = (n, ok) => { if (!ok) { console.error(`FAIL ${n}`); failed++; } };
const by = Object.fromEntries(J.results.map((r) => [r.cell, r]));
const X = {
  'R0-rep': [0.0009, [54, 48, 57, 59, 39, 59], 'PASS'], 'V-m0.2-ψ1': [0, null, 'PASS'], 'V-m0.2-ψ1.1': [0, null, 'PASS'], 'V-m0.2-ψ1.2': [0.0113, [180, 134, 236, 283, 66, 300], 'PASS'],
  'H-m0.2-ψ1': [0, null, 'reported'], 'P-m0.2-ψ1.5': [0.2576, [52, 47, 57, 59, 24, 60], 'reported'], 'P-m0.2-ψ2.0': [0.9996, [32, 28, 35, 39, 18, 60], 'PASS'], 'P-m0.2-ψ3.0': [1, [19, 18, 21, 22, 14, 27], 'reported'],
  'IV-ε0.002-f0': [0, null, 'PASS'], 'IV-ε0.002-f0.001': [0, null, 'PASS'], 'IV-ε0.002-f0.002': [0, null, 'PASS'], 'IV-ε0.002-λ50': [0, null, 'reported'],
  'IP-ε0.002-f0.005': [1, [9, 9, 10, 10, 7, 13], 'PASS'], 'IP-ε0.002-f0.01': [1, [6, 6, 7, 7, 6, 8], 'reported'], 'IP-ε0.002-f0.003': [1, [22, 19, 25, 29, 11, 46], 'reported'],
};
check('run pinned', report.includes(RUN) && J.R === 10000 && J.SEED0 === 20261003 && J.engine.sha.startsWith('5a67a3c') && J.engine.dirty.length === 0 && report.includes('`5a67a3c`'));
check('bar', Math.abs(J.BAR - 0.0556) < 5e-5 && report.includes('bar 0.0556'));
check('15 cells in order', J.results.map((r) => r.cell).join() === Object.keys(X).join());
let halts = 0, proceeds = 0;
for (const [c, [fired, t, v]] of Object.entries(X)) {
  const r = by[c]; halts += r.halts; proceeds += r.proceeds;
  check(`${c}: fired ${fired}`, Math.abs(r.fired - fired) < 5e-5 && r.R === 10000 && r.verdict === v);
  if (t) check(`${c}: ticks`, [r.tick.median, r.tick.q25, r.tick.q75, r.tick.p90, r.tick.min, r.tick.max].every((x, i) => x === t[i]));
  else check(`${c}: no rollbacks`, r.tick.median === null);
}
check('0 halts in 150,000; proceeds stated', halts === 0 && by['V-m0.2-ψ1'].proceeds === 8431 && by['V-m0.2-ψ1.1'].proceeds === 476 && by['H-m0.2-ψ1'].proceeds === 9995 && report.includes('0 sample-ratio halts in 150,000') && report.includes('ended 8,431 of the V-m0.2-ψ1 replications, 476 of V-m0.2-ψ1.1 and 9,995 of H-m0.2-ψ1'));
const PH = JSON.parse(readFileSync(join(STUDY, 'results', RUN, 'posthoc-noproceed.json'), 'utf8'));
check('post-hoc no-proceed rerun matches the registered rollback rates', PH.posthoc === true && PH.results.map((r) => r.rollback).join() === '0,0,0.0113,0' && report.includes('give rollback 0.0000, 0.0000,\n0.0113 and 0.0000, identical to the registered run'));
check('E2 max score difference 0', by['R0-rep'].score_max_diff === 0 && report.includes('max score difference 0'));
check('endpoints and ship rule', ['E1', 'E2', 'E3', 'E4'].every((e) => J.endpoints[e] === 'PASS') && J.ship_rule === 'MET' && report.includes('Ship rule MET'));
for (const q of ['0.934 to 0.258', 'median of 32 ticks', 'f 0.003 detected 1.000 by 60 against a predicted 0.3–0.7', 'fired in 0 of 200 runs at 2.5× the tolerance', 'ADR 0038 ACCEPTED']) check(`quotes ${q}`, report.includes(q));
if (failed) { console.error(`${failed} check(s) failed`); process.exit(1); }
console.log('check_report: all checks passed');

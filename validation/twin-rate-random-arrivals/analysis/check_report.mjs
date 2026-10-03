// analysis/check_report.mjs — pins REPORT.md's numbers to results/run-20261003T045238Z/results.json. Exit 1 on drift.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const HERE = dirname(fileURLToPath(import.meta.url));
const STUDY = join(HERE, '..');
const RUN = 'run-20261003T045238Z';
const report = readFileSync(join(STUDY, 'REPORT.md'), 'utf8');
const J = JSON.parse(readFileSync(join(STUDY, 'results', RUN, 'results.json'), 'utf8'));
let failed = 0; const check = (n, ok) => { if (!ok) { console.error(`FAIL ${n}`); failed++; } };
const by = Object.fromEntries(J.results.map((r) => [r.cell, r]));
const X = {
  'N-R': { rb: 0, t: [null, null, null, null, null, null, null], v: 'PASS' },
  'D-1.5': { rb: 1, t: [40, 40, 41, 41, 42, 38, 43], v: 'PASS' },
  'D-2.0': { rb: 1, t: [25, 25, 26, 26, 26, 24, 26], v: 'PASS' },
  'R-1.5': { rb: 0.9343, t: [43, 38, 49, 54, 60, 21, 60], v: 'reported' },
  'R-2.0': { rb: 1, t: [26, 24, 29, 31, 36, 17, 42], v: 'reported' },
  'R-1.2': { rb: 0.0561, t: [54, 49, 58, 59, 60, 31, 60], v: 'reported' },
};
check('run pinned', report.includes(RUN) && J.R === 10000 && J.T === 60 && J.SEED0 === 20261003 && J.TRAFFIC === 2440 && J.P0 === 0.005 && J.PROCS === 4);
check('engine pin', J.engine.version === '0.13.0-pre' && J.engine.sha.startsWith('ecb1901') && J.engine.dirty.length === 0 && report.includes('`ecb1901`'));
check('bar', Math.abs(J.BAR - 0.0556) < 5e-5 && report.includes('bar 0.0556'));
check('six cells in order', J.results.map((r) => r.cell).join() === Object.keys(X).join());
for (const [c, x] of Object.entries(X)) {
  const r = by[c]; const t = r.tick;
  check(`${c}: rollback_by_60 ${x.rb}`, Math.abs(r.rollback_by_60 - x.rb) < 5e-5 && r.R === 10000 && Math.abs(r.rollback_by_60 + r.undecided_at_60 - 1) < 1e-9);
  check(`${c}: ticks`, [t.median, t.q25, t.q75, t.p90, t.p99, t.min, t.max].every((v, i) => v === x.t[i]));
  check(`${c}: verdict ${x.v}`, r.verdict === x.v && r.halts === 0 && r.proceeds === 0 && r.rollbacks_not_on_http_5xx_alone === 0);
  check(`${c}: control faults 6.0–6.1`, r.mean_events_per_tick.control >= 6.0 && r.mean_events_per_tick.control <= 6.11);
}
check('endpoints', J.endpoints.E1 === 'PASS' && J.endpoints.E2 === 'PASS' && report.includes('E1 PASS, E2 PASS, E3 reported'));
check('R-1.5 undecided 657 = 6.6%', by['R-1.5'].inconclusive === 657 && report.includes('6.6% of 10,000') && report.includes('(657)'));
check('canary faults', Math.abs(by['R-1.5'].mean_events_per_tick.canary - 9.18) < 0.006 && Math.abs(by['D-1.5'].mean_events_per_tick.canary - 9.13) < 0.006 && Math.abs(by['R-1.2'].mean_events_per_tick.canary - 7.32) < 0.006);
for (const s of ['0.934', '**43**, 38–49, 54, 60, 21–60', '26, 24–29, 31, 36, 17–42', '54, 49–58, 59, 60, 31–60', 'Prediction P3 was wrong', 'I registered 0.45–0.75', 'the point figure is 0', '0 sample-ratio halts, 0 proceeds, in 60,000']) check(`quotes ${s}`, report.includes(s));
if (failed) { console.error(`${failed} check(s) failed`); process.exit(1); }
console.log('check_report: all checks passed');

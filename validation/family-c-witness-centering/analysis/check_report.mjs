// analysis/check_report.mjs — pins every number in REPORT.md to the canonical run's
// artifacts. Exit 1 on drift. Bound to the run by constant, per the family-d-emean
// convention.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const STUDY = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const RUN = 'run-20260820T025417Z';
const dir = path.join(STUDY, 'results', 'live', RUN);
const report = fs.readFileSync(path.join(STUDY, 'REPORT.md'), 'utf8');
const e = JSON.parse(fs.readFileSync(path.join(dir, 'endpoints-witness-centering.json'), 'utf8'));
const cell = (id) => JSON.parse(fs.readFileSync(path.join(dir, 'cells', `${id}.json`), 'utf8'));

let bad = 0;
const pin = (label, str) => {
  if (!report.includes(String(str))) { console.error(`DRIFT ${label}: "${str}"`); bad++; }
};
const expect = (label, cond) => { if (!cond) { console.error(`DRIFT ${label}`); bad++; } };

// E0
expect('executable', e.executable === true);
expect('E0 anchors pass', e.E0.anchors.pass === true);
pin('anchor corr', e.E0.anchors.corr.measured.toFixed(6));
pin('anchor diag', e.E0.anchors.diag.measured.toFixed(6));
expect('E0 determinism', e.E0.determinism.repro_mismatches === 0);
expect('E0 consistency < 1e-9', e.E0.witness_consistency.consistency_max < 1e-9);
pin('consistency magnitude', '4.5×10⁻¹⁵');
expect('consistency magnitude exact', Math.abs(e.E0.witness_consistency.consistency_max - 4.496403249731884e-15) < 1e-20);

// E1
expect('E1 verdict', e.E1.verdict === 'REFUTED-as-predicted');
pin('E1 corr mean', e.E1.corr.mean.toFixed(6));
pin('E1 corr L95', e.E1.corr.lower95.toFixed(6));
pin('E1 diag mean', e.E1.diag.mean.toFixed(6));
pin('E1 diag L95', e.E1.diag.lower95.toFixed(6));

// E1b
expect('E1b', e.E1b.verdict === 'HELD');
pin('E1b corr', e.E1b.corr.toFixed(6));
pin('E1b diag', e.E1b.diag.toFixed(6));

// E2 — the λ·b channel equals the excess
expect('E2', e.E2.verdict === 'HELD');
pin('E2 corr λb', (e.E2.corr.lambda_b.mean * 1e3).toFixed(3) + '×10⁻³');
pin('E2 corr λb L95', (e.E2.corr.lambda_b.lower95_one_sided * 1e3).toFixed(3) + '×10⁻³');
pin('E2 diag λb', (e.E2.diag.lambda_b.mean * 1e3).toFixed(3) + '×10⁻³');
expect('E2 channel-accounting agreement corr',
  Math.abs(e.E2.corr.lambda_b.mean - (e.E1.corr.mean - 1)) < 2e-6);
pin('E2 λb 4-digit', (e.E2.corr.lambda_b.mean * 1e3).toFixed(4) + '×10⁻³');
pin('E1 excess 4-digit', ((e.E1.corr.mean - 1) * 1e3).toFixed(4) + '×10⁻³');
expect('E2 corr residuals within se bars',
  Math.abs(e.E2.corr.lambda_F_minus_b.mean) <= 0.5 * e.E2.corr.lambda_F_minus_b.se
  && Math.abs(e.E2.corr.F_minus_b.mean) <= 1.0 * e.E2.corr.F_minus_b.se);

// E3
expect('E3', e.E3.verdict === 'HELD');
pin('E3 corr', `${e.E3.corr.pos.toFixed(4)} vs ${e.E3.corr.neg.toFixed(4)}`);
pin('E3 diag', `${e.E3.diag.pos.toFixed(4)} vs ${e.E3.diag.neg.toFixed(4)}`);

// E4
expect('E4', e.E4.verdict === 'HELD');
pin('E4 corr', e.E4.corr.mean.toFixed(6));
pin('E4 corr L95', e.E4.corr.lower95.toFixed(6));
pin('E4 diag', e.E4.diag.mean.toFixed(6));

// E5
pin('E5 S900 corr', e.E5.corr.t900.mean.toFixed(2));
pin('E5 S900 diag', e.E5.diag.t900.mean.toFixed(2));
pin('E5 crossing corr', (e.E5.corr.crossing.alpha05_full * 100).toFixed(2) + '%');
pin('E5 crossing diag', (e.E5.diag.crossing.alpha05_full * 100).toFixed(2) + '%');
expect('E5 shipped-threshold crossings zero',
  e.E5.corr.crossing.shipped_full === 0 && e.E5.diag.crossing.shipped_full === 0);

// E6
pin('E6 leg500 corr inc', e.E6['LEG500-corr-T300'].increment.mean.toFixed(4));
pin('E6 leg8000 corr inc', e.E6['LEG8000-corr-T300'].increment.mean.toFixed(4));
// The report uses the typographic minus sign; normalize pins to it.
const tmin = (s) => String(s).replace(/^-/, '−');
pin('E6 leg500 corr F', tmin(e.E6['LEG500-corr-T300'].mean_F.mean.toFixed(3)));
pin('E6 leg8000 corr F', tmin(e.E6['LEG8000-corr-T300'].mean_F.mean.toFixed(3)));
expect('E6 clamp neg saturation', ['LEG500-corr-T300', 'LEG500-diag-T300', 'LEG8000-corr-T300', 'LEG8000-diag-T300']
  .every((id) => e.E6[id].clamp.neg > 0.97));

// Block decay sequence on the corr cell
const blocks = cell('EXACT-corr-T900').blocks;
pin('block [11,50]', blocks.find((b) => b.from === 11).mean.toFixed(4));
pin('block (600,900]', blocks.find((b) => b.from === 601).mean.toFixed(6));

// Hygiene counters
expect('caught failures 0', e.caught_failures === 0);
const ec = cell('EXACT-corr-T900');
expect('floor/suppressed 0', ec.floor_events === 0 && ec.suppressed_ticks === 0);

// z-statistic quoted in the discussion
const z = (e.E1.corr.mean - 1) / ((e.E1.corr.mean - e.E1.corr.lower95) / 1.645);
expect('z ≈ 92', Math.abs(z - 92) < 1.5);
pin('z quote', 'z ≈ +92');

if (bad) { console.error(`${bad} drift(s)`); process.exit(1); }
console.log(`REPORT.md is consistent with ${RUN}`);

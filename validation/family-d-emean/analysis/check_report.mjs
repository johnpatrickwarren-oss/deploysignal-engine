// analysis/check_report.mjs — pins every number in the canonical run's REPORT.md to that run's
// artifacts. Exit 1 on drift. No parameters: the checker is BOUND to the canonical run by the
// constant below (Amendment A1 correction append, item 6 — pinned strings include run-specific
// measured values, so pointing this at another run would report drift when nothing drifted).
// A superseding run updates the constant and the pins together, as one reviewed change.
//
// Every pinned string is DERIVED from the artifacts here and required to appear verbatim in
// REPORT.md — the runway test_report_consistency pattern (methodology/pre-registration-discipline).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const STUDY = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const CANONICAL_RUN = 'run-20260818T222835Z';
const runDir = path.join(STUDY, 'results', 'live', CANONICAL_RUN);

const report = fs.readFileSync(path.join(runDir, 'REPORT.md'), 'utf8');
const cell = (id) => JSON.parse(fs.readFileSync(path.join(runDir, 'cells', `${id}.json`), 'utf8'));
const endpoints = JSON.parse(fs.readFileSync(path.join(runDir, 'endpoints-family-d-emean.json'), 'utf8'));
const manifest = JSON.parse(fs.readFileSync(path.join(runDir, 'manifest.json'), 'utf8'));

let failures = 0;
const pin = (label, str) => {
  if (!report.includes(str)) {
    console.error(`DRIFT ${label}: "${str}" not found in REPORT.md`);
    failures++;
  }
};
const expect = (label, cond) => {
  if (!cond) { console.error(`DRIFT ${label}`); failures++; }
};

const f6 = (x) => x.toFixed(6);
const Z95 = 1.6448536269514722, Z975 = 1.959963984540054;

// §1 — E1 cells, verdicts, guards
for (const [id, T, wantVerdict] of [['N1-exact-T300', 300, 'not-refuted'], ['N1-exact-T900', 900, 'FAIL']]) {
  const c = cell(id);
  pin(`${id} mean`, f6(c.e_mean));
  pin(`${id} lower`, f6(c.e_mean_lower_95));
  const e1 = endpoints.e1.find((e) => e.horizon_ticks === T);
  expect(`E1@${T} verdict ${wantVerdict}`, e1.verdict === wantVerdict);
}
pin('guard dMu', endpoints.guard.dMu.toExponential(3));
pin('residual', endpoints.analytic_residual_log_c.toExponential(3));
pin('exact T900 top1', cell('N1-exact-T900').top1_share.toFixed(4));

// §2 — the K grid: means, lower bounds, and the finite-K refutations the REPORT claims
for (const id of ['N1-ptK400-T300', 'N1-ptK400-T900', 'N1-ptK100-T300', 'N1-ptK100-T900']) {
  const c = cell(id);
  pin(`${id} mean`, f6(c.e_mean));
  pin(`${id} lower`, f6(c.e_mean_lower_95));
  expect(`${id} lower bound > 1`, c.e_mean_lower_95 > 1);
}
for (const id of ['N1-sharedK400-T900', 'N1-sharedK100-T900']) {
  const c = cell(id);
  pin(`${id} mean`, f6(c.across_draw_mean));
  pin(`${id} sd`, f6(c.across_draw_sd));
  pin(`${id} p05`, f6(c.across_draw_p05));
  pin(`${id} p95`, f6(c.across_draw_p95));
}
// the K-ordering claim
for (const T of [300, 900]) {
  expect(`ordering exact < K400 < K100 @T${T}`,
    cell(`N1-exact-T${T}`).e_mean < cell(`N1-ptK400-T${T}`).e_mean
    && cell(`N1-ptK400-T${T}`).e_mean < cell(`N1-ptK100-T${T}`).e_mean);
}

// §3 — committed comparison and the ptK400 condition-question CIs
for (const cmp of endpoints.committed_comparison) {
  pin(`committed@${cmp.horizon_ticks} lo`, f6(cmp.ci95[0]));
  pin(`committed@${cmp.horizon_ticks} hi`, f6(cmp.ci95[1]));
  expect(`committed@${cmp.horizon_ticks} consistent`, cmp.consistent === true);
}
for (const [id] of [['N1-ptK400-T300'], ['N1-ptK400-T900']]) {
  const c = cell(id);
  const se = (c.e_mean - c.e_mean_lower_95) / Z95;
  pin(`${id} ci lo`, f6(c.e_mean - Z975 * se));
  pin(`${id} ci hi`, f6(c.e_mean + Z975 * se));
}

// §4 — control
const ctrl = cell('N7-rolling-T300');
pin('control log10 mean', ctrl.log10_e_mean.toFixed(4));
pin('control crossing', String(ctrl.crossing_rate_shipped_threshold));
pin('control top1', ctrl.top1_share.toFixed(4));
expect('executable', endpoints.executable === true);
for (const id of ['N1-exact-T300', 'N1-exact-T900', 'N1-ptK100-T300', 'N1-ptK100-T900', 'N1-ptK400-T300', 'N1-ptK400-T900']) {
  expect(`${id} crossing 0`, cell(id).crossing_rate_shipped_threshold === 0);
}

// provenance — mode, supersession, sizes
expect('mode live', manifest.mode === 'live');
expect('supersedes declared', manifest.supersedes?.[0]?.run === 'run-20260818T220621Z');
pin('sizes N', `N = ${manifest.sizes.N_FULL.toLocaleString('en-US')}`);
pin('supersedes named', 'run-20260818T220621Z');

if (failures) { console.error(`${failures} drift(s)`); process.exit(1); }
console.log(`REPORT.md is consistent with the ${CANONICAL_RUN} artifacts`);

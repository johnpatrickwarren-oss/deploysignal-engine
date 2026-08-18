// analysis/check_report.mjs — pins every number in the run REPORT.md to the run artifacts.
// Exit 1 on drift. Usage: node analysis/check_report.mjs [runDir]
//
// The check recomputes each pinned string from cells/*.json, endpoints-family-d-emean.json and
// manifest.json and requires the literal formatted string to appear in REPORT.md — the runway
// test_report_consistency pattern (methodology/pre-registration-discipline).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const STUDY = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const runDir = process.argv[2]
  ?? path.join(STUDY, 'results', 'live', 'run-20260818T220621Z');

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

const f6 = (x) => x.toFixed(6);

// §1 — E1 cells and verdicts
for (const [id, T] of [['N1-exact-T300', 300], ['N1-exact-T900', 900]]) {
  const c = cell(id);
  pin(`${id} mean`, f6(c.e_mean));
  pin(`${id} lower`, f6(c.e_mean_lower_95));
  const e1 = endpoints.e1.find((e) => e.horizon_ticks === T);
  if (e1.verdict !== 'not-refuted') { console.error(`DRIFT: E1@${T} verdict is ${e1.verdict}, REPORT says not-refuted`); failures++; }
}
pin('guard dMu', '1.576e-4');
if (Math.abs(endpoints.guard.dMu - 1.576e-4) > 1e-7) { console.error('DRIFT: guard dMu'); failures++; }
pin('residual', '5.677e-4');
if (Math.abs(endpoints.analytic_residual_log_c - 5.677e-4) > 1e-6) { console.error('DRIFT: residual'); failures++; }

// §2 — the K grid
for (const id of ['N1-ptK400-T300', 'N1-ptK400-T900', 'N1-ptK100-T300', 'N1-ptK100-T900']) {
  const c = cell(id);
  pin(`${id} mean`, f6(c.e_mean));
  pin(`${id} lower`, f6(c.e_mean_lower_95));
  if (!(c.e_mean_lower_95 > 1)) { console.error(`DRIFT: ${id} lower bound not > 1, REPORT claims refutation`); failures++; }
}
for (const id of ['N1-sharedK400-T900', 'N1-sharedK100-T900']) {
  const c = cell(id);
  pin(`${id} mean`, f6(c.across_draw_mean));
  pin(`${id} sd`, f6(c.across_draw_sd));
  pin(`${id} p05`, f6(c.across_draw_p05));
  pin(`${id} p95`, f6(c.across_draw_p95));
}

// §3 — committed comparison
for (const cmp of endpoints.committed_comparison) {
  pin(`committed@${cmp.horizon_ticks} lo`, f6(cmp.ci95[0]));
  pin(`committed@${cmp.horizon_ticks} hi`, f6(cmp.ci95[1]));
  if (cmp.consistent !== true) { console.error(`DRIFT: committed@${cmp.horizon_ticks} not consistent, REPORT claims CONSISTENT`); failures++; }
}
// §3 — the ptK400 two-sided CIs quoted for the 2026-08-03 condition question
{
  const Z95 = 1.6448536269514722, Z975 = 1.959963984540054;
  for (const [id, T] of [['N1-ptK400-T300', 300], ['N1-ptK400-T900', 900]]) {
    const c = cell(id);
    const se = (c.e_mean - c.e_mean_lower_95) / Z95;
    pin(`${id} ci lo`, f6(c.e_mean - Z975 * se));
    pin(`${id} ci hi`, f6(c.e_mean + Z975 * se));
  }
}

// §4 — control
const ctrl = cell('N7-rolling-T300');
pin('control log10 mean', ctrl.log10_e_mean.toFixed(4));
pin('control crossing', String(ctrl.crossing_rate_shipped_threshold));
pin('control top1', ctrl.top1_share.toFixed(4));
if (!endpoints.executable) { console.error('DRIFT: endpoints.executable is false'); failures++; }
for (const id of ['N1-exact-T300', 'N1-exact-T900', 'N1-ptK100-T300', 'N1-ptK100-T900', 'N1-ptK400-T300', 'N1-ptK400-T900']) {
  if (cell(id).crossing_rate_shipped_threshold !== 0) { console.error(`DRIFT: ${id} crossing not 0`); failures++; }
}

// header — provenance
pin('sizes N', `N = ${manifest.sizes.N_FULL.toLocaleString('en-US')}`);
if (manifest.mode !== 'live') { console.error('DRIFT: manifest.mode is not live'); failures++; }

if (failures) { console.error(`${failures} drift(s)`); process.exit(1); }
console.log('REPORT.md is consistent with the run artifacts');

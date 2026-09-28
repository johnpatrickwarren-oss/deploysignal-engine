// validation/twin-gate/harness/run.mjs — study 2026-09-twin-gate (ADR 0036, gate level). Registered in
// ../PREREGISTRATION.md (d15ba61) before this file existed; generator, cells, seeds, measures and bars
// are §1–§6 there. Drives the committed dist/ (run `npx tsc` first).
//
//   node validation/twin-gate/harness/run.mjs            full run, R = 1000, writes results/run-<UTC>/
//   node validation/twin-gate/harness/run.mjs --smoke    R = 2 per cell, prints harness failures only

import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const gate = require('../../../dist/per-shard/twin-gate.js');
const twin = require('../../../dist/detectors/twin-contrast.js');
const bet = require('../../../dist/detectors/_paired-bet.js');

const HERE = dirname(fileURLToPath(import.meta.url));
const SMOKE = process.argv.includes('--smoke');
const T = 2000, R = SMOKE ? 2 : 1000, ALPHA = 0.05, TRAFFIC = 2000, P0 = 0.01, DAY = 1440;
const BAR = ALPHA + 2.58 * Math.sqrt((ALPHA * (1 - ALPHA)) / 1000);

// ── Generator primitives, as 2026-09-twin-null ─────────────────────────────────────────────────
function lcg(seed) {
  let s = seed >>> 0;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return (s + 0.5) / 4294967296; };
}
function gaussian(rng) { return Math.sqrt(-2 * Math.log(rng())) * Math.cos(2 * Math.PI * rng()); }
function poisson(rng, mean) {
  if (mean <= 0) return 0;
  if (mean > 30) return Math.max(0, Math.round(mean + Math.sqrt(mean) * gaussian(rng)));
  const L = Math.exp(-mean); let k = 0, p = 1;
  do { k++; p *= rng(); } while (p > L);
  return k - 1;
}
function split(rng, n, q) {
  if (q <= 0) return 0;
  return Math.min(n, Math.max(0, Math.round(n * q + Math.sqrt(n * q * (1 - q)) * gaussian(rng))));
}
function centeredLognormal(rng) { return Math.exp(0.75 * gaussian(rng)) - Math.exp(0.28125); }

// Binomial(n, p): exact (geometric waiting times between successes, the Bernoulli-sum
// distribution) when n p (1 − p) < 30, a rounded clamped normal otherwise (§1).
function binomial(rng, n, p) {
  if (n <= 0 || p <= 0) return 0;
  if (p >= 1) return n;
  if (p > 0.5) return n - binomial(rng, n, 1 - p);
  const v = n * p * (1 - p);
  if (v >= 30) return Math.min(n, Math.max(0, Math.round(n * p + Math.sqrt(v) * gaussian(rng))));
  const lq = Math.log(1 - p);
  let x = 0, k = 0;
  for (;;) {
    x += Math.floor(Math.log(rng()) / lq) + 1;
    if (x > n) return k;
    k++;
  }
}
function oddsShift(p, psi) { return (psi * p) / (1 - p + psi * p); }

// ── Cells, in §3 order ──────────────────────────────────────────────────────────────────────────
const rate = (id) => ({ id, kind: 'rate', worse: 'higher', tolerance: 0.5 });
const sign = (id) => ({ id, kind: 'sign', worse: 'higher', tolerance: 0.1 });
const CELLS = [
  { id: 'G1-N1', metrics: [rate('r0')], bar: 'rollback' },
  { id: 'G1-N3', metrics: [rate('r0'), rate('r1'), sign('s0')], bar: 'rollback' },
  { id: 'G1-N8', metrics: [rate('r0'), rate('r1'), rate('r2'), rate('r3'), sign('s0'), sign('s1'), sign('s2'), sign('s3')], bar: 'rollback' },
  { id: 'G1-N3-dup', metrics: [rate('r0'), rate('r1'), rate('r2')], dup: true, bar: 'rollback' },
  { id: 'G2-null', metrics: [rate('r0')], q: 0.5, bar: 'guard' },
  { id: 'G2-q0.49', metrics: [rate('r0')], q: 0.49, bar: 'rollback' },
  { id: 'G2-q0.45', metrics: [rate('r0')], q: 0.45, bar: 'rollback' },
  { id: 'G2-q0', metrics: [rate('r0')], q: 0, bar: 'rollback' },
  { id: 'G3-mcar0.1', metrics: [rate('r0')], miss: { type: 'mcar', m: 0.1 }, bar: 'rollback' },
  { id: 'G3-mcar0.3', metrics: [rate('r0')], miss: { type: 'mcar', m: 0.3 }, bar: 'rollback' },
  { id: 'G3-mnar-rb', metrics: [rate('r0')], miss: { type: 'mnar-rb' }, bar: 'rollback' },
  { id: 'G3-mnar-rb-skip', metrics: [rate('r0')], miss: { type: 'mnar-rb' }, comparator: true, bar: null, report: 'rollback' },
  { id: 'G3-mnar-pr', metrics: [rate('r0')], mult: 1.5, miss: { type: 'mnar-pr' }, bar: 'proceed' },
  { id: 'G3-mnar-pr-skip', metrics: [rate('r0')], mult: 1.5, miss: { type: 'mnar-pr' }, comparator: true, bar: null, report: 'proceed' },
  ...[0, 0.01, 0.02, 0.05, 0.1, 0.2].map((m) => ({
    id: `G4-m${m}`, metrics: [rate('r0')], mult: 1.2, miss: m > 0 ? { type: 'mcar', m } : null, bar: null, report: 'rollback',
  })),
  { id: 'G5-null-het', metrics: [rate('r0')], bern: { h: 0.01, pHot: 0.95, psi: 1 }, bar: 'rollback' },
  { id: 'G5-hom', metrics: [rate('r0')], bern: { h: 0, pHot: 0, psi: 1.5 }, bar: 'proceed' },
  { id: 'G5-het0.5', metrics: [rate('r0')], bern: { h: 0.01, pHot: 0.5, psi: 1.5 }, bar: null, report: 'proceed' },
  { id: 'G5-het0.95', metrics: [rate('r0')], bern: { h: 0.01, pHot: 0.95, psi: 1.5 }, bar: null, report: 'proceed' },
];

// ── One tick's observations ─────────────────────────────────────────────────────────────────────
function bernoulliArm(rng, n, bern, psi) {
  const nHot = Math.round(n * bern.h), nCold = n - nHot;
  return binomial(rng, nHot, oddsShift(bern.pHot, psi)) + binomial(rng, nCold, oddsShift(0.005, psi));
}
function rateObs(rng, cell, nc, nk, season) {
  if (cell.bern) {
    return { canaryEvents: bernoulliArm(rng, nc, cell.bern, cell.bern.psi), canaryTotal: nc,
      controlEvents: bernoulliArm(rng, nk, cell.bern, 1), controlTotal: nk };
  }
  const p = P0 * season;
  return { canaryEvents: Math.min(nc, poisson(rng, nc * p * (cell.mult ?? 1))), canaryTotal: nc,
    controlEvents: Math.min(nk, poisson(rng, nk * p)), controlTotal: nk };
}
function signObs(rng, nc, nk, season) {
  const shared = 100 * season;
  return { canary: shared + (30 * centeredLognormal(rng)) / Math.sqrt(Math.max(nc, 1)),
    control: shared + (30 * centeredLognormal(rng)) / Math.sqrt(Math.max(nk, 1)) };
}
/** §1 missingness: only a rate observation with bad events, only while the canary takes traffic. */
function absent(rng, miss, obs) {
  if (!miss) return false;
  const u = rng();
  const e = obs.canaryEvents + obs.controlEvents;
  if (obs.canaryTotal === 0 || e === 0) return false;
  if (miss.type === 'mcar') return u < miss.m;
  const x = obs.canaryEvents / e, share = obs.canaryTotal / (obs.canaryTotal + obs.controlTotal);
  if (miss.type === 'mnar-rb') return x < share && u < 0.5;
  return x > share && u < 0.5;   // mnar-pr
}

// ── Shadow of the gate's evidence (§2) ──────────────────────────────────────────────────────────
function initShadow(cell) {
  const metrics = {};
  for (const m of cell.metrics) metrics[m.id] = twin.initTwinMetric();
  return { metrics, srmUp: bet.initPairedBet(), srmDown: bet.initPairedBet() };
}
function stepShadow(cell, sh, nc, nk, observations, absentAsSkip) {
  if (nc + nk > 0) {
    const share = nc / (nc + nk);
    sh.srmUp = bet.updatePairedBet(sh.srmUp, { lo: 0, hi: 1, nullMean: 0.5 }, share);
    sh.srmDown = bet.updatePairedBet(sh.srmDown, { lo: 0, hi: 1, nullMean: 0.5 }, 1 - share);
  }
  for (const m of cell.metrics) {
    const obs = observations[m.id];
    sh.metrics[m.id] = obs !== undefined ? twin.updateTwinMetric(m, sh.metrics[m.id], obs)
      : nc > 0 && !absentAsSkip ? twin.missTwinMetric(sh.metrics[m.id])
      : twin.skipTwinMetric(sh.metrics[m.id]);
  }
}
function shadowEvidence(cell, sh) {
  const n = cell.metrics.length;
  const ev = cell.metrics.map((m) => twin.twinMetricEvidence(sh.metrics[m.id]));
  const srmE = (bet.pairedBetWealth(sh.srmUp) + bet.pairedBetWealth(sh.srmDown)) / 2;
  return {
    ev, srmE,
    rollback: ev.some((e) => e.rollbackE >= n / ALPHA),
    proceed: ev.every((e) => e.proceedE >= 1 / ALPHA),
    guard: srmE >= 1 / ALPHA,
  };
}

// ── One replication ─────────────────────────────────────────────────────────────────────────────
function replicate(cell, rng) {
  const cfg = { metrics: cell.metrics, alphaRollback: ALPHA, alphaProceed: ALPHA, alphaSrm: ALPHA, canaryWeight: 0.5, maxTicks: T };
  let gs = gate.initTwinGate(cfg);
  let verdict = null, verdictTick = null, failures = 0;
  const sh = initShadow(cell);
  const cmp = cell.comparator ? initShadow(cell) : null;
  const first = { rollback: -1, proceed: -1, guard: -1 };
  const firstCmp = { rollback: -1, proceed: -1 };
  for (let t = 0; t < T; t++) {
    const season = 1 + 0.5 * Math.sin((2 * Math.PI * t) / DAY);
    const n = poisson(rng, TRAFFIC * season);
    const nc = split(rng, n, cell.q ?? 0.5), nk = n - nc;
    const observations = {};
    let shared = null;
    for (const m of cell.metrics) {
      let obs;
      if (m.kind === 'sign') obs = signObs(rng, nc, nk, season);
      else if (cell.dup && shared) obs = shared;
      else { obs = rateObs(rng, cell, nc, nk, season); shared = obs; }
      if (m.kind === 'rate' && !(cell.dup && m !== cell.metrics[0]) && absent(rng, cell.miss, obs)) obs = undefined;
      observations[m.id] = obs;
    }
    const input = { canaryRequests: nc, controlRequests: nk, observations };
    stepShadow(cell, sh, nc, nk, observations, false);
    const se = shadowEvidence(cell, sh);
    if (verdict === null) {
      const step = gate.stepTwinGate(cfg, gs, input);
      gs = step.state;
      const d = step.decision;
      const same = d.srmE === se.srmE && d.metrics.every((m, i) => m.rollbackE === se.ev[i].rollbackE && m.proceedE === se.ev[i].proceedE);
      if (!same) failures++;
      if (d.verdict !== 'extend') { verdict = d.verdict; verdictTick = d.tick; }
    }
    for (const k of ['rollback', 'proceed', 'guard']) if (first[k] < 0 && se[k]) first[k] = t;
    if (cmp) {
      stepShadow(cell, cmp, nc, nk, observations, true);
      const ce = shadowEvidence(cell, cmp);
      for (const k of ['rollback', 'proceed']) if (firstCmp[k] < 0 && ce[k]) firstCmp[k] = t;
    }
    const doneMain = first.rollback >= 0 && first.proceed >= 0 && first.guard >= 0;
    const doneCmp = !cmp || (firstCmp.rollback >= 0 && firstCmp.proceed >= 0);
    if (verdict !== null && doneMain && doneCmp) break;
  }
  return { first, firstCmp, verdict: verdict ?? 'extend', verdictTick, failures };
}

// ── Run ─────────────────────────────────────────────────────────────────────────────────────────
function median(xs) { if (xs.length === 0) return null; const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; }
function frac(xs) { return xs.filter((x) => x >= 0).length / xs.length; }
function se(p) { return Math.sqrt((p * (1 - p)) / R); }

const results = [];
let totalFailures = 0;
CELLS.forEach((cell, i) => {
  const rng = lcg(20260928 + 7919 * i);
  const reps = [];
  let failures = 0, errors = 0;
  for (let r = 0; r < R; r++) {
    try { const out = replicate(cell, rng); failures += out.failures; reps.push(out); }
    catch (e) { errors++; if (errors === 1) process.stderr.write(`${cell.id}: ${e.message}\n`); }
  }
  totalFailures += failures + errors;
  if (SMOKE) { process.stdout.write(`${cell.id}: harness failures ${failures + errors}\n`); return; }
  const cross = (k, src) => {
    const ticks = reps.map((o) => o[src][k]);
    const p = frac(ticks);
    return { rate: p, se: se(p), median: median(ticks.filter((x) => x >= 0)) };
  };
  const verdicts = {};
  for (const v of ['rollback', 'proceed', 'invalid_experiment', 'inconclusive', 'extend']) verdicts[v] = reps.filter((o) => o.verdict === v).length / reps.length;
  const row = {
    id: cell.id, failures: failures + errors, executable: failures + errors === 0,
    rollback: cross('rollback', 'first'), proceed: cross('proceed', 'first'), guard: cross('guard', 'first'),
    comparator: cell.comparator ? { rollback: cross('rollback', 'firstCmp'), proceed: cross('proceed', 'firstCmp') } : null,
    gate: { verdicts, medianTerminalTick: median(reps.filter((o) => o.verdictTick !== null).map((o) => o.verdictTick)) },
    bar: cell.bar,
  };
  if (cell.bar) row.verdict = !row.executable ? 'NOT EXECUTABLE' : row[cell.bar].rate <= BAR ? 'PASS' : 'FAIL';
  if (cell.id === 'G2-null') row.verdict = !row.executable ? 'NOT EXECUTABLE' : row.guard.rate <= BAR ? 'PASS' : 'FAIL';
  results.push(row);
  const main = cell.comparator ? row.comparator[cell.report] : row[cell.bar ?? cell.report];
  process.stdout.write(`${cell.id}: ${cell.bar ?? cell.report} ${main.rate.toFixed(4)} (median ${main.median ?? '–'})${row.verdict ? ' ' + row.verdict : ''}${row.failures ? ` FAILURES ${row.failures}` : ''}\n`);
});

if (SMOKE) { process.stdout.write(`smoke: total harness failures ${totalFailures}\n`); process.exit(totalFailures === 0 ? 0 : 1); }

const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
const out = join(HERE, '..', 'results', `run-${stamp}`);
mkdirSync(out, { recursive: true });
writeFileSync(join(out, 'results.json'), JSON.stringify({ study: '2026-09-twin-gate', T, R, ALPHA, BAR, node: process.version, results }, null, 2));
const f = (c) => `${c.rate.toFixed(4)} ± ${c.se.toFixed(4)} (${c.median ?? '–'})`;
const lines = [
  `# 2026-09-twin-gate — run-${stamp}`, '',
  `T = ${T}, R = ${R}, α = ${ALPHA} (all three), bar B = ${BAR.toFixed(4)}. Registered: ../../PREREGISTRATION.md.`,
  'Crossings are the shadow\'s full-horizon first crossings (fraction ± SE, median tick); gate = the gate\'s own verdict fractions.', '',
  '| cell | rollback crossing | proceed crossing | guard crossing | comparator | gate R / P / I / inc | harness failures | bar | verdict |',
  '|---|---|---|---|---|---|---|---|---|',
  ...results.map((r) => `| ${r.id} | ${f(r.rollback)} | ${f(r.proceed)} | ${f(r.guard)} | ${r.comparator ? `R ${f(r.comparator.rollback)}; P ${f(r.comparator.proceed)}` : '–'} | ${['rollback', 'proceed', 'invalid_experiment', 'inconclusive'].map((v) => r.gate.verdicts[v].toFixed(3)).join(' / ')} | ${r.failures} | ${r.id === 'G2-null' ? 'guard' : r.bar ?? 'report'} | ${r.verdict ?? '–'} |`),
];
writeFileSync(join(out, 'REPORT.md'), lines.join('\n') + '\n');
process.stdout.write(`wrote ${out}\n`);

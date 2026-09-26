// validation/twin-null/harness/run.mjs — study 2026-09-twin-null (ADR 0036). Registered in
// ../PREREGISTRATION.md before this file existed; generator, cells, seeds and bars are §1–§5 there.
// Drives the committed dist/ (run `npx tsc` first).

import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const twin = require('../../../dist/detectors/twin-contrast.js');
const planning = require('../../../dist/per-shard/twin-planning.js');

const HERE = dirname(fileURLToPath(import.meta.url));
const T = 2000, R = 1000, ALPHA = 0.05, TRAFFIC = 2000, P0 = 0.01, DAY = 1440;
const BAR = ALPHA + 2.58 * Math.sqrt((ALPHA * (1 - ALPHA)) / R);

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
function split(rng, n, w) {
  return Math.min(n, Math.max(0, Math.round(n * w + Math.sqrt(n * w * (1 - w)) * gaussian(rng))));
}
function centeredLognormal(rng) { return Math.exp(0.75 * gaussian(rng)) - Math.exp(0.28125); }

// §3, in registered order.
const CELLS = [];
CELLS.push({ id: 'P1-rate-w0.5', group: 'P1', kind: 'rate', w: 0.5 });
CELLS.push({ id: 'P1-rate-w0.1', group: 'P1', kind: 'rate', w: 0.1 });
CELLS.push({ id: 'P1-sign-w0.5', group: 'P1', kind: 'sign', w: 0.5 });
for (const kind of ['rate', 'sign']) for (const w of [0.5, 0.1]) for (const phi of [0, 0.5, 0.9, 0.99]) for (const sigmaArm of [0.1, 0.3]) {
  CELLS.push({ id: `P2-${kind}-w${w}-phi${phi}-s${sigmaArm}`, group: 'P2', kind, w, phi, sigmaArm });
}
CELLS.push({ id: 'P3-sign-w0.1-higher', group: 'P3', kind: 'sign', w: 0.1, worse: 'higher' });
CELLS.push({ id: 'P3-sign-w0.1-lower', group: 'P3', kind: 'sign', w: 0.1, worse: 'lower' });
for (const kind of ['rate', 'sign']) for (const warmup of [0, 150]) {
  CELLS.push({ id: `CS-${kind}-W${warmup}`, group: warmup === 0 ? 'CS0' : 'CS', kind, w: 0.5, cold: true, warmup });
}
CELLS.push({ id: 'P4-rate-w0.5-x1.2', group: 'P4', kind: 'rate', w: 0.5, rateMult: 1.2 });
CELLS.push({ id: 'P4-rate-w0.1-x1.2', group: 'P4', kind: 'rate', w: 0.1, rateMult: 1.2 });
CELLS.push({ id: 'P4-sign-w0.5-+0.5', group: 'P4', kind: 'sign', w: 0.5, signShift: 0.5 });
CELLS.push({ id: 'P4-sign-w0.5-+2', group: 'P4', kind: 'sign', w: 0.5, signShift: 2 });
CELLS.push({ id: 'P5-rate-w0.5-x1.5', group: 'P5', kind: 'rate', w: 0.5, rateMult: 1.5 });
CELLS.push({ id: 'P5-rate-w0.1-x1.5', group: 'P5', kind: 'rate', w: 0.1, rateMult: 1.5 });
CELLS.push({ id: 'P5-sign-direct', group: 'P5', kind: 'sign-direct', w: 0.5 });

function replicate(cell, rng) {
  const kind = cell.kind === 'sign-direct' ? 'sign' : cell.kind;
  const spec = { id: 'm', kind, worse: cell.worse ?? 'higher', tolerance: kind === 'rate' ? 0.5 : 0.1 };
  const sigma = cell.sigmaArm ?? 0, phi = cell.phi ?? 0, innov = sigma * Math.sqrt(1 - phi * phi);
  let aC = sigma > 0 ? sigma * gaussian(rng) : 0;
  let aK = sigma > 0 ? sigma * gaussian(rng) : 0;
  let st = twin.initTwinMetric();
  let rollbackAt = -1, proceedAt = -1;
  for (let t = 0; t < T; t++) {
    if (sigma > 0) { aC = phi * aC + innov * gaussian(rng); aK = phi * aK + innov * gaussian(rng); }
    const cold = cell.cold ? 0.3 * Math.exp(-t / 30) : 0;
    const season = 1 + 0.5 * Math.sin((2 * Math.PI * t) / DAY);
    const inOutage = t >= 800 && t < 900;
    let obs;
    if (cell.kind === 'sign-direct') {
      obs = rng() < 0.5 + spec.tolerance ? { canary: 1, control: 0 } : { canary: 0, control: 1 };
    } else {
      const n = poisson(rng, TRAFFIC * season);
      const nc = split(rng, n, cell.w), nk = n - nc;
      if (cell.kind === 'rate') {
        const p = P0 * season * (inOutage ? 5 : 1);
        obs = {
          canaryEvents: Math.min(nc, poisson(rng, nc * p * (cell.rateMult ?? 1) * Math.exp(aC + cold))), canaryTotal: nc,
          controlEvents: Math.min(nk, poisson(rng, nk * p * Math.exp(aK))), controlTotal: nk,
        };
      } else {
        const shared = 100 * season * (inOutage ? 3 : 1);
        obs = {
          canary: shared + 10 * (aC + cold) + (cell.signShift ?? 0) + (30 * centeredLognormal(rng)) / Math.sqrt(Math.max(nc, 1)),
          control: shared + 10 * aK + (30 * centeredLognormal(rng)) / Math.sqrt(Math.max(nk, 1)),
        };
      }
    }
    if (t < (cell.warmup ?? 0)) continue;
    st = twin.updateTwinMetric(spec, st, obs);
    const ev = twin.twinMetricEvidence(st);
    if (rollbackAt < 0 && ev.rollbackE >= 1 / ALPHA) rollbackAt = t;
    if (proceedAt < 0 && ev.proceedE >= 1 / ALPHA) proceedAt = t;
    if (rollbackAt >= 0 && proceedAt >= 0) break;
  }
  return { rollbackAt, proceedAt };
}

function median(xs) { if (xs.length === 0) return null; const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; }
function se(p) { return Math.sqrt((p * (1 - p)) / R); }

const results = [];
CELLS.forEach((cell, i) => {
  const rng = lcg(20260925 + 7919 * i);
  const rb = [], pr = [];
  for (let r = 0; r < R; r++) {
    const out = replicate(cell, rng);
    if (out.rollbackAt >= 0) rb.push(out.rollbackAt);
    if (out.proceedAt >= 0) pr.push(out.proceedAt);
  }
  const rollbackRate = rb.length / R, proceedRate = pr.length / R;
  const row = {
    id: cell.id, group: cell.group,
    rollbackRate, rollbackSE: se(rollbackRate), medianRollbackTick: median(rb),
    proceedRate, proceedSE: se(proceedRate), medianProceedTick: median(pr),
  };
  if (cell.group === 'P1' || cell.group === 'CS') row.verdict = rollbackRate <= BAR ? 'PASS' : 'FAIL';
  if (cell.group === 'P5') row.verdict = proceedRate <= BAR ? 'PASS' : 'FAIL';
  if (cell.group === 'P2' || cell.group === 'P3' || cell.group === 'CS0') row.withinBar = rollbackRate <= BAR;
  if (cell.group === 'P4' && cell.kind === 'rate') {
    row.planTicks = planning.ticksToDetect({ kind: 'rate', canaryShare: cell.w, oddsRatio: cell.rateMult, badEventsPerTick: TRAFFIC * P0, alpha: ALPHA });
    row.medianOverPlan = row.medianRollbackTick === null ? null : row.medianRollbackTick / row.planTicks;
  }
  results.push(row);
  process.stdout.write(`${cell.id}: rollback ${rollbackRate.toFixed(4)} proceed ${proceedRate.toFixed(4)}${row.verdict ? ' ' + row.verdict : ''}\n`);
});

const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
const out = join(HERE, '..', 'results', `run-${stamp}`);
mkdirSync(out, { recursive: true });
writeFileSync(join(out, 'results.json'), JSON.stringify({ study: '2026-09-twin-null', T, R, ALPHA, BAR, results }, null, 2));
const lines = [
  `# 2026-09-twin-null — run-${stamp}`, '',
  `T = ${T}, R = ${R}, α = ${ALPHA}, bar B = ${BAR.toFixed(4)}. Registered: ../../PREREGISTRATION.md.`, '',
  '| cell | group | false/true rollback | SE | median tick | proceed | SE | verdict / within B | median ÷ plan |',
  '|---|---|---|---|---|---|---|---|---|',
  ...results.map((r) => `| ${r.id} | ${r.group} | ${r.rollbackRate.toFixed(4)} | ${r.rollbackSE.toFixed(4)} | ${r.medianRollbackTick ?? '–'} | ${r.proceedRate.toFixed(4)} | ${r.proceedSE.toFixed(4)} | ${r.verdict ?? (r.withinBar === undefined ? '–' : r.withinBar ? 'within' : 'exceeds')} | ${r.medianOverPlan == null ? '–' : r.medianOverPlan.toFixed(2)} |`),
];
writeFileSync(join(out, 'REPORT.md'), lines.join('\n') + '\n');
process.stdout.write(`wrote ${out}\n`);

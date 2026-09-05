// validation/sequencing/harness/run.mjs — the registered harness for 2026-09-sequencing, engine half
// (PREREGISTRATION.md §2–§3). Imports the h0-battery's nulls and Family A adapters unchanged; the
// e-SR adapter and the trajectory construction are copied from validation/e-sr-mean-shift/harness
// (not imported: it executes on import). K signals per replication, F faulted at staggered onsets;
// three orderings read on the same draws. No catch anywhere.
//
//   node validation/sequencing/harness/run.mjs --mode live
//   node validation/sequencing/harness/run.mjs --mode sim --quick     (N = 20, never scored)

import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { rng, NULLS } from '../../h0-battery/harness/nulls.mjs';
import { DETECTORS } from '../../h0-battery/harness/detectors.mjs';
import { render } from '../analysis/report.mjs';

const require = createRequire(import.meta.url);
const esr = require('../../../dist/detectors/e-sr-mean-shift.js');

const STUDY = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const ROOT = path.join(STUDY, '..', '..');
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const MODE = arg('--mode', 'sim');
const QUICK = process.argv.includes('--quick');
if (MODE === 'live' && QUICK) { console.error('--quick may not write under results/live'); process.exit(1); }

// ── registered constants (PREREGISTRATION §2) ──
const N = QUICK ? 20 : 1000;
const SEED = 20260912;
const K = 20, NU0 = 200, CENSOR = 800;
const FS = [3, 5], DELTAS = [1.5, 3], GAPS = [5, 20, 50];
const ALPHA_RUN = 0.01, ALPHA_ARL = 1e-3;
const N1 = NULLS.find((n) => n.id === 'N1');
const CFG = { mu: 0, sigma: 1, phi: 0, alpha: ALPHA_RUN, windows: N1.windows };

const MIX = DETECTORS.find((d) => d.id === 'family_A_mixture_supermartingale');
const BET = DETECTORS.find((d) => d.id === 'family_A_betting_e_process');
if (!MIX || !BET) throw new Error('battery adapters missing');

/** The e-SR adapter of validation/e-sr-mean-shift/harness/run.mjs, extended to return the
 *  onset_estimate carried by the result at the crossing tick. */
const ESR = {
  id: 'e_sr_mean_shift',
  make(cfg) {
    const params = { alpha_arl: ALPHA_ARL };
    const st = esr.freshESrMeanShiftState(params);
    let prev = null;
    return {
      step(x) {
        const r = esr.standardizeAr1Residual(x, prev, cfg.mu, cfg.sigma, cfg.phi ?? 0);
        prev = x;
        const res = esr.evaluateESrMeanShift(r, params, st);
        return res.fired ? { onset: res.onset_estimate } : null;
      },
    };
  },
};
const ORDERINGS = ['mix', 'bet', 'sr', 'srx'];

/** One replication: K signals, F faulted at nu_k = NU0 + k·g with step delta, T ticks. Ticks outer,
 *  signals inner, one generator per replication (§2). Each detector instance stops at its first
 *  crossing. Returns per signal { mixTick, betTick, srTick, srOnset } (−1 = never crossed). */
function replicate(seed, F, delta, g, T) {
  const r = rng(seed);
  const src = N1.gen(r);
  const nu = Array.from({ length: F }, (_, k) => NU0 + k * g);
  const sig = Array.from({ length: K }, () => ({ mix: MIX.make(CFG), bet: BET.make(CFG), sr: ESR.make(CFG), mixTick: -1, betTick: -1, srTick: -1, srOnset: -1 }));
  for (let t = 0; t < T; t++) {
    for (let k = 0; k < K; k++) {
      let x = src();
      if (k < F && t >= nu[k]) x += delta;
      const s = sig[k];
      if (s.mixTick < 0 && s.mix.step(x)) s.mixTick = t;
      if (s.betTick < 0 && s.bet.step(x)) s.betTick = t;
      if (s.srTick < 0) { const o = s.sr.step(x); if (o) { s.srTick = t; s.srOnset = o.onset; } }
    }
  }
  return { nu, sig };
}

const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
const se = (xs) => { const m = mean(xs); return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1) / xs.length); };
const sd = (xs) => { const m = mean(xs); return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / Math.max(1, xs.length - 1)); };
const INF = Number.POSITIVE_INFINITY;
const stat = (s, o) => (o === 'mix' ? s.mixTick : o === 'bet' ? s.betTick : o === 'srx' ? s.srTick : s.srOnset);
const asOrd = (v) => (v < 0 ? INF : v);

/** §2.1 pair score: 1 if o_a < o_b, 0 if o_a > o_b, 0.5 on a tie (including both ∞). */
const pairScore = (oa, ob) => (oa < ob ? 1 : oa > ob ? 0 : 0.5);

function cell(F, delta, g, salt) {
  const T = NU0 + (F - 1) * g + CENSOR;
  const nuLast = NU0 + (F - 1) * g;
  const acc = Object.fromEntries(ORDERINGS.map((o) => [o, { A: [], phi: [], delays: [], detected: 0, faulted: 0, uncrossedPairs: 0, pairs: 0, onsetErr: [], within: 0, crossedFaulted: 0, preOnset: 0 }]));
  const diff = { sr_mix: [], sr_bet: [] };
  for (let i = 0; i < N; i++) {
    const { nu, sig } = replicate(SEED + 7919 * i + salt, F, delta, g, T);
    const aOf = {};
    for (const o of ORDERINGS) {
      const a = acc[o];
      let score = 0, pairs = 0;
      for (let p = 0; p < F; p++) for (let q = p + 1; q < F; q++) {
        const oa = asOrd(stat(sig[p], o)), ob = asOrd(stat(sig[q], o));
        score += pairScore(oa, ob); pairs++;
        if (oa === INF || ob === INF) a.uncrossedPairs++;
      }
      a.pairs += pairs;
      aOf[o] = score / pairs; a.A.push(aOf[o]);
      // false sequencing: null signals whose CROSSING precedes the last onset (for sr, its crossing)
      const crossKey = o === 'sr' ? 'srx' : o;
      let fs = 0; for (let k = F; k < K; k++) { const c = stat(sig[k], crossKey); if (c >= 0 && c < nuLast) fs++; }
      a.phi.push(fs / (K - F));
      for (let k = 0; k < F; k++) {
        a.faulted++;
        const c = stat(sig[k], crossKey);
        if (c >= 0) { a.detected++; a.delays.push(c - nu[k]); if (c < nu[k]) a.preOnset++; }
        if (o === 'sr' && c >= 0) { a.crossedFaulted++; const err = Math.abs(sig[k].srOnset - nu[k]); a.onsetErr.push(err); if (err <= g / 2) a.within++; }
      }
    }
    diff.sr_mix.push(aOf.sr - aOf.mix); diff.sr_bet.push(aOf.sr - aOf.bet);
  }
  const per_ordering = ORDERINGS.map((o) => {
    const a = acc[o]; const A = mean(a.A), As = se(a.A); const pd = a.detected / a.faulted;
    return { ordering: o, A, A_se: As, e1: pd < 0.5 ? 'NOT-SCORED' : (A - 3 * As > 0.5 ? 'HELD' : 'FAILED'),
      e2: g === 50 ? (pd < 0.5 ? 'NOT-SCORED' : (A >= 0.8 ? 'HELD' : 'FAILED')) : null,
      phi: mean(a.phi), phi_se: se(a.phi), e4: (o === 'mix' || o === 'bet') ? (mean(a.phi) <= 0.02 ? 'HELD' : 'FAILED') : null,
      p_detect: pd, delay_mean: a.delays.length ? mean(a.delays) : null, delay_sd: a.delays.length ? sd(a.delays) : null,
      uncrossed_pair_frac: a.uncrossedPairs / a.pairs, pre_onset_frac: a.preOnset / a.faulted,
      onset_err_mean: o === 'sr' && a.onsetErr.length ? mean(a.onsetErr) : null, onset_within_half_gap: o === 'sr' && a.crossedFaulted ? a.within / a.crossedFaulted : null };
  });
  const e3 = delta === 1.5 && g === 5 ? {
    sr_minus_mix: mean(diff.sr_mix), sr_minus_mix_se: se(diff.sr_mix), sr_minus_bet: mean(diff.sr_bet), sr_minus_bet_se: se(diff.sr_bet),
    verdict: (mean(diff.sr_mix) > 3 * se(diff.sr_mix) && mean(diff.sr_bet) > 3 * se(diff.sr_bet)) ? 'HELD' : 'FAILED',
  } : { sr_minus_mix: mean(diff.sr_mix), sr_minus_mix_se: se(diff.sr_mix), sr_minus_bet: mean(diff.sr_bet), sr_minus_bet_se: se(diff.sr_bet), verdict: null };
  return { F, delta, g, nu_last: nuLast, T, n: N, per_ordering, e3, exceptions: 0 };
}

const t0 = Date.now();
const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
const runDir = path.join(STUDY, 'results', MODE === 'live' ? 'live' : 'sim', `run-${stamp}`);
if (fs.existsSync(runDir)) { console.error(`refusing to reuse ${runDir}`); process.exit(1); }
fs.mkdirSync(runDir, { recursive: true });

const cells = []; let j = 0;
for (const F of FS) for (const delta of DELTAS) for (const g of GAPS) {
  const c = cell(F, delta, g, 1_000_000 * j++); cells.push(c);
  console.log(`F=${F} δ=${delta} g=${g}: ` + c.per_ordering.map((o) => `${o.ordering} A=${o.A.toFixed(3)}±${o.A_se.toFixed(3)} ${o.e1} Φ=${o.phi.toFixed(3)} pdet=${o.p_detect.toFixed(3)}`).join(' | ') + (c.e3.verdict ? ` E3 ${c.e3.verdict}` : ''));
}
const sha256 = (p) => createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const manifest = { study: '2026-09-sequencing', substrate: 'engine', run: `run-${stamp}`, mode: MODE, quick: QUICK, tier: 'T1',
  git_sha: execSync('git rev-parse HEAD', { cwd: ROOT }).toString().trim(), harness_sha256: sha256(fileURLToPath(import.meta.url)),
  registration_sha256: sha256(path.join(STUDY, 'PREREGISTRATION.md')),
  n: N, seed: SEED, K, nu0: NU0, censor: CENSOR, fs: FS, deltas: DELTAS, gaps: GAPS, alpha_run: ALPHA_RUN, alpha_arl: ALPHA_ARL, null_id: 'N1',
  detectors: { mix: MIX.id, bet: BET.id, sr: ESR.id }, cells: cells.length, wall_seconds: Math.round((Date.now() - t0) / 1000), argv: process.argv.slice(2) };
fs.writeFileSync(path.join(runDir, 'cells.json'), JSON.stringify(cells, null, 2) + '\n');
fs.writeFileSync(path.join(runDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
fs.writeFileSync(path.join(runDir, 'REPORT.md'), render(cells, manifest));
console.log(`wrote ${runDir} (${cells.length} cells, ${manifest.wall_seconds} s)`);

// validation/coverage/harness/run-battery.mjs — the fault-class coverage battery.
//
// Design frozen by ../PREREGISTRATION.md (sections 1-14, Amendment v1.1 A1-A8, Amendment
// v1.2 items 1-3, Amendment v2.K4 + v2.K4.1). WHERE THAT DOCUMENT AND THE IMPLEMENTATION
// PLAN'S TASK-8 BRIEF DISAGREE, THE PREREGISTRATION WINS — it postdates the brief by five
// reviewed amendments. Every divergence taken through v1.2 is named in
// ../../../.superpowers/sdd/2026-08-07-coverage-matrix-v1/task-8-report.md; K4's third
// candidate is Task 4 of ../../../.superpowers/sdd/2026-08-08-coverage-gap-detectors/.
//
// What it drives, per §7 + A6 + A1 + Amendment v2.K4 (K4.3):
//   K1, K3, K5, K6  -> safe_t, universal_inference            (all grid + -ar1 cells)
//   K3 (idx 15, 17) -> family_D_spectral_e_detector           (canonical + -ar1, for the record)
//   K3 (all 6)      -> spectral_bet_e_process                 (Amendment v2.K3 K3.5)
//   K2              -> group_average_e_value, and safe_t on series k=0 (A6)
//   K4              -> family_E_conformal_heldout, point_tail_bet_e_value (Amendment v2.K4
//                      K4.3), and safe_t on the point series (A6)
//   arms 30, 31, 32, 33 -> the four candidates' own healthy (S2) and 3-sigma power (S3) arms
//                      (A1; arm 32 per Amendment v2.K4 K4.5; arm 33 per Amendment v2.K3 K3.6/K3.7)
//
// Harness discipline (knowledge/methodology/harness-discipline.md):
//   1. Every external interface was read before wiring, at a line: safe-t
//      (dist/detectors/safe-t-e-value.js:86, called as run.mjs:42-43 calls it), universal
//      inference (dist/detectors/universal-inference-e-value.js, run.mjs:45), group average
//      (dist/detectors/group-average-e-value.js), the conformal weighted-e-value wealth
//      process (dist/detectors/conformal.js:357 + freshConformalEValueState at :320), the
//      held-out stamper (../../../tools/stamp-heldout-family-e.mjs), and family_D's audited
//      adapter (../../h0-battery/harness/detectors.mjs's make(cfg) -> {step, logM}).
//   2. NO bare catch — every adapter throw increments a counter that reaches the cell and
//      the report (§9's fallback is defined on that count).
//   3. Determinism: nothing in the measurement path reads the clock; the clock only names
//      the run dir. Seeds are the registered ones (§6, A5), asserted against the registered
//      literals at startup.
//
// Results are append-only: the run refuses to overwrite an existing run dir. COVERAGE_RESULTS_DIR
// relocates the results root (the CERT_RESULTS_DIR pattern, validation/certification/verdict.mjs:27)
// so tests never write under validation/coverage/results/live — loadEvidence
// (validation/certification/lib/collect.mjs:138) reads validation/*/results/live/* and would
// otherwise pick a smoke run up as certification evidence.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { createRequire } from 'node:module';
import {
  rng, gaussFrom,
  injectStep, injectUnison, injectOscillation, injectPoint, injectDrift, injectShapeMix,
} from '../lib/inject.mjs';
import { FAULT_CLASSES, COVERAGE_FLOOR } from '../../certification/lib/constants.mjs';
// family_D's adapter, reused rather than re-implemented: the task brief's "drives family_D
// via the detector-audit harness's adapter ... reuse it". run-power.mjs:21-22 imports the
// same module across studies, so this is the established mechanism, not a new one. The
// PRNG is still this study's own copy (inject.mjs), which is what §2/A8 hash as substrate.
import { DETECTORS } from '../../h0-battery/harness/detectors.mjs';
import { stampHeldoutFamilyE } from '../../../tools/stamp-heldout-family-e.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const STUDY = path.dirname(HERE);
const ENGINE_ROOT = path.resolve(STUDY, '..', '..');
const require = createRequire(import.meta.url);
const safeT = require(path.join(ENGINE_ROOT, 'dist/detectors/safe-t-e-value.js'));
const ui = require(path.join(ENGINE_ROOT, 'dist/detectors/universal-inference-e-value.js'));
const groupAvg = require(path.join(ENGINE_ROOT, 'dist/detectors/group-average-e-value.js'));
const conformal = require(path.join(ENGINE_ROOT, 'dist/detectors/conformal.js'));
const tailBet = require(path.join(ENGINE_ROOT, 'dist/detectors/point-tail-bet-e-value.js'));
const spectralBet = require(path.join(ENGINE_ROOT, 'dist/detectors/spectral-bet-e-process.js'));

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };

// ── registered design parameters (§3, §5, §6, A5) ─────────────────────────────
const REGISTERED_N = 2000;
const N = Number(arg('--n', REGISTERED_N));   // --n is a smoke override; the manifest flags it
const T = 300;
const ONSET = 100;
const ALPHA = 0.05;
const SIGMA = 1;
const THRESHOLD = 1 / ALPHA;                  // 20 (§3)
const BASE_SEED = 20260807;
const TRAJ_STEP = 7919;                       // §6, run-power.mjs:14 / run.mjs:85
const SERIES_SALT = 104729;                   // A5, the prime run-power.mjs:67 already uses
const HELDOUT_OFFSET = 500000;                // §6
const HELDOUT_ROWS = 10000;                   // §6, and the stamper's own floor
// §5/A8: run.mjs:86-87's {start,len} splitting MECHANISM with this battery's own lengths.
const CAL = { start: 0, len: ONSET };
const TEST = { start: ONSET, len: T - ONSET };

// Amendment v2.K3, K3.9: six disjoint 30-tick windows of the post-onset slice [100,280);
// t=280..299 (20 ticks) is unused. window_len is cross-checked against the module's own
// W_K3 export so a value drift crashes at startup rather than silently mismatching the
// registered partition.
const K3_WINDOWS = 6;
const K3_WINDOW_LEN = spectralBet.W_K3;
const K3_WINDOW_SPAN = `[${ONSET},${ONSET + K3_WINDOWS * K3_WINDOW_LEN})`;
if (K3_WINDOW_LEN !== 30) throw new Error(`run-battery: spectralBet.W_K3 is ${K3_WINDOW_LEN}, PREREGISTRATION.md K3.1 registers 30`);
if (K3_WINDOW_SPAN !== '[100,280)') throw new Error(`run-battery: K3 window span computed as ${K3_WINDOW_SPAN}, PREREGISTRATION.md K3.9 registers [100,280)`);

// Test-only hook, named: forces every adapter call for one detector id to throw, so §9's
// NOT-EXECUTABLE fallback path is exercised by test/run-battery.test.mjs. It cannot fire by
// accident — an unset env var leaves it null — and it is recorded in the manifest, so a run
// that used it can never be read as a measurement.
const FORCE_THROW = process.env.COVERAGE_FORCE_THROW ?? null;

// ── the registered cell table (§6, A1), copied literally ──────────────────────
const F = (idx, fault_class, severity, phi) => ({ idx, fault_class, severity, phi, seed: BASE_SEED + idx });
const REGISTERED_CELLS = [
  F(0, 'K1', '0.75sigma', 0), F(1, 'K1', '1.5sigma', 0), F(2, 'K1', '3sigma', 0), F(3, 'K1', '1.5sigma-ar1', 0.6),
  F(4, 'K2', 'K5-e0.25sigma', 0), F(5, 'K2', 'K5-e0.5sigma', 0), F(6, 'K2', 'K10-e0.25sigma', 0),
  F(7, 'K2', 'K10-e0.5sigma', 0), F(8, 'K2', 'K10-e0.75sigma', 0), F(9, 'K2', 'K20-e0.25sigma', 0),
  F(10, 'K2', 'K20-e0.5sigma', 0), F(11, 'K2', 'K10-e0.5sigma-ar1', 0.6),
  F(12, 'K3', 'A0.5sigma-f0.02', 0), F(13, 'K3', 'A0.5sigma-f0.05', 0), F(14, 'K3', 'A0.75sigma-f0.02', 0),
  F(15, 'K3', 'A0.75sigma-f0.05', 0), F(16, 'K3', 'A0.75sigma-f0.1', 0), F(17, 'K3', 'A0.75sigma-f0.05-ar1', 0.6),
  F(18, 'K4', '3sigma-point', 0), F(19, 'K4', '5sigma-point', 0), F(20, 'K4', '8sigma-point', 0),
  F(21, 'K4', '5sigma-point-ar1', 0.6),
  F(22, 'K5', 'slope5e-5', 0), F(23, 'K5', 'slope1e-4', 0), F(24, 'K5', 'slope5e-4', 0), F(25, 'K5', 'slope1e-4-ar1', 0.6),
  F(26, 'K6', 'mix-d1.0', 0), F(27, 'K6', 'mix-d1.5', 0), F(28, 'K6', 'mix-d2.0', 0), F(29, 'K6', 'mix-d1.5-ar1', 0.6),
];
// A1: the two new candidates' own healthy/power arms. `hint` is the fault class whose
// geometry the arm borrows (K=10 for the group arm, the 1-D stream for the conformal arm);
// it selects the arm under --classes and is NOT emitted as `fault_class` — these arms are
// registered as evidence independent of the fault-class cells.
const ARM_CELLS = [
  { idx: 30, arm_detector: 'group_average_e_value', hint: 'K2', phi: 0, seed: BASE_SEED + 30, K: 10 },
  { idx: 31, arm_detector: 'family_E_conformal_heldout', hint: 'K4', phi: 0, seed: BASE_SEED + 31 },
  // Amendment v2.K4, K4.4/K4.5: point_tail_bet_e_value's own arm, CELL_SEED = BASE_SEED + 32
  // = 20260839 (arithmetic shown in K4.4's table, continuing directly from arm 31's index).
  { idx: 32, arm_detector: 'point_tail_bet_e_value', hint: 'K4', phi: 0, seed: BASE_SEED + 32 },
  // Amendment v2.K3, K3.6: spectral_bet_e_process's own arm, CELL_SEED = BASE_SEED + 33 =
  // 20260840, continuing directly from arm 32's index. No held-out stream is registered
  // for this candidate (K3.3/K3.6: sigma is passed oracle, nothing to calibrate).
  { idx: 33, arm_detector: 'spectral_bet_e_process', hint: 'K3', phi: 0, seed: BASE_SEED + 33 },
];

// The constants module is normative (§1); this table mirrors it. Disagreement is a defect,
// so it is a crash at startup rather than a run nobody can interpret.
function assertRegistryAgreement() {
  for (const [classId, spec] of Object.entries(FAULT_CLASSES)) {
    const rows = REGISTERED_CELLS.filter((c) => c.fault_class === classId);
    const grid = rows.filter((c) => c.phi === 0).map((c) => c.severity);
    if (JSON.stringify(grid) !== JSON.stringify(spec.grid)) {
      throw new Error(`run-battery: ${classId} grid ${JSON.stringify(grid)} != FAULT_CLASSES ${JSON.stringify(spec.grid)}`);
    }
    const ar1Rows = rows.filter((c) => c.phi === 0.6);
    if (ar1Rows.length !== 1 || ar1Rows[0].severity !== `${spec.canonical}-ar1`) {
      throw new Error(`run-battery: ${classId} has no single ${spec.canonical}-ar1 replicate (§4)`);
    }
  }
  for (const c of REGISTERED_CELLS) {
    if (c.seed !== BASE_SEED + c.idx) throw new Error(`run-battery: cell ${c.idx} seed ${c.seed} != CELL_SEED formula`);
  }
  if (REGISTERED_CELLS.length !== 30) throw new Error(`run-battery: ${REGISTERED_CELLS.length} fault cells, §4 registers 30`);
  if (REGISTERED_CELLS[29].seed !== 20260836) throw new Error('run-battery: cell 29 seed != registered 20260836');
  // Every seed constant against its registered literal (§6, A5). These are the numbers the
  // seed formulas are made of; a formula that still parses with a changed constant produces a
  // different data set under the same registered cell id, so each one is pinned by value here.
  const literals = [
    ['BASE_SEED', BASE_SEED, 20260807, '§6'],
    ['TRAJ_STEP', TRAJ_STEP, 7919, '§6'],
    ['SERIES_SALT', SERIES_SALT, 104729, 'A5'],
    ['HELDOUT_OFFSET', HELDOUT_OFFSET, 500000, '§6'],
    ['HELDOUT_ROWS', HELDOUT_ROWS, 10000, '§6'],
  ];
  for (const [name, actual, registered, where] of literals) {
    if (actual !== registered) {
      throw new Error(`run-battery: ${name} is ${actual}, PREREGISTRATION.md ${where} registers ${registered}`);
    }
  }
  // Amendment v1.2 item 1: the one HELDOUT_SEED literal ever registered for arm 31.
  const arm31 = ARM_CELLS.find((a) => a.idx === 31).seed + HELDOUT_OFFSET;
  if (arm31 !== 20760838) throw new Error(`run-battery: arm-31 HELDOUT_SEED ${arm31} != registered 20760838`);
  // Amendment v2.K4, K4.4: arm 32's own CELL_SEED and HELDOUT_SEED, shown by arithmetic there.
  const arm32Cell = ARM_CELLS.find((a) => a.idx === 32);
  if (arm32Cell.seed !== 20260839) throw new Error(`run-battery: arm-32 CELL_SEED ${arm32Cell.seed} != registered 20260839`);
  const arm32Heldout = arm32Cell.seed + HELDOUT_OFFSET;
  if (arm32Heldout !== 20760839) throw new Error(`run-battery: arm-32 HELDOUT_SEED ${arm32Heldout} != registered 20760839`);
  // Amendment v2.K3, K3.6: arm 33's own CELL_SEED, shown by arithmetic there. No
  // HELDOUT_SEED is registered for this arm (K3.3/K3.6: no calibration stream).
  const arm33Cell = ARM_CELLS.find((a) => a.idx === 33);
  if (arm33Cell.seed !== 20260840) throw new Error(`run-battery: arm-33 CELL_SEED ${arm33Cell.seed} != registered 20260840`);
  // Amendment v2.K4, K4.4's table: point_tail_bet_e_value reuses the identical held-out stream
  // already registered for family_E_conformal_heldout on cells 18-21 (superseding §6's "only"
  // scoping, per Amendment v2.K4.1 K4.1.2). Verified here against the table's own literals.
  const K4_HELDOUT_SEEDS = { 18: 20760825, 19: 20760826, 20: 20760827, 21: 20760828 };
  for (const [idxStr, expected] of Object.entries(K4_HELDOUT_SEEDS)) {
    const idx = Number(idxStr);
    const cell = REGISTERED_CELLS.find((c) => c.idx === idx);
    const heldout = cell.seed + HELDOUT_OFFSET;
    if (heldout !== expected) throw new Error(`run-battery: cell ${idx} HELDOUT_SEED ${heldout} != registered ${expected}`);
  }
}

const canonicalOf = (cell) => cell.severity === FAULT_CLASSES[cell.fault_class].canonical;

// ── grid-label parsing (§2) ───────────────────────────────────────────────────
const num = (s) => { const v = Number(s); if (!Number.isFinite(v)) throw new Error(`run-battery: unparsable grid number "${s}"`); return v; };
function parseSeverity(fault_class, severity) {
  const s = severity.replace(/-ar1$/, '');
  let m;
  switch (fault_class) {
    case 'K1': if ((m = /^(\d*\.?\d+)sigma$/.exec(s))) return { delta: num(m[1]) }; break;
    case 'K2': if ((m = /^K(\d+)-e(\d*\.?\d+)sigma$/.exec(s))) return { K: num(m[1]), eps: num(m[2]) }; break;
    case 'K3': if ((m = /^A(\d*\.?\d+)sigma-f(\d*\.?\d+)$/.exec(s))) return { amp: num(m[1]), freq: num(m[2]) }; break;
    case 'K4': if ((m = /^(\d*\.?\d+)sigma-point$/.exec(s))) return { mult: num(m[1]) }; break;
    case 'K5': if ((m = /^slope(\d+(?:\.\d+)?e-\d+)$/.exec(s))) return { slope: num(m[1]) }; break;
    case 'K6': if ((m = /^mix-d(\d*\.?\d+)$/.exec(s))) return { d: num(m[1]) }; break;
    default: break;
  }
  throw new Error(`run-battery: severity "${severity}" does not parse for ${fault_class} (§2's grammar)`);
}

// ── null models (§4) ─────────────────────────────────────────────────────────
// AR(1), unit marginal variance, copied from run.mjs:19-20 (the N3-p06 generator §4 names).
const ar1 = (r, phi) => {
  const g = gaussFrom(r);
  let p = g();
  const sd = Math.sqrt(1 - phi * phi);
  return () => (p = phi * p + sd * g());
};
const drawFor = (r, phi) => (phi > 0 ? ar1(r, phi) : gaussFrom(r));

const cellSeed = (cell, i) => cell.seed + TRAJ_STEP * i;              // §6
const seriesSeed = (cell, i, k) => cellSeed(cell, i) + SERIES_SALT * k; // A5

/** One trajectory's data for a fault-class cell. K2 cells yield a matrix of K series;
 *  everything else a single series. The trajectory is generated ONCE and shared across
 *  every detector scored on the cell (§6's paired comparison). */
function generate(cell, i) {
  const p = parseSeverity(cell.fault_class, cell.severity);
  if (cell.fault_class === 'K2') {
    const matrix = [];
    for (let k = 0; k < p.K; k++) {
      const r = rng(seriesSeed(cell, i, k));
      const draw = drawFor(r, cell.phi);
      matrix.push(Array.from({ length: T }, draw));
    }
    return { matrix: injectUnison(matrix, { sigma: SIGMA, at: ONSET, eps: p.eps }) };
  }
  const r = rng(cellSeed(cell, i));
  const draw = drawFor(r, cell.phi);
  // A5's K6 pinning: the baseline is generated in full FIRST, then injectShapeMix is called
  // with the same, now-advanced `r` (it discards the baseline's post-onset values and draws
  // 3 fresh raw values per tick from that stream).
  const base = Array.from({ length: T }, draw);
  switch (cell.fault_class) {
    case 'K1': return { series: injectStep(base, { sigma: SIGMA, at: ONSET, delta: p.delta }) };
    case 'K3': return { series: injectOscillation(base, { sigma: SIGMA, at: ONSET, amp: p.amp, freq: p.freq }) };
    case 'K4': return { series: injectPoint(base, { sigma: SIGMA, at: ONSET, mult: p.mult }) };
    case 'K5': return { series: injectDrift(base, { sigma: SIGMA, at: ONSET, slope: p.slope }) };
    case 'K6': return { series: injectShapeMix(base, { sigma: SIGMA, at: ONSET, d: p.d, rng: r }) };
    default: throw new Error(`run-battery: no generator for ${cell.fault_class}`);
  }
}

// ── adapter contract, one entry point per detector ────────────────────────────
// Terminal detectors return one e-value per trajectory (§5); process detectors return
// { crossed, wealth } where `crossed` is a crossing of 1/alpha at t >= ONSET (§5's
// onset-gated endpoint, stricter than run-power.mjs:78-84's ungated loop).
const safeTOpts = (phi) => (phi > 0 ? { ar1Phi: phi } : undefined);      // run.mjs:42-43
const seriesFor = (data) => data.series ?? data.matrix[0];               // A6: safe_t sees series k=0 only

const familyDDet = DETECTORS.find((d) => d.id === 'family_D_spectral_e_detector');
if (!familyDDet) throw new Error('run-battery: family_D adapter absent from h0-battery/harness/detectors.mjs');

const ADAPTERS = {
  safe_t: {
    kind: 'terminal',
    read: (data, cell) => safeT.safeTwoSampleTEValue(seriesFor(data), CAL, TEST, safeTOpts(cell.phi)),
  },
  universal_inference: {
    kind: 'terminal',
    read: (data) => ui.universalInferenceMeanShiftEValue(data.series, CAL, TEST),
  },
  group_average_e_value: {
    kind: 'terminal',
    // §5's K2 mechanics: one per-series terminal safe-t e-value per component, arithmetic-meaned.
    read: (data, cell) => groupAvg.groupAverageEValue(
      data.matrix.map((s) => safeT.safeTwoSampleTEValue(s, CAL, TEST, safeTOpts(cell.phi))),
    ),
  },
  family_E_conformal_heldout: {
    kind: 'process',
    // A2's 1-D construction: x_t = [v_t], Sigma = [[1]], alpha_E = this battery's alpha.
    read: (data, cell, ctx) => {
      const state = conformal.freshConformalEValueState();
      let crossed = false;
      let indicatorAtOnset = 0;
      for (let t = 0; t < T; t++) {
        const before = state.M;
        const v = conformal.evaluateConformalWeightedEValue(
          { params: ctx.heldout, covariance: [[1]], alpha: ALPHA }, [data.series[t]], state,
        );
        // A2's descriptive secondary, carrying no verdict: did the tail rank fire at the
        // injected tick, independent of whether accumulated wealth ever crossed. The
        // evaluator returns no indicator, so it is read off the multiplier: e_t is
        // 1-alpha when the indicator is 0 and 2-alpha when it is 1.
        if (t === ONSET && before > 0 && state.M / before > 1.5) indicatorAtOnset = 1;
        if (t >= ONSET && v.verdict === 'fire') crossed = true;
      }
      return { crossed, wealth: state.M, indicatorAtOnset };
    },
  },
  // Amendment v2.K4/v2.K4.1: point_tail_bet_e_value. `kind: 'point'` returns one e-value per
  // tick of the post-onset test window (index 0 = the injected tick, ONSET), rather than a
  // single scalar/process summary — the two K4 cell types this candidate is scored on read
  // that array differently (K4.6's injected-tick class endpoint + window-crossing secondary
  // on the four fault cells; K4.1.4's per-point exceedance on arm 32's healthy (S2) row;
  // K4.5's any-tick-fires reading on arm 32's power (S3) row), so `record()` accumulates both
  // readings and each cell-emission site picks the one the amendment registers for that row.
  point_tail_bet_e_value: {
    kind: 'point',
    read: (data, cell, ctx) => {
      const es = new Array(TEST.len);
      for (let t = ONSET; t < T; t++) es[t - ONSET] = tailBet.pointTailBetEValue(data.series[t], ctx.tailBetCal).e;
      return es;
    },
  },
  family_D_spectral_e_detector: {
    kind: 'process',
    // A5's registered cfg, mirroring run-power.mjs:71-72's oracle branch with windows pinned.
    read: (data, cell) => {
      const inst = familyDDet.make({ mu: 0, sigma: SIGMA, phi: cell.phi, alpha: ALPHA, windows: 'disjoint' });
      let crossed = false;
      let firedPreOnset = false;
      for (let t = 0; t < T; t++) {
        const fired = inst.step(data.series[t]);          // run-power.mjs:78-84's step loop
        if (fired !== true) continue;
        if (t >= ONSET) crossed = true;                    // §5's onset gate (§10.2)
        else firedPreOnset = true;
      }
      // Additive descriptive secondary, carrying no verdict (A2's precedent for the K4
      // indicator rate). §5's gate counts a crossing at t >= onset; because the adapter's
      // wealth is not reset at onset, a pre-onset crossing that leaves wealth above 1/alpha
      // is still reported as `fire` afterwards and so still counts. This field makes the
      // size of that overlap readable off the results instead of inferable from the prose.
      return { crossed, firedPreOnset, wealth: Math.exp(inst.logM()), logWealth: inst.logM() };
    },
  },
  // Amendment v2.K3/v2.K3.1/v2.K3.2: spectral_bet_e_process. K3.9's registered adapter
  // reading: slice the post-onset span into six disjoint 30-tick windows and call
  // spectralBetWealth(windows, SIGMA) once per trajectory, reading the returned log[]
  // array for the any-prefix crossing check. spectralBetWindow is ALSO called directly
  // per window (not only through spectralBetWealth) because K3.1.6/K3.1.7 need the raw
  // per-window eAvg and per-bin p values BEFORE advanceLogWealth absorbs a degenerate
  // read — spectralBetWealth's own log[] does not expose that.
  spectral_bet_e_process: {
    kind: 'spectral',
    read: (data, cell) => {
      const windows = [];
      for (let w = 0; w < K3_WINDOWS; w++) {
        const start = ONSET + w * K3_WINDOW_LEN;
        windows.push(data.series.slice(start, start + K3_WINDOW_LEN));
      }
      let degenerateWindows = 0;
      const eAvgs = new Array(K3_WINDOWS);
      const ps = [];
      for (let w = 0; w < K3_WINDOWS; w++) {
        const { perBin, eAvg } = spectralBet.spectralBetWindow(windows[w], SIGMA);
        if (!Number.isFinite(eAvg)) degenerateWindows += 1;
        eAvgs[w] = eAvg;
        for (const b of perBin) ps.push(b.p);
      }
      const { wealth, log } = spectralBet.spectralBetWealth(windows, SIGMA);
      const crossed = log.some((l) => l >= Math.log(THRESHOLD));
      return { crossed, wealth, eAvgs, ps, degenerateWindows };
    },
  },
};

// §7 + A6: which detectors are scored on which class, and (family_D) on which cells.
function detectorsFor(cell) {
  switch (cell.fault_class) {
    case 'K1': case 'K5': case 'K6': return ['safe_t', 'universal_inference'];
    // Amendment v2.K3, K3.5: spectral_bet_e_process is scored on ALL SIX K3 cells,
    // unlike family_D_spectral_e_detector, which stays canonical + -ar1 only (§7).
    case 'K3': {
      const dets = ['safe_t', 'universal_inference'];
      if (canonicalOf(cell) || cell.severity.endsWith('-ar1')) dets.push('family_D_spectral_e_detector');
      dets.push('spectral_bet_e_process');
      return dets;
    }
    case 'K2': return ['group_average_e_value', 'safe_t'];
    // Amendment v2.K4, K4.3: point_tail_bet_e_value joins K4 as a new row.
    case 'K4': return ['family_E_conformal_heldout', 'safe_t', 'point_tail_bet_e_value'];
    default: throw new Error(`run-battery: no detector assignment for ${cell.fault_class}`);
  }
}

/** One adapter call, with the §9 counters. NO bare catch: a throw is counted and named. */
function callAdapter(detId, data, cell, ctx) {
  if (FORCE_THROW === detId) {
    throw new Error(`COVERAGE_FORCE_THROW=${detId}: forced adapter throw (test-only hook)`);
  }
  return ADAPTERS[detId].read(data, cell, ctx);
}

/** The registered held-out draw shared by both K4 candidates (§6's K4 block, A1 for arm 31,
 *  A7's T1 substrate finding, Amendment v2.K4 K4.4 for point_tail_bet_e_value's reuse of the
 *  identical stream on cells 18-21 and its own fresh stream on arm 32): n=10,000 rows drawn
 *  from the cell's healthy null under HELDOUT_SEED = CELL_SEED + 500000, seed(j) = HELDOUT_SEED
 *  + 7919*j. Returning the raw rows (not a detector-specific calibration) lets both candidates
 *  calibrate from the SAME draw when both are scored on the same cell, per K4.4's text. */
function heldoutRows(cell) {
  const heldoutSeed = cell.seed + HELDOUT_OFFSET;
  const rows = new Array(HELDOUT_ROWS);
  for (let j = 0; j < HELDOUT_ROWS; j++) {
    const r = rng(heldoutSeed + TRAJ_STEP * j);
    rows[j] = drawFor(r, cell.phi)();
  }
  return { rows, heldoutSeed };
}

function heldoutParams(rows) {
  return stampHeldoutFamilyE({ calibrationRows: rows, alpha: ALPHA });
}

// ── accumulation and the registered verdict vocabulary ────────────────────────
const freshAcc = () => ({
  fires: 0, throws: 0, nonFinite: 0, finite: 0, indicatorAtOnset: 0, firedPreOnset: 0, firstError: null,
  // point_tail_bet_e_value only (`kind: 'point'`): per-POINT counters across the whole
  // post-onset window, read by K4.1.4's healthy (S2) arm; windowCrossed is the K4.6
  // descriptive secondary (fault cells) and K4.5's own per-trajectory reading (S3 arm).
  pointFinite: 0, pointNonFinite: 0, pointK: 0, pointSumE: 0, windowCrossed: 0,
  // spectral_bet_e_process only (`kind: 'spectral'`): degenerateWindows sums, across every
  // trajectory AND window scored for the cell, the count of individual spectralBetWindow
  // calls whose eAvg was non-finite (K3.1.6). spectralEAvgMeans holds one number per
  // trajectory — that trajectory's own mean of its six per-window eAvg values, the sample
  // K3.1.1's increment_estimator is built from. spectralPs pools every individual per-bin p
  // value (K3.1.7).
  degenerateWindows: 0, spectralEAvgMeans: [], spectralPs: [],
});

/** One adapter call, counted. The record() step is deliberately OUTSIDE the catch (see the
 *  call sites): a defect in this harness's own bookkeeping must crash the run, never be
 *  tallied as an adapter throw and reported as the detector's failure. */
function attempt(acc, detId, data, cell, ctx) {
  try { return { ok: true, out: callAdapter(detId, data, cell, ctx) }; }
  catch (err) {
    acc.throws += 1;
    // M4: the FIRST error per (detector, cell) is retained and reaches the cell, so a reader
    // can tell an adapter's own RangeError apart from a wiring defect without a re-run.
    acc.firstError ??= err?.message ?? String(err);
    return { ok: false };
  }
}

function record(acc, detId, out) {
  if (ADAPTERS[detId].kind === 'terminal') {
    if (!Number.isFinite(out)) { acc.nonFinite += 1; return; }
    acc.finite += 1;
    if (out >= THRESHOLD) acc.fires += 1;
    (acc.es ??= []).push(out);
    return;
  }
  if (ADAPTERS[detId].kind === 'point') {
    // K4.6's class endpoint: the single injected tick, index 0 of the window array (t = ONSET).
    const eAtOnset = out[0];
    if (!Number.isFinite(eAtOnset)) { acc.nonFinite += 1; } else {
      acc.finite += 1;
      (acc.es ??= []).push(eAtOnset);
      if (eAtOnset >= THRESHOLD) acc.fires += 1;
    }
    // K4.1.4's per-point aggregate, across every tick of the window regardless of cell type —
    // cheap to always compute; only the S2 arm's emission reads it.
    let anyFired = false;
    for (const e of out) {
      if (Number.isFinite(e)) {
        acc.pointFinite += 1;
        acc.pointSumE += e;
        if (e >= THRESHOLD) { acc.pointK += 1; anyFired = true; }
      } else {
        acc.pointNonFinite += 1;
      }
    }
    if (anyFired) acc.windowCrossed += 1;
    return;
  }
  if (ADAPTERS[detId].kind === 'spectral') {
    if (!Number.isFinite(out.wealth)) { acc.nonFinite += 1; } else { acc.finite += 1; (acc.es ??= []).push(out.wealth); }
    if (out.crossed) acc.fires += 1;
    acc.degenerateWindows += out.degenerateWindows;
    // K3.1.1: the trajectory's own increment MEAN is the mean of its six eAvg values —
    // taken from the raw per-window reads (not the post-floor log[] diffs), so a
    // degenerate window (not expected, K3.1.6) surfaces here as a non-finite mean rather
    // than being silently absorbed the way advanceLogWealth absorbs it for wealth itself.
    acc.spectralEAvgMeans.push(mean(out.eAvgs));
    for (const p of out.ps) acc.spectralPs.push(p);
    return;
  }
  // A3a's registered field name is `non_finite_wealth` for every cell this battery emits,
  // terminal reads included — `applyGuards` (guards.mjs:12) pattern-matches that literal, so
  // a non-finite terminal e-value counted under any other name would defeat the guard.
  if (!Number.isFinite(out.wealth)) { acc.nonFinite += 1; } else { acc.finite += 1; (acc.es ??= []).push(out.wealth); }
  if (out.crossed) acc.fires += 1;
  acc.indicatorAtOnset += out.indicatorAtOnset ?? 0;
  if (out.firedPreOnset === true) acc.firedPreOnset += 1;
}

/** §9 (adapter throws > 1% of the cell's trajectories) + A3c (vacuity: not one finite read). */
function fallback(acc, n) {
  if (acc.throws > 0.01 * n) {
    return `adapter threw on ${acc.throws}/${n} trajectories (> 1%, PREREGISTRATION.md §9) `
      + `— a defect, not a measurement; first error: ${acc.firstError}`;
  }
  if (acc.finite === 0) {
    return `no finite read on any of ${n} trajectories (vacuous, PREREGISTRATION.md A3c) `
      + '— reporting 0.00 would assert a measurement that never happened';
  }
  return null;
}

// run.mjs:50-52's one-sided 95% lower bound on a rate, copied verbatim for the A1 healthy arms.
const lower95 = (k, n) => {
  const p = k / n, z = 1.645, d = 1 + z * z / n;
  const c = p + z * z / (2 * n), h = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n));
  return Math.max(0, (c - h) / d);
};
const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  const n = s.length;
  if (n === 0) return NaN;
  const mid = Math.floor(n / 2);
  return n % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};

// K3.1.1, copied verbatim from validation/detector-audit/harness/run-sequential.mjs:37-44
// (PREREGISTRATION.md's own citation for cell 33's increment_estimator shape).
function summarise(xs) {
  const n = xs.length;
  const m = xs.reduce((a, b) => a + b, 0) / n;
  const varr = n > 1 ? xs.reduce((a, b) => a + (b - m) ** 2, 0) / (n - 1) : 0;
  const se = Math.sqrt(varr / n);
  return { n, mean: m, sd: Math.sqrt(varr), se, lower95_one_sided: m - 1.645 * se, upper95_one_sided: m + 1.645 * se };
}

// K3.1.7: pooled per-bin p values (across N trajectories x 6 windows x 3 bins) into decile
// counts, plus the one-sample Kolmogorov-Smirnov statistic against Uniform(0,1) and the
// standard asymptotic critical value c(alpha=0.05)=1.36 at the actual pooled sample size —
// 1.36/sqrt(n), not the registered-N literal, so a smoke run reports its own n honestly.
function computePUniformity(rawPs) {
  const ps = rawPs.filter(Number.isFinite);
  const n = ps.length;
  const decile_counts = new Array(10).fill(0);
  for (const p of ps) decile_counts[Math.min(9, Math.max(0, Math.floor(p * 10)))] += 1;
  const sorted = [...ps].sort((a, b) => a - b);
  let d = 0;
  for (let i = 0; i < n; i++) d = Math.max(d, (i + 1) / n - sorted[i], sorted[i] - i / n);
  return { n, decile_counts, ks_statistic: n > 0 ? d : NaN, ks_critical_at_alpha: n > 0 ? 1.36 / Math.sqrt(n) : NaN };
}

// ── run ──────────────────────────────────────────────────────────────────────
assertRegistryAgreement();

const classFilter = arg('--classes', null);
const CLASSES_RUN = classFilter ? classFilter.split(',').map((s) => s.trim()) : Object.keys(FAULT_CLASSES);
for (const c of CLASSES_RUN) {
  if (!(c in FAULT_CLASSES)) throw new Error(`run-battery: --classes names "${c}", which is not a registered class`);
}

const cells = [];
const t0 = Date.now();

// The 30 fault-injected cells (§6), plus safe_t's measured-for-the-record K2/K4 rows (A6)
// and family_D on K3's canonical + -ar1 cells (§7).
for (const cell of REGISTERED_CELLS.filter((c) => CLASSES_RUN.includes(c.fault_class))) {
  const dets = detectorsFor(cell);
  const acc = new Map(dets.map((d) => [d, freshAcc()]));
  // Amendment v2.K4, K4.4: point_tail_bet_e_value reuses the IDENTICAL held-out stream already
  // registered for family_E_conformal_heldout on these same cells (superseding §6's "only"
  // scoping, per Amendment v2.K4.1 K4.1.2) — drawn once here, so both candidates calibrate
  // from the same rows rather than two independently-drawn samples that happen to agree.
  const needsHeldout = dets.includes('family_E_conformal_heldout') || dets.includes('point_tail_bet_e_value');
  const heldout = needsHeldout ? heldoutRows(cell) : null;
  const ctx = {};
  if (heldout) ctx.heldoutSeed = heldout.heldoutSeed;
  if (dets.includes('family_E_conformal_heldout')) ctx.params = heldoutParams(heldout.rows);
  if (dets.includes('point_tail_bet_e_value')) ctx.tailBetCal = tailBet.calibrateTailBet(heldout.rows);
  const ctxForRead = { heldout: ctx.params, tailBetCal: ctx.tailBetCal };

  for (let i = 0; i < N; i++) {
    const data = generate(cell, i);
    for (const detId of dets) {
      const a = acc.get(detId);
      const r = attempt(a, detId, data, cell, ctxForRead);
      if (r.ok) record(a, detId, r.out);
    }
  }

  for (const detId of dets) {
    const a = acc.get(detId);
    const reason = fallback(a, N);
    const rate = reason === null ? a.fires / N : null;    // A3c: the denominator stays N
    const c = {
      detector: detId,
      fault_class: cell.fault_class,
      severity: cell.severity,
      canonical: canonicalOf(cell),
      cell_index: cell.idx,
      // §4: the baseline is run.mjs's N1 null, the replicate its N3-p06 null. Recording the
      // registered id lets the certification scorer's phi derivation (lib/nulls.mjs) agree
      // with the phi recorded here instead of refusing the cell fail-closed.
      null_id: cell.phi === 0 ? 'N1' : 'N3-p06',
      phi: cell.phi,
      // Amendment v2.K4.1, K4.1.5: point_tail_bet_e_value stamps its own accurate literal
      // rather than reusing 'oracle' (Erratum v1.3's defect class) — its median/MAD are
      // empirical statistics of an independent held-out sample, not oracle constants.
      params: detId === 'point_tail_bet_e_value' ? 'heldout-empirical' : 'oracle',
      alpha: ALPHA,
      n: N,
      ticks: T,
      onset: ONSET,
      fires: a.fires,
      detection_rate: rate,
      adapter_failures: a.throws,
      non_finite_wealth: a.nonFinite,
      verdict: reason !== null ? 'NOT-EXECUTABLE' : (rate >= COVERAGE_FLOOR ? 'POWERED' : 'INERT'),
      not_executable_reason: reason,
      substrate_tier: 'T1',
    };
    // A2's registered descriptive secondary, no verdict attached.
    if (detId === 'family_E_conformal_heldout') {
      c.indicator_rate_at_injected_tick = a.indicatorAtOnset / N;
      c.heldout_seed = ctx.heldoutSeed;
      c.heldout_rows = HELDOUT_ROWS;
    }
    // family_D's own descriptive secondary, no verdict attached: how many trajectories the
    // adapter already fired on before onset, which is the size of §5's gate overlap.
    if (detId === 'family_D_spectral_e_detector') c.fired_pre_onset = a.firedPreOnset;
    // Amendment v2.K4, K4.6: the window-crossing reading is a descriptive secondary, no
    // verdict attached — the fraction of trajectories where ANY of the 200 post-onset ticks
    // (not only the injected one) has e >= 20, conflating the class endpoint with false-alarm
    // noise from the other 199 null ticks by design (K4.6's own text).
    if (detId === 'point_tail_bet_e_value') {
      c.window_crossing_rate = a.windowCrossed / N;
      c.heldout_seed = ctx.heldoutSeed;
      c.heldout_rows = HELDOUT_ROWS;
      // Re-derivable provenance (review finding): the calibration this cell actually used,
      // read straight off ctx.tailBetCal rather than re-derived — pins the row against a
      // wrong-stream mutation (e.g. a heldoutSeed off by one or a shared-with-the-wrong-cell
      // draw), which a report reader can check independently against §6/K4.4's own seed
      // formula without re-running the battery.
      c.cal_median = ctx.tailBetCal.median;
      c.cal_mad = ctx.tailBetCal.mad;
      // K4.1.6's structural-zero claim, exposed as a counted field rather than only implied by
      // non_finite_wealth's (onset-only) reading — non_finite_wealth above is the injected-tick
      // reading; this is the accumulated per-point counter across the whole window.
      c.point_non_finite = a.pointNonFinite;
    }
    // Amendment v2.K3, K3.8/K3.9/K3.1.6: the registered window-partition fields, wealth
    // descriptives, and the pre-absorption degenerate-window counter. Deliberately NONE of
    // the five instrument-named fields (K3.1.4, binding) — a fault cell has no S2/S3 role.
    if (detId === 'spectral_bet_e_process') {
      c.windows = K3_WINDOWS;
      c.window_len = K3_WINDOW_LEN;
      c.window_span = K3_WINDOW_SPAN;
      c.final_wealth_mean = a.es && a.es.length ? mean(a.es) : NaN;
      c.final_wealth_median = a.es && a.es.length ? median(a.es) : NaN;
      c.degenerate_windows = a.degenerateWindows;
    }
    cells.push(c);
    process.stderr.write(
      `${detId.padEnd(28)} ${cell.fault_class} ${cell.severity.padEnd(20)} `
      + `rate=${rate === null ? ' n/a  ' : rate.toFixed(4)} ${c.verdict.padEnd(15)} `
      + `throws=${a.throws} nonfinite=${a.nonFinite}\n`);
  }
}

// A1's healthy (S2) and 3-sigma power (S3) arms for the two new detectors. These carry no
// `fault_class`: they are the candidates' own validity/power evidence, independent of the
// fault-class cells, so the certification pipeline reads them as ordinary S2/S3 cells.
for (const arm of ARM_CELLS.filter((a) => CLASSES_RUN.includes(a.hint))) {
  const detId = arm.arm_detector;
  const pointKind = ADAPTERS[detId].kind === 'point';
  // Amendment v2.K3, K3.6/K3.7: spectral_bet_e_process's own arm. No heldout stream (K3.3).
  const spectralKind = detId === 'spectral_bet_e_process';
  const ctx = {};
  if (detId === 'family_E_conformal_heldout' || pointKind) {
    const h = heldoutRows(arm);
    ctx.heldoutSeed = h.heldoutSeed;
    if (detId === 'family_E_conformal_heldout') ctx.params = heldoutParams(h.rows);
    if (pointKind) ctx.tailBetCal = tailBet.calibrateTailBet(h.rows);
  }
  const ctxForRead = { heldout: ctx.params, tailBetCal: ctx.tailBetCal };
  const healthy = freshAcc();
  const power = freshAcc();

  for (let i = 0; i < N; i++) {
    let base;
    if (detId === 'group_average_e_value') {
      const matrix = [];
      for (let k = 0; k < arm.K; k++) {
        const r = rng(seriesSeed(arm, i, k));
        matrix.push(Array.from({ length: T }, drawFor(r, arm.phi)));
      }
      base = { matrix };
    } else {
      const r = rng(cellSeed(arm, i));
      base = { series: Array.from({ length: T }, drawFor(r, arm.phi)) };
    }
    // A1's S3 construction: injectUnison at eps=3 across all K components for the group
    // arm; injectStep at delta=3 for the conformal arm (run.mjs:89-90's registered shift).
    const shifted = detId === 'group_average_e_value'
      ? { matrix: injectUnison(base.matrix, { sigma: SIGMA, at: ONSET, eps: 3 }) }
      : { series: injectStep(base.series, { sigma: SIGMA, at: ONSET, delta: 3 }) };

    const rh = attempt(healthy, detId, base, arm, ctxForRead);
    if (rh.ok) record(healthy, detId, rh.out);
    const rp = attempt(power, detId, shifted, arm, ctxForRead);
    if (rp.ok) record(power, detId, rp.out);
  }

  // S2. exceedance is the crossing rate the card's falsifier names — for the terminal group
  // read, e >= 1/alpha; for the conformal wealth process, A2's firing rule (M_t >= 1/alpha at
  // some t >= onset). mean_e is the terminal read's mean (the group e-value; the wealth M_T),
  // the field name CLASS_INSTRUMENTS.terminal_e_value registers (constants.mjs:11).
  //
  // Amendment v2.K4.1, K4.1.4: point_tail_bet_e_value's S2 row is PER-POINT, not
  // per-trajectory — n_points = n*200, exceedance = k/n_points, lower_95 the per-point Wilson
  // bound, and verdict derived from that already-computed lower_95 (not recomputed). K4.7 names
  // the triple explicitly as exceedance/k/N_points, so `k` is pinned as its own field (review
  // finding), not left implicit in the exceedance ratio alone.
  const s2Reason = fallback(healthy, N);
  const s2n = healthy.finite;
  const s2k = healthy.fires;
  const s2PointN = healthy.pointFinite;
  const s2PointK = healthy.pointK;
  const s2Lower95 = pointKind
    ? (s2PointN ? lower95(s2PointK, s2PointN) : NaN)
    : (s2n ? lower95(s2k, s2n) : NaN);
  const s2 = {
    detector: detId,
    arm: 'healthy',
    cell_index: arm.idx,
    // Amendment v2.K3.1, K3.1.5: cell 33 stamps the out-of-grammar literal on both rows,
    // outside the run.mjs:497-style N1/N3-p06 convention every other arm keeps.
    null_id: spectralKind ? 'K3-arm-oracle' : (arm.phi === 0 ? 'N1' : 'N3-p06'),
    phi: arm.phi,
    params: pointKind ? 'heldout-empirical' : 'oracle',
    alpha: ALPHA,
    n: s2n,
    ticks: T,
    onset: ONSET,
    ...(pointKind ? { n_points: s2PointN, k: s2PointK } : {}),
    ...(spectralKind ? { windows: K3_WINDOWS, window_len: K3_WINDOW_LEN, window_span: K3_WINDOW_SPAN } : {}),
    // Amendment v2.K3.1, K3.1.1/K3.1.2: spectral_bet_e_process's S2 row carries its own
    // class instrument (increment_estimator) plus crossing_rate/k — NOT exceedance/mean_e
    // (K3.15's gap; the terminal_e_value instrument pair belongs to a different class).
    ...(spectralKind
      ? { k: s2k, crossing_rate: s2n ? s2k / s2n : NaN }
      : {
        exceedance: pointKind ? (s2PointN ? s2PointK / s2PointN : NaN) : (s2n ? s2k / s2n : NaN),
        mean_e: pointKind ? (s2PointN ? healthy.pointSumE / s2PointN : NaN) : (healthy.es ? mean(healthy.es) : NaN),
      }),
    lower_95: s2Lower95,
    ...(spectralKind ? {
      increment_estimator: summarise(healthy.spectralEAvgMeans),         // K3.1.1
      p_uniformity: computePUniformity(healthy.spectralPs),              // K3.1.7
      final_wealth_mean: healthy.es && healthy.es.length ? mean(healthy.es) : NaN,
      final_wealth_median: healthy.es && healthy.es.length ? median(healthy.es) : NaN,
      degenerate_windows: healthy.degenerateWindows,                     // K3.1.6
    } : {}),
    non_finite_wealth: healthy.nonFinite,
    adapter_failures: healthy.throws,
    verdict: s2Reason !== null
      ? 'NOT-EXECUTABLE'
      // K3.1.3: unchanged from K3.7 — crossing_rate-derived, NOT increment_estimator-derived.
      : (s2Lower95 > ALPHA ? 'FAIL' : 'not-refuted'),   // run.mjs:115 / K4.1.4 / K3.1.3
    not_executable_reason: s2Reason,
    substrate_tier: 'T1',
    ...(pointKind ? { point_non_finite: healthy.pointNonFinite, cal_median: ctx.tailBetCal.median, cal_mad: ctx.tailBetCal.mad } : {}),
  };
  // S3. No exceedance/mean_e, so this arm is not a validity candidate (run.mjs:130-132's
  // own reasoning); the paired S2 row above is. Amendment v2.K4, K4.5: point_tail_bet_e_value's
  // S3 detection is per-trajectory, "fires iff any of its 200 post-onset ticks has e >= 20" —
  // windowCrossed, not the injected-tick-only `fires` counter K4.6 uses for the fault cells
  // (this arm's injection is a SUSTAINED step, not a single point, so there is no one
  // "injected tick" to read in isolation).
  const s3Reason = fallback(power, N);
  const s3k = pointKind ? power.windowCrossed : power.fires;
  const s3Rate = s3Reason === null ? s3k / N : null;
  const s3 = {
    detector: detId,
    arm: 'power',
    cell_index: arm.idx,
    null_id: spectralKind ? 'K3-arm-oracle' : (arm.phi === 0 ? 'N1' : 'N3-p06'),
    phi: arm.phi,
    params: pointKind ? 'heldout-empirical' : 'oracle',
    shift_sigma: 3,
    alpha: ALPHA,
    n: N,
    ticks: T,
    onset: ONSET,
    ...(spectralKind ? { windows: K3_WINDOWS, window_len: K3_WINDOW_LEN, window_span: K3_WINDOW_SPAN } : {}),
    fires: s3k,
    detection_rate: s3Rate,
    // Amendment v2.K3.1, K3.1.4 (Critical, binding): NONE of the five instrument-named
    // fields land here — only wealth descriptives and the degenerate-window counter.
    ...(spectralKind ? {
      final_wealth_mean: power.es && power.es.length ? mean(power.es) : NaN,
      final_wealth_median: power.es && power.es.length ? median(power.es) : NaN,
      degenerate_windows: power.degenerateWindows,
    } : {}),
    adapter_failures: power.throws,
    non_finite_wealth: power.nonFinite,
    verdict: s3Reason !== null ? 'NOT-EXECUTABLE' : (s3Rate >= COVERAGE_FLOOR ? 'POWERED' : 'INERT'),
    not_executable_reason: s3Reason,
    substrate_tier: 'T1',
    ...(pointKind ? { point_non_finite: power.pointNonFinite, cal_median: ctx.tailBetCal.median, cal_mad: ctx.tailBetCal.mad } : {}),
  };
  if (detId === 'family_E_conformal_heldout' || pointKind) {
    s2.heldout_seed = ctx.heldoutSeed;
    s3.heldout_seed = ctx.heldoutSeed;
    s2.heldout_rows = HELDOUT_ROWS;
    s3.heldout_rows = HELDOUT_ROWS;
  }
  cells.push(s2, s3);
  process.stderr.write(spectralKind
    ? `${detId.padEnd(28)} ARM healthy crossing_rate=${Number.isFinite(s2.crossing_rate) ? s2.crossing_rate.toFixed(4) : ' n/a  '} `
      + `inc_mean=${Number.isFinite(s2.increment_estimator.mean) ? s2.increment_estimator.mean.toFixed(4) : ' n/a  '} ${s2.verdict}\n`
      + `${detId.padEnd(28)} ARM power   rate=${s3Rate === null ? ' n/a  ' : s3Rate.toFixed(4)} ${s3.verdict}\n`
    : `${detId.padEnd(28)} ARM healthy exceedance=${Number.isFinite(s2.exceedance) ? s2.exceedance.toFixed(4) : ' n/a  '} `
      + `mean_e=${Number.isFinite(s2.mean_e) ? s2.mean_e.toFixed(4) : ' n/a  '} ${s2.verdict}\n`
      + `${detId.padEnd(28)} ARM power   rate=${s3Rate === null ? ' n/a  ' : s3Rate.toFixed(4)} ${s3.verdict}\n`);
}

// ── manifest (A8's registered field list) and append-only write ───────────────
const substrateSha = crypto.createHash('sha256')
  .update(fs.readFileSync(path.join(STUDY, 'lib', 'inject.mjs')))
  .digest('hex');
// A8 registers substrate_sha256 as sha256(inject.mjs) ALONE (its RNG is copied into the
// file, so h0-battery's nulls.mjs does not drive this battery). family_D's adapter DOES
// drive the K3 rows, so its hash is recorded separately rather than folded into the
// registered field — the registered mechanism is not widened by this harness.
const familyDAdapterSha = crypto.createHash('sha256')
  .update(fs.readFileSync(path.resolve(STUDY, '..', 'h0-battery', 'harness', 'detectors.mjs')))
  .digest('hex');

let gitSha = null;
try { gitSha = execSync('git rev-parse HEAD', { cwd: ENGINE_ROOT }).toString().trim(); } catch { gitSha = null; }
const enginePin = JSON.parse(fs.readFileSync(path.join(ENGINE_ROOT, 'package.json'), 'utf8')).version;

const outRoot = process.env.COVERAGE_RESULTS_DIR
  ? path.resolve(process.env.COVERAGE_RESULTS_DIR)
  : path.join(STUDY, 'results');
// results/live is the certification evidence path: loadEvidence (collect.mjs:138) reads
// validation/*/results/live/* and scores whatever it finds there. Only a run at the registered
// n = 2000 with no test hook engaged may write to it; everything else lands in results/sim, the
// run.mjs:76 convention. This is a property of the run, not a flag the caller passes, so a
// smoke run cannot opt itself into the evidence path. --classes does NOT force sim: Task 9 may
// run the registered n class by class (plan step 2), and `classes_run` below records the scope.
const MODE = (N === REGISTERED_N && FORCE_THROW === null) ? 'live' : 'sim';
const stamp = `${new Date().toISOString().replace(/[-:.]/g, '').slice(0, 15)}Z`;
const outDir = path.join(outRoot, MODE, `run-${stamp}`);
if (fs.existsSync(outDir)) {
  throw new Error(`run-battery: ${outDir} exists; results are append-only and this run refuses to overwrite`);
}
fs.mkdirSync(outDir, { recursive: true });

const classIndices = {};
for (const classId of Object.keys(FAULT_CLASSES)) {
  classIndices[classId] = REGISTERED_CELLS.filter((c) => c.fault_class === classId).map((c) => c.idx);
}

fs.writeFileSync(path.join(outDir, 'summary.json'), `${JSON.stringify({ cells }, null, 1)}\n`);
fs.writeFileSync(path.join(outDir, 'manifest.json'), `${JSON.stringify({
  study: 'coverage',
  prereg: 'PREREGISTRATION.md',
  git_sha: gitSha,
  engine_pin: enginePin,
  engine_version: enginePin,
  node: process.version,
  // Interpolated from the constants the run actually used, never retyped: a manifest that
  // quoted the seed scheme as a hardcoded string could describe a run that used different
  // numbers. assertRegistryAgreement() pins each constant to its registered literal.
  seed_scheme: {
    cell: `CELL_SEED = BASE_SEED(${BASE_SEED}) + cellIndex`,
    trajectory: `seed(i) = CELL_SEED + ${TRAJ_STEP}*i`,
    series: `seed(i,k) = CELL_SEED + ${TRAJ_STEP}*i + ${SERIES_SALT}*k (K2 matrices and arm 30)`,
    heldout: `HELDOUT_SEED = CELL_SEED + ${HELDOUT_OFFSET}; seed(j) = HELDOUT_SEED + ${TRAJ_STEP}*j, `
      + `j = 0..${HELDOUT_ROWS - 1}`,
    heldout_seed_arm_31: ARM_CELLS.find((a) => a.idx === 31).seed + HELDOUT_OFFSET,
    heldout_seed_arm_32: ARM_CELLS.find((a) => a.idx === 32).seed + HELDOUT_OFFSET,
    constants: {
      base_seed: BASE_SEED,
      trajectory_step: TRAJ_STEP,
      series_salt: SERIES_SALT,
      heldout_offset: HELDOUT_OFFSET,
    },
  },
  mode: MODE,
  n: N,
  registered_n: REGISTERED_N,
  smoke: N !== REGISTERED_N,
  ticks: T,
  onset: ONSET,
  alpha: ALPHA,
  sigma: SIGMA,
  detectors: [...new Set(cells.map((c) => c.detector))],
  classes: classIndices,
  classes_run: CLASSES_RUN,
  arms: ARM_CELLS.filter((a) => CLASSES_RUN.includes(a.hint)).map((a) => ({ cell_index: a.idx, detector: a.arm_detector })),
  substrate: 'validation/coverage/lib/inject.mjs (this battery\'s own generators; A7 T1)',
  substrate_sha256: substrateSha,
  family_d_adapter_sha256: familyDAdapterSha,
  tier: 'T1',
  force_throw_hook: FORCE_THROW,
  generated_at: stamp,
}, null, 1)}\n`);

// Elapsed time is operator information, not a manifest field: A8 registers the field list and
// wall-clock is not in it, so it goes to stderr instead of into the frozen record.
process.stderr.write(`\n${cells.length} cells -> ${outDir}\nelapsed ${(Date.now() - t0) / 1000}s\n`);

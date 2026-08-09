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
import assert from 'node:assert/strict';
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
const shapeBlockBet = require(path.join(ENGINE_ROOT, 'dist/detectors/shape-block-conformal-bet.js'));
// Amendment v2.K6A.1: K6-slow's single candidate, shape_ecdf_accumulator (C49 task 3's module).
const shapeEcdfAcc = require(path.join(ENGINE_ROOT, 'dist/detectors/shape-ecdf-accumulator.js'));

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

// ── the per-class scenario span and per-class substrate size (Amendment v2.K6A.1 K6A.1.9,
// items 7 and 8 of K6A.1.13; the nine further HELDOUT_ROWS sites and the arm mechanism are
// v2.K6A.2 K6A.2.5) ───────────────────────────────────────────────────────────────────────
//
// T/ONSET/TEST above were module scalars for every class. K6-slow is read over an HOURS-SCALE
// horizon and cannot share them, so the span is now looked up per class. EVERY EXISTING CLASS
// KEEPS T = 300 / ONSET = 100 BIT-FOR-BIT: the scalars above are still the only place those
// numbers exist, `DEFAULT_SPAN` is a view onto them, and `spanFor` returns that same frozen
// object for every class but `K6-slow`. CAL is deliberately NOT per class: it is safe_t's and
// universal_inference's calibration window (§5), and neither detector is registered on K6-slow
// (K6A.1.9's single-detector assignment), so a K6-slow CAL would be an invented constant.
const T_K6SLOW = 6300;                        // K6A.1.9: baseline 300 + 6,000 post-onset
const ONSET_K6SLOW = 300;                     // K6A.1.9
const TEST_K6SLOW = { start: ONSET_K6SLOW, len: T_K6SLOW - ONSET_K6SLOW };   // {300, 6000}
const DEFAULT_SPAN = Object.freeze({ T, ONSET, TEST });
const K6SLOW_SPAN = Object.freeze({ T: T_K6SLOW, ONSET: ONSET_K6SLOW, TEST: TEST_K6SLOW });
const spanFor = (classId) => (classId === 'K6-slow' ? K6SLOW_SPAN : DEFAULT_SPAN);
// Arms carry `hint` (the class whose geometry the arm borrows) and no `fault_class`; fault cells
// carry `fault_class` and no `hint`. K6A.2.5: arms are keyed by `hint` at the arm loop, so
// arm 47's long span comes through this lookup and not from the fault-cell path.
const classOf = (cellOrArm) => cellOrArm.fault_class ?? cellOrArm.hint;

// The calibration substrate size, per class. K6A.1.9 registers n = 100,000 for K6-slow
// (A = 25,000, B = 75,000 -> m = 500 blocks of 150 exactly); every existing consumer keeps
// §6's HELDOUT_ROWS = 10,000. Read off the module's own frozen export rather than retyped, the
// same cross-check discipline K3_WINDOW_LEN/K6_WINDOW_LEN use below, and pinned against the
// registered literal in assertRegistryAgreement.
const HELDOUT_ROWS_K6SLOW = shapeEcdfAcc.N_ROWS_K6SLOW;
const heldoutRowsFor = (classId) => (classId === 'K6-slow' ? HELDOUT_ROWS_K6SLOW : HELDOUT_ROWS);

// Amendment v2.K3, K3.9: six disjoint 30-tick windows of the post-onset slice [100,280);
// t=280..299 (20 ticks) is unused. window_len is cross-checked against the module's own
// W_K3 export so a value drift crashes at startup rather than silently mismatching the
// registered partition.
const K3_WINDOWS = 6;
const K3_WINDOW_LEN = spectralBet.W_K3;
const K3_WINDOW_SPAN = `[${ONSET},${ONSET + K3_WINDOWS * K3_WINDOW_LEN})`;
if (K3_WINDOW_LEN !== 30) throw new Error(`run-battery: spectralBet.W_K3 is ${K3_WINDOW_LEN}, PREREGISTRATION.md K3.1 registers 30`);
if (K3_WINDOW_SPAN !== '[100,280)') throw new Error(`run-battery: K3 window span computed as ${K3_WINDOW_SPAN}, PREREGISTRATION.md K3.9 registers [100,280)`);

// Amendment v2.K6, K6.10: the class endpoint reuses K3.9's identical window partition
// (disjoint-window product martingale, same shape as spectralBetWealth), cross-checked
// against the module's own W_K6 export the same way K3's is above.
const K6_WINDOWS = 6;
const K6_WINDOW_LEN = shapeBlockBet.W_K6;
const K6_WINDOW_SPAN = `[${ONSET},${ONSET + K6_WINDOWS * K6_WINDOW_LEN})`;
if (K6_WINDOW_LEN !== 30) throw new Error(`run-battery: shapeBlockBet.W_K6 is ${K6_WINDOW_LEN}, PREREGISTRATION.md K6.1 registers 30`);
if (K6_WINDOW_SPAN !== '[100,280)') throw new Error(`run-battery: K6 window span computed as ${K6_WINDOW_SPAN}, PREREGISTRATION.md K6.10 registers [100,280)`);

// Amendment v2.K6A.1, K6A.1.9: K6-slow's own partition — 40 disjoint 150-tick windows of
// [300, 6300), i.e. TEST_K6SLOW exactly, no remainder. This is a SEPARATE set of constants and
// not a widening of K6's: v2.K6A.2 K6A.2.1 item 12 records that K6_WINDOW_LEN is hardwired to
// `shapeBlockBet.W_K6` and asserted `!== 30 -> throw` immediately above, so a W = 150 detector
// cannot reuse it, and the two shape detectors must carry PER-DETECTOR W. W is cross-checked
// against the accumulator module's own W_K6SLOW export the same way K3's and K6's are.
const K6SLOW_WINDOW_LEN = shapeEcdfAcc.W_K6SLOW;
const K6SLOW_WINDOWS = TEST_K6SLOW.len / K6SLOW_WINDOW_LEN;
const K6SLOW_WINDOW_SPAN = `[${ONSET_K6SLOW},${ONSET_K6SLOW + K6SLOW_WINDOWS * K6SLOW_WINDOW_LEN})`;
if (K6SLOW_WINDOW_LEN !== 150) throw new Error(`run-battery: shapeEcdfAcc.W_K6SLOW is ${K6SLOW_WINDOW_LEN}, PREREGISTRATION.md K6A.1.2 registers 150`);
if (K6SLOW_WINDOWS !== 40) throw new Error(`run-battery: K6-slow window count computed as ${K6SLOW_WINDOWS}, PREREGISTRATION.md K6A.1.9 registers 40 (6,000/150, no remainder)`);
if (K6SLOW_WINDOW_SPAN !== '[300,6300)') throw new Error(`run-battery: K6-slow window span computed as ${K6SLOW_WINDOW_SPAN}, PREREGISTRATION.md K6A.1.9 registers [300,6300)`);

// The T1 geometry the accumulator's calibration MUST have, held here as the harness's own
// registered literals (K6A.1.2/K6A.1.9) rather than read off the module — a check against the
// module's own constants could only ever agree with itself. `assertRegisteredGeometryK6slow`
// below asserts every calibration the T1 path builds against this object before any cell is
// scored, and the startup check pins it against the module's frozen export as well, so a drift
// on either side is a crash rather than a differently-calibrated run under this class's name.
// T2 (the clustersynth arm) runs at the registered m = 45 (K6A.1.11) and is NOT this object.
const REGISTERED_GEOMETRY_K6SLOW = Object.freeze({ W: 150, nA: 25000, m: 500 });
{
  const g = REGISTERED_GEOMETRY_K6SLOW;
  const mod = shapeEcdfAcc.REGISTERED_GEOMETRY_K6SLOW;
  if (g.W !== mod.W || g.nA !== mod.nA || g.m !== mod.m) {
    throw new Error(`run-battery: registered K6-slow geometry ${JSON.stringify(g)} != the module's own `
      + `${JSON.stringify({ W: mod.W, nA: mod.nA, m: mod.m })} (PREREGISTRATION.md K6A.1.2)`);
  }
  if (g.nA + g.m * g.W !== HELDOUT_ROWS_K6SLOW) {
    throw new Error(`run-battery: K6-slow geometry ${g.nA} + ${g.m}*${g.W} != the ${HELDOUT_ROWS_K6SLOW}-row `
      + 'substrate K6A.1.9 registers (A = 25,000, B = 75,000)');
  }
}
// ── the null-growth screen (Amendment v2.K6A.3 K6A.3.1, corrected by v2.K6A.4 K6A.4.1) ───────
// K6A.1.10 registers the screen as stop condition (2) and states that running it AT RUN TIME on
// FRESH draws is what makes it a stop condition rather than a citation. Nothing called it until
// the rider registered a driver; the numbers below are the rider's, transcribed.
//
// SCREEN_MC_WINDOWS is DERIVED, not chosen: g_null carries MC noise
// (1-kappa)*sd(-log p)/sqrt(M), and at the exact m = 500 law sd(-log p) = 0.975005, so M = 8000
// gives an MC SE of 0.003466. Composed with K6A.1.5's across-draw sd (1.571e-2 about a mean of
// -6.754e-2) that puts the registered path's own false-STOP rate at ~0.34% over 250 draws
// (K6A.4.1's correction of K6A.3.1's ~0.2%, which composed MC noise alone).
const SCREEN_DRAWS = 250;                     // K6A.1.10's own number
const SCREEN_MC_WINDOWS = 8000;               // K6A.3.1's derived count
const SCREEN_DRAWS_SMOKE = 5;                 // K6A.3.1
// Amendment v2.K6A.4 (K6A.4.1) SUPERSEDES K6A.3.1's 200. That count fired on the driver's FIRST
// run — screen draw 41000003 read g_null = +0.008760 at M = 200 and reads -0.041339 at M = 2,000,
// -0.047401 at M = 8,000, so the abort was mechanically correct and the reading was MC noise. The
// screen ENFORCES on every run it runs on (one rule for both paths; a screen that reports without
// stopping is the citation K6A.1.10 forbade), so the count is what makes enforcement honest: at
// M = 2,000 the smoke path's false-STOP probability is 2.1e-4 per run against M = 200's 3.0%.
const SCREEN_MC_WINDOWS_SMOKE = 2000;         // K6A.4.1
// K6A.3.1's registered fresh bands: seed(d) = 41,000,000 + d and
// seed(d,j) = 42,000,000 + 10,000*d + j. Every member exceeds 37,033,479, the maximum seed any
// registered stream of this study starts at (arm 30's K2 matrix, asserted below), so exact-seed
// disjointness holds by the bound rather than by trust. K6A.2.3's withdrawn band-ordering
// argument is NOT re-used, and its one-orbit limitation is inherited. K6A.4.2 measured the
// spaced-seed scheme against one continuous stream and found no detectable bias, so it stands.
const SCREEN_CAL_SEED_BASE = 41000000;
const SCREEN_MC_SEED_BASE = 42000000;
const SCREEN_MC_SEED_STRIDE = 10000;          // bounds M, so no two draws' MC bands can overlap
const SCREEN_MAX_REGISTERED_SEED = 37033479;  // BASE_SEED + 30 + TRAJ_STEP*1999 + SERIES_SALT*9

/** Enforcement, not observability (module review): every K6-slow calibration the T1 path builds
 *  is asserted against the registered geometry BEFORE any cell is scored, so a wrong-W or
 *  wrong-split draw cannot reach a verdict and be discovered afterwards in `cal_fingerprint`. */
function assertRegisteredGeometryK6slow(cal, where) {
  assert.deepStrictEqual(
    { W: cal.W, nA: cal.nA, m: cal.m },
    { W: REGISTERED_GEOMETRY_K6SLOW.W, nA: REGISTERED_GEOMETRY_K6SLOW.nA, m: REGISTERED_GEOMETRY_K6SLOW.m },
    `run-battery: ${where} K6-slow calibration geometry != PREREGISTRATION.md K6A.1.2's registered W/nA/m`,
  );
}

// Test-only hook, named: forces every adapter call for one detector id to throw, so §9's
// NOT-EXECUTABLE fallback path is exercised by test/run-battery.test.mjs. It cannot fire by
// accident — an unset env var leaves it null — and it is recorded in the manifest, so a run
// that used it can never be read as a measurement.
const FORCE_THROW = process.env.COVERAGE_FORCE_THROW ?? null;

// Test-only hook, named: overwrites spectral_bet_e_process's window 0 with a huge on-grid
// (k=3) oscillation on every trajectory, pushing U_3 past double-precision's ~745 underflow
// threshold so p_3 = exp(-U_3) is exactly 0 and e_3 = kappa*p^(kappa-1) is Infinity — proving
// the degenerate_windows counter (K3.1.6) can actually move, a positive control the ordinary
// registered amplitudes never exercise. Cannot fire by accident (unset env var leaves it
// false) and is recorded in the manifest, same convention as COVERAGE_FORCE_THROW.
const FORCE_SPECTRAL_DEGENERATE = process.env.COVERAGE_FORCE_SPECTRAL_DEGENERATE === '1';

// Test-only hook, named: overwrites shape_block_conformal_bet's window 0 with a constant
// block on every trajectory, so shapeMoments' m2 is exactly 0 for that window (m3, m4 also
// 0, so kurtosis = m4/(m2*m2) = 0/0 = NaN and absSkew = |m3|/m2^1.5 = 0/0 = NaN) — the SAME
// live-side degeneracy pathway featureResult's own NaN guard exists for (shape-block-
// conformal-bet.ts:262-275: non-finite T -> e=1, p=NaN, "neutral, holds the books"), proving
// the degenerate_windows counter (K6.7) can actually move. Amendment v2.K6.2 (K6.2.1)
// registers this pathway is genuinely reachable without forcing at d=2.0 (a live window of
// 30 iid two-point +-1 draws all landing on the same sign has probability 2*0.5^30 ~= 1.9e-9
// per window — rare, but the counter must be ABLE to count it if it ever fires). Cannot fire
// by accident (unset env var leaves it false) and is recorded in the manifest, same
// convention as COVERAGE_FORCE_SPECTRAL_DEGENERATE.
const FORCE_SHAPE_DEGENERATE = process.env.COVERAGE_FORCE_SHAPE_DEGENERATE === '1';

// Test-only hook, named: restores the PRE-Amendment-v2.C1 held-out draw (one gaussian per
// arithmetically-spaced LCG seed — the rank-1 Kronecker lattice C1.1 names) so a test can prove
// the C1.2 serial-structure guard actually rejects it. Without this control, a guard that never
// fires is indistinguishable from a guard that cannot fire. Cannot fire by accident (unset env
// var leaves it false), forces MODE=sim, and is recorded in the manifest, same convention as
// COVERAGE_FORCE_THROW / COVERAGE_FORCE_SPECTRAL_DEGENERATE / COVERAGE_FORCE_SHAPE_DEGENERATE.
const FORCE_HELDOUT_LATTICE = process.env.COVERAGE_FORCE_HELDOUT_LATTICE === '1';

// Test-only hook, named: replaces the null-growth screen's calibration substrate with a
// SYNTHETIC draw engineered to have POSITIVE null growth — the reference blocks are a
// quantile-regular sample of A (the extreme form of the compressed-reference defect C1.1 found in
// the wild, Amendment v2.C1), so every genuine null window ranks as more extreme than every
// reference block, E[-log p] is driven to its ceiling log(m+1) = 6.2166 and
// g_null = log kappa + (1-kappa)*6.2166 = +1.594 > 0. This is the positive control Amendment
// v2.K6A.3 (K6A.3.1) requires: without it, a screen that CANNOT fire is indistinguishable from a
// screen that never fires. Cannot fire by accident (unset env var leaves it false), forces
// MODE=sim, and is recorded in the manifest, same convention as COVERAGE_FORCE_THROW /
// COVERAGE_FORCE_SPECTRAL_DEGENERATE / COVERAGE_FORCE_SHAPE_DEGENERATE /
// COVERAGE_FORCE_HELDOUT_LATTICE.
const FORCE_SCREEN_POSITIVE = process.env.COVERAGE_FORCE_SCREEN_POSITIVE === '1';

// Amendment v2.C1, C1.6: a rerun declares, in its own manifest, which already-registered
// (study, run, detector) rows it supersedes — the only way a preserved prior run stops being
// scored alongside its own correction (validation/certification/lib/collect.mjs pools every
// directory under validation/*/results/live/ with no cross-run dedup). Both flags travel
// together or neither does: a supersession with no stated reason is not auditable, and a reason
// with nothing named is not machine-readable.
//   --supersedes "study/run:detA,detB;study/run:detC"   --supersedes-reason "<text>"
const SUPERSEDES_RAW = arg('--supersedes', null);
const SUPERSEDES_REASON = arg('--supersedes-reason', null);
function parseSupersedes() {
  if (SUPERSEDES_RAW === null && SUPERSEDES_REASON === null) return null;
  if (SUPERSEDES_RAW === null || SUPERSEDES_REASON === null) {
    throw new Error('run-battery: --supersedes and --supersedes-reason must be given together (C1.6)');
  }
  const out = SUPERSEDES_RAW.split(';').map((entry) => {
    const [locator, dets] = entry.split(':');
    const [study, run] = (locator ?? '').split('/');
    if (!study || !run || !dets) {
      throw new Error(`run-battery: --supersedes entry "${entry}" must read study/run:detector[,detector] (C1.6)`);
    }
    return { study, run, detectors: dets.split(',').map((d) => d.trim()).filter(Boolean), reason: SUPERSEDES_REASON };
  });
  for (const s of out) {
    // A supersession that names a directory nobody can find is a typo that would silently
    // supersede nothing, so it is a startup crash rather than a run with a dead declaration.
    const dir = path.resolve(STUDY, '..', s.study, 'results', 'live', s.run);
    if (!fs.existsSync(dir)) throw new Error(`run-battery: --supersedes names ${s.study}/${s.run}, which does not exist at ${dir}`);
    if (!s.detectors.length) throw new Error(`run-battery: --supersedes names ${s.study}/${s.run} with no detectors`);
  }
  return out;
}

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
  // Amendment v2.K5R, K5R.5: K5's re-registered grid. Indices START AT 38 because 35, 36 and 37
  // are already registered seeds -- K6_T2_SCENARIO_SEED (K6.12, 20260842, asserted in
  // run-clustersynth-arm.mjs:67-68), K6E.9's shape_ecdf_conformal_bet arm (20260843) and
  // K6E.10's K6E_T2_SCENARIO_SEED (20260844). v2.K6E.17 cancelled that run; a cancelled run does
  // not release a registered index, so reusing 36 or 37 would make two registrations share a
  // seed. Appended (not interleaved with cells 22-25) so every earlier cell keeps its index, and
  // therefore its CELL_SEED and its trajectory stream, bit-for-bit.
  F(38, 'K5', 'slope2.5e-3', 0), F(39, 'K5', 'slope5e-3', 0), F(40, 'K5', 'slope1e-2', 0),
  F(41, 'K5', 'slope2e-2', 0), F(42, 'K5', 'slope1e-2-ar1', 0.6),
  // Amendment v2.K6A.1, K6A.1.9: the K6-slow cells, continuing the index sequence past 42.
  // Same severities and same canonical as K6 (the same injectShapeMix construction); what
  // differs is the horizon they are read over -- T = 6,300 / ONSET = 300, 40 disjoint windows
  // of 150 -- and their 100,000-row calibration substrate. Appended, so every earlier cell
  // keeps its index and therefore its CELL_SEED and its trajectory stream, bit-for-bit.
  F(43, 'K6-slow', 'mix-d1.0', 0), F(44, 'K6-slow', 'mix-d1.5', 0), F(45, 'K6-slow', 'mix-d2.0', 0),
  F(46, 'K6-slow', 'mix-d1.5-ar1', 0.6),
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
  // Amendment v2.K6, K6.6: shape_block_conformal_bet's own arm, CELL_SEED = BASE_SEED + 34 =
  // 20260841, continuing directly from arm 33's index. HELDOUT_SEED = CELL_SEED + 500000 =
  // 20760841 (K6.6's table) — this arm's calibration is EMPIRICAL, unlike arm 33's oracle sigma.
  { idx: 34, arm_detector: 'shape_block_conformal_bet', hint: 'K6', phi: 0, seed: BASE_SEED + 34 },
  // Amendment v2.K6A.1, K6A.1.9: shape_ecdf_accumulator's own arm, CELL_SEED = BASE_SEED + 47 =
  // 20260854, HELDOUT_SEED = 20760854 (K6A.1.9's table). `hint: 'K6-slow'` is what selects it
  // under --classes K6-slow (K6A.2.5: arms are keyed by hint, not by class) AND what gives it
  // the long span through spanFor — the arm loop reads the span itself, so item 7's per-class
  // span is necessary but not sufficient here.
  { idx: 47, arm_detector: 'shape_ecdf_accumulator', hint: 'K6-slow', phi: 0, seed: BASE_SEED + 47 },
];

// Amendment v2.K5R, K5R.5 clause 3: the registered per-class count of φ=0.6 replicates. K5 is the
// one class with two, because a preserved cell is not deleted when the canonical moves.
// Amendment v2.K6A.1 (K6A.1.13 item 3): K6-slow carries one, cell 46 (`mix-d1.5-ar1`).
const REGISTERED_AR1_ROWS = Object.freeze({ K1: 1, K2: 1, K3: 1, K4: 1, K5: 2, K6: 1, 'K6-slow': 1 });

// The constants module is normative (§1); this table mirrors it. Disagreement is a defect,
// so it is a crash at startup rather than a run nobody can interpret.
function assertRegistryAgreement() {
  for (const [classId, spec] of Object.entries(FAULT_CLASSES)) {
    const rows = REGISTERED_CELLS.filter((c) => c.fault_class === classId);
    const grid = rows.filter((c) => c.phi === 0).map((c) => c.severity);
    if (JSON.stringify(grid) !== JSON.stringify(spec.grid)) {
      throw new Error(`run-battery: ${classId} grid ${JSON.stringify(grid)} != FAULT_CLASSES ${JSON.stringify(spec.grid)}`);
    }
    // §4 gives each class the φ=0.6 replicate of its own canonical. Amendment v2.K5R (K5R.5)
    // makes K5 carry TWO: the current canonical's (`slope1e-2-ar1`) and the retired canonical's
    // (`slope1e-4-ar1`, preserved as evidence of a different question, K5R.4). The registered
    // invariant is therefore three checks, not "exactly one row": the current canonical's
    // replicate is present, every replicate replicates a registered grid entry, and the per-class
    // count equals K5R.5's literal table. The third clause is what keeps this from being a
    // loosening -- a stray extra replicate in any class still crashes at startup.
    const ar1Rows = rows.filter((c) => c.phi === 0.6);
    if (!ar1Rows.some((c) => c.severity === `${spec.canonical}-ar1`)) {
      throw new Error(`run-battery: ${classId} has no ${spec.canonical}-ar1 replicate (§4)`);
    }
    for (const c of ar1Rows) {
      const base = c.severity.replace(/-ar1$/, '');
      if (!spec.grid.includes(base)) {
        throw new Error(`run-battery: ${classId} replicate ${c.severity} replicates ${base}, which is not a registered grid entry (§4, K5R.5)`);
      }
    }
    if (ar1Rows.length !== REGISTERED_AR1_ROWS[classId]) {
      throw new Error(`run-battery: ${classId} has ${ar1Rows.length} φ=0.6 replicates, K5R.5 registers ${REGISTERED_AR1_ROWS[classId]}`);
    }
  }
  for (const c of REGISTERED_CELLS) {
    if (c.seed !== BASE_SEED + c.idx) throw new Error(`run-battery: cell ${c.idx} seed ${c.seed} != CELL_SEED formula`);
  }
  if (REGISTERED_CELLS.length !== 39) throw new Error(`run-battery: ${REGISTERED_CELLS.length} fault cells, §4 + Amendment v2.K5R + v2.K6A.1 K6A.1.9 register 39`);
  // Amendment v2.K5R, K5R.5's index table, pinned by value: the cell indices ARE the seed scheme,
  // so a moved index is a different data set under the same severity label. Indices 35-37 are
  // reserved by K6.12/K6E.9/K6E.10 and must stay absent from the fault-cell table.
  //
  // Amendment v2.K5R.1, K5R.1.1: cell 25 joins this table. The three -ar1 checks above bound HOW
  // MANY replicates a class carries, not WHICH ones -- so relabelling the preserved replicate from
  // `slope1e-4-ar1` to any other grid severity's `-ar1` passed all three (the reviewer's mutation
  // R1: both suites green, where the pre-K5R "exactly one, and it is the canonical's" assertion
  // crashed here). Cell 42 was pinned by this table; cell 25 was pinned by nothing once that
  // assertion was replaced. §6's seed table already registers cell 25 as slope1e-4-ar1 / 20260832;
  // this makes the harness assert it.
  for (const [idx, severity, phi, seed] of [
    [25, 'slope1e-4-ar1', 0.6, 20260832],
    [38, 'slope2.5e-3', 0, 20260845], [39, 'slope5e-3', 0, 20260846], [40, 'slope1e-2', 0, 20260847],
    [41, 'slope2e-2', 0, 20260848], [42, 'slope1e-2-ar1', 0.6, 20260849],
  ]) {
    const cell = REGISTERED_CELLS.find((c) => c.idx === idx);
    if (!cell) throw new Error(`run-battery: no fault cell at index ${idx}, K5R.5 registers ${severity}`);
    if (cell.fault_class !== 'K5' || cell.severity !== severity || cell.phi !== phi || cell.seed !== seed) {
      throw new Error(`run-battery: cell ${idx} is ${cell.fault_class} ${cell.severity} φ=${cell.phi} seed=${cell.seed}, `
        + `K5R.5 registers K5 ${severity} φ=${phi} seed=${seed}`);
    }
  }
  for (const idx of [35, 36, 37]) {
    if (REGISTERED_CELLS.some((c) => c.idx === idx)) {
      throw new Error(`run-battery: fault cell at index ${idx}, which K6.12/K6E.9/K6E.10 already registered as a seed`);
    }
  }
  // Amendment v2.K6A.1, K6A.1.9's index table, pinned by value for the same reason K5R.5's is:
  // the index IS the seed scheme, so a moved index is a different data set under the same
  // severity label. HELDOUT_SEED is pinned by the same table's third column.
  for (const [idx, severity, phi, seed, heldoutSeed] of [
    [43, 'mix-d1.0', 0, 20260850, 20760850], [44, 'mix-d1.5', 0, 20260851, 20760851],
    [45, 'mix-d2.0', 0, 20260852, 20760852], [46, 'mix-d1.5-ar1', 0.6, 20260853, 20760853],
  ]) {
    const cell = REGISTERED_CELLS.find((c) => c.idx === idx);
    if (!cell) throw new Error(`run-battery: no fault cell at index ${idx}, K6A.1.9 registers ${severity}`);
    if (cell.fault_class !== 'K6-slow' || cell.severity !== severity || cell.phi !== phi || cell.seed !== seed) {
      throw new Error(`run-battery: cell ${idx} is ${cell.fault_class} ${cell.severity} φ=${cell.phi} seed=${cell.seed}, `
        + `K6A.1.9 registers K6-slow ${severity} φ=${phi} seed=${seed}`);
    }
    if (cell.seed + HELDOUT_OFFSET !== heldoutSeed) {
      throw new Error(`run-battery: cell ${idx} HELDOUT_SEED ${cell.seed + HELDOUT_OFFSET} != registered ${heldoutSeed}`);
    }
  }
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
    // Amendment v2.K6A.1, K6A.1.9 (item 8 of K6A.1.13): the substrate size is per class from
    // here on, so the literal check splits accordingly — §6's 10,000 for every existing
    // consumer, K6A.1.9's 100,000 for K6-slow. A single literal would have crashed the
    // 100,000-row draw at startup; a single UNCHECKED constant would have let it drift.
    ['HELDOUT_ROWS_K6SLOW', HELDOUT_ROWS_K6SLOW, 100000, 'K6A.1.9'],
    ['T_K6SLOW', T_K6SLOW, 6300, 'K6A.1.9'],
    ['ONSET_K6SLOW', ONSET_K6SLOW, 300, 'K6A.1.9'],
    // Amendment v2.K6A.3/v2.K6A.4: the screen's own registered numbers and seed bands. A screen
    // whose draw or MC count drifted would be a differently-powered falsifier under the same
    // name, and a screen whose seed band drifted would not be fresh.
    ['SCREEN_DRAWS', SCREEN_DRAWS, 250, 'K6A.1.10/K6A.3.1'],
    ['SCREEN_MC_WINDOWS', SCREEN_MC_WINDOWS, 8000, 'K6A.3.1'],
    ['SCREEN_DRAWS_SMOKE', SCREEN_DRAWS_SMOKE, 5, 'K6A.3.1'],
    ['SCREEN_MC_WINDOWS_SMOKE', SCREEN_MC_WINDOWS_SMOKE, 2000, 'K6A.4.1'],
    ['SCREEN_CAL_SEED_BASE', SCREEN_CAL_SEED_BASE, 41000000, 'K6A.3.1'],
    ['SCREEN_MC_SEED_BASE', SCREEN_MC_SEED_BASE, 42000000, 'K6A.3.1'],
    ['SCREEN_MC_SEED_STRIDE', SCREEN_MC_SEED_STRIDE, 10000, 'K6A.3.1'],
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
  // Amendment v2.K6, K6.6: arm 34's own CELL_SEED and HELDOUT_SEED, shown by arithmetic there.
  const arm34Cell = ARM_CELLS.find((a) => a.idx === 34);
  if (arm34Cell.seed !== 20260841) throw new Error(`run-battery: arm-34 CELL_SEED ${arm34Cell.seed} != registered 20260841`);
  const arm34Heldout = arm34Cell.seed + HELDOUT_OFFSET;
  if (arm34Heldout !== 20760841) throw new Error(`run-battery: arm-34 HELDOUT_SEED ${arm34Heldout} != registered 20760841`);
  // Amendment v2.K6A.1, K6A.1.9's table: arm 47's own CELL_SEED and HELDOUT_SEED, and its
  // `hint` — the hint is not cosmetic, it is what selects the arm under --classes and what
  // hands it the long span (K6A.2.5), so a wrong hint is a silently unrun or wrongly-spanned arm.
  const arm47Cell = ARM_CELLS.find((a) => a.idx === 47);
  if (arm47Cell.seed !== 20260854) throw new Error(`run-battery: arm-47 CELL_SEED ${arm47Cell.seed} != registered 20260854`);
  const arm47Heldout = arm47Cell.seed + HELDOUT_OFFSET;
  if (arm47Heldout !== 20760854) throw new Error(`run-battery: arm-47 HELDOUT_SEED ${arm47Heldout} != registered 20760854`);
  if (arm47Cell.hint !== 'K6-slow') throw new Error(`run-battery: arm-47 hint is "${arm47Cell.hint}", K6A.1.9/K6A.2.5 register K6-slow`);
  if (arm47Cell.arm_detector !== 'shape_ecdf_accumulator') {
    throw new Error(`run-battery: arm-47 detector is "${arm47Cell.arm_detector}", K6A.1.9 registers shape_ecdf_accumulator`);
  }
  // Amendment v2.K6A.3, K6A.3.1: the screen's freshness ground, checked by arithmetic rather than
  // asserted in prose. The study's maximum registered seed is re-derived from the constants here
  // (never retyped), and every seed either band can produce must exceed it.
  const maxRegisteredSeed = Math.max(
    ...ARM_CELLS.map((a) => a.seed + TRAJ_STEP * 1999 + (a.K ? SERIES_SALT * (a.K - 1) : 0)),
    ...REGISTERED_CELLS.map((c) => c.seed + TRAJ_STEP * 1999),
    ...REGISTERED_CELLS.map((c) => c.seed + HELDOUT_OFFSET),
    ...ARM_CELLS.map((a) => a.seed + HELDOUT_OFFSET),
  );
  if (maxRegisteredSeed !== SCREEN_MAX_REGISTERED_SEED) {
    throw new Error(`run-battery: the study's maximum registered seed is ${maxRegisteredSeed}, `
      + `K6A.3.1 records ${SCREEN_MAX_REGISTERED_SEED} — the screen's disjointness bound rests on it`);
  }
  if (!(SCREEN_CAL_SEED_BASE > maxRegisteredSeed && SCREEN_MC_SEED_BASE > maxRegisteredSeed)) {
    throw new Error('run-battery: a null-growth screen seed band overlaps the registered seeds '
      + `(max ${maxRegisteredSeed}); K6A.3.1 registers exact-seed disjointness by enumeration`);
  }
  if (SCREEN_MC_WINDOWS > SCREEN_MC_SEED_STRIDE) {
    throw new Error(`run-battery: SCREEN_MC_WINDOWS ${SCREEN_MC_WINDOWS} exceeds the ${SCREEN_MC_SEED_STRIDE} `
      + 'stride, so two draws\' MC seed bands would overlap (K6A.3.1)');
  }
  // Amendment v2.K6, K6.6's table: shape_block_conformal_bet's four fault cells' own
  // HELDOUT_SEEDs, cross-checked against the table's own literals.
  const K6_HELDOUT_SEEDS = { 26: 20760833, 27: 20760834, 28: 20760835, 29: 20760836 };
  for (const [idxStr, expected] of Object.entries(K6_HELDOUT_SEEDS)) {
    const idx = Number(idxStr);
    const cell = REGISTERED_CELLS.find((c) => c.idx === idx);
    const heldout = cell.seed + HELDOUT_OFFSET;
    if (heldout !== expected) throw new Error(`run-battery: cell ${idx} HELDOUT_SEED ${heldout} != registered ${expected}`);
  }
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
    // Amendment v2.K6A.1 (K6A.1.13 item 4): K6-slow SHARES K6's grammar rather than getting its
    // own — the severities are the same injectShapeMix distances, and a second regex would be a
    // second place for the grid labels to drift. Without this case every K6-slow severity throws
    // at the default below.
    case 'K6': case 'K6-slow': if ((m = /^mix-d(\d*\.?\d+)$/.exec(s))) return { d: num(m[1]) }; break;
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
  // Amendment v2.K6A.1 (K6A.1.13 item 7): the span is per class. For every class but K6-slow
  // `spanFor` returns DEFAULT_SPAN, whose T and ONSET ARE the module scalars — same numbers,
  // same arithmetic, same bits.
  const { T: spanT, ONSET: spanOnset } = spanFor(cell.fault_class);
  if (cell.fault_class === 'K2') {
    const matrix = [];
    for (let k = 0; k < p.K; k++) {
      const r = rng(seriesSeed(cell, i, k));
      const draw = drawFor(r, cell.phi);
      matrix.push(Array.from({ length: spanT }, draw));
    }
    return { matrix: injectUnison(matrix, { sigma: SIGMA, at: spanOnset, eps: p.eps }) };
  }
  const r = rng(cellSeed(cell, i));
  const draw = drawFor(r, cell.phi);
  // A5's K6 pinning: the baseline is generated in full FIRST, then injectShapeMix is called
  // with the same, now-advanced `r` (it discards the baseline's post-onset values and draws
  // 3 fresh raw values per tick from that stream).
  const base = Array.from({ length: spanT }, draw);
  switch (cell.fault_class) {
    case 'K1': return { series: injectStep(base, { sigma: SIGMA, at: spanOnset, delta: p.delta }) };
    case 'K3': return { series: injectOscillation(base, { sigma: SIGMA, at: spanOnset, amp: p.amp, freq: p.freq }) };
    case 'K4': return { series: injectPoint(base, { sigma: SIGMA, at: spanOnset, mult: p.mult }) };
    case 'K5': return { series: injectDrift(base, { sigma: SIGMA, at: spanOnset, slope: p.slope }) };
    // Amendment v2.K6A.1 (K6A.1.13 item 5): K6-slow's generator is K6's, at the long span. The
    // 6,000-tick post-onset slice is the whole of the class's difference from K6 — same
    // injectShapeMix, same A5 pinning convention, same `r`.
    case 'K6': case 'K6-slow': return { series: injectShapeMix(base, { sigma: SIGMA, at: spanOnset, d: p.d, rng: r }) };
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
      // Test-only positive control (never fires unless COVERAGE_FORCE_SPECTRAL_DEGENERATE=1):
      // replace window 0 with a huge on-grid k=3 oscillation so I(f_3) underflows p_3 to
      // exactly 0, forcing e_3 = Infinity and eAvg non-finite — proving degenerate_windows
      // can move at all (reviewer's Important 1).
      if (FORCE_SPECTRAL_DEGENERATE) {
        windows[0] = Array.from({ length: K3_WINDOW_LEN },
          (_, tau) => 1e8 * Math.sin(2 * Math.PI * (3 / K3_WINDOW_LEN) * tau));
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
  // Amendment v2.K6/v2.K6.1: shape_block_conformal_bet. K6.10's registered adapter
  // reading: slice the post-onset span into the SAME six disjoint 30-tick windows K3.9
  // registers, and call shapeBetWealth(windows, cal) once per trajectory against the
  // cell/arm's own empirical (held-out) calibration (K6.3: m=333 at n=10,000, W=30).
  // shapeBetWindow is ALSO called directly per window (not only through shapeBetWealth)
  // because K6.7's S2 arm needs the raw per-window eAvg (increment_estimator) and
  // per-feature p (p_uniformity) BEFORE advanceLogWealth absorbs a degenerate read —
  // shapeBetWealth's own log[] does not expose that (identical reasoning to K3.9's comment).
  shape_block_conformal_bet: {
    kind: 'shapeblock',
    read: (data, cell, ctx) => {
      const windows = [];
      for (let w = 0; w < K6_WINDOWS; w++) {
        const start = ONSET + w * K6_WINDOW_LEN;
        windows.push(data.series.slice(start, start + K6_WINDOW_LEN));
      }
      // Test-only positive control (never fires unless COVERAGE_FORCE_SHAPE_DEGENERATE=1):
      // see the flag's own comment above.
      if (FORCE_SHAPE_DEGENERATE) {
        windows[0] = Array.from({ length: K6_WINDOW_LEN }, () => 0);
      }
      let degenerateWindows = 0;
      const eAvgs = new Array(K6_WINDOWS);
      const ps = [];
      for (let w = 0; w < K6_WINDOWS; w++) {
        const { perFeature, eAvg } = shapeBlockBet.shapeBetWindow(windows[w], ctx.shapeCal);
        // Bug fix (post-Task-11a review, Important 1): eAvg is the MEAN of the two per-
        // feature e-values, and featureResult's own NaN guard (shape-block-conformal-bet.ts)
        // returns e=1 (finite) for a degenerate feature — so eAvg stays finite even when a
        // feature genuinely degenerated, and `!Number.isFinite(eAvg)` can never be true. The
        // mechanical signal a feature degenerated is its own `p` (NaN on the guarded path,
        // finite otherwise, per featureResult's return shape) — read that directly instead.
        if (perFeature.some((f) => !Number.isFinite(f.p))) degenerateWindows += 1;
        eAvgs[w] = eAvg;
        for (const f of perFeature) ps.push(f.p);
      }
      const { wealth, log } = shapeBlockBet.shapeBetWealth(windows, ctx.shapeCal);
      const crossed = log.some((l) => l >= Math.log(THRESHOLD));
      return { crossed, wealth, eAvgs, ps, degenerateWindows };
    },
  },
  // Amendment v2.K6A.1, K6A.1.9/K6A.1.10: shape_ecdf_accumulator, K6-slow's single candidate.
  // Same `kind: 'shapeblock'` contract as the detector above — one per-window statistic list,
  // one pooled p list, one wealth path — so `record()` and every emission site treat the two
  // uniformly, which is what makes the dispatch a KIND test rather than a detector-id literal
  // (v2.K6A.2 K6A.2.1 item 12). What is NOT shared is the geometry: 40 windows of 150 over
  // [300, 6300) against K6's 6 of 30 over [100, 280).
  //
  // Two deliberate departures from the sibling adapter, both forced by the module's interface:
  //   - `eAvgs` holds the per-window e DIRECTLY. K6 averages two features per window; this
  //     construction has ONE feature, so there is no averaging step and `mean(out.eAvgs)` in
  //     record() is the mean of the 40 per-window e values — exactly the increment_estimator
  //     K6A.1.12 predicts at 0.9914.
  //   - `degenerateWindows` is a STRUCTURAL zero, not a counter with an unreached branch. The
  //     module has no non-throwing degenerate path (its docstring: a non-finite T can only come
  //     from a non-finite input, which is a defect, so it throws). K6A.1.12 registers
  //     degenerate_windows and non_finite_wealth as structural zeros for this class; the field
  //     is emitted at 0 so a reader sees the claim, and a throw would surface as
  //     adapter_failures instead. Do not wire a countable degenerate branch here.
  shape_ecdf_accumulator: {
    kind: 'shapeblock',
    read: (data, cell, ctx) => {
      const windows = [];
      for (let w = 0; w < K6SLOW_WINDOWS; w++) {
        const start = ONSET_K6SLOW + w * K6SLOW_WINDOW_LEN;
        windows.push(data.series.slice(start, start + K6SLOW_WINDOW_LEN));
      }
      const degenerateWindows = 0;
      const eAvgs = new Array(K6SLOW_WINDOWS);
      const ps = [];
      // Per-window reads first, for the raw e and p the S2 arm's increment_estimator and
      // p_uniformity need BEFORE advanceLogWealth absorbs anything — identical reasoning to
      // K3.9's and K6.10's comments above, and the same deliberate double evaluation.
      for (let w = 0; w < K6SLOW_WINDOWS; w++) {
        const { p, e } = shapeEcdfAcc.ecdfAccumulatorWindow(windows[w], ctx.shapeCal);
        eAvgs[w] = e;
        ps.push(p);
      }
      const { wealth, log } = shapeEcdfAcc.ecdfAccumulatorWealth(windows, ctx.shapeCal);
      const crossed = log.some((l) => l >= Math.log(THRESHOLD));
      return { crossed, wealth, eAvgs, ps, degenerateWindows };
    },
  },
};

// Amendment v2.K6A.2, K6A.2.1 item 12: the two shape detectors, keyed by id, with everything
// that DIFFERS between them in one place — per-detector W and window count, per-detector
// calibration call, per-detector arm null_id literal, per-detector fingerprint source. The
// dispatch sites below test `ADAPTERS[detId].kind === 'shapeblock'` and read this table; the
// literal `detId === 'shape_block_conformal_bet'` the amendment names as a silent wrong-probe
// hazard appears nowhere any more.
const SHAPE_DETECTORS = Object.freeze({
  shape_block_conformal_bet: Object.freeze({
    windows: K6_WINDOWS,
    windowLen: K6_WINDOW_LEN,
    windowSpan: K6_WINDOW_SPAN,
    armNullId: 'K6-arm-heldout',                                   // K6.7's out-of-grammar literal
    calibrate: (rows) => shapeBlockBet.calibrateShapeBlocks(rows, K6_WINDOW_LEN),
    fingerprint: (cal) => shapeCalFingerprint(cal),                // C1.8, derived by this harness
  }),
  shape_ecdf_accumulator: Object.freeze({
    windows: K6SLOW_WINDOWS,
    windowLen: K6SLOW_WINDOW_LEN,
    windowSpan: K6SLOW_WINDOW_SPAN,
    armNullId: 'K6slow-arm-heldout',                               // K6A.1.10's registered literal
    calibrate: (rows, where) => {
      const cal = shapeEcdfAcc.calibrateEcdfAccumulator(rows, REGISTERED_GEOMETRY_K6SLOW);
      assertRegisteredGeometryK6slow(cal, where);
      return cal;
    },
    fingerprint: (cal) => cal.cal_fingerprint,                     // C1.8, exported by the module
  }),
});
const shapeSpecOf = (detId) => SHAPE_DETECTORS[detId] ?? null;

// §7 + A6: which detectors are scored on which class, and (family_D) on which cells.
function detectorsFor(cell) {
  switch (cell.fault_class) {
    case 'K1': case 'K5': return ['safe_t', 'universal_inference'];
    // Amendment v2.K6, K6.6: shape_block_conformal_bet joins K6 as a new row, scored on
    // the class's four registered fault cells (K6 only, not the other five classes).
    case 'K6': return ['safe_t', 'universal_inference', 'shape_block_conformal_bet'];
    // Amendment v2.K6A.1, K6A.1.9 (item 6 of K6A.1.13): K6-slow is scored by
    // shape_ecdf_accumulator ALONE, deliberately. safe_t and universal_inference are NOT
    // registered on this class: scoring them over 6,300 ticks would be a new measurement of two
    // existing detectors under a geometry nothing registers for them. The registered and
    // disclosed cost is that this class row has no paired-comparison partner, so `pairingGaps`
    // will name it.
    case 'K6-slow': return ['shape_ecdf_accumulator'];
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

/** C1.2's registered statistic: the biased sample autocorrelation at lag k. */
function acfAt(xs, k) {
  const m = xs.reduce((a, b) => a + b, 0) / xs.length;
  let num = 0;
  let den = 0;
  for (let i = 0; i < xs.length; i++) den += (xs[i] - m) ** 2;
  for (let i = 0; i + k < xs.length; i++) num += (xs[i] - m) * (xs[i + k] - m);
  return num / den;
}

/** Amendment v2.C1, C1.2 — the registered runtime guard, and the mechanical kill for a
 *  regression to the spaced-seed scheme. The rows must carry the serial structure their own
 *  phi implies: nothing at phi=0, (phi, phi^2) at phi>0. HELDOUT_ACF_BOUND is derived, not
 *  tuned — the iid sampling sd of acf(k) at n=10,000 is ~n^(-1/2) = 0.01, so 0.10 is a
 *  10-sigma bound, while the lattice reads acf(2) = -0.7513 at phi=0 (outside by 7.5x) and
 *  deviates 0.33/0.68 at phi=0.6. This THROWS rather than counting a fallback: a defective
 *  calibration substrate is not a detector failure to tally, it is a run that must not exist. */
const HELDOUT_ACF_BOUND = 0.10;
function assertHeldoutSerialStructure(rows, phi, heldoutSeed) {
  for (const k of [1, 2]) {
    const got = acfAt(rows, k);
    const want = phi ** k;
    if (!(Math.abs(got - want) <= HELDOUT_ACF_BOUND)) {
      throw new Error(
        `run-battery: held-out draw at HELDOUT_SEED ${heldoutSeed} (phi=${phi}) has acf(${k}) `
        + `${got}, which deviates ${Math.abs(got - want)} from the ${want} its phi implies `
        + `(bound ${HELDOUT_ACF_BOUND}, PREREGISTRATION.md Amendment v2.C1 C1.2). The registered `
        + 'generator is ONE continuous stream per held-out draw; the spaced-seed scheme this '
        + 'guard rejects produced a rank-1 Kronecker lattice (C1.1) and moved a verdict.');
    }
  }
}

/** The registered held-out draw shared by both K4 candidates and by K6 (§6's K4 block, A1 for
 *  arm 31, A7's T1 substrate finding, Amendment v2.K4 K4.4 for point_tail_bet_e_value's reuse of
 *  the identical stream on cells 18-21 and its own fresh stream on arm 32, Amendment v2.K6
 *  K6.3/K6.6 for shape_block_conformal_bet): n=10,000 rows drawn from the cell's healthy null
 *  under HELDOUT_SEED = CELL_SEED + 500000. Returning the raw rows (not a detector-specific
 *  calibration) lets every candidate scored on the cell calibrate from the SAME draw, per K4.4.
 *
 *  Amendment v2.C1 (C1.2) SUPERSEDES K4.4/K6.3/K6.6's `seed(j) = HELDOUT_SEED + 7919*j` clause.
 *  HELDOUT_SEED and HELDOUT_ROWS are unchanged; the DRAW is not. The rows are 10,000
 *  CONSECUTIVE draws from one continuously-advanced stream, the same way a live window is 30
 *  consecutive draws — which is the comparability the block-conformal rank assumes and the
 *  contiguity K6's module docstring claims (shape-block-conformal-bet.ts:12-16). Under the old
 *  form `drawFor` was constructed and called ONCE per row, so both uniforms gaussFrom consumes
 *  were affine in j (a rank-1 lattice) and, on the -ar1 cells, the AR(1) recursion never
 *  advanced at all (C1.3). Here the single `draw` closure holds the AR(1) state across rows. */
function heldoutRows(cell) {
  const heldoutSeed = cell.seed + HELDOUT_OFFSET;
  // Amendment v2.K6A.1, K6A.1.9 (item 8 of K6A.1.13, scoped by v2.K6A.2 K6A.2.5): the row count
  // is per class — 100,000 for K6-slow, §6's 10,000 for every existing consumer. The DRAW is
  // otherwise untouched: same HELDOUT_SEED, same single continuously-advanced stream (C1.2), so
  // a 10,000-row class's rows are the same 10,000 numbers as before, bit for bit.
  const nRows = heldoutRowsFor(classOf(cell));
  const rows = new Array(nRows);
  if (FORCE_HELDOUT_LATTICE) {
    // Test-only positive control for the guard above (see the flag's own comment): the exact
    // pre-C1 draw, so a test can prove the guard actually rejects it.
    for (let j = 0; j < nRows; j++) rows[j] = drawFor(rng(heldoutSeed + TRAJ_STEP * j), cell.phi)();
  } else {
    const r = rng(heldoutSeed);
    const draw = drawFor(r, cell.phi);
    for (let j = 0; j < nRows; j++) rows[j] = draw();
  }
  assertHeldoutSerialStructure(rows, cell.phi, heldoutSeed);
  return { rows, heldoutSeed, heldoutRowCount: nRows };
}

/** Amendment v2.C1, C1.8 (review Important 3): the calibration's own fingerprint, read straight
 *  off the ShapeCalibration the row actually used rather than re-derived — the K6 analogue of
 *  point_tail_bet_e_value's cal_median/cal_mad, extended to a two-feature block calibration.
 *  Makes C1's signature (a compressed reference |dev| spread) readable off a future run
 *  directory instead of only off the amendment, and makes the single-draw caveat (C1.7)
 *  checkable: two rows sharing a reference have identical fingerprints. */
const calQuantile = (sortedAbsDev, p) => sortedAbsDev[Math.round(p * (sortedAbsDev.length - 1))];
const calFeatureFingerprint = (f) => ({
  median: f.median,
  absdev_p50: calQuantile(f.sortedAbsDev, 0.5),
  absdev_p90: calQuantile(f.sortedAbsDev, 0.9),
  absdev_max: f.sortedAbsDev[f.sortedAbsDev.length - 1],
});
const shapeCalFingerprint = (cal) => ({
  W: cal.W,
  m: cal.m,
  kurtosis: calFeatureFingerprint(cal.kurtosis),
  absSkew: calFeatureFingerprint(cal.absSkew),
});

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
  // Amendment v2.C38.1, C38.1.2 (registered code item 1): Welford accumulators for the per-POINT
  // sample's sd, which the per-point `mean_e_lower_95` needs and which `pointSumE` alone cannot
  // give. ADDED BESIDE the existing counters, never replacing them: `mean_e` on the point row
  // stays `pointSumE / pointFinite` bit-for-bit, and `pointMeanW` is used only for the variance.
  pointMeanW: 0, pointM2: 0,
  // spectral_bet_e_process only (`kind: 'spectral'`): degenerateWindows sums, across every
  // trajectory AND window scored for the cell, the count of individual spectralBetWindow
  // calls whose eAvg was non-finite (K3.1.6). spectralEAvgMeans holds one number per
  // trajectory — that trajectory's own mean of its six per-window eAvg values, the sample
  // K3.1.1's increment_estimator is built from. spectralPs pools every individual per-bin p
  // value (K3.1.7).
  degenerateWindows: 0, spectralEAvgMeans: [], spectralPs: [],
  // shape_block_conformal_bet only (`kind: 'shapeblock'`): the identical accumulator shape
  // as the spectral fields above, kept separate rather than shared so a K6 read can never
  // silently pool into K3's arrays (each is a per-detId accumulator, so this is belt-and-
  // suspenders, not load-bearing on its own).
  shapeEAvgMeans: [], shapePs: [],
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
        // Amendment v2.C38.1, C38.1.2: Welford, in the same pass, for the per-point sd only.
        const d = e - acc.pointMeanW;
        acc.pointMeanW += d / acc.pointFinite;
        acc.pointM2 += d * (e - acc.pointMeanW);
        if (e >= THRESHOLD) { acc.pointK += 1; anyFired = true; }
      } else {
        acc.pointNonFinite += 1;
      }
    }
    if (anyFired) acc.windowCrossed += 1;
    return;
  }
  if (ADAPTERS[detId].kind === 'spectral' || ADAPTERS[detId].kind === 'shapeblock') {
    if (!Number.isFinite(out.wealth)) { acc.nonFinite += 1; } else { acc.finite += 1; (acc.es ??= []).push(out.wealth); }
    if (out.crossed) acc.fires += 1;
    acc.degenerateWindows += out.degenerateWindows;
    // K3.1.1/K6.7: the trajectory's own increment MEAN is the mean of its six eAvg values —
    // taken from the raw per-window reads (not the post-floor log[] diffs), so a
    // degenerate window (not expected, K3.1.6/K6.7's structural-zero claim) surfaces here
    // as a non-finite mean rather than being silently absorbed the way advanceLogWealth
    // absorbs it for wealth itself. K6 uses its own accumulator arrays (never K3's).
    const meanEAvg = mean(out.eAvgs);
    if (ADAPTERS[detId].kind === 'spectral') {
      acc.spectralEAvgMeans.push(meanEAvg);
      for (const p of out.ps) acc.spectralPs.push(p);
    } else {
      acc.shapeEAvgMeans.push(meanEAvg);
      for (const p of out.ps) acc.shapePs.push(p);
    }
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

// Amendment v2.C38.1, C38.1.2: the one-sided 95% lower bound on a MEAN, transcribed from the
// addendum that owns the field name `mean_e_lower_95`
// (validation/terminal-evalue/POWER-PER-CELL-ADDENDUM-2026-08-07.md change (a), emitted at
// validation/terminal-evalue/harness/run.mjs:70-71) so one field name cannot mean two statistics
// across two studies. `z = 1.645` is the same quantile `lower95` above uses for the exceedance
// bound on the same row. The CLAMP AT 0 is the one difference from summarise()'s
// `lower95_one_sided` and it is deliberate: e >= 0, and clamping can only lower the bound, so it
// can never make a falsifier fire. NaN at n < 2, which is the field's registered absence.
const meanLower95 = (mu, sd, n) => (
  n < 2 || !Number.isFinite(sd) || !Number.isFinite(mu) ? NaN : Math.max(0, mu - 1.645 * sd / Math.sqrt(n))
);

// K3.1.1, copied verbatim from validation/detector-audit/harness/run-sequential.mjs:37-44
// (PREREGISTRATION.md's own citation for cell 33's increment_estimator shape).
function summarise(xs) {
  const n = xs.length;
  const m = xs.reduce((a, b) => a + b, 0) / n;
  const varr = n > 1 ? xs.reduce((a, b) => a + (b - m) ** 2, 0) / (n - 1) : 0;
  const se = Math.sqrt(varr / n);
  return { n, mean: m, sd: Math.sqrt(varr), se, lower95_one_sided: m - 1.645 * se, upper95_one_sided: m + 1.645 * se };
}

// Amendment v2.C39, C39.2/C39.7 item 1: `summarise()`'s own tail algebra — everything after the
// two reductions — for the ONE path where the sample is not held in memory (K4.1.4's per-POINT row,
// where `record()` keeps `pointSumE` and the Welford `pointM2` and never the 400,000 values). Same
// n-1 variance, same `z`, same field names and same order, so a per-point increment estimator and a
// per-trajectory one are the same statistic computed from different bookkeeping. `summarise` above
// is left byte-for-byte as K3.1.1's verbatim copy rather than refactored to call this.
function summariseFromMoments(n, m, varr) {
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

// ── run identity ─────────────────────────────────────────────────────────────
// Hoisted above the run (Amendment v2.K6A.3, K6A.3.1): the null-growth screen may have to write a
// failure record and refuse the run before a single trajectory exists, so it needs the results
// root, the mode decision and the provenance stamps. The VALUES are unchanged — each is the same
// pure function of the flags and the environment it always was, and the clock still only names a
// directory, never the measurement path.
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
const MODE = (N === REGISTERED_N && FORCE_THROW === null && !FORCE_SPECTRAL_DEGENERATE
  && !FORCE_SHAPE_DEGENERATE && !FORCE_HELDOUT_LATTICE && !FORCE_SCREEN_POSITIVE) ? 'live' : 'sim';
const stamp = `${new Date().toISOString().replace(/[-:.]/g, '').slice(0, 15)}Z`;

// ── the null-growth screen driver (Amendment v2.K6A.3, K6A.3.1) ──────────────
// The registered STOP CONDITION of K6A.1.10 (2), executed rather than cited. It is called below,
// after the registry agreement and the --classes resolution and BEFORE the first trajectory of any
// cell of any class, and ONLY when K6-slow is in scope.

/** One fresh screen calibration draw: 100,000 CONSECUTIVE values from ONE continuously-advanced
 *  stream at seed(d) (C1.2's form, the same shape heldoutRows uses), at phi = 0 — the law
 *  K6A.1.5 measured and the only one K6A.1.10 registers a screen for. K6A.3.1 discloses that the
 *  phi = 0.6 calibrator (cell 46) is therefore NOT screened. */
function screenDrawRows(calSeed) {
  const draw = drawFor(rng(calSeed), 0);
  const rows = new Array(HELDOUT_ROWS_K6SLOW);
  for (let j = 0; j < HELDOUT_ROWS_K6SLOW; j++) rows[j] = draw();
  if (!FORCE_SCREEN_POSITIVE) return rows;
  // Test-only positive control (see COVERAGE_FORCE_SCREEN_POSITIVE's own comment): keep A, and
  // replace every reference block with a quantile-regular sample of A plus a per-block jitter
  // (the jitter only supplies the across-block spread calibrateEcdfAccumulator requires). Such a
  // reference is maximally close to Fhat_A, so a genuine null window ranks above every block and
  // p hits the floor at every window.
  const { W, nA, m } = REGISTERED_GEOMETRY_K6SLOW;
  const sortedA = rows.slice(0, nA).sort((a, b) => a - b);
  const forced = rows.slice(0, nA);
  for (let j = 0; j < m; j++) {
    for (let i = 0; i < W; i++) forced.push(sortedA[Math.floor((i + 0.5) * nA / W)] + (j + 1) * 1e-9);
  }
  return forced;
}

/** One fresh null window for the MC term: W consecutive draws at seed(d,j), phi = 0. */
function screenNullWindow(seed) {
  const draw = drawFor(rng(seed), 0);
  return Array.from({ length: K6SLOW_WINDOW_LEN }, draw);
}

const SCREEN_DRAWS_ARG = arg('--screen-draws', null);
const SCREEN_MC_ARG = arg('--screen-mc', null);

/** K6A.3.1's driver. Returns the screen's reading on a pass; writes the registered
 *  screen-failure record and THROWS on a fail, having read no endpoint. */
function runNullGrowthScreen(classesRun) {
  const registered = MODE === 'live';
  if (registered && (SCREEN_DRAWS_ARG !== null || SCREEN_MC_ARG !== null)) {
    throw new Error('run-battery: --screen-draws/--screen-mc are refused on a registered run '
      + `(n === ${REGISTERED_N}, no hook engaged) — K6A.3.1 registers ${SCREEN_DRAWS} draws x `
      + `${SCREEN_MC_WINDOWS} MC windows there and allows no override`);
  }
  const draws = Number(SCREEN_DRAWS_ARG ?? (registered ? SCREEN_DRAWS : SCREEN_DRAWS_SMOKE));
  const mc = Number(SCREEN_MC_ARG ?? (registered ? SCREEN_MC_WINDOWS : SCREEN_MC_WINDOWS_SMOKE));
  if (!Number.isInteger(draws) || draws < 1) throw new Error(`run-battery: --screen-draws must be a positive integer, got ${draws}`);
  if (!Number.isInteger(mc) || mc < 1 || mc > SCREEN_MC_SEED_STRIDE) {
    throw new Error(`run-battery: --screen-mc must be a positive integer <= ${SCREEN_MC_SEED_STRIDE} `
      + `(the MC seed stride, K6A.3.1), got ${mc}`);
  }
  const spec = shapeSpecOf('shape_ecdf_accumulator');
  const perDraw = [];
  for (let d = 0; d < draws; d++) {
    const calSeed = SCREEN_CAL_SEED_BASE + d;
    const cal = spec.calibrate(screenDrawRows(calSeed), `null-growth screen draw ${d} (seed ${calSeed})`);
    const seeds = new Array(mc);
    for (let j = 0; j < mc; j++) seeds[j] = SCREEN_MC_SEED_BASE + SCREEN_MC_SEED_STRIDE * d + j;
    // K6A.1.5's estimator verbatim, at the frozen kappa (the module's own default — a per-call
    // kappa here would screen a differently-calibrated accumulator under this class's name).
    const r = shapeEcdfAcc.nullGrowthScreen(cal, { seeds, drawNullWindow: screenNullWindow });
    perDraw.push({
      draw: d,
      cal_seed: calSeed,
      mc_seed_first: seeds[0],
      mc_seed_last: seeds[mc - 1],
      mean_neg_log_p: r.meanNegLogP,
      g_null: r.gNull,
      positive: r.positive,
    });
  }
  const gs = perDraw.map((x) => x.g_null);
  const gMean = mean(gs);
  const positives = perDraw.filter((x) => x.positive);
  const sorted = [...gs].sort((a, b) => a - b);
  const reading = {
    draws,
    mc_windows_per_draw: mc,
    positive: positives.length,
    kappa: shapeEcdfAcc.KAPPA_K6SLOW,
    screen_mode: registered ? 'registered' : 'smoke',
    seed_bands: {
      calibration: `${SCREEN_CAL_SEED_BASE} + d, d = 0..${draws - 1}`,
      mc: `${SCREEN_MC_SEED_BASE} + ${SCREEN_MC_SEED_STRIDE}*d + j, j = 0..${mc - 1}`,
    },
    g_null: {
      mean: gMean,
      sd: draws > 1 ? Math.sqrt(gs.reduce((a, b) => a + (b - gMean) ** 2, 0) / (draws - 1)) : 0,
      max: sorted[sorted.length - 1],
      p99: sorted[Math.min(sorted.length - 1, Math.round(0.99 * (sorted.length - 1)))],
    },
    forced_positive_hook: FORCE_SCREEN_POSITIVE,
  };
  if (positives.length === 0) return reading;
  // FAILED. K6A.3.1: abort before any registered endpoint is read, and write the record OUTSIDE
  // live/ and sim/ — loadEvidence enumerates every directory under validation/*/results/live/
  // (collect.mjs:320-324), so a failure record inside it would be reported as a skipped run
  // forever. No summary.json, no manifest, no run directory, no trajectory of any class.
  const failDir = path.join(outRoot, 'screen-failed');
  fs.mkdirSync(failDir, { recursive: true });
  const failPath = path.join(failDir, `screen-${stamp}.json`);
  fs.writeFileSync(failPath, `${JSON.stringify({
    study: 'coverage',
    prereg: 'PREREGISTRATION.md',
    stop_condition: 'null-growth screen (PREREGISTRATION.md Amendment v2.K6A.1 K6A.1.10 (2), driver v2.K6A.3 K6A.3.1)',
    verdict: 'STOP — shape_ecdf_accumulator REFUTED on the record (K6A.1.10)',
    ...reading,
    geometry: { ...REGISTERED_GEOMETRY_K6SLOW, n_rows: HELDOUT_ROWS_K6SLOW },
    positive_draws: positives,
    per_draw: perDraw,
    classes_run: classesRun,
    n: N,
    registered_n: REGISTERED_N,
    mode: MODE,
    git_sha: gitSha,
    engine_pin: enginePin,
    node: process.version,
    generated_at: stamp,
  }, null, 1)}\n`);
  throw new Error(`run-battery: NULL-GROWTH SCREEN FAILED — ${positives.length}/${draws} calibration draws `
    + `have positive null growth (max g_null ${reading.g_null.max}); PREREGISTRATION.md Amendment v2.K6A.1 `
    + 'K6A.1.10 stop condition (2): STOP, investigate, do not run. shape_ecdf_accumulator is REFUTED on '
    + `the record. No endpoint was read and no run directory exists. Record: ${failPath}`);
}

// ── run ──────────────────────────────────────────────────────────────────────
assertRegistryAgreement();
// Parsed here rather than at flag-read time so a malformed declaration crashes before any
// trajectory is generated, alongside the registry agreement it belongs with (C1.6).
const SUPERSEDES = parseSupersedes();

const classFilter = arg('--classes', null);
const CLASSES_RUN = classFilter ? classFilter.split(',').map((s) => s.trim()) : Object.keys(FAULT_CLASSES);
for (const c of CLASSES_RUN) {
  if (!(c in FAULT_CLASSES)) throw new Error(`run-battery: --classes names "${c}", which is not a registered class`);
}

// Amendment v2.K6A.3, K6A.3.1: the registered stop condition, EXECUTED. Placement is registered —
// after assertRegistryAgreement() and the --classes resolution, before the first trajectory of any
// cell of any class — and it runs iff K6-slow is in scope, because the screen is a property of
// this construction's calibrator. A failed screen throws from inside, having written its record
// and read no endpoint.
const NULL_GROWTH_SCREEN = CLASSES_RUN.includes('K6-slow') ? runNullGrowthScreen(CLASSES_RUN) : null;
if (NULL_GROWTH_SCREEN) {
  process.stderr.write(`null-growth screen: ${NULL_GROWTH_SCREEN.positive}/${NULL_GROWTH_SCREEN.draws} positive `
    + `(${NULL_GROWTH_SCREEN.screen_mode}, ${NULL_GROWTH_SCREEN.mc_windows_per_draw} MC windows/draw, `
    + `max g_null ${NULL_GROWTH_SCREEN.g_null.max.toFixed(6)})\n`);
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
  // Amendment v2.K6, K6.3/K6.6: shape_block_conformal_bet's own held-out calibration
  // reuses the SAME n=10,000/HELDOUT_SEED mechanism, drawn once here per cell like the
  // other two calibrated candidates above.
  // Amendment v2.K6A.1: shape_ecdf_accumulator calibrates from the same HELDOUT_SEED mechanism
  // as the other three calibrated candidates, at K6A.1.9's own 100,000-row draw. Which shape
  // detector is on the cell decides the calibration call, through SHAPE_DETECTORS.
  const shapeDet = dets.find((d) => shapeSpecOf(d) !== null) ?? null;
  const needsHeldout = dets.includes('family_E_conformal_heldout') || dets.includes('point_tail_bet_e_value')
    || shapeDet !== null;
  const heldout = needsHeldout ? heldoutRows(cell) : null;
  const ctx = {};
  if (heldout) ctx.heldoutSeed = heldout.heldoutSeed;
  if (heldout) ctx.heldoutRowCount = heldout.heldoutRowCount;
  if (dets.includes('family_E_conformal_heldout')) ctx.params = heldoutParams(heldout.rows);
  if (dets.includes('point_tail_bet_e_value')) ctx.tailBetCal = tailBet.calibrateTailBet(heldout.rows);
  // The geometry assertion lives inside the accumulator's own `calibrate` (SHAPE_DETECTORS), so
  // it fires HERE — before the trajectory loop below scores a single cell.
  if (shapeDet) ctx.shapeCal = shapeSpecOf(shapeDet).calibrate(heldout.rows, `cell ${cell.idx} (${cell.fault_class} ${cell.severity})`);
  const ctxForRead = { heldout: ctx.params, tailBetCal: ctx.tailBetCal, shapeCal: ctx.shapeCal };

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
      // Amendment v2.K6, K6.9: shape_block_conformal_bet stamps the same accurate literal
      // as point_tail_bet_e_value — its calibration is an empirical statistic of an
      // independent held-out sample (K6.3), not an oracle constant like K3's sigma.
      // Amendment v2.K6A.1, K6A.1.10: shape_ecdf_accumulator stamps the same accurate literal
      // for the same reason — its calibration is an empirical statistic of an independent
      // held-out draw (K6A.1.9's 100,000 rows), not an oracle constant.
      params: (detId === 'point_tail_bet_e_value' || shapeSpecOf(detId) !== null) ? 'heldout-empirical' : 'oracle',
      alpha: ALPHA,
      n: N,
      ticks: spanFor(cell.fault_class).T,
      onset: spanFor(cell.fault_class).ONSET,
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
      c.heldout_rows = ctx.heldoutRowCount;
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
      c.heldout_rows = ctx.heldoutRowCount;
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
    // Amendment v2.K6, K6.9: the registered window-partition fields, wealth descriptives,
    // and the pre-absorption degenerate-window counter (structurally 0, K6.7). Deliberately
    // NONE of the five instrument-named fields (K6.7's binding adapter constraint) — a fault
    // cell has no S2/S3 role.
    // Amendment v2.K6A.1, K6A.1.10: the same field set for shape_ecdf_accumulator, "K6.7's field
    // set carried by reference" — same names, same order, per-detector VALUES out of
    // SHAPE_DETECTORS (40/150/[300,6300) here against 6/30/[100,280) for the sibling).
    if (shapeSpecOf(detId)) {
      const spec = shapeSpecOf(detId);
      c.windows = spec.windows;
      c.window_len = spec.windowLen;
      c.window_span = spec.windowSpan;
      c.final_wealth_mean = a.es && a.es.length ? mean(a.es) : NaN;
      c.final_wealth_median = a.es && a.es.length ? median(a.es) : NaN;
      c.degenerate_windows = a.degenerateWindows;
      // Amendment v2.C1, C1.8: the calibration fingerprint + the same held-out provenance pair
      // point_tail_bet_e_value already carries (K4.4). A K6 row previously named no calibration
      // at all, so the artefact that moved this class's S3 verdict was invisible in the run
      // directory — a reader had to re-derive the reference to see anything about it. The
      // accumulator's fingerprint is the module's own export (it carries the C1.8 quantile
      // convention internally, and its W/m/n_A make the geometry readable off the row too).
      c.cal_fingerprint = spec.fingerprint(ctx.shapeCal);
      c.heldout_seed = ctx.heldoutSeed;
      c.heldout_rows = ctx.heldoutRowCount;
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
  // Amendment v2.K6, K6.6/K6.7: shape_block_conformal_bet's own arm. Held-out calibration
  // (K6.3), unlike spectral_bet_e_process's genuinely-oracle sigma.
  //
  // Amendment v2.K6A.2, K6A.2.1 item 12: a KIND test, not the detector-id literal this line
  // used to hold. With the literal, `shape_ecdf_accumulator` made both `shapeKind` and
  // `pointKind` false and arm 47 fell through every branch below: no held-out stream fetched at
  // all, the S3 injection defaulting to `injectStep` delta=3 — a K1-type mean step, not the
  // registered injectShapeMix at d = 2.0 — and `null_id: 'N1'` / `params: 'oracle'` against
  // K6A.1.10's registered pair. The arm would have read POWERED on the wrong fault class
  // entirely. Every site the amendment enumerates is threaded through `spec` below.
  const shapeKind = ADAPTERS[detId].kind === 'shapeblock';
  const spec = shapeSpecOf(detId);
  if (shapeKind !== (spec !== null)) {
    throw new Error(`run-battery: ${detId} has kind 'shapeblock' but no SHAPE_DETECTORS entry (or the reverse) `
      + '— the kind test and the per-detector spec table must name the same detectors (v2.K6A.2 K6A.2.1 item 12)');
  }
  // Amendment v2.K6A.1 K6A.1.9 + v2.K6A.2 K6A.2.5: the arm's span comes from its own `hint`,
  // because this loop reads the scalars directly and never touches the fault-cell path.
  const span = spanFor(arm.hint);
  const ctx = {};
  if (detId === 'family_E_conformal_heldout' || pointKind || shapeKind) {
    const h = heldoutRows(arm);
    ctx.heldoutSeed = h.heldoutSeed;
    ctx.heldoutRowCount = h.heldoutRowCount;
    if (detId === 'family_E_conformal_heldout') ctx.params = heldoutParams(h.rows);
    if (pointKind) ctx.tailBetCal = tailBet.calibrateTailBet(h.rows);
    if (shapeKind) ctx.shapeCal = spec.calibrate(h.rows, `arm ${arm.idx}`);
  }
  const ctxForRead = { heldout: ctx.params, tailBetCal: ctx.tailBetCal, shapeCal: ctx.shapeCal };
  const healthy = freshAcc();
  const power = freshAcc();
  // Amendment v2.K3.3, K3.3.3: spectral_bet_e_process's own third, verdict-free accumulator
  // for the retained (now superseded-as-S3) step construction.
  const stepProbe = spectralKind ? freshAcc() : null;

  for (let i = 0; i < N; i++) {
    let base;
    let r;
    if (detId === 'group_average_e_value') {
      const matrix = [];
      for (let k = 0; k < arm.K; k++) {
        const rk = rng(seriesSeed(arm, i, k));
        matrix.push(Array.from({ length: span.T }, drawFor(rk, arm.phi)));
      }
      base = { matrix };
    } else {
      r = rng(cellSeed(arm, i));
      base = { series: Array.from({ length: span.T }, drawFor(r, arm.phi)) };
    }
    // A1's S3 construction: injectUnison at eps=3 across all K components for the group
    // arm; injectStep at delta=3 for the conformal/tail-bet arms (run.mjs:89-90's registered
    // shift). Amendment v2.K3.3, K3.3.2: spectral_bet_e_process's own S3 construction is the
    // class-appropriate on-grid oscillation (amp=3sigma at freq=3/30, bin k=3 exactly) —
    // injectStep is DC-blind to every bin this detector scores (K3.3.1's derivation), so the
    // step survives only as the separate step_blindness_probe_rate accumulator below (K3.3.3).
    // Amendment v2.K6.1, K6.1.1/K6.8: shape_block_conformal_bet's own S3 construction is
    // injectShapeMix at the class's own maximal registered severity (d=2.0), sustained
    // across the full test span — reusing the SAME now-advanced `r` stream `base.series`
    // was drawn from (A5's K6 pinning convention, generate()'s own comment, applied here
    // to the arm identically). Amendment v2.K6A.1, K6A.1.12: arm 47's S3 construction is the
    // SAME injectShapeMix at d = 2.0, now reached through the kind test — the registered
    // `shift_sigma: 3` on the S3 row below IS this d = 2.0 injection (K6A.1.12's own row), and
    // K6A.2.2 registers that this cell's 1.0000 rests on the d = 2.0 boundary artifact. If this
    // branch is ever taken away from a shape detector the arm silently becomes a K1 step probe.
    const shifted = detId === 'group_average_e_value'
      ? { matrix: injectUnison(base.matrix, { sigma: SIGMA, at: span.ONSET, eps: 3 }) }
      : spectralKind
        ? { series: injectOscillation(base.series, { sigma: SIGMA, at: span.ONSET, amp: 3, freq: 3 / K3_WINDOW_LEN }) }
        : shapeKind
          ? { series: injectShapeMix(base.series, { sigma: SIGMA, at: span.ONSET, d: 2.0, rng: r }) }
          : { series: injectStep(base.series, { sigma: SIGMA, at: span.ONSET, delta: 3 }) };

    const rh = attempt(healthy, detId, base, arm, ctxForRead);
    if (rh.ok) record(healthy, detId, rh.out);
    const rp = attempt(power, detId, shifted, arm, ctxForRead);
    if (rp.ok) record(power, detId, rp.out);

    if (spectralKind) {
      const stepShifted = { series: injectStep(base.series, { sigma: SIGMA, at: span.ONSET, delta: 3 }) };
      const rsp = attempt(stepProbe, detId, stepShifted, arm, ctxForRead);
      if (rsp.ok) record(stepProbe, detId, rsp.out);
    }
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
  // Amendment v2.C38.1, C38.1.2: the terminal-instrument row's mean, the spread that produced it,
  // and its one-sided 95% lower bound — all three over the SAME sample `mean_e` is already the mean
  // of, per adapter kind (C38.1.2's table). `terminal`/`process` hold the whole sample in
  // `acc.es`, so the sd is two-pass and `summarise` supplies it; `point` holds running aggregates
  // only, so the sd is Welford's (record(), point branch) and `mean_e` stays `pointSumE /
  // pointFinite` bit-for-bit. `meanSd`'s n < 2 -> NaN convention
  // (validation/terminal-evalue/harness/run.mjs:67) is kept, so the sd and the bound are absent
  // together or present together.
  const s2MeanN = pointKind ? s2PointN : s2n;
  const s2MeanE = pointKind
    ? (s2PointN ? healthy.pointSumE / s2PointN : NaN)
    : (healthy.es ? mean(healthy.es) : NaN);
  // Amendment v2.C39, C39.2: the terminal class's REPORTED mean instrument — `summarise()`'s object
  // over the SAME sample `mean_e` is the mean of. A terminal e-value's wealth path has exactly one
  // increment per replicate (the terminal e itself), so the increment sample and the terminal sample
  // are the same numbers and there is nothing to choose. It carries NO verdict authority: the S2
  // token below stays exceedance-derived, and `applyGuards`'s Finding 4 reads a foreign instrument
  // beside the class's own as annotation rather than a veto (C39.3).
  const s2IncrementEstimator = pointKind
    ? summariseFromMoments(s2PointN, s2MeanE, s2PointN > 1 ? healthy.pointM2 / (s2PointN - 1) : 0)
    : summarise(healthy.es ?? []);
  // C38.1's sd is read off that same object on the two-pass paths, so the two fields cannot drift
  // apart. C39.5: at n < 2 they part by construction — `summarise` gives sd 0 (K3.1.1's own
  // convention) and the addendum's rule for `mean_e_sd` is NaN — and that boundary is registered.
  const s2MeanSd = s2MeanN > 1 ? s2IncrementEstimator.sd : NaN;
  const s2MeanLower95 = meanLower95(s2MeanE, s2MeanSd, s2MeanN);
  const s2 = {
    detector: detId,
    arm: 'healthy',
    cell_index: arm.idx,
    // Amendment v2.K3.1, K3.1.5: cell 33 stamps the out-of-grammar literal on both rows,
    // outside the run.mjs:497-style N1/N3-p06 convention every other arm keeps. Amendment
    // v2.K6, K6.7: cell 34 gets its own out-of-grammar literal, 'K6-arm-heldout' — adapted
    // from K3's 'K3-arm-oracle' because this arm's calibration is EMPIRICAL, not oracle.
    // Amendment v2.K6A.1, K6A.1.10: arm 47's own literal is 'K6slow-arm-heldout', taken from
    // SHAPE_DETECTORS so the two shape arms cannot share one string by accident.
    null_id: spectralKind ? 'K3-arm-oracle' : shapeKind ? spec.armNullId : (arm.phi === 0 ? 'N1' : 'N3-p06'),
    phi: arm.phi,
    params: (pointKind || shapeKind) ? 'heldout-empirical' : 'oracle',
    alpha: ALPHA,
    n: s2n,
    ticks: span.T,
    onset: span.ONSET,
    ...(pointKind ? { n_points: s2PointN, k: s2PointK } : {}),
    ...(spectralKind ? { windows: K3_WINDOWS, window_len: K3_WINDOW_LEN, window_span: K3_WINDOW_SPAN } : {}),
    ...(shapeKind ? { windows: spec.windows, window_len: spec.windowLen, window_span: spec.windowSpan } : {}),
    // Amendment v2.K3.1, K3.1.1/K3.1.2: spectral_bet_e_process's S2 row carries its own
    // class instrument (increment_estimator) plus crossing_rate/k — NOT exceedance/mean_e
    // (K3.15's gap; the terminal_e_value instrument pair belongs to a different class).
    // Amendment v2.K6, K6.7: shape_block_conformal_bet's S2 row carries the identical
    // instrument pair, applying the K3.15 lesson directly rather than deferring it.
    ...((spectralKind || shapeKind)
      ? { k: s2k, crossing_rate: s2n ? s2k / s2n : NaN }
      : {
        exceedance: pointKind ? (s2PointN ? s2PointK / s2PointN : NaN) : (s2n ? s2k / s2n : NaN),
        mean_e: s2MeanE,
        // Amendment v2.C38.1, C38.1.2 (registered code item 2): the field safe-t's frozen card
        // falsifier names ("one-sided 95% lower bound of mean(e) > 1"), and the spread it cannot
        // be read without. `meanRule` (validation/certification/lib/guards.mjs) is refusal-only
        // and tests this bound and the point estimate INDEPENDENTLY, so emitting the field can
        // only add refutations — it can never clear a cell the point estimate refutes.
        mean_e_sd: s2MeanSd,
        mean_e_lower_95: s2MeanLower95,
        // Amendment v2.C39, C39.2 (registered code item 2): REPORTED, never scored. Any reading of
        // this field must be reported with C39.4's caveat verbatim — its se and bounds are
        // WITHIN-draw, and on the one construction where both are measured the between-draw spread
        // is 9.3x larger. A `lower95_one_sided > 1` reading is FILED to
        // stats/terminal-mean-rule-contested (K3.1.3's reporting rule), not scored.
        increment_estimator: s2IncrementEstimator,
      }),
    lower_95: s2Lower95,
    ...(spectralKind ? {
      increment_estimator: summarise(healthy.spectralEAvgMeans),         // K3.1.1
      p_uniformity: computePUniformity(healthy.spectralPs),              // K3.1.7
      final_wealth_mean: healthy.es && healthy.es.length ? mean(healthy.es) : NaN,
      final_wealth_median: healthy.es && healthy.es.length ? median(healthy.es) : NaN,
      degenerate_windows: healthy.degenerateWindows,                     // K3.1.6
    } : {}),
    ...(shapeKind ? {
      increment_estimator: summarise(healthy.shapeEAvgMeans),            // K6.7
      p_uniformity: computePUniformity(healthy.shapePs),                 // K6.7
      final_wealth_mean: healthy.es && healthy.es.length ? mean(healthy.es) : NaN,
      final_wealth_median: healthy.es && healthy.es.length ? median(healthy.es) : NaN,
      degenerate_windows: healthy.degenerateWindows,                     // K6.7, structurally 0
    } : {}),
    non_finite_wealth: healthy.nonFinite,
    adapter_failures: healthy.throws,
    verdict: s2Reason !== null
      ? 'NOT-EXECUTABLE'
      // K3.1.3/K6.7: unchanged — crossing_rate-derived, NOT increment_estimator-derived.
      : (s2Lower95 > ALPHA ? 'FAIL' : 'not-refuted'),   // run.mjs:115 / K4.1.4 / K3.1.3 / K6.7
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
    null_id: spectralKind ? 'K3-arm-oracle' : shapeKind ? spec.armNullId : (arm.phi === 0 ? 'N1' : 'N3-p06'),
    phi: arm.phi,
    params: (pointKind || shapeKind) ? 'heldout-empirical' : 'oracle',
    // K6A.1.12's cell-47 S3 row: `shift_sigma: 3` IS the d = 2.0 injectShapeMix above for a
    // shape arm (the same equivalence K6.1.1/K6.8 registered for arm 34), not a mean step.
    shift_sigma: 3,
    alpha: ALPHA,
    n: N,
    ticks: span.T,
    onset: span.ONSET,
    ...(spectralKind ? { windows: K3_WINDOWS, window_len: K3_WINDOW_LEN, window_span: K3_WINDOW_SPAN } : {}),
    // Amendment v2.K6, K6.7: no windows/window_len/window_span on the S3 row — the
    // registration's own field list for this row does not name them (unlike S2's), so they
    // are omitted here rather than added by K3 parity.
    fires: s3k,
    detection_rate: s3Rate,
    // Amendment v2.K3.1, K3.1.4 (Critical, binding): NONE of the five instrument-named
    // fields land here — only wealth descriptives and the degenerate-window counter.
    // Amendment v2.K6, K6.7: the same binding exclusion, applied to shape_block_conformal_bet.
    ...((spectralKind || shapeKind) ? {
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
  if (detId === 'family_E_conformal_heldout' || pointKind || shapeKind) {
    s2.heldout_seed = ctx.heldoutSeed;
    s3.heldout_seed = ctx.heldoutSeed;
    s2.heldout_rows = ctx.heldoutRowCount;
    s3.heldout_rows = ctx.heldoutRowCount;
  }
  // Amendment v2.C1, C1.8: the K6 arm's own calibration fingerprint, on both rows. This arm is
  // where the defect reached a verdict (S3 POWERED on a lattice reference), so it is the row
  // where the reference's shape most needs to be on the record.
  if (shapeKind) {
    s2.cal_fingerprint = spec.fingerprint(ctx.shapeCal);
    s3.cal_fingerprint = spec.fingerprint(ctx.shapeCal);
  }
  // Amendment v2.K6A.3, K6A.3.1: the screen's reading lands ON the S2 row, not only in the
  // manifest. K6A.1.10 requires a fired paging bound to be reported with the screen's reading
  // beside it (screen-clean + paging-fired is the calibration lottery's signature; screen-dirty +
  // paging-fired is a construction defect), and this is what makes that mechanical rather than a
  // reader's duty — the two readings are then on the same row.
  if (NULL_GROWTH_SCREEN && arm.hint === 'K6-slow') {
    s2.null_growth_screen = {
      draws: NULL_GROWTH_SCREEN.draws,
      positive: NULL_GROWTH_SCREEN.positive,
      g_null_max: NULL_GROWTH_SCREEN.g_null.max,
    };
  }
  // Amendment v2.K3.3, K3.3.3/K3.3.5: the retained step construction, as a THIRD, verdict-
  // free descriptive row on cell 33 — the exact registered field set, nothing more: no
  // shift_sigma (so isPowerCell/scoreS3 never admits it as an S3 candidate), no verdict, and
  // none of the five instrument-named strings (K3.1.4's exclusion, extended explicitly here).
  let stepRow = null;
  if (spectralKind) {
    const spK = stepProbe.fires;
    stepRow = {
      detector: detId,
      arm: 'step_blindness_probe',
      cell_index: arm.idx,
      null_id: 'K3-arm-oracle',
      phi: arm.phi,
      params: 'oracle',
      alpha: ALPHA,
      ticks: T,
      onset: ONSET,
      n: N,
      k: spK,
      step_blindness_probe_rate: spK / N,
      substrate_tier: 'T1',
    };
    cells.push(stepRow);
  }
  cells.push(s2, s3);
  process.stderr.write(spectralKind
    ? `${detId.padEnd(28)} ARM healthy crossing_rate=${Number.isFinite(s2.crossing_rate) ? s2.crossing_rate.toFixed(4) : ' n/a  '} `
      + `inc_mean=${Number.isFinite(s2.increment_estimator.mean) ? s2.increment_estimator.mean.toFixed(4) : ' n/a  '} ${s2.verdict}\n`
      + `${detId.padEnd(28)} ARM power   rate=${s3Rate === null ? ' n/a  ' : s3Rate.toFixed(4)} ${s3.verdict}\n`
      + `${detId.padEnd(28)} ARM step_blindness_probe_rate=${stepRow.step_blindness_probe_rate.toFixed(4)}\n`
    : shapeKind
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
    // Amendment v2.C1 (C1.2) supersedes the `seed(j) = HELDOUT_SEED + 7919*j` clause every run
    // before this one recorded here. HELDOUT_SEED and the row count are unchanged; the draw is
    // ONE continuous stream, so this string is not a cosmetic edit — it is the difference
    // between a lattice and a sample, and a manifest that still said `seed(j)` would misdescribe
    // the run it manifests.
    // Amendment v2.K6A.2, K6A.2.5: the row count is per class, so this string states BOTH — a
    // single ${HELDOUT_ROWS} would have put a false constant in the record of any run that
    // includes a K6-slow cell (K6A.2.5 names this exact site as the ninth under-scoped one).
    heldout: `HELDOUT_SEED = CELL_SEED + ${HELDOUT_OFFSET}; rows are ${HELDOUT_ROWS} CONSECUTIVE `
      + 'draws from one continuously-advanced rng(HELDOUT_SEED) stream (Amendment v2.C1 C1.2, '
      + 'superseding the pre-C1 seed(j) = HELDOUT_SEED + 7919*j scheme)'
      + `; K6-slow (shape_ecdf_accumulator) draws ${HELDOUT_ROWS_K6SLOW} rows from that same `
      + `stream instead (Amendment v2.K6A.1 K6A.1.9: A = ${REGISTERED_GEOMETRY_K6SLOW.nA} + `
      + `B = ${REGISTERED_GEOMETRY_K6SLOW.m * REGISTERED_GEOMETRY_K6SLOW.W} -> `
      + `m = ${REGISTERED_GEOMETRY_K6SLOW.m} blocks of ${REGISTERED_GEOMETRY_K6SLOW.W})`,
    heldout_acf_bound: HELDOUT_ACF_BOUND,
    heldout_rows_by_class: { default: HELDOUT_ROWS, 'K6-slow': HELDOUT_ROWS_K6SLOW },
    heldout_seed_arm_31: ARM_CELLS.find((a) => a.idx === 31).seed + HELDOUT_OFFSET,
    heldout_seed_arm_32: ARM_CELLS.find((a) => a.idx === 32).seed + HELDOUT_OFFSET,
    heldout_seed_arm_34: ARM_CELLS.find((a) => a.idx === 34).seed + HELDOUT_OFFSET,
    heldout_seed_arm_47: ARM_CELLS.find((a) => a.idx === 47).seed + HELDOUT_OFFSET,
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
  // Amendment v2.K6A.1, K6A.1.9: `ticks`/`onset` above stay the deploy-gate span A8 registered
  // and every existing class still runs at. The span is per class from this build on, so the
  // whole map is recorded — a run containing K6-slow cells would otherwise be manifested as a
  // 300-tick run. Each emitted cell also carries its own ticks/onset.
  class_spans: {
    default: { ticks: DEFAULT_SPAN.T, onset: DEFAULT_SPAN.ONSET },
    'K6-slow': { ticks: K6SLOW_SPAN.T, onset: K6SLOW_SPAN.ONSET, windows: K6SLOW_WINDOWS, window_len: K6SLOW_WINDOW_LEN, window_span: K6SLOW_WINDOW_SPAN },
  },
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
  // Amendment v2.K6A.3, K6A.3.1: `null` when the run's scope contains no K6-slow cell, so a
  // consumer can tell "screened and passed" from "not applicable" without reading classes_run.
  null_growth_screen: NULL_GROWTH_SCREEN,
  force_throw_hook: FORCE_THROW,
  spectral_force_degenerate_hook: FORCE_SPECTRAL_DEGENERATE,
  shape_force_degenerate_hook: FORCE_SHAPE_DEGENERATE,
  heldout_lattice_hook: FORCE_HELDOUT_LATTICE,
  screen_positive_hook: FORCE_SCREEN_POSITIVE,
  // Amendment v2.C1, C1.6: null on every run that supersedes nothing, which is every run
  // committed before this amendment.
  supersedes: SUPERSEDES,
  generated_at: stamp,
}, null, 1)}\n`);

// Elapsed time is operator information, not a manifest field: A8 registers the field list and
// wall-clock is not in it, so it goes to stderr instead of into the frozen record.
process.stderr.write(`\n${cells.length} cells -> ${outDir}\nelapsed ${(Date.now() - t0) / 1000}s\n`);

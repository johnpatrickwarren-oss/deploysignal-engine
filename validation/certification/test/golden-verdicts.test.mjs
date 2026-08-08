// validation/certification/test/golden-verdicts.test.mjs
//
// I5 -- the fourteen verdicts are frozen here. Any change to the scorer, the guards, the
// cards, or the evidence corpus that moves a verdict fails this test by name.
//
// WHY A GOLDEN TABLE AND NOT A REPORT DIFF. The protocol's own rule is that endpoints and
// thresholds never move inside a version; the risk this guards is a scoring change that
// quietly restates a detector's usability while every stage-level test still passes. A
// per-stage test cannot see that -- only the composed verdict can. So the table below is
// the endpoint, and moving a row is a deliberate act with a commit message attached.
//
// The CLI is driven end-to-end against the REAL evidence corpus into a temp output root
// (CERT_RESULTS_DIR), so this reads the same path an official run takes and never writes
// into results/.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, mkdtempSync, rmSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';

const certDir = join(dirname(fileURLToPath(import.meta.url)), '..');

// Frozen 2026-08-07, protocol v1, cards frozen at 45ce230.
// verdict, tier, and the four stage statuses that produced them.
//
// Re-frozen 2026-08-07 against the current corpus (run-20260807T215155Z's live power-per-
// cell + phi-sweep evidence) AFTER the FIX 1/FIX 2 verdict-integrity fixes (mean-rule
// strongest-signal, FAIL -> REFUTED). Only universal_inference_e_value's S3 moved, INERT
// from PASS -- P-A3, registered in advance of the live run and unrelated to FIX 1/FIX 2:
// five of UI's power cells (N3-p09, N4-p09 from the power run; N4-p09/-p095/-p099 from the
// sweep) sit below the 0.10 inertness floor (see study-power-live-report.md §3.2, §5). It
// was already true in the committed run before this session's fixes; the golden table
// simply predated the live run. Every other card's verdict, tier and four stage statuses
// are unchanged, including safe_t_e_value's: FIX 1 makes the mean rule fire on 5 N4-p09
// cells instead of 3 (2026-08-07's pair no longer clears), but all 5 sit outside the
// published estimated-phi-excluded regime, so the stage status itself does not move.
//
// Extended 2026-08-07, coverage-matrix-v1 Task 7 (cards frozen at 4c16092): two new
// candidate cards land, group_average_e_value (Task 6, K2) and
// family_E_conformal_heldout (Task 7, K4). Both freeze with prior_evidence pointing at
// coverage/results/live/* (PREREGISTRATION.md), and no run under that study exists yet
// -- the battery harness that produces it is Task 8/9's job, not this one's. Both
// therefore read S1/S2/S3 MISSING (no evidence to score), S4 PASS (nothing priced against
// budget yet), overall NOT_EXECUTABLE -- the correct, non-tuned verdict for a card with no
// evidence, not a defect. This is expected to move once Task 9's battery run lands, at
// which point this table re-freezes again by the same convention as the P-A3 update above.
//
// Re-frozen 2026-08-08, coverage-matrix-v1 Task 10 (cert run run-20260808T011035Z, consuming
// battery run-20260808T010208Z): the delta the paragraph above predicted. Both new cards
// move NOT_EXECUTABLE -> REFUSE, S2 MISSING -> REFUTED, S3 MISSING -> PASS (S1/S4 unchanged
// at MISSING/PASS). Neither card was refuted by its own coverage-battery evidence -- idx
// 30/31's S2 arm (Wilson lower_95 below alpha) CLEARED as 'not-refuted'. The terminal_e_value
// mean rule (lib/guards.mjs meanRule, C1) overrode that clearance: mean_e 1.9141
// (group_average_e_value) and 3.1160 (family_E_conformal_heldout) both exceed the registered
// bound of 1 (TERMINAL_MEAN_BOUND, lib/constants.mjs), so the cell is scored REFUTED, which
// maps S2 REFUTED -> overall REFUSE (lib/score.mjs overallVerdict). K2's YES answer rests on
// safe_t_e_value (USE); K4's NO answer holds independently of this delta (NOT_POWERED,
// canonical rate 0.043 < 0.50 floor). Every other card's verdict, tier and four stage
// statuses are unchanged.
//
// Extended 2026-08-08, coverage-gap-detectors Task 3 (card frozen at 8546bef): a third K4
// candidate lands, point_tail_bet_e_value (the per-point conformal tail-bet construction,
// PREREGISTRATION.md Amendments v2.K4/v2.K4.1). Its prior_evidence cites the coverage study
// (S2, same as the other two K4 cards) and the ratified design page
// (methodology/coverage-gap-detectors) as supporting evidence. No battery run of this
// candidate exists yet -- Task 4's adapter is what produces one -- so S1/S2/S3 read MISSING,
// S4 PASS (nothing priced against budget yet), overall NOT_EXECUTABLE: the correct, non-tuned
// pre-run verdict, same convention as group_average_e_value's and family_E_conformal_heldout's
// own NOT_EXECUTABLE entry point above. Expected to move once a battery run lands, at which
// point this table re-freezes again by the same convention as the deltas above. Test titles
// renamed eleven -> twelve to match.
//
// Corrected 2026-08-08 (card re-frozen at 9f0be14): the design-page prior_evidence entry was
// first stamped stage 'S1', reading DECLARED. Review adjudicated that wrong -- scoreS1's
// string-match is a v1 floor standing in for measured dispatch, not a general "any wiki
// citation" flag, and both existing DECLARED precedents (family_E_conformal's S1+S2 entry,
// sequential_mmd_betting_e_process's S1 entry) cite source pages backed by real run artifacts,
// unlike this pre-run design doc; the two sibling K4 cards drawing on the same design page
// already read MISSING. Relabeled stage 'design' (the citation itself is unchanged); S1 now
// reads MISSING, matching the card's true pre-run state.
//
// Re-frozen 2026-08-08, coverage-gap-detectors Task 5 (cert run run-20260808T064214Z, consuming
// battery run-20260808T064039Z): the delta the paragraph above predicted, on ONE row, not two.
// `point_tail_bet_e_value` moves NOT_EXECUTABLE -> USE, tier null -> T1, S2 MISSING -> PASS,
// S3 MISSING -> PASS (S1 MISSING and S4 PASS unchanged). The two other new-candidate rows
// (group_average_e_value, family_E_conformal_heldout) already left NOT_EXECUTABLE at the Task 10
// delta above and do not move here.
//
// What produced it, per Amendment v2.K4/v2.K4.1: arm cell 32's healthy (S2) row cleared on its
// own registered per-point instrument -- k = 1012 of n_points = 400,000, exceedance 0.00253,
// Wilson lower_95 0.0024027 <= alpha 0.05, so K4.7's stop condition did not fire -- and the
// terminal_e_value mean rule (lib/guards.mjs meanRule) did NOT override it: mean_e 0.6351 sits
// under TERMINAL_MEAN_BOUND = 1, unlike group_average_e_value's 1.9141 and
// family_E_conformal_heldout's 3.1160. That is the whole difference between this card's USE and
// the two REFUSEs above. S3 PASS comes from arm 32's shift_sigma = 3 power row, detection_rate
// 1.0000.
//
// The class answer moves with it: COVERAGE.md's K4 row goes NO -> YES, carried by this card
// (canonical cell 19 `5sigma-point` detection_rate 0.9750 >= COVERAGE_FLOOR 0.50, tier T1).
// The Task 10 note above recorded "K4's NO answer holds"; that sentence described the corpus at
// that run and is superseded here by a third candidate's evidence, not contradicted by it -- the
// other two K4 candidates' canonical rates are unchanged and still below the floor
// (family_E_conformal_heldout 0.0430 NOT_POWERED, safe_t_e_value 0.0005 NOT_POWERED).
// Every other card's verdict, tier and four stage statuses are unchanged.
//
// Extended 2026-08-08, coverage-gap-detectors Task 7 (card frozen at ebf34c5): a fourth new
// candidate lands, spectral_bet_e_process (the periodogram betting e-process K3 construction,
// PREREGISTRATION.md Amendment v2.K3). Its prior_evidence cites the coverage study (S2, same
// pattern as the other three new candidates) and the ratified design page at stage 'design' --
// not 'S1', per the point_tail_bet_e_value precedent above (dfe7536: a pre-run design-doc
// citation does not satisfy scoreS1's DECLARED reading). No battery run of this candidate exists
// yet -- Task 8's adapter is what produces one -- so S1/S2/S3 read MISSING, S4 PASS (nothing
// priced against budget yet), overall NOT_EXECUTABLE: the correct, non-tuned pre-run verdict,
// same convention as every other new-candidate entry point above. Amendment v2.K3 K3.15 registers
// a further, structural point this table does not resolve: this card's class is test_martingale,
// whose CLASS_INSTRUMENTS entry (increment_estimator) the amendment's registered coverage-battery
// fields do not populate -- so S2 is expected to stay MISSING even after a registered run lands,
// absent a Task 8 adapter addition, unlike the three terminal_e_value-class candidates above
// (whose exceedance/mean_e fields are exactly their class's own instrument). Expected to move only
// if Task 8's adapter closes that gap; flagged here so a future NOT_EXECUTABLE reading post-run is
// not mistaken for a defect in this test.
//
// Re-frozen 2026-08-08, coverage-gap-detectors Task 8 (cert run run-20260808T091718Z, consuming
// battery run-20260808T091521Z): ONE row moves. `spectral_bet_e_process` goes NOT_EXECUTABLE ->
// USE, tier null -> T1, S2 MISSING -> PASS, S3 MISSING -> PASS (S1 MISSING and S4 PASS unchanged).
// No other card's verdict, tier or stage status moves -- the registered run was --classes K3, so
// the other twelve cards' evidence is untouched.
//
// The S2 MISSING the paragraph above predicted did NOT persist, and the registered reason is an
// amendment, not a scoring change: Amendment v2.K3.1 K3.1.1 (registered before any run, closing
// K3.15's own gap) added `increment_estimator` -- the martingale's own per-window eAvg increments --
// to arm cell 33's healthy row, and K3.1.2 renamed that row's rate field to the class-recognized
// `crossing_rate`, so `isValidityCell` (lib/score.mjs) now recognizes a cell it previously could not
// see. The Task 8 adapter emits both. The verdict token itself stays crossing_rate-derived (K3.1.3),
// never increment_estimator-derived: k = 6 of n = 2000, crossing_rate 0.003, Wilson lower_95
// 0.0015520 <= alpha 0.05, so K3.13's stop condition did not fire and S2 CLEARED as 'not-refuted'.
// The test_martingale class carries no terminal mean rule, so nothing overrode that clearance the
// way meanRule overrode group_average_e_value's and family_E_conformal_heldout's. S3 PASS comes
// from arm 33's shift_sigma = 3 power row, detection_rate 1.0000 -- realized per class as an on-grid
// oscillation (amp 3 sigma, freq 3/30, bin k=3) rather than a step, per Amendment v2.K3.3 K3.3.2:
// the originally registered step probe is DC-blind to every bin this detector scores (K3.3.1) and
// survives only as the verdict-free `step_blindness_probe_rate` row, which carries no
// `detection_rate` and no `shift_sigma` and is therefore invisible to scoreS3 by construction.
//
// The class answer moves with it: COVERAGE.md's K3 row goes NO -> YES, carried by this card
// (canonical cell 15 `A0.75sigma-f0.05` detection_rate 0.6540 >= COVERAGE_FLOOR 0.50, tier T1).
// No USE card covered K3 at the previous corpus and none of the incumbents changed that here:
// safe_t_e_value and universal_inference_e_value read 0.0000 on all six K3 cells in this same run,
// and family_D_spectral_e_detector (also 0.0000 on idx 15/17) is REFUSE, barred from carrying a
// class regardless. K5 and K6 stay NO.
// Extended 2026-08-08, coverage-gap-detectors Task 10 (card frozen at 7bf6372's amendment,
// card+freeze this same commit): a fifth new candidate lands, shape_block_conformal_bet (the
// block-conformal shape-bet K6 construction, PREREGISTRATION.md Amendment v2.K6). Its
// prior_evidence cites the coverage study (S2, same pattern as the other four new candidates)
// and the ratified design page at stage 'design' -- not 'S1', the same MISSING-honest precedent
// point_tail_bet_e_value/spectral_bet_e_process both already carry. No battery or T2 run of this
// candidate exists yet -- Task 11's adapters are what produce them -- so S1/S2/S3 read MISSING,
// S4 PASS (nothing priced against budget yet), overall NOT_EXECUTABLE: the correct, non-tuned
// pre-run verdict, same convention as every other new-candidate entry point above. Amendment
// v2.K6 registers, up front (not deferred to a correction round the way K3.15/v2.K3.1 needed
// for spectral_bet_e_process), that arm cell 34's S2 row carries increment_estimator so S2 is
// expected to move to PASS once Task 11's adapter lands -- and separately derives, in full
// before any run, that this candidate is NOT_POWERED at K6's canonical severity and INERT on
// its own S3 arm (Amendment v2.K6 K6.4/K6.8), so the card's own expected post-run verdict is
// ADVISORY, not USE, per overallVerdict's valid-but-inert rule -- registered here so a future
// ADVISORY reading is not mistaken for a defect in this test.
// Updated 2026-08-08, coverage-gap-detectors Task 11b, the registered K6 runs
// (coverage/results/live/run-20260808T121548Z T1 battery, run-t2-20260808T121710Z T2 arm): the
// ONE-ROW delta those runs land, named in advance by Amendment v2.K6.2 K6.2.4 --
// shape_block_conformal_bet NOT_EXECUTABLE -> USE, tier null -> T1, s2 MISSING -> PASS,
// s3 MISSING -> PASS. The ADVISORY expectation in the paragraph above is exactly what v2.K6.2
// SUPERSEDES: d=2.0 is a two-point degeneracy (s = sqrt(1 - d^2/4) = 0 exactly), so the S3 arm
// reads POWERED at detection_rate 1.0000 rather than the withdrawn ~0.000, and overallVerdict's
// valid-but-inert rule no longer applies. The K6 CLASS answer is unchanged at NO, decided by the
// canonical d=1.5 cell alone (measured 0.0005 against COVERAGE_FLOOR 0.50): a USE card that does
// not carry the class it was built for is the registered, expected reading here (v2.K6.2 K6.2.2),
// not a defect in this test.
const GOLDEN = {
  family_A_betting_e_process: { verdict: 'REFUSE', tier: null, s1: 'MISSING', s2: 'REFUTED', s3: 'INERT', s4: 'UNPRICED' },
  family_A_mixture_supermartingale: { verdict: 'REFUSE', tier: null, s1: 'MISSING', s2: 'REFUTED', s3: 'PASS', s4: 'PASS' },
  family_C_safe_hotelling: { verdict: 'NOT_EXECUTABLE', tier: null, s1: 'MISSING', s2: 'MISSING', s3: 'PASS', s4: 'UNPRICED' },
  family_D_spectral_e_detector: { verdict: 'REFUSE', tier: null, s1: 'MISSING', s2: 'REFUTED', s3: 'INERT', s4: 'PASS' },
  family_E_conformal: { verdict: 'NOT_EXECUTABLE', tier: null, s1: 'DECLARED', s2: 'VOID', s3: 'MISSING', s4: 'REFUSE' },
  safe_t_e_value: { verdict: 'USE', tier: 'T1', s1: 'MISSING', s2: 'PASS', s3: 'PASS', s4: 'PASS' },
  sequential_mmd_betting_e_process: { verdict: 'REFUSE', tier: null, s1: 'DECLARED', s2: 'REFUTED', s3: 'MISSING', s4: 'PASS' },
  sequential_ui_e_process: { verdict: 'NOT_EXECUTABLE', tier: null, s1: 'MISSING', s2: 'PASS', s3: 'MISSING', s4: 'PASS' },
  universal_inference_e_value: { verdict: 'USE', tier: 'T1', s1: 'MISSING', s2: 'PASS', s3: 'INERT', s4: 'PASS' },
  group_average_e_value: { verdict: 'REFUSE', tier: null, s1: 'MISSING', s2: 'REFUTED', s3: 'PASS', s4: 'PASS' },
  family_E_conformal_heldout: { verdict: 'REFUSE', tier: null, s1: 'MISSING', s2: 'REFUTED', s3: 'PASS', s4: 'PASS' },
  point_tail_bet_e_value: { verdict: 'USE', tier: 'T1', s1: 'MISSING', s2: 'PASS', s3: 'PASS', s4: 'PASS' },
  spectral_bet_e_process: { verdict: 'USE', tier: 'T1', s1: 'MISSING', s2: 'PASS', s3: 'PASS', s4: 'PASS' },
  shape_block_conformal_bet: { verdict: 'USE', tier: 'T1', s1: 'MISSING', s2: 'PASS', s3: 'PASS', s4: 'PASS' },
};

function runHarness(t) {
  const tmpRoot = mkdtempSync(join(tmpdir(), 'cert-golden-'));
  t.after(() => rmSync(tmpRoot, { recursive: true, force: true }));
  execFileSync(process.execPath, [join(certDir, 'verdict.mjs')], {
    cwd: certDir, env: { ...process.env, CERT_RESULTS_DIR: tmpRoot }, stdio: 'pipe',
  });
  const runs = readdirSync(tmpRoot).filter((d) => d.startsWith('run-'));
  assert.equal(runs.length, 1);
  const dir = join(tmpRoot, runs[0]);
  const cards = {};
  for (const f of readdirSync(dir).filter((n) => n.endsWith('.card.json'))) {
    const o = JSON.parse(readFileSync(join(dir, f), 'utf8'));
    cards[o.card.detector_id] = o;
  }
  return { dir, cards };
}

test('the fourteen verdicts are exactly the frozen table', (t) => {
  const { cards } = runHarness(t);
  assert.deepEqual(Object.keys(cards).sort(), Object.keys(GOLDEN).sort(), 'the set of certified detectors changed');
  for (const [id, want] of Object.entries(GOLDEN)) {
    const o = cards[id];
    assert.equal(o.overall.verdict, want.verdict, `${id}: verdict moved`);
    assert.equal(o.overall.tier, want.tier, `${id}: tier moved`);
    assert.equal(o.s1.status, want.s1, `${id}: S1 moved`);
    assert.equal(o.s2.status, want.s2, `${id}: S2 moved`);
    assert.equal(o.s3.status, want.s3, `${id}: S3 moved`);
    assert.equal(o.s4.status, want.s4, `${id}: S4 moved`);
  }
});

// The two facts the fix wave turned on, asserted against the corpus rather than a fixture:
// if either regressed, safe-t's USE would be resting on a cell that refutes it.
//
// FIX 3: `results/` is append-only, so a strict cell count breaks by construction the
// first time any registered run is appended -- two of golden-verdicts.test.mjs's three
// pre-existing failures were exactly this (n4.length 5 !== 2, 14 !== 4), unrelated to
// whether the scorer is correct. The floor below is the count the corpus produces TODAY
// (2 x 2026-08-02 + 2 x the 2026-08-07 power run + 1 x the phi sweep = 5); `>=` keeps the
// regression the test exists for -- a run silently vanishing from the corpus -- catchable
// without breaking on the next registered append.
test('safe-t: the mean rule fires on N4-p09 and that cell is out of the published regime', (t) => {
  const { cards } = runHarness(t);
  const o = cards.safe_t_e_value;
  const n4 = o.s2.perCell.filter((c) => c.null_id === 'N4-p09');
  assert.ok(n4.length >= 5, `at least the 5 currently-registered N4-p09 cells must be scored (got ${n4.length})`);
  for (const c of n4) {
    assert.equal(c.mapped, 'REFUTED');
    assert.equal(c.mean_rule_applied, true);
    assert.equal(c.overridden_verdict, 'not-refuted');
    assert.equal(c.out_of_regime, true);
  }
  assert.ok(o.overall.regime.excluded_cells.some((c) => c.null_id === 'N4-p09' && c.mapped === 'REFUTED'),
    'the refuting cell must appear in the published regime as excluded, not vanish');
  assert.equal(o.overall.verdict, 'USE');
});

// FIX 3: floor, not exact count, for the same append-only reason as the safe-t test above.
// 14 is what the corpus produces today (4 from the pre-existing battery runs + 4 from the
// 2026-08-07 power run + 6 from the phi sweep).
test('universal-inference keeps its N4 cells in regime: its claim quantifies over any phi', (t) => {
  const { cards } = runHarness(t);
  const o = cards.universal_inference_e_value;
  assert.equal(o.card.guarantee.regime.phi_known, undefined, 'UI claims no known-phi restriction');
  const n4 = o.s2.perCell.filter((c) => c.null_id?.startsWith('N4'));
  assert.ok(n4.length >= 14, `at least the 14 currently-registered N4* cells must be scored (got ${n4.length})`);
  assert.ok(n4.every((c) => c.out_of_regime === false && c.mapped === 'CLEARED'));
});

test('the report the harness writes carries the same fourteen verdicts as its card JSONs', (t) => {
  const { dir, cards } = runHarness(t);
  const report = readFileSync(join(dir, 'REPORT.md'), 'utf8');
  assert.ok(existsSync(join(dir, 'MISSING-CELLS.md')));
  for (const [id, want] of Object.entries(GOLDEN)) {
    const row = report.split('\n').find((l) => l.includes(`| ${id} |`));
    assert.ok(row, `no report row for ${id}`);
    assert.ok(row.includes(`**${want.verdict}**`), `${id}: report row disagrees with the frozen verdict`);
    assert.equal(cards[id].overall.verdict, want.verdict);
  }
});

// validation/certification/test/coverage-score.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FAULT_CLASSES, COVERAGE_FLOOR } from '../lib/constants.mjs';
import { coverageFor } from '../lib/score.mjs';

const card = {
  detector_id: 'safe_t_e_value', aliases: ['safe_t'], class: 'terminal_e_value',
  guarantee: { regime: { phi_max: 0.95, m_min: null, phi_known: true } },
  budget: { participating: true }, prior_evidence: [],
};
const pcell = (over = {}) => ({ detector: 'safe_t', fault_class: 'K1', severity: '1.5sigma',
  canonical: true, detection_rate: 0.86, shift_sigma: null, phi: 0, __tier: 'T1', verdict: 'POWERED', ...over });

// Amendment v2.K6A.2, K6A.2.1 item 10: the name said "six classes" as a frozen PROPERTY, and the
// deepEqual is exact, so K6A.1.13's item 1 breaks this assertion the moment it lands. Registered
// update: seven keys, and a name that no longer claims a count the registry does not have. What
// the test is for is unchanged — the registry's shape is frozen by assertion, not by convention,
// and `K6-slow` is appended so every existing class keeps its position (COVERAGE.md row order is
// this key order, verdict.mjs:286).
test('registry: seven classes, frozen shape', () => {
  assert.deepEqual(Object.keys(FAULT_CLASSES), ['K1', 'K2', 'K3', 'K4', 'K5', 'K6', 'K6-slow']);
  assert.equal(FAULT_CLASSES.K1.canonical, '1.5sigma');
  assert.equal(FAULT_CLASSES.K2.canonical, 'K10-e0.5sigma');
  assert.equal(FAULT_CLASSES.K3.canonical, 'A0.75sigma-f0.05');
  assert.equal(FAULT_CLASSES.K4.canonical, '5sigma-point');
  // Amendment v2.K5R (K5R.3/K5R.5): K5's canonical moved from `slope1e-4` (terminal shift
  // 0.0199σ over the 200-tick window, a cell whose injection changed 0 of 14,000 paired
  // crossing decisions) to the 2σ-terminal cell `slope1e-2`. The three old grid entries are
  // KEPT — preserved evidence of a different question (K5R.4), reported and deciding nothing.
  assert.equal(FAULT_CLASSES.K5.canonical, 'slope1e-2');
  assert.deepEqual(FAULT_CLASSES.K5.grid,
    ['slope5e-5', 'slope1e-4', 'slope5e-4', 'slope2.5e-3', 'slope5e-3', 'slope1e-2', 'slope2e-2'],
    'K5R.5 registers the old three grid entries followed by the four new ones, in cell-table order');
  assert.equal(FAULT_CLASSES.K6.canonical, 'mix-d1.5');
  // Amendment v2.K6A.1 (K6A.1.13 item 1): K6-slow shares K6's severities and its canonical --
  // it is the SAME injectShapeMix construction read over an hours-scale horizon (T = 6,300,
  // K6A.1.9), not a new severity grammar. The two rows are distinguished by their names and by
  // the detector each carries, never by their grids.
  assert.equal(FAULT_CLASSES['K6-slow'].canonical, 'mix-d1.5');
  assert.deepEqual(FAULT_CLASSES['K6-slow'].grid, ['mix-d1.0', 'mix-d1.5', 'mix-d2.0']);
  assert.deepEqual(FAULT_CLASSES['K6-slow'].grid, FAULT_CLASSES.K6.grid,
    'K6A.1.9: the same three severities, at a different horizon');
  assert.equal(FAULT_CLASSES['K6-slow'].name, 'distributional shape change, hours-scale accumulator');
  assert.notEqual(FAULT_CLASSES['K6-slow'].name, FAULT_CLASSES.K6.name,
    'two rows that share a grid must not share a name in the report');
  assert.equal(COVERAGE_FLOOR, 0.50);
  // Every class's canonical must be a member of its own grid — the invariant `canonicalOf`
  // (run-battery.mjs) and `coverageFor`'s `canonical === true` filter both rest on. A canonical
  // outside the grid emits no canonical cell at all and the class silently reads NOT_POWERED.
  for (const [classId, spec] of Object.entries(FAULT_CLASSES)) {
    assert.ok(spec.grid.includes(spec.canonical),
      `${classId}: canonical ${spec.canonical} is not in its own grid`);
  }
});

// Amendment v2.K5R, K5R.6: the mechanism the registered supersession exists for. `coverageFor`
// keys COVERED on `canonical === true` and nothing else, so two rows from two pooled runs can
// both claim to be a class's canonical at DIFFERENT severities (`loadEvidence` pools every run
// under results/live with no cross-run dedup). This test pins both halves of that behaviour: a
// covering cell is found whatever the array order, and when nothing covers, the REPORTED
// canonical is simply `canonicalCells[0]` — order-dependent, which is why the corpus must carry
// one canonical, not two.
test('two canonical cells at different severities: .find covers, but the reported canonical is order-dependent', () => {
  const stale = pcell({ fault_class: 'K5', severity: 'slope1e-4', canonical: true, detection_rate: 0.0 });
  const current = pcell({ fault_class: 'K5', severity: 'slope1e-2', canonical: true, detection_rate: 0.9999 });

  for (const order of [[stale, current], [current, stale]]) {
    const cov = coverageFor(card, order);
    assert.equal(cov.K5.status, 'COVERED', 'a covering canonical cell is found in either order');
    assert.equal(cov.K5.canonical.severity, 'slope1e-2');
    assert.equal(cov.K5.canonical.rate, 0.9999);
  }

  const bothBelow = [
    pcell({ fault_class: 'K5', severity: 'slope1e-4', canonical: true, detection_rate: 0.0 }),
    pcell({ fault_class: 'K5', severity: 'slope1e-2', canonical: true, detection_rate: 0.4 }),
  ];
  assert.equal(coverageFor(card, bothBelow).K5.canonical.severity, 'slope1e-4');
  assert.equal(coverageFor(card, [...bothBelow].reverse()).K5.canonical.severity, 'slope1e-2',
    'with nothing covering, the reported canonical follows array order — two canonicals is not a readable corpus');
});

test('COVERED when canonical cell at or above floor', () => {
  const cov = coverageFor(card, [pcell()]);
  assert.equal(cov.K1.status, 'COVERED');
  assert.equal(cov.K1.canonical.rate, 0.86);
});

test('NOT_POWERED below floor at canonical; grid cells reported but not deciding', () => {
  const cov = coverageFor(card, [pcell({ detection_rate: 0.31 }), pcell({ severity: '3sigma', canonical: false, detection_rate: 0.99 })]);
  assert.equal(cov.K1.status, 'NOT_POWERED');
  assert.equal(cov.K1.cells.length, 2);
});

test('NO_EVIDENCE when a class has no fault_class cells', () => {
  const cov = coverageFor(card, [pcell()]);
  assert.equal(cov.K3.status, 'NO_EVIDENCE');
});

test('cells without fault_class are ignored by coverage (legacy S3 evidence)', () => {
  const legacy = { detector: 'safe_t', shift_sigma: 3, detection_rate: 0.96, __tier: 'T1', verdict: 'pass' };
  const cov = coverageFor(card, [legacy]);
  assert.equal(cov.K1.status, 'NO_EVIDENCE');
});

test('guards apply: non-finite coverage cell is excluded, not counted', () => {
  const cov = coverageFor(card, [pcell({ non_finite_wealth: 12 })]);
  assert.equal(cov.K1.status, 'NO_EVIDENCE');
});

test('a guard-passing canonical cell with no finite power rate is excluded, named, and does not silently survive', () => {
  const cov = coverageFor(card, [pcell({ detection_rate: null, rate_e_ge_20: undefined })]);
  assert.equal(cov.K1.status, 'NO_EVIDENCE');
  assert.equal(cov.K1.cells.length, 0);
  assert.equal(cov.K1.excluded.length, 1);
  assert.match(cov.K1.excluded[0].reason, /^no finite power rate recorded/);
  assert.equal(cov.K1.excluded[0].suppressed_verdict, 'POWERED');
});

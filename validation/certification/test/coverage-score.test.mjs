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

test('registry: six classes, frozen shape', () => {
  assert.deepEqual(Object.keys(FAULT_CLASSES), ['K1', 'K2', 'K3', 'K4', 'K5', 'K6']);
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

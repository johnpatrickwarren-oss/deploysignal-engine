// test/guarantees.test.ts — the guarantee table is total, honest, and live.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { APPROXIMATE_E_VALUE_BY_CONSTRUCTION } from '../guarantees';
import { DETECTOR_REGISTRY, type DetectorId } from '../types/audit';
import {
  GUARANTEE_TABLE, guaranteeFor, guaranteeManifest, ESTIMATED_BASELINE_GUARANTEES,
  HEURISTIC_CORE_GUARANTEE,
} from '../guarantees';
import * as core from '../core';
import {
  BETTING_E_PROCESS_ENVELOPE, MIXTURE_SUPERMARTINGALE_ENVELOPE,
} from '../detectors/validity-envelope';

const ALL_IDS: DetectorId[] = [
  ...DETECTOR_REGISTRY.A, ...DETECTOR_REGISTRY.B, ...DETECTOR_REGISTRY.C,
  ...DETECTOR_REGISTRY.D, ...DETECTOR_REGISTRY.E,
];

describe('guarantee table (WORKLIST C4)', () => {
  test('total over the registry: every detector id resolves to exactly one row', () => {
    for (const id of ALL_IDS) {
      const row = guaranteeFor(id);
      assert.ok(row, `no guarantee row for registry id '${id}'`);
    }
  });

  test('longest-prefix routing: the betting MMD id does not fall through to the retired row', () => {
    assert.equal(guaranteeFor('sequential_mmd_betting_e_process')!.validityClass, 'ville_anytime_valid');
    assert.equal(guaranteeFor('sequential_mmd')!.evidence.includes('Q68'), true);
  });

  test('axis-2 entries are the live envelope objects, not copies', () => {
    assert.equal(guaranteeFor('betting_e_process_ttft')!.estimatedBaseline, BETTING_E_PROCESS_ENVELOPE);
    assert.equal(guaranteeFor('page_cusum_ttft')!.estimatedBaseline, MIXTURE_SUPERMARTINGALE_ENVELOPE);
  });

  test('no unpriced alpha: only ville/priced/classical classes may spend', () => {
    for (const row of GUARANTEE_TABLE) {
      if (row.alphaPolicy === 'none') continue;
      assert.notEqual(row.validityClass, 'heuristic',
        `heuristic row '${row.detector}' must not spend alpha`);
      assert.notEqual(row.validityClass, 'retracted',
        `retracted row '${row.detector}' must not spend alpha`);
      if (row.validityClass === 'bounded_priced') {
        assert.equal(row.alphaPolicy, 'priced_spend_requires_c_bound',
          `bounded_priced row '${row.detector}' may spend only under the c-bound`);
      }
    }
  });

  test('the Family D e-detector row carries the measured reclassification, dated', () => {
    const row = guaranteeFor('spectral_e_detector_kv_cache')!;
    assert.equal(row.validityClass, 'bounded_priced');
    for (const needle of ['0.576', '2026-08-01', '1.0636', 'c/alpha']) {
      assert.ok(row.evidence.includes(needle), `evidence missing '${needle}'`);
    }
  });

  test('blanks are explicit: Families C, D, E carry no envelope and say so', () => {
    for (const id of ['hotelling_t2_safe', 'spectral_e_detector_kv_cache',
      'mahalanobis_conformal_baseline'] as const) {
      assert.equal(guaranteeFor(id)!.estimatedBaseline, 'unrecorded');
    }
  });

  test('the retraction stays visible where the table lives', () => {
    assert.equal(
      ESTIMATED_BASELINE_GUARANTEES.nuisance_robust_bf_e_value.validUnderEstimatedBaseline, false);
  });

  test('manifest round-trips as JSON with one entry per row plus the heuristic core', () => {
    const parsed = JSON.parse(guaranteeManifest());
    assert.equal(parsed.length, GUARANTEE_TABLE.length + 1);
    const core = parsed[parsed.length - 1];
    assert.equal(core.kind, 'heuristic_core');
    assert.equal(core.validityClass, 'heuristic');
    assert.equal(core.alphaPolicy, 'none');
  });

  test('the core.ts heuristic layer is covered: heuristic, spends no alpha, exports live', () => {
    assert.equal(HEURISTIC_CORE_GUARANTEE.validityClass, 'heuristic');
    assert.equal(HEURISTIC_CORE_GUARANTEE.alphaPolicy, 'none');
    assert.ok(Object.isFrozen(HEURISTIC_CORE_GUARANTEE));
    // Every export the entry claims to cover actually exists in core.ts, so the entry
    // cannot drift from the module it describes.
    for (const name of HEURISTIC_CORE_GUARANTEE.exports) {
      assert.ok(name in core, `HEURISTIC_CORE_GUARANTEE covers '${name}' but core.ts does not export it`);
    }
  });

  test('the Family B row points at the trend layer that sets its thresholds', () => {
    const row = guaranteeFor('kv_saturation')!;
    assert.equal(row.family, 'B');
    assert.ok(row.implementation.includes('core.ts'),
      'Family B implementation must name the core.ts trend layer');
    assert.ok(row.implementation.includes('HEURISTIC_CORE_GUARANTEE'));
  });
});

// ── Axis 3 (C61, 2026-09-02): the (epsilon, delta)-approximate e-value form ──────────────
test('axis 3 is total: every row and the core layer state an approximate-e-value form', () => {
  for (const row of GUARANTEE_TABLE) {
    assert.ok(row.approximateEValue && row.approximateEValue.form, `${row.detector}: no axis 3`);
  }
  assert.equal(HEURISTIC_CORE_GUARANTEE.approximateEValue.form, 'not_e_value');
});

test('axis 3 is consistent with axes 1 and 2', () => {
  for (const row of GUARANTEE_TABLE) {
    const a = row.approximateEValue;
    // a genuine e-value claim needs a recorded envelope; nothing in the registry table qualifies today
    if (a.form === 'e_value') assert.notEqual(row.estimatedBaseline, 'unrecorded', `${row.detector}: e_value with no envelope`);
    // a Ville label whose envelope records the estimation premise false cannot be 'e_value'
    if (row.validityClass === 'ville_anytime_valid' && row.estimatedBaseline !== 'unrecorded'
        && row.estimatedBaseline.validUnderEstimatedBaseline === false) {
      assert.notEqual(a.form, 'e_value', `${row.detector}: premise false but claimed e_value`);
    }
    // a priced row is an (epsilon, 0) form with a measured horizon and K
    if (row.validityClass === 'bounded_priced') {
      assert.equal(a.form, 'epsilon');
      if (a.form === 'epsilon') { assert.ok(a.epsilon > 0 && a.horizon > 0 && a.calibration_windows !== undefined); }
    }
    // classical / heuristic / retracted rows are not e-values
    if (row.validityClass === 'classical_epoch' || row.validityClass === 'heuristic') {
      assert.equal(a.form, 'not_e_value', `${row.detector}: ${row.validityClass} must be not_e_value`);
    }
    if (a.form === 'epsilon') assert.ok(a.epsilon >= 0 && a.source.length > 0);
    if (a.form === 'epsilon_growing') assert.ok(a.law.length > 20 && a.source.length > 0);
  }
});

test('the Family A plug-in rows carry the growing-epsilon law with the measured kappa', () => {
  const betting = guaranteeFor('betting_e_process_ttft')!.approximateEValue;
  assert.equal(betting.form, 'epsilon_growing');
  if (betting.form === 'epsilon_growing') assert.equal(betting.kappa, 0.8445);
  assert.equal(guaranteeFor('page_cusum_ttft')!.approximateEValue.form, 'epsilon_growing');
});

test('the constructions: three e-values inside their envelopes and one constant epsilon', () => {
  assert.equal(APPROXIMATE_E_VALUE_BY_CONSTRUCTION.safe_t_e_value.form, 'e_value');
  assert.equal(APPROXIMATE_E_VALUE_BY_CONSTRUCTION.universal_inference_e_value.form, 'e_value');
  assert.equal(APPROXIMATE_E_VALUE_BY_CONSTRUCTION.sequential_ui_e_process.form, 'e_value');
  const bf = APPROXIMATE_E_VALUE_BY_CONSTRUCTION.nuisance_robust_bf_e_value;
  assert.equal(bf.form, 'epsilon');
  if (bf.form === 'epsilon') assert.ok(Math.abs(bf.epsilon - 0.155) < 1e-9);
});

test('the manifest carries axis 3 on every row', () => {
  const parsed = JSON.parse(guaranteeManifest()) as Array<{ approximateEValue?: { form: string } }>;
  for (const r of parsed) assert.ok(r.approximateEValue?.form, 'manifest row without axis 3');
});


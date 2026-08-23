// test/guarantees.test.ts — the guarantee table is total, honest, and live.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
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

  test('manifest round-trips as JSON with one entry per row', () => {
    const parsed = JSON.parse(guaranteeManifest());
    assert.equal(parsed.length, GUARANTEE_TABLE.length);
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

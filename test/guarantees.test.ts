// test/guarantees.test.ts — the guarantee table is total, honest, and live.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { APPROXIMATE_E_VALUE_BY_CONSTRUCTION } from '../guarantees';
import { detectorRegistryFor, allDetectorIds } from '../types/audit';
import {
  GUARANTEE_TABLE, guaranteeFor, guaranteeManifest, ESTIMATED_BASELINE_GUARANTEES,
} from '../guarantees';
import {
  BETTING_E_PROCESS_ENVELOPE, MIXTURE_SUPERMARTINGALE_ENVELOPE,
} from '../detectors/validity-envelope';

// The DeploySignal-shaped fixture: six Family A signals, one Family D signal, sixteen heuristic
// ids. Since v0.8.0-pre the library ships no registry instance; this fixture keeps the totality
// proof concrete (the test 'a consumer with its own signals…' proves it for an arbitrary set).
const SIX_SIGNALS = ['p99_latency', 'ttft', 'eval_score', 'tool_success_rate', 'downstream_err', 'cost_req'] as const;
const SIXTEEN_HEURISTICS = [
  'kv_saturation', 'hbm_elevation', 'hbm_spill_roll', 'mfu_collapse',
  'slowbleed', 'collective', 'capacity', 'gpu_eff', 'compound_lat',
  'tok_econ', 'behavioral', 'eval_quality_drop', 'refusal_spike',
  'output_len_drift', 'tool_call_degradation', 'quality_warning',
] as const;
const FIXTURE_REGISTRY = detectorRegistryFor({ signals: SIX_SIGNALS, familyDSignals: ['kv_cache'], heuristics: SIXTEEN_HEURISTICS });
const ALL_IDS = allDetectorIds(FIXTURE_REGISTRY);

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

  test('C64 (a): the six safe_t_e_value_* ids are registered and resolve to the terminal e-value row', () => {
    const signals = ['p99_latency', 'ttft', 'eval_score', 'tool_success_rate', 'downstream_err', 'cost_req'];
    for (const sig of signals) {
      const id = `safe_t_e_value_${sig}`;
      assert.ok((FIXTURE_REGISTRY.A as readonly string[]).includes(id), `${id} not in the fixture registry`);
      const row = guaranteeFor(id)!;
      assert.equal(row.validityClass, 'e_value_terminal');
      assert.equal(row.alphaPolicy, 'classical_epoch_alpha', 'one look per canary spends alpha once');
      assert.equal(row.estimatedBaseline, ESTIMATED_BASELINE_GUARANTEES.safe_t_e_value, 'the live safe-t envelope');
      assert.equal(row.approximateEValue.form, 'e_value');
      assert.ok(row.evidence.includes('2026-09-03T18182Z'), 'evidence names the C64 (d) run');
    }
    // the row must not be mistaken for an e-process: the class is terminal, never ville
    assert.notEqual(guaranteeFor('safe_t_e_value_ttft')!.validityClass, 'ville_anytime_valid');
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
    const m = JSON.parse(guaranteeManifest());
    assert.equal(m.length, GUARANTEE_TABLE.length);
  });

  test('the Family B row names the trend layer that sets its thresholds, now DeploySignal\'s own', () => {
    const row = guaranteeFor('kv_saturation')!;
    assert.ok(row.implementation.includes('core.ts'), 'Family B implementation must name the core.ts trend layer');
    assert.ok(row.implementation.includes('DeploySignal'), 'and say whose it is since v0.8.0-pre');
  });
});

// ── Axis 3 (C61, 2026-09-02): the (epsilon, delta)-approximate e-value form ──────────────
test('axis 3 is total: every row and the core layer state an approximate-e-value form', () => {
  for (const row of GUARANTEE_TABLE) {
    assert.ok(row.approximateEValue && row.approximateEValue.form, `${row.detector}: no axis 3`);
  }
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


// ── ADR 0033: the registry is generic; the guarantee table is total over any instance ────────
import { detectorKindOf, DETECTOR_KINDS } from '../types/audit';

describe('detector registry (ADR 0033)', () => {
  test('a six-signal registry: every per-signal kind × every signal, kind-major, plus the joint-vector kinds', () => {
    const sig = [...SIX_SIGNALS];
    const A = ['mSPRT', 'page_cusum', 'betting_e_process', 'safe_t_e_value', 'contrast_null', 'onset_mixture']
      .flatMap((k) => sig.map((s) => `${k}_${s}`));
    assert.deepEqual([...FIXTURE_REGISTRY.A], A);
    assert.deepEqual([...FIXTURE_REGISTRY.B], [...SIXTEEN_HEURISTICS]);
    assert.deepEqual([...FIXTURE_REGISTRY.C], [
      'hotelling_t2_joint_vector', 'sequential_mmd', 'hotelling_t2_safe', 'sequential_mmd_e_process',
      'sequential_mmd_betting_e_process',
    ]);
    assert.deepEqual([...FIXTURE_REGISTRY.D], ['spectral_peak_acf_kv_cache', 'spectral_e_detector_kv_cache']);
    assert.deepEqual([...FIXTURE_REGISTRY.E], ['mahalanobis_conformal_baseline']);
    assert.equal(ALL_IDS.length, 36 + 16 + 5 + 2 + 1);
  });

  test('a consumer with its own signals gets a registry the guarantee table is total over', () => {
    const r = detectorRegistryFor({ signals: ['path_loss_7', 'rtt_p99'], familyDSignals: ['hbm_temp'] });
    assert.equal(r.A.length, DETECTOR_KINDS.A.length * 2);
    assert.equal(r.D.length, DETECTOR_KINDS.D.length);
    assert.deepEqual([...r.B], [], 'no heuristics unless the consumer names them');
    assert.equal(allDetectorIds(r).length, r.A.length + r.C.length + r.D.length + r.E.length);
    for (const id of allDetectorIds(r)) {
      const row = guaranteeFor(id);
      assert.ok(row, `no guarantee row for '${id}'`);
      assert.equal(row!.family, detectorKindOf(id)!.family, `family disagrees for '${id}'`);
    }
    // the same kind resolves to the same row whatever the signal is called
    assert.equal(guaranteeFor('betting_e_process_rtt_p99'), guaranteeFor('betting_e_process_ttft'));
    assert.equal(guaranteeFor('safe_t_e_value_path_loss_7')!.validityClass, 'e_value_terminal');
    assert.equal(Object.isFrozen(r) && Object.isFrozen(r.A), true);
  });

  test('detectorKindOf: longest kind-prefix wins; heuristics and unknown ids are undefined', () => {
    assert.deepEqual(detectorKindOf('sequential_mmd_betting_e_process'), { family: 'C', kind: 'sequential_mmd_betting_e_process' });
    assert.deepEqual(detectorKindOf('sequential_mmd'), { family: 'C', kind: 'sequential_mmd' });
    assert.deepEqual(detectorKindOf('page_cusum_anything'), { family: 'A', kind: 'page_cusum' });
    assert.deepEqual(detectorKindOf('spectral_e_detector_x'), { family: 'D', kind: 'spectral_e_detector' });
    assert.equal(detectorKindOf('kv_saturation'), undefined);
    assert.equal(detectorKindOf('page_cusum'), undefined, 'a per-signal kind needs a signal');
  });
});

test('ADR 0036: twin rows resolve by prefix, carry live envelopes, and claim a genuine e-value', () => {
  const rate = guaranteeFor('twin_rate_http_5xx');
  const sign = guaranteeFor('twin_sign_p99_ms');
  assert.ok(rate && sign);
  assert.equal(rate.estimatedBaseline, ESTIMATED_BASELINE_GUARANTEES.twin_rate);
  assert.equal(sign.estimatedBaseline, ESTIMATED_BASELINE_GUARANTEES.twin_sign);
  assert.equal(rate.validityClass, 'ville_anytime_valid');
  assert.equal(APPROXIMATE_E_VALUE_BY_CONSTRUCTION.twin_rate.form, 'e_value');
  assert.equal(APPROXIMATE_E_VALUE_BY_CONSTRUCTION.twin_sign.form, 'e_value');
  assert.match(rate.evidence, /REGISTERED, NOT RUN/);
});

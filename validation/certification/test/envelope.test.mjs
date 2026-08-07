// validation/certification/test/envelope.test.mjs
//
// I3(b): S4.4 wiring -- "a ValidityEnvelope entry exists" is a fact about
// fleet/e-bh-guarded.ts's DETECTOR_ENVELOPES map, so it is read mechanically
// out of that file rather than asserted in a card.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { envelopeKeys, isWired } from '../lib/envelope.mjs';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

test('envelopeKeys reads the real DETECTOR_ENVELOPES keys out of fleet/e-bh-guarded.ts', () => {
  const keys = envelopeKeys(readFileSync(join(repoRoot, 'fleet', 'e-bh-guarded.ts'), 'utf8'));
  assert.deepEqual([...keys].sort(), [
    'betting_e_process',
    'nuisance_robust_bf_e_value',
    'page_cusum_mixture_supermartingale',
    'safe_t_e_value',
    'sequential_ui_e_process',
    'universal_inference_e_value',
  ]);
});

test('envelopeKeys returns [] when the map is absent, so the check degrades to "not wired"', () => {
  assert.deepEqual(envelopeKeys('export const NOTHING = 1;'), []);
});

test('envelopeKeys ignores commented-out entries and the import block', () => {
  const src = `
import { A } from '../detectors/validity-envelope';
export const DETECTOR_ENVELOPES: Readonly<Record<string, ValidityEnvelope>> = Object.freeze({
  alpha_detector: A_ENVELOPE,
  // retired_detector: RETIRED_ENVELOPE,
  beta_detector: B_ENVELOPE,
});
`;
  assert.deepEqual(envelopeKeys(src), ['alpha_detector', 'beta_detector']);
});

test('isWired matches a card id exactly', () => {
  assert.equal(isWired('safe_t_e_value', [], ['safe_t_e_value']), true);
});

test('isWired matches through an alias', () => {
  assert.equal(isWired('family_A_betting_e_process', ['betting_e_process'], ['betting_e_process']), true);
});

// The real family_A_mixture case: the card's alias is mixture_supermartingale and the
// envelope key is page_cusum_mixture_supermartingale -- the same detector under a
// longer name. A suffix match on an underscore boundary accepts it; a substring
// match anywhere would accept far too much, so the boundary is required.
test('isWired accepts an alias that is an underscore-boundary suffix of the envelope key', () => {
  assert.equal(isWired('family_A_mixture_supermartingale', ['mixture_supermartingale'], ['page_cusum_mixture_supermartingale']), true);
});

test('isWired rejects a bare substring that is not on an underscore boundary', () => {
  assert.equal(isWired('supermartingale', [], ['page_cusum_mixture_supermartingale']), false);
});

test('isWired is false for a detector with no envelope entry at all', () => {
  assert.equal(isWired('family_C_safe_hotelling', ['safe_hotelling'], ['safe_t_e_value', 'betting_e_process']), false);
});

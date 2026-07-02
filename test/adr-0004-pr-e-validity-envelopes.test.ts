// test/adr-0004-pr-e-validity-envelopes.test.ts — ADR 0004 PR E.
//
// The honesty fix: every e-value ships a validity envelope; the plug-in betting/mixture e-values are
// labelled INVALID under an estimated baseline and gated out of the FDR path unless their regime is
// asserted; the assembled FP/FDR-by-construction conditions are surfaced for the fleet verdict.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  BETTING_E_PROCESS_ENVELOPE,
  MIXTURE_SUPERMARTINGALE_ENVELOPE,
  NUISANCE_ROBUST_BF_ENVELOPE,
  isValidForFdrPath,
  assertValidForFdrPath,
} from '../detectors/validity-envelope';
import { SAFE_T_ENVELOPE } from '../detectors/safe-t-e-value';
import {
  assembleFleetGuaranteeConditions,
  ROBUST_COMMON_MODE_BREAKDOWN,
} from '../fleet/guarantee';

// ── Envelopes label the plug-in e-values invalid-under-estimated-baseline; and since the 2026-07-02
// correction the BF too (E[BF|H0] ≈ 1.155 at every cal length — the recentering defect). ──────────
test('envelopes: plug-in betting/mixture AND the corrected BF are invalid-under-estimated-baseline', () => {
  assert.equal(BETTING_E_PROCESS_ENVELOPE.baseline, 'plug-in');
  assert.equal(BETTING_E_PROCESS_ENVELOPE.validUnderEstimatedBaseline, false);
  assert.equal(MIXTURE_SUPERMARTINGALE_ENVELOPE.baseline, 'plug-in');
  assert.equal(MIXTURE_SUPERMARTINGALE_ENVELOPE.validUnderEstimatedBaseline, false);
  assert.equal(NUISANCE_ROBUST_BF_ENVELOPE.baseline, 'unknown-mean-integrated');
  // 2026-07-02 correction: the BF's recentering breaks the proper-prior property (E ≈ 1.155).
  assert.equal(NUISANCE_ROBUST_BF_ENVELOPE.validUnderEstimatedBaseline, false);
});

// ── The FDR-path gate. ────────────────────────────────────────────────────────────────────────────
test('gate: the corrected BF is NO LONGER auto-admissible to the FDR path (2026-07-02)', () => {
  assert.equal(isValidForFdrPath(NUISANCE_ROBUST_BF_ENVELOPE), false);
  assert.equal(isValidForFdrPath(NUISANCE_ROBUST_BF_ENVELOPE, {}), false);
  // Its inflation is bounded (≈1.155·q), so a caller may still admit it under an explicit regime
  // assertion — but never silently.
  assert.equal(isValidForFdrPath(NUISANCE_ROBUST_BF_ENVELOPE, { trueBaseline: true }), true);
});

test('gate: a plug-in e-value is gated OUT unless its validity regime is asserted', () => {
  // Default (estimated baseline) → not admissible.
  assert.equal(isValidForFdrPath(BETTING_E_PROCESS_ENVELOPE), false);
  assert.equal(isValidForFdrPath(MIXTURE_SUPERMARTINGALE_ENVELOPE), false);
  // Asserting a true baseline OR m≫n admits it within its regime.
  assert.equal(isValidForFdrPath(BETTING_E_PROCESS_ENVELOPE, { trueBaseline: true }), true);
  assert.equal(isValidForFdrPath(BETTING_E_PROCESS_ENVELOPE, { mMuchGreaterThanN: true }), true);
  assert.equal(isValidForFdrPath(MIXTURE_SUPERMARTINGALE_ENVELOPE, { mMuchGreaterThanN: true }), true);
});

test('gate: assertValidForFdrPath throws for an unasserted plug-in e-value, passes otherwise', () => {
  assert.throws(() => assertValidForFdrPath(BETTING_E_PROCESS_ENVELOPE), /INVALID under an estimated baseline/);
  assert.throws(() => assertValidForFdrPath(MIXTURE_SUPERMARTINGALE_ENVELOPE), /INVALID/);
  assert.doesNotThrow(() => assertValidForFdrPath(BETTING_E_PROCESS_ENVELOPE, { trueBaseline: true }));
  // 2026-07-02 correction: the BF is no longer auto-admissible (E[BF|H0] ≈ 1.155); the safe-t /
  // UI envelopes are the valid-under-estimated-baseline objects now.
  assert.throws(() => assertValidForFdrPath(NUISANCE_ROBUST_BF_ENVELOPE), /INVALID/);
  assert.doesNotThrow(() => assertValidForFdrPath(SAFE_T_ENVELOPE));
});

// ── The assembled fleet guarantee conditions. ─────────────────────────────────────────────────────
test('guarantee: FP/FDR is by-construction only when ALL conditions hold (valid e-value, minority faults, scalar, coupled)', () => {
  const base = {
    // 2026-07-02: safe-t replaces the corrected BF as the valid-under-estimated-baseline envelope.
    eValueEnvelope: SAFE_T_ENVELOPE,
    faultFraction: 0.1,
    genuineCoupling: true,
    scalarCommonMode: true,
    minDetectableEffect: 3,
  };
  const ok = assembleFleetGuaranteeConditions(base);
  assert.equal(ok.fdrGuaranteedByConstruction, true);
  assert.equal(ok.eValueValidForFdr, true);
  assert.equal(ok.faultFractionUnderBreakdown, true);
  assert.equal(ok.breakdownFraction, ROBUST_COMMON_MODE_BREAKDOWN);
  assert.match(ok.summary, /BY CONSTRUCTION/);
  assert.match(ok.summary, /δ=3/); // FD characterized, not unconditional

  // Fault fraction past the breakdown → not guaranteed.
  assert.equal(assembleFleetGuaranteeConditions({ ...base, faultFraction: 0.4 }).fdrGuaranteedByConstruction, false);
  // No genuine coupling → not guaranteed.
  assert.equal(assembleFleetGuaranteeConditions({ ...base, genuineCoupling: false }).fdrGuaranteedByConstruction, false);
  // Heterogeneous (non-scalar) loading → not guaranteed.
  assert.equal(assembleFleetGuaranteeConditions({ ...base, scalarCommonMode: false }).fdrGuaranteedByConstruction, false);
});

test('guarantee: a plug-in e-value (unasserted) blocks the by-construction FP/FDR claim', () => {
  const c = assembleFleetGuaranteeConditions({
    eValueEnvelope: BETTING_E_PROCESS_ENVELOPE,
    faultFraction: 0.05, genuineCoupling: true, scalarCommonMode: true,
  });
  assert.equal(c.eValueValidForFdr, false);
  assert.equal(c.fdrGuaranteedByConstruction, false);
  assert.match(c.summary, /INVALID under an estimated baseline/);
  // Asserting the plug-in's regime restores the by-construction claim.
  const asserted = assembleFleetGuaranteeConditions({
    eValueEnvelope: BETTING_E_PROCESS_ENVELOPE, assertions: { mMuchGreaterThanN: true },
    faultFraction: 0.05, genuineCoupling: true, scalarCommonMode: true,
  });
  assert.equal(asserted.fdrGuaranteedByConstruction, true);
});

test('guarantee: the FD side is characterized (MDE), never unconditional; input is validated', () => {
  const noMde = assembleFleetGuaranteeConditions({
    eValueEnvelope: NUISANCE_ROBUST_BF_ENVELOPE, faultFraction: 0.1, genuineCoupling: true, scalarCommonMode: true,
  });
  assert.equal(noMde.minDetectableEffect, null);
  assert.match(noMde.summary, /not an unconditional guarantee|not guaranteed/);
  assert.throws(() => assembleFleetGuaranteeConditions({
    eValueEnvelope: NUISANCE_ROBUST_BF_ENVELOPE, faultFraction: 1.5, genuineCoupling: true, scalarCommonMode: true,
  }), RangeError);
  assert.throws(() => assembleFleetGuaranteeConditions({
    eValueEnvelope: NUISANCE_ROBUST_BF_ENVELOPE, faultFraction: 0.1, breakdownFraction: 1.5, genuineCoupling: true, scalarCommonMode: true,
  }), RangeError, 'breakdownFraction > 1');
});

test('guarantee: AT exactly the breakdown the guarantee is withheld (strict-< is conservative)', () => {
  const c = assembleFleetGuaranteeConditions({
    eValueEnvelope: NUISANCE_ROBUST_BF_ENVELOPE, faultFraction: 0.2, breakdownFraction: 0.2,
    genuineCoupling: true, scalarCommonMode: true,
  });
  assert.equal(c.faultFractionUnderBreakdown, false, 'faultFraction === breakdownFraction is OUT of envelope');
  assert.equal(c.fdrGuaranteedByConstruction, false);
});

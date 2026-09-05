// fleet/e-bh-guarded.ts — the e-BH entry point that refuses.
//
// `fleet/e-bh.ts` states the contract in its header: e-BH "TRUSTS the caller to have passed only
// e-values that are VALID under their baseline regime … Gate inputs with
// detectors/validity-envelope.ts:assertValidForFdrPath before calling this." Until 2026-08-02
// nothing did — `assertValidForFdrPath` had zero production callers across six repos, and there was
// no way to obtain an envelope for a detector id in the first place, because both gate functions
// take an envelope OBJECT the caller supplies.
//
// This file supplies the missing map and the entry point that uses it. Modelled on Tessera's
// `certifiedFdrBenjaminiHochberg` (tessera/tools/emitter-contract.ts), which is the working
// precedent for a gated FDR path in this workspace.
//
// `eBenjaminiHochberg` stays exported and ungated. Measurement harnesses legitimately compute an
// observed FDP against labelled ground truth and must not be forced through a validity gate — see
// validation/h0-battery/. What changes is that a caller committing to an FDR CLAIM has a function
// that refuses.

import { eBenjaminiHochberg, EBenjaminiHochbergOutput } from './e-bh';
import {
  ValidityEnvelope, FdrPathAssertions, assertValidForFdrPath,
  BETTING_E_PROCESS_ENVELOPE, MIXTURE_SUPERMARTINGALE_ENVELOPE,
} from '../detectors/validity-envelope';
import { SAFE_T_ENVELOPE } from '../detectors/safe-t-e-value';
import { UI_MEAN_SHIFT_ENVELOPE } from '../detectors/universal-inference-e-value';
import { SEQUENTIAL_UI_ENVELOPE } from '../detectors/sequential-ui';
import { NUISANCE_ROBUST_BF_ENVELOPE } from '../detectors/nuisance-robust-bf-e-value';
import { CONTRAST_NULL_ENVELOPE } from '../per-shard/contrast';

/** Detector id → the regime in which that detector's `E[e|H0] ≤ 1` holds.
 *
 *  An id ABSENT from this map is refused, not admitted. `detector-portfolio-current` records the
 *  rule this implements: a blank axis-2 cell means UNRECORDED, NOT SAFE. Families C, D and E publish
 *  no envelope, so they are absent, and the 2026-08-01 H0 battery measured Family D's spectral
 *  e-detector at a 57.6% false-alarm rate against a nominal 5% — which is what "unrecorded" was
 *  concealing. */
export const DETECTOR_ENVELOPES: Readonly<Record<string, ValidityEnvelope>> = Object.freeze({
  betting_e_process: BETTING_E_PROCESS_ENVELOPE,
  page_cusum_mixture_supermartingale: MIXTURE_SUPERMARTINGALE_ENVELOPE,
  safe_t_e_value: SAFE_T_ENVELOPE,
  universal_inference_e_value: UI_MEAN_SHIFT_ENVELOPE,
  sequential_ui_e_process: SEQUENTIAL_UI_ENVELOPE,
  // Retracted at v0.6.2-pre; kept so a caller still feeding it gets a NAMED refusal rather than
  // an "unknown detector" one. Its envelope carries validUnderEstimatedBaseline: false.
  nuisance_robust_bf_e_value: NUISANCE_ROBUST_BF_ENVELOPE,
  // C81 (2026-09-05): the contrast null (per-shard/contrast.ts) — the mixture or betting card on the
  // standardized contrast residual of a treatment/control pair. A NAMED REFUSAL: study
  // 2026-09-contrast-null measured the estimated OFFSET of the contrast as the plug-in n >> m price
  // (0.34 / 0.18 / 0.03 false alerts per 1,000 ticks at fit 60 / 300 / 2000 on iid pairs) and admitted
  // nothing; the envelope's `admission` carries the numbers. Admitted here only under the caller's
  // assertion { mMuchGreaterThanN } (fit >> horizon) or { trueBaseline } (a twin with a known offset).
  contrast_null_mixture: CONTRAST_NULL_ENVELOPE,
  contrast_null_betting: CONTRAST_NULL_ENVELOPE,
});

export function envelopeFor(detectorId: string): ValidityEnvelope | undefined {
  return DETECTOR_ENVELOPES[detectorId];
}

export interface GuardedEValue {
  /** Key into DETECTOR_ENVELOPES. An unknown id is refused. */
  detectorId: string;
  eValue: number;
  /** Per-shard regime assertions the caller is willing to stand behind. */
  assertions?: FdrPathAssertions;
  /** Calibration length actually used, if known. Checked against the envelope's `minCalibration`,
   *  which no code path read before 2026-08-02. */
  calLen?: number;
}

/** e-BH that refuses inadmissible inputs instead of trusting the caller.
 *
 *  Throws on: an unknown detector id, an envelope outside its validity regime, or a calibration
 *  length below the envelope's declared floor. Otherwise delegates to `eBenjaminiHochberg`.
 *
 *  @throws RangeError with the detector id and the reason. */
export function eBenjaminiHochbergGuarded(inputs: ReadonlyArray<GuardedEValue>, q: number): EBenjaminiHochbergOutput {
  if (inputs.length === 0) {
    throw new RangeError('eBenjaminiHochbergGuarded: no inputs (N=0 is structurally undefined)');
  }
  for (const input of inputs) {
    const env = envelopeFor(input.detectorId);
    if (env === undefined) {
      throw new RangeError(
        `eBenjaminiHochbergGuarded: no validity envelope for detector "${input.detectorId}". ` +
        'An unrecorded envelope is refused, not admitted — see detectors/validity-envelope.ts. ' +
        'Families C, D and E publish none.',
      );
    }
    try {
      assertValidForFdrPath(env, input.assertions ?? {});
    } catch (e) {
      throw new RangeError(
        `eBenjaminiHochbergGuarded: "${input.detectorId}" is outside its validity regime — ` +
        `${(e as Error).message}`,
      );
    }
    if (env.minCalibration !== undefined && input.calLen !== undefined
        && input.calLen < env.minCalibration) {
      throw new RangeError(
        `eBenjaminiHochbergGuarded: "${input.detectorId}" needs cal ≥ ${env.minCalibration} for its ` +
        `by-construction validity; got ${input.calLen}.`,
      );
    }
  }
  return eBenjaminiHochberg(inputs.map((i) => i.eValue), q);
}

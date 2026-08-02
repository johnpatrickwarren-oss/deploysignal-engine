import { EBenjaminiHochbergOutput } from './e-bh';
import { ValidityEnvelope, FdrPathAssertions } from '../detectors/validity-envelope';
/** Detector id → the regime in which that detector's `E[e|H0] ≤ 1` holds.
 *
 *  An id ABSENT from this map is refused, not admitted. `detector-portfolio-current` records the
 *  rule this implements: a blank axis-2 cell means UNRECORDED, NOT SAFE. Families C, D and E publish
 *  no envelope, so they are absent, and the 2026-08-01 H0 battery measured Family D's spectral
 *  e-detector at a 57.6% false-alarm rate against a nominal 5% — which is what "unrecorded" was
 *  concealing. */
export declare const DETECTOR_ENVELOPES: Readonly<Record<string, ValidityEnvelope>>;
export declare function envelopeFor(detectorId: string): ValidityEnvelope | undefined;
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
export declare function eBenjaminiHochbergGuarded(inputs: ReadonlyArray<GuardedEValue>, q: number): EBenjaminiHochbergOutput;
//# sourceMappingURL=e-bh-guarded.d.ts.map
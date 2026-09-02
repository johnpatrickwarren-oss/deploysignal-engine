// engine/detectors/_evidence.ts — ADR 0027: build the optional `evidence` surface from what a
// wealth detector already knows. Pure; never touches state. See
// types/verdict-extensions/evidence-surface.ts for the semantics and the validity boundary.

import type { EvidenceSurface, ThresholdKind } from '../types/verdict-extensions/evidence-surface';

export interface EvidenceArgs {
  log_wealth: number;
  log_increment: number | null;
  bet: number | null;
  n: number;
  /** linear threshold as the verdict carries it, or null. */
  threshold: number | null;
  threshold_kind: ThresholdKind | null;
  log_peak_wealth: number;
}

export function buildEvidence(a: EvidenceArgs): EvidenceSurface {
  const hasThreshold = a.threshold !== null && Number.isFinite(a.threshold) && a.threshold > 0;
  const log_threshold = hasThreshold ? Math.log(a.threshold as number) : null;
  return {
    log_wealth: a.log_wealth,
    log_increment: a.log_increment,
    bet: a.bet,
    n: a.n,
    log_threshold,
    threshold_kind: hasThreshold ? a.threshold_kind : null,
    nats_to_threshold: log_threshold === null ? null : log_threshold - a.log_wealth,
    growth_rate_hat: a.n > 0 ? a.log_wealth / a.n : null,
    log_peak_wealth: a.log_peak_wealth,
    anytime_p: Math.min(1, Math.exp(-a.log_peak_wealth)),
  };
}

/** Running-max bookkeeping: the new peak given the previous (possibly absent) peak and the
 *  current log-wealth. Absence heals to the current value. */
export function advanceLogPeak(prevPeak: number | null | undefined, logM: number): number {
  if (prevPeak == null || !Number.isFinite(prevPeak)) return logM;
  return logM > prevPeak ? logM : prevPeak;
}

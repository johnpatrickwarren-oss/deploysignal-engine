// fleet/localize.ts — topology-localized fault detection (ADR 0016/0017).
//
// The end-to-end localisation path the FAIR test (ADR 0016) validated, composing three pieces:
//   1. DETECTION-oriented common-mode (ADR 0017) — crossed-domain backfitting that removes the shared
//      common-mode WITHOUT absorbing a single-shard fault (the FDP-oriented common-mode absorbs it → 0%).
//   2. per-shard UNIVERSAL-INFERENCE e-value (ADR 0010) on each residual row (cal vs test window).
//   3. topology-PARTITIONED e-BH — e-BH run WITHIN each localisation group (e.g. a rack), not flat. At fleet
//      scale the flat threshold N/q is unreachable by the bounded UI e-value for sparse faults; partitioning
//      to n/q per group restores firing AND yields a localisation (which group, which shard).
//
// WHY PARTITIONED, NOT FLAT/HIERARCHICAL. Flat e-BH over 10^5 shards cannot fire on a bounded e-value
// (ADR 0016 finding 5). Two-level hierarchical e-BH does not control overall FDR (ADR 0015 — Benjamini–
// Bogomolov does not transfer to e-BH under arbitrary dependence; mean-aggregation dilution). So we run e-BH
// SEPARATELY per group and report per-group results. This is the honest middle: it localises and it controls
// FDR WITHIN each group, but there is NO cross-group/global FDR statement.
//
// SCOPE / HONESTY (do NOT overstate — measured, not assumed).
//   • The trustworthy output is the RANKING (`perShardEValue`), NOT the selected set. Measured at scale
//     (clustersynth, 2.9k–5.8k GPUs, ~1% sparse faults, 72/rack, q=0.1): recall ~45%, per-shard FPR ~6%, but
//     **FDP ~93%** — the e-BH `selected` set is mostly false positives. Reason: the common-mode residual is a
//     data-dependent fit, so per-shard validity is broken (leakage inflates healthy e-values) and the e-BH FDR
//     theorem does NOT hold; and at ~1% fault density even a 6% FPR swamps the rare true positives.
//   • So USE THIS AS A RANKED SHORTLIST: victims are enriched ~7× over healthy, so the top-ranked shards (by
//     `perShardEValue`, fleet-wide or per group) are a good triage list for an engineer. Do NOT treat
//     `selected` as a certified fault list — it is a convenience with NO FDR guarantee.
//   • For large fleets (10k+) only; small fleets are out of scope (DCGM localises directly).
//   • Real-telemetry ceiling (ADR 0012) is unchanged: irreducible per-shard nonstationarity is not removable
//     common-mode, so localisation on real data is bounded well below the synthetic oracle.
//   • GROUP-LEVEL faults (a whole domain shifting together) are ABSORBED by the common-mode and are a blind
//     spot here — they need a separate group-vs-fleet detector (ADR 0015 v2), not this path.

import { detectionOrientedResiduals, DetectionCommonModeOptions } from './detection-common-mode';
import { universalInferenceMeanShiftEValue } from '../detectors/universal-inference-e-value';
import { eBenjaminiHochberg } from './e-bh';
import type { Window } from '../detectors/safe-t-e-value';

export interface LocalizeParams {
  /** `[shard][tick]` counter matrix. */
  X: ReadonlyArray<ReadonlyArray<number>>;
  /** Healthy reference-window length `[0, referenceLen)` for the detection common-mode (per-shard level +
   *  loading fit). Longer ⇒ better loading identification; MUST be fault-free. */
  referenceLen: number;
  /** UI e-value calibration window (the "before"). */
  cal: Window;
  /** UI e-value test/monitoring window (the "after" — where a fault is sought). */
  test: Window;
  /** Crossed factor structure for the common-mode: one entry per factor kind, each an array of length
   *  `n_shards` giving each shard's domain label for that kind (negative = not a member). */
  factorPartitions: ReadonlyArray<ReadonlyArray<number>>;
  /** Per-shard label for the topology-partitioned e-BH (e.g. rack id). e-BH runs within each label group. */
  localizationGroups: ReadonlyArray<number>;
  /** FDR target per group, in (0, 1]. */
  qLevel: number;
  /** Detection common-mode options (iterations, loadLen). `loadLen` defaults to `referenceLen`. */
  commonMode?: DetectionCommonModeOptions;
}

export interface LocalizeResult {
  /** The PRIMARY, trustworthy output: per-shard UI e-value on the detection-common-mode residual. RANK by
   *  this for a triage shortlist (victims are enriched ~7× over healthy). */
  perShardEValue: number[];
  /** The e-BH selected set (union over groups, sorted). CONVENIENCE ONLY — NOT a certified fault list: FDP is
   *  not controlled on the data-dependent residual (measured ~93% at ~1% fault density). Prefer ranking by
   *  `perShardEValue`. */
  selected: number[];
  /** Per group: `groupLabel → selected shard indices in that group` (only groups with ≥1 selection). */
  byGroup: Map<number, number[]>;
}

/** Run the topology-localised fault-detection path (see the file header). Returns the flagged shards (a
 *  ranked localisation, NOT a certified FDR discovery set — see Scope).
 *
 *  @throws RangeError on an empty/ragged matrix, `referenceLen` out of bounds, `qLevel` ∉ (0,1], or
 *    `localizationGroups` length ≠ shard count. `factorPartitions` and the UI windows are validated by the
 *    underlying operators. */
export function localizeFaults(p: LocalizeParams): LocalizeResult {
  const { X, referenceLen, cal, test, factorPartitions, localizationGroups, qLevel, commonMode } = p;
  const n = X.length;
  if (n === 0) throw new RangeError('localizeFaults: X must have at least one shard');
  if (!(qLevel > 0 && qLevel <= 1)) throw new RangeError(`localizeFaults: qLevel must be in (0, 1]; got ${qLevel}`);
  if (localizationGroups.length !== n) {
    throw new RangeError(`localizeFaults: localizationGroups has length ${localizationGroups.length}, expected one label per shard (${n})`);
  }

  // 1. detection-oriented common-mode (loading fit on the healthy reference window).
  const R = detectionOrientedResiduals(X, referenceLen, factorPartitions, commonMode);

  // 2. per-shard UI e-value on each residual row.
  const perShardEValue = R.map((row) => universalInferenceMeanShiftEValue(row, cal, test));

  // 3. topology-PARTITIONED e-BH: run e-BH within each localisation group, map selections back to globals.
  const groups = new Map<number, number[]>();
  for (let i = 0; i < n; i++) {
    const g = localizationGroups[i];
    const cur = groups.get(g);
    if (cur) cur.push(i); else groups.set(g, [i]);
  }
  const selected: number[] = [];
  const byGroup = new Map<number, number[]>();
  for (const [g, idxs] of groups) {
    const sub = idxs.map((i) => perShardEValue[i]);
    const localSel = eBenjaminiHochberg(sub, qLevel).selected; // indices into `idxs`
    if (localSel.length === 0) continue;
    const globals = localSel.map((j) => idxs[j]).sort((a, b) => a - b);
    byGroup.set(g, globals);
    for (const gi of globals) selected.push(gi);
  }
  selected.sort((a, b) => a - b);
  return { selected, perShardEValue, byGroup };
}

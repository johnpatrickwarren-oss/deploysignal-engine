"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.localizeFaults = localizeFaults;
const detection_common_mode_1 = require("./detection-common-mode");
const universal_inference_e_value_1 = require("../detectors/universal-inference-e-value");
const e_bh_1 = require("./e-bh");
/** Run the topology-localised fault-detection path (see the file header). Returns the flagged shards (a
 *  ranked localisation, NOT a certified FDR discovery set — see Scope).
 *
 *  @throws RangeError on an empty/ragged matrix, `referenceLen` out of bounds, `qLevel` ∉ (0,1], or
 *    `localizationGroups` length ≠ shard count. `factorPartitions` and the UI windows are validated by the
 *    underlying operators. */
function localizeFaults(p) {
    const { X, referenceLen, cal, test, factorPartitions, localizationGroups, qLevel, commonMode } = p;
    const n = X.length;
    if (n === 0)
        throw new RangeError('localizeFaults: X must have at least one shard');
    if (!(qLevel > 0 && qLevel <= 1))
        throw new RangeError(`localizeFaults: qLevel must be in (0, 1]; got ${qLevel}`);
    if (localizationGroups.length !== n) {
        throw new RangeError(`localizeFaults: localizationGroups has length ${localizationGroups.length}, expected one label per shard (${n})`);
    }
    // 1. detection-oriented common-mode (loading fit on the healthy reference window).
    const R = (0, detection_common_mode_1.detectionOrientedResiduals)(X, referenceLen, factorPartitions, commonMode);
    // 2. per-shard UI e-value on each residual row.
    const perShardEValue = R.map((row) => (0, universal_inference_e_value_1.universalInferenceMeanShiftEValue)(row, cal, test));
    // 3. topology-PARTITIONED e-BH: run e-BH within each localisation group, map selections back to globals.
    const groups = new Map();
    for (let i = 0; i < n; i++) {
        const g = localizationGroups[i];
        const cur = groups.get(g);
        if (cur)
            cur.push(i);
        else
            groups.set(g, [i]);
    }
    const selected = [];
    const byGroup = new Map();
    for (const [g, idxs] of groups) {
        const sub = idxs.map((i) => perShardEValue[i]);
        const localSel = (0, e_bh_1.eBenjaminiHochberg)(sub, qLevel).selected; // indices into `idxs`
        if (localSel.length === 0)
            continue;
        const globals = localSel.map((j) => idxs[j]).sort((a, b) => a - b);
        byGroup.set(g, globals);
        for (const gi of globals)
            selected.push(gi);
    }
    selected.sort((a, b) => a - b);
    return { selected, perShardEValue, byGroup };
}
//# sourceMappingURL=localize.js.map
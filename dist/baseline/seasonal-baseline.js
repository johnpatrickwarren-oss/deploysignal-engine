"use strict";
// baseline/seasonal-baseline.ts — the L1 baseline kit (ADR 0019): a parameterized, data-agnostic seasonal
// clean-null baseline compiler + residualiser.
//
// WHY THIS EXISTS. The e-values/e-processes are worthless without a valid baseline (ADR 0012/0017/0018): fed a
// baseline that does not remove predictable structure (diurnal/weekly seasonality), the residual looks
// nonstationary, E[e|H0] ≫ 1, and the Ville/e-BH guarantees bind nothing. The weeks-of-data baseline compiler
// that does this lived in the original DeploySignal (`tools/calibrate`) but was not vendored. ADR 0019 puts it
// in the engine as a parameterized kit: PRODUCTS supply data + the context axis; the ENGINE does the stats.
//
// WHAT IT DOES. Bin a series' historical samples by an integer CONTEXT label (e.g. hour-of-day, or
// hour×day-of-week — the product chooses the axis), and per bin compute a ROBUST CLEAN-NULL mean/variance by
// dropping anomalous samples (median/MAD trim — the "drop true anomalies, keep a coherent null" step). Sparse
// bins fall back to a pooled aggregate over all clean samples. Then `seasonalBaselineResidual` subtracts each
// observation's bin mean, leaving a residual whose predictable seasonal structure is gone — the input the
// e-value actually needs.
//
// SCOPE. Univariate per-series (call once per shard×metric). Generic over the context axis (knows nothing about
// hours or GPUs — the product maps time→bin). This is the per-cell Family-A-style baseline; the multivariate
// (Family C covariance/MCD) and adjacency-aware pooling are follow-on ports (ADR 0019 migration). It removes
// PREDICTABLE (calendar) structure; cross-shard common-mode is a separate layer (instrumented-common-mode).
Object.defineProperty(exports, "__esModule", { value: true });
exports.compileSeasonalBaseline = compileSeasonalBaseline;
exports.seasonalBaselineResidual = seasonalBaselineResidual;
const multi_factor_common_mode_1 = require("../fleet/multi-factor-common-mode");
/** Robust clean-null of a sample: drop points beyond `zCut` MAD-σ of the median, then mean/variance of the
 *  survivors (with a relative variance floor). Returns the clean count too. */
function robustCleanNull(xs, zCut, varFloorRel) {
    if (xs.length === 0)
        return { n: 0, mean: 0, variance: 0 };
    const med = (0, multi_factor_common_mode_1.median)(xs);
    const dev = xs.map((x) => Math.abs(x - med));
    const scale = Math.max((0, multi_factor_common_mode_1.median)(dev) * 1.4826, 1e-12);
    const clean = [];
    for (const x of xs)
        if (Math.abs(x - med) / scale <= zCut)
            clean.push(x);
    const use = clean.length > 0 ? clean : xs; // never drop everything
    let mean = 0;
    for (const x of use)
        mean += x;
    mean /= use.length;
    let v = 0;
    for (const x of use)
        v += (x - mean) ** 2;
    v /= use.length;
    const floor = varFloorRel * mean * mean;
    return { n: clean.length, mean, variance: Math.max(v, floor, 1e-12) };
}
/** Compile a per-bin robust clean-null baseline for one series. See the file header.
 *
 *  @param values   the historical samples.
 *  @param context  per-sample integer bin label in `0..nBins-1` (same length as `values`).
 *  @throws RangeError on length mismatch, empty input, non-finite values, bad `nBins`/thresholds, or a context
 *    label out of range. */
function compileSeasonalBaseline(values, context, opts) {
    const fn = 'compileSeasonalBaseline';
    const n = values.length;
    if (n === 0)
        throw new RangeError(`${fn}: values must be non-empty`);
    if (context.length !== n)
        throw new RangeError(`${fn}: context length ${context.length} != values length ${n}`);
    const nBins = opts.nBins;
    if (!Number.isInteger(nBins) || nBins < 1)
        throw new RangeError(`${fn}: nBins must be a positive integer; got ${nBins}`);
    const minStrict = opts.minStrict ?? 60;
    const minPooled = opts.minPooled ?? 20;
    const zCut = opts.zCut ?? 3.0;
    const varFloorRel = opts.varFloorRel ?? 1e-6;
    const poolRadius = opts.poolRadius ?? 0;
    const cyclic = opts.cyclic ?? false;
    if (!Number.isInteger(poolRadius) || poolRadius < 0)
        throw new RangeError(`${fn}: poolRadius must be a non-negative integer; got ${poolRadius}`);
    if (!(zCut > 0))
        throw new RangeError(`${fn}: zCut must be > 0; got ${zCut}`);
    if (!(minPooled >= 1 && minStrict >= minPooled))
        throw new RangeError(`${fn}: require 1 <= minPooled <= minStrict; got minPooled=${minPooled}, minStrict=${minStrict}`);
    const buckets = Array.from({ length: nBins }, () => []);
    for (let i = 0; i < n; i++) {
        if (!Number.isFinite(values[i]))
            throw new RangeError(`${fn}: non-finite value at index ${i}`);
        const c = context[i];
        if (!Number.isInteger(c) || c < 0 || c >= nBins)
            throw new RangeError(`${fn}: context[${i}] = ${c} out of range 0..${nBins - 1}`);
        buckets[c].push(values[i]);
    }
    const agg = robustCleanNull(values, zCut, varFloorRel);
    const aggregate = { ...agg, confidence: 'aggregate' };
    const bins = buckets.map((b, idx) => {
        if (b.length > 0) {
            const c = robustCleanNull(b, zCut, varFloorRel);
            if (c.n >= minStrict)
                return { ...c, confidence: 'strict' };
            if (c.n >= minPooled)
                return { ...c, confidence: 'pooled' };
        }
        // Too few clean samples: try adjacency pooling (borrow from neighbouring bins) before the aggregate.
        if (poolRadius > 0) {
            const pooled = [];
            for (let d = -poolRadius; d <= poolRadius; d++) {
                let bi = idx + d;
                if (cyclic)
                    bi = ((bi % nBins) + nBins) % nBins;
                if (bi < 0 || bi >= nBins)
                    continue;
                for (const x of buckets[bi])
                    pooled.push(x);
            }
            if (pooled.length > 0) {
                const c = robustCleanNull(pooled, zCut, varFloorRel);
                if (c.n >= minPooled)
                    return { ...c, confidence: 'pooled' };
            }
        }
        return { n: aggregate.n, mean: aggregate.mean, variance: aggregate.variance, confidence: 'aggregate' };
    });
    return { bins, aggregate };
}
/** Residualise a series against a compiled baseline: each observation minus its context bin's clean-null mean.
 *  The result has the predictable (calendar/seasonal) structure removed — feed it to a per-shard detector.
 *
 *  @throws RangeError on length mismatch, non-finite values, or a context label out of range for the baseline. */
function seasonalBaselineResidual(values, context, baseline) {
    const fn = 'seasonalBaselineResidual';
    const n = values.length;
    if (context.length !== n)
        throw new RangeError(`${fn}: context length ${context.length} != values length ${n}`);
    const nBins = baseline.bins.length;
    const out = new Array(n);
    for (let i = 0; i < n; i++) {
        if (!Number.isFinite(values[i]))
            throw new RangeError(`${fn}: non-finite value at index ${i}`);
        const c = context[i];
        if (!Number.isInteger(c) || c < 0 || c >= nBins)
            throw new RangeError(`${fn}: context[${i}] = ${c} out of range 0..${nBins - 1}`);
        out[i] = values[i] - baseline.bins[c].mean;
    }
    return out;
}
//# sourceMappingURL=seasonal-baseline.js.map
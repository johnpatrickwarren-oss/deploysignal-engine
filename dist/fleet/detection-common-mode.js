"use strict";
// fleet/detection-common-mode.ts — a DETECTION-oriented common-mode (ADR 0017).
//
// WHY THIS EXISTS. The multi-factor common-mode (ADR 0008, `fleet/multi-factor-common-mode.ts`) is tuned for
// FDP CONTROL: it fits each shard's loading on the FULL series, which ABSORBS a sustained single-shard fault
// into that shard's loading — the fault is collinear with the nonstationary factor's test-window excursion,
// so a robust regression reads it as a steeper loading, not an outlier. That is an acceptable, documented
// power cost on the FDP path, but it is LETHAL for DETECTION / LOCALISATION: the FAIR test (ADR 0016/0017)
// measured 0% single-shard detection through the full-loading common-mode versus 99% through an oracle
// common-mode. The entire gap is common-mode ESTIMATION.
//
// CONSTRUCTION — heterogeneous crossed-domain backfitting. The common-mode is a set of CROSSED factor
// domains: each shard belongs to one cooling domain AND one power domain AND one fabric domain AND one job —
// different partitions of the same fleet. The caller supplies those partitions (from the topology). Then:
//   level-remove each shard (reference-window median), and repeat `iterations` times:
//     for each partition (factor kind):
//       for each domain d:  F_d[t] = robust location over d's members of the CURRENT residual at tick t;
//       for each member i:  λ̂_i = robust slope of i's residual on F_d over the REFERENCE window ONLY,
//                           then subtract λ̂_i·F_d[t] from shard i over ALL t.
// Two choices are load-bearing: (1) fitting the loading on the (healthy) REFERENCE window — not the full
// series — is what avoids absorbing a fault that lands in the test window; (2) CYCLING the crossed partitions
// (backfitting) is what disentangles factors whose domains cross — a single domain's mean is otherwise
// contaminated by its members' differing factors on the other partitions.
//
// MEASURED (ADR 0017, FAIR substrate, single-GPU step, per-rack e-BH): 0% → ~40% detection at ~5% FPR,
// residual φ 0.55 → 0.22 — a 4×+ gain over the FDP-oriented common-mode. Still short of the oracle's 99%:
// single-snapshot crossed-factor estimation is intrinsically limited; closing more needs temporal/stateful
// per-shard loading models (deferred — its own ADR).
//
// SCOPE / HONESTY (do NOT overstate).
//   • This is a POWER (detection/localisation) improvement, NOT an FDR guarantee. The residual is a
//     data-dependent fit, so an e-value computed on it is POST-SELECTION and e-BH FDR control is not
//     automatic. For the guarantee path keep the FDP-oriented `multiFactorRobustResiduals`; use THIS for
//     ranking / localisation.
//   • It does NOT lift the real-telemetry ceiling (ADR 0012). On real data the per-shard within-window
//     nonstationarity is not removable common-mode, so even the oracle is unreachable; this estimator can
//     only approach what a (removable) crossed-factor common-mode allows.
//   • GROUP-LEVEL faults (a whole rack shifting together) are absorbed into the in-sample baseline — the
//     absorption is a property of the baseline being estimated IN-SAMPLE (not of scale). The `leaveOutGroups`
//     option excludes a shard's own group from its factor and DOES prevent the absorption (recovers oracle-
//     level fault preservation), BUT it is NOT a localisation win: under heterogeneous loadings it injects a
//     per-group (Δλ)·F trend bias that degrades rank-vs-fleet ranking (ADR 0017). It is OFF by default; the
//     genuine fix for group localisation is true factor knowledge (oracle / a temporal model), not leave-out.
//
// Tessera-original (ADR 0017). Distinct OBJECT from the FDP-oriented common-mode — ship both.
Object.defineProperty(exports, "__esModule", { value: true });
exports.detectionOrientedResiduals = detectionOrientedResiduals;
const common_mode_1 = require("./common-mode");
const multi_factor_common_mode_1 = require("./multi-factor-common-mode");
/** Validate the matrix + windows + partitions; returns `[n, t]`. */
function validate(X, calLen, partitions, loadLen, iterations, leaveOutGroups) {
    const fn = 'detectionOrientedResiduals';
    const n = X.length;
    if (n === 0)
        throw new RangeError(`${fn}: X must have at least one shard`);
    const t = X[0].length;
    if (t === 0)
        throw new RangeError(`${fn}: shard rows must be non-empty`);
    for (let i = 0; i < n; i++) {
        if (X[i].length !== t)
            throw new RangeError(`${fn}: ragged matrix — row ${i} has length ${X[i].length}, expected ${t}`);
        for (let j = 0; j < t; j++)
            if (!Number.isFinite(X[i][j]))
                throw new RangeError(`${fn}: non-finite value at [${i}][${j}]`);
    }
    if (!Number.isInteger(calLen) || calLen < 1 || calLen > t) {
        throw new RangeError(`${fn}: calLen must be an integer in 1..${t}; got ${calLen}`);
    }
    if (!Number.isInteger(loadLen) || loadLen < 1 || loadLen > t) {
        throw new RangeError(`${fn}: loadLen must be an integer in 1..${t}; got ${loadLen}`);
    }
    if (!Number.isInteger(iterations) || iterations < 1) {
        throw new RangeError(`${fn}: iterations must be a positive integer; got ${iterations}`);
    }
    if (partitions.length === 0)
        throw new RangeError(`${fn}: partitions must have at least one factor partition`);
    for (let k = 0; k < partitions.length; k++) {
        if (partitions[k].length !== n) {
            throw new RangeError(`${fn}: partition ${k} has length ${partitions[k].length}, expected one label per shard (${n})`);
        }
    }
    if (leaveOutGroups !== undefined && leaveOutGroups.length !== n) {
        throw new RangeError(`${fn}: leaveOutGroups has length ${leaveOutGroups.length}, expected one label per shard (${n})`);
    }
    return [n, t];
}
/** Build `domain id → member shard indices` for one partition. A negative label means "not a member of any
 *  domain on this partition" (e.g. an idle GPU with no job factor) and is skipped. */
function domainMembers(part, n) {
    const m = new Map();
    for (let i = 0; i < n; i++) {
        const d = part[i];
        if (d < 0)
            continue;
        const cur = m.get(d);
        if (cur)
            cur.push(i);
        else
            m.set(d, [i]);
    }
    return m;
}
/** Detection-oriented common-mode residuals `R[i][t]`, via heterogeneous crossed-domain backfitting (see the
 *  file header). The common-mode is removed without absorbing single-shard faults, so the residual PRESERVES a
 *  fault in the test window — feed each row to a per-shard detector then a topology-PARTITIONED e-BH for
 *  localisation. This is a POWER tool, NOT an FDR guarantee on its (data-dependent) residual; keep
 *  `multiFactorRobustResiduals` for the guarantee path.
 *
 *  @param X            `[shard][tick]` counter matrix.
 *  @param calLen       healthy reference-window length for the per-shard level (median over `[0, calLen)`).
 *  @param partitions   the crossed factor structure: one entry per factor kind, each an array of length
 *                      `n_shards` giving the domain label of each shard for that kind (negative = not a
 *                      member). E.g. `[coolDomainOf, powerDomainOf, fabricDomainOf, jobDomainOf]`.
 *  @param opts         `iterations` (backfitting sweeps, default 4), `loadLen` (loading-fit reference window,
 *                      default `calLen`), and `leaveOutGroups` (per-shard leave-out label, e.g. rack — when
 *                      set, each domain factor excludes the shard's own group so a coherent GROUP fault is not
 *                      absorbed into the baseline; see the option doc).
 *  @throws RangeError on an empty/ragged/non-finite matrix, `calLen`/`loadLen` out of `1..ticks`,
 *    non-positive `iterations`, no partitions, or a partition/leaveOutGroups whose length ≠ shard count. */
function detectionOrientedResiduals(X, calLen, partitions, opts) {
    const iterations = opts?.iterations ?? 4;
    const loadLen = opts?.loadLen ?? calLen;
    const lo = opts?.leaveOutGroups;
    const [n, t] = validate(X, calLen, partitions, loadLen, iterations, lo);
    // Level-remove each shard against its healthy reference window.
    const R = X.map((row) => {
        const lvl = (0, multi_factor_common_mode_1.median)(row.slice(0, calLen));
        return row.map((v) => v - lvl);
    });
    const partGroups = partitions.map((part) => domainMembers(part, n));
    const F = new Array(t);
    const col = [];
    const refRow = new Array(loadLen);
    const fRef = new Array(loadLen);
    /** Estimate the domain factor from `factorMembers`, then fit each `targetMember`'s loading on the reference
     *  window and deflate it over all ticks. (factorMembers === targetMembers is the in-sample case; for
     *  leave-group-out, factorMembers excludes the target group.) */
    const deflate = (factorMembers, targetMembers) => {
        if (factorMembers.length < 2)
            return; // can't define a shared factor — leave residual as-is
        // Factor F_d[t] = robust location across factorMembers of the CURRENT residual; accumulate its
        // reference-window and full-window energy for the degeneracy guard.
        let refE = 0, fullE = 0;
        for (let j = 0; j < t; j++) {
            col.length = 0;
            for (const i of factorMembers)
                col.push(R[i][j]);
            F[j] = (0, common_mode_1.robustLocation)(col);
            const f2 = F[j] * F[j];
            fullE += f2;
            if (j < loadLen) {
                fRef[j] = F[j];
                refE += f2;
            }
        }
        // Degeneracy guard: after earlier sweeps clean the reference window, a later sweep's factor can be ~0 in
        // the reference while a PRESERVED fault keeps F large in the test window; fitting a loading then divides
        // by ~0 and λ̂ explodes, injecting a finite-but-huge spurious test-window excursion (false fires the
        // validator misses). If the factor's reference energy is a negligible fraction of its full energy it is
        // unidentifiable from the reference ⇒ do not project onto it.
        if (refE <= 1e-12 || refE < 1e-6 * fullE)
            return;
        for (const i of targetMembers) {
            for (let j = 0; j < loadLen; j++)
                refRow[j] = R[i][j];
            const lam = (0, multi_factor_common_mode_1.robustSlope)(fRef, refRow); // loading fit on the REFERENCE window only (fault not absorbed)
            for (let j = 0; j < t; j++)
                R[i][j] -= lam * F[j];
        }
    };
    for (let it = 0; it < iterations; it++) {
        for (const groups of partGroups) {
            for (const idxs of groups.values()) {
                // A domain needs ≥ 2 members to define a SHARED factor (a lone member's "factor" is its own series →
                // self-absorbs its own fault).
                if (idxs.length < 2)
                    continue;
                if (!lo) {
                    deflate(idxs, idxs); // in-sample factor
                    continue;
                }
                // LEAVE-GROUP-OUT: members are deflated against a factor that EXCLUDES their own leave-out group, so a
                // coherent group fault cannot contaminate the baseline it is measured against. Members with no group
                // (label < 0) are a negligible domain fraction and use the all-member factor.
                const byG = new Map();
                for (const i of idxs) {
                    const g = lo[i];
                    const a = byG.get(g);
                    if (a)
                        a.push(i);
                    else
                        byG.set(g, [i]);
                }
                for (const [g, targets] of byG) {
                    if (g < 0) {
                        deflate(idxs, targets);
                        continue;
                    }
                    const factorMembers = idxs.filter((i) => lo[i] !== g);
                    // If excluding the group leaves too few members to estimate the factor, fall back to all members.
                    deflate(factorMembers.length >= 2 ? factorMembers : idxs, targets);
                }
            }
        }
    }
    return R;
}
//# sourceMappingURL=detection-common-mode.js.map
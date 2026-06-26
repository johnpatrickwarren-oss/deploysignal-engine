// baseline/factor-telemetry.ts — the L2→L1 ingestion contract for instrumented common-mode (ADR 0020).
//
// Products resample their raw factor streams onto the analysis grid (their job — L2) and hand the engine a
// FactorTelemetry (dense [factor][tick] aligned to the grid) + per-shard membership by factor id (their
// vocabulary). The engine validates the grid, resolves ids → integer indices, and (optionally) helps align a
// single irregular stream. The resolved signals + membership feed `instrumentedCommonModeResiduals` (ADR 0018).
//
// The engine ingests NO raw source here: alignment/gap policy is product-specific; this module only validates,
// resolves, and offers a common-case aligner. Garbage factor in ⇒ garbage common-mode out (ADR 0018).

export interface FactorTelemetry {
  /** Measured factor signals on the analysis grid: `signals[k][t]`, each of length `ticks`. */
  signals: ReadonlyArray<ReadonlyArray<number>>;
  /** Stable id per factor (e.g. "cdu-0", "power-feed-3"); same order/length as `signals`; the product's
   *  vocabulary, resolved to indices by `resolveFactorMembership`. */
  factorIds: ReadonlyArray<string>;
  /** Grid origin (epoch), step, and length the product resampled to — must match the shard matrix's grid. */
  t0: number;
  dt: number;
  ticks: number;
}

/** Validate a FactorTelemetry against the analysis-grid length the shard matrix uses.
 *  @throws RangeError on a grid/length mismatch, non-finite value, id/signal count mismatch, or duplicate id. */
export function validateFactorTelemetry(ft: FactorTelemetry, ticks: number): void {
  const fn = 'validateFactorTelemetry';
  if (!Number.isInteger(ticks) || ticks < 1) throw new RangeError(`${fn}: ticks must be a positive integer; got ${ticks}`);
  if (ft.ticks !== ticks) throw new RangeError(`${fn}: telemetry ticks ${ft.ticks} != analysis grid ticks ${ticks}`);
  if (!(ft.dt > 0)) throw new RangeError(`${fn}: dt must be > 0; got ${ft.dt}`);
  if (!Number.isFinite(ft.t0)) throw new RangeError(`${fn}: t0 must be finite`);
  if (ft.factorIds.length !== ft.signals.length) {
    throw new RangeError(`${fn}: factorIds length ${ft.factorIds.length} != signals length ${ft.signals.length}`);
  }
  const seen = new Set<string>();
  for (const id of ft.factorIds) {
    if (seen.has(id)) throw new RangeError(`${fn}: duplicate factor id "${id}"`);
    seen.add(id);
  }
  for (let k = 0; k < ft.signals.length; k++) {
    if (ft.signals[k].length !== ticks) throw new RangeError(`${fn}: factor "${ft.factorIds[k]}" has length ${ft.signals[k].length}, expected ${ticks}`);
    for (let t = 0; t < ticks; t++) if (!Number.isFinite(ft.signals[k][t])) throw new RangeError(`${fn}: non-finite value for factor "${ft.factorIds[k]}" at tick ${t}`);
  }
}

/** Map per-shard membership expressed as factor IDS (product vocabulary) to the integer index arrays that
 *  `instrumentedCommonModeResiduals` consumes (indices into `factorIds`). A shard may list zero factors.
 *  @throws RangeError if a membership entry references an unknown factor id. */
export function resolveFactorMembership(
  factorIds: ReadonlyArray<string>,
  membershipByFactorId: ReadonlyArray<ReadonlyArray<string>>,
): number[][] {
  const index = new Map<string, number>();
  factorIds.forEach((id, i) => index.set(id, i));
  return membershipByFactorId.map((ids, shard) =>
    ids.map((id) => {
      const k = index.get(id);
      if (k === undefined) throw new RangeError(`resolveFactorMembership: shard ${shard} references unknown factor id "${id}"`);
      return k;
    }),
  );
}

export interface AlignOptions {
  /** Resampling rule. 'hold' = previous-sample-hold (default); 'linear' = linear interpolation between
   *  bracketing samples. */
  method?: 'hold' | 'linear';
  /** Max time gap (same units as timestamps) to fill; grid points farther than this from a usable sample get
   *  NaN (the product decides how to handle gaps). Default Infinity (always fill). */
  maxGap?: number;
}

/** Convenience aligner for the COMMON case: resample one irregular `(t, v)` stream onto the grid
 *  `t0 + i·dt`, i in `[0, ticks)`. Products with bespoke resampling skip this. Samples need not be sorted.
 *  Grid points with no usable sample within `maxGap` are left `NaN` (so `validateFactorTelemetry` will reject
 *  them unless the product fills them) — the engine never fabricates a value past the declared gap.
 *  @throws RangeError on bad grid params or a non-finite sample. */
export function alignToGrid(
  samples: ReadonlyArray<{ t: number; v: number }>,
  t0: number,
  dt: number,
  ticks: number,
  opts?: AlignOptions,
): number[] {
  const fn = 'alignToGrid';
  if (!(dt > 0)) throw new RangeError(`${fn}: dt must be > 0; got ${dt}`);
  if (!Number.isInteger(ticks) || ticks < 1) throw new RangeError(`${fn}: ticks must be a positive integer; got ${ticks}`);
  const method = opts?.method ?? 'hold';
  const maxGap = opts?.maxGap ?? Infinity;
  const s = [...samples].sort((a, b) => a.t - b.t);
  for (const x of s) if (!Number.isFinite(x.t) || !Number.isFinite(x.v)) throw new RangeError(`${fn}: non-finite sample`);
  const out = new Array<number>(ticks);
  let j = 0; // index of the last sample at or before the current grid time
  for (let i = 0; i < ticks; i++) {
    const gt = t0 + i * dt;
    while (j + 1 < s.length && s[j + 1].t <= gt) j++;
    const prev = (j < s.length && s[j].t <= gt) ? s[j] : null;
    const next = (() => { let k = prev ? j + 1 : 0; while (k < s.length && s[k].t < gt) k++; return k < s.length ? s[k] : null; })();
    if (method === 'linear' && prev && next && next.t > prev.t) {
      if (gt - prev.t > maxGap && next.t - gt > maxGap) { out[i] = NaN; continue; }
      const w = (gt - prev.t) / (next.t - prev.t);
      out[i] = prev.v + w * (next.v - prev.v);
    } else {
      // previous-hold (or linear with only one neighbour): use the nearer usable sample within maxGap
      const cand = prev ?? next;
      out[i] = cand && Math.abs(cand.t - gt) <= maxGap ? cand.v : NaN;
    }
  }
  return out;
}

// VENDORED FROM DeploySignal main@5a72371 — 2026-05-16
// Source: deploysignal/engine/per-detector-resampler-mode.ts
// Sync policy: vendored-at-pin
// Extract target: @johnpatrickwarren-oss/deploysignal-engine (Tessera Phase 2 close commitment)
// DO NOT modify internals without ADR; deltas only at architecturally-anchored extension points (see SCOPING-MEMO-v0.3 § 9).

// engine/_per-detector-resampler-counts.ts — single-pass per-detector
// firing-count attribution + Family C hotelling-variant resolution.
// Extracted from the former monolithic per-detector-resampler-mode.ts;
// the >100-line `extractPerDetectorCounts` was decomposed into
// contiguous <100-line helpers (inflateFromCategory + the family-D
// event-count loop) with identical behavior.

import type {
  DetectorFamily,
  ResamplerMode,
  PerDetectorPoolFiringId,
  FprSweepResultLike,
  CompiledConfigVariantHints,
} from './_per-detector-resampler-types';

/** Resolve Family C hotelling variant from compiled config. Drives
 *  per-detector pool attribution for `family_C` events: when variant
 *  is 'safe_test' all family_C events flow to the safe_test pool;
 *  when 'chi_square' all flow to the chi_square pool. Defaults to
 *  'chi_square' for legacy substrates without the field. */
export function resolveHotellingVariant(cfg: CompiledConfigVariantHints): 'safe_test' | 'chi_square' {
  return cfg?.baseline_cells?.aggregate_fallback?.family_C?.hotelling_variant ?? 'chi_square';
}

/** Synthesize firing-ID stubs from per-cell breakdown for a given
 *  source category. Each cell-key with N firings produces N entries
 *  with cell_key populated; tick/statistic/threshold are null (per
 *  anti-scope: not surfacing inner detector statistic without touching
 *  engine/detectors/*).
 *
 *  Extracted verbatim from the former `inflateFromCategory` closure
 *  inside `extractPerDetectorCounts`; the closure's captured
 *  dependencies (perCellByCategory, family, mode) are now explicit
 *  parameters. */
function inflateFromCategory(
  perCellByCategory: Record<string, Record<string, number>>,
  family: DetectorFamily,
  mode: ResamplerMode,
  sourceCategory: string,
): PerDetectorPoolFiringId[] {
  // Remediation 2026-06-10 L2: the former optional `signalFilter` parameter
  // was dead — when supplied, the only push was guarded by `if
  // (!signalFilter)` so nothing was ever emitted. No call site supplied it;
  // removed (behavior-identical). Per-cell breakdown doesn't capture
  // per-event signal, so any signal filtering must happen at event level
  // via firing_events_by_detector_id.
  const out: PerDetectorPoolFiringId[] = [];
  const perCell = perCellByCategory[sourceCategory] ?? {};
  for (const [cellKeyStr, n] of Object.entries(perCell)) {
    // Cell keys are 'hour-dayOfWeek'; hour-only keys (no '-') occur in
    // hour-granularity breakdowns. Guard the parse (remediation 2026-06-10
    // L2): a missing/garbled component previously produced NaN; -1 is the
    // documented "component unknown" sentinel for these best-effort stubs.
    const [hStr, dStr] = cellKeyStr.split('-');
    const h = parseInt(hStr, 10);
    const d = parseInt(dStr, 10);
    const cellKey = {
      hour_of_day: Number.isFinite(h) ? h : -1,
      day_of_week: Number.isFinite(d) ? d : -1,
    };
    for (let i = 0; i < n; i++) {
      out.push({
        cell_key: cellKey,
        tick: null,
        signal: undefined,
        statistic_value: null,
        threshold: null,
        verdict: 'fire',
        detector_family: family,
        methodology_source: mode,
      });
    }
  }
  return out;
}

/** Count family_D spectral events at the event level. spectral pool
 *  covers all signals EXCEPT kv_cache (which has its own pool). Count
 *  derived from event-level detector_id splits. Extracted verbatim
 *  from the `family_D_spectral` switch arm. */
function countFamilyDSpectralEvents(events: Record<string, number>): number {
  let total = 0;
  for (const [id, n] of Object.entries(events)) {
    if (!id.startsWith('family_D_')) continue;
    if (id === 'family_D_kv_cache') continue;
    total += n;
  }
  return total;
}

/** Per-detector firing-count attribution from a single FPR-sweep
 *  pass. Returns `{ count, ids }` where `count` is the per-window
 *  count from `firing_attribution_by_category` (a window contributes
 *  1 per category-firing) and `ids` is a derived list of stub
 *  per-detector firing-IDs.
 *
 *  Disambiguation rules per amended spec § detector family table:
 *  - `family_C_safe_test` ← `family_C` events when `hotelling_variant === 'safe_test'`
 *  - `family_C_chi_square` ← `family_C` events when `hotelling_variant === 'chi_square'`
 *  - `family_D_spectral` ← `family_D` events EXCLUDING kv_cache signal
 *  - `family_D_kv_cache` ← `family_D` events WHERE signal === 'kv_cache'
 *  - `mmd_betting` ← `family_C_mmd` events when `mmd_variant === 'betting_e_process'`
 *  - `mmd_bootstrap_null` ← `family_C_mmd` events when `mmd_variant === 'bootstrap_null'`
 *  - `family_B_pattern_match` ← `family_b` events
 *
 *  detector_id-to-category mapping mirrors `runFprSweep` categorizeId
 *  (build-report-card.js line ~847). */
export function extractPerDetectorCounts(
  source: FprSweepResultLike,
  family: DetectorFamily,
  cfg: CompiledConfigVariantHints,
  mode: ResamplerMode,
): { count: number; ids: PerDetectorPoolFiringId[] } {
  const counts = source.firing_attribution_by_category.counts;
  const events = source.firing_events_by_detector_id;
  const perCellByCategory = source.firing_attribution_by_category.per_cell_breakdown ?? {};

  let count = 0;
  const ids: PerDetectorPoolFiringId[] = [];
  const inflate = (sourceCategory: string) =>
    inflateFromCategory(perCellByCategory, family, mode, sourceCategory);

  switch (family) {
    case 'family_A_betting': {
      count = counts.family_A_betting ?? 0;
      ids.push(...inflate('family_A_betting'));
      break;
    }
    case 'family_A_page_cusum': {
      // 'family_A_page_cusum' covers the explicit-named ID; 'family_A_other'
      // covers legacy `family_A_<signal>` IDs (per categorizeId line
      // ~849-850). Both are Page-CUSUM classical-epoch.
      count = (counts.family_A_page_cusum ?? 0) + (counts.family_A_other ?? 0);
      ids.push(...inflate('family_A_page_cusum'));
      ids.push(...inflate('family_A_other'));
      break;
    }
    case 'family_C_safe_test': {
      const variant = resolveHotellingVariant(cfg);
      count = variant === 'safe_test' ? (counts.family_C ?? 0) : 0;
      if (variant === 'safe_test') ids.push(...inflate('family_C'));
      break;
    }
    case 'family_C_chi_square': {
      const variant = resolveHotellingVariant(cfg);
      count = variant === 'chi_square' ? (counts.family_C ?? 0) : 0;
      if (variant === 'chi_square') ids.push(...inflate('family_C'));
      break;
    }
    case 'family_D_spectral': {
      // family_D events split by signal: family_D_<sig> per detector
      // attribution. spectral pool covers all signals EXCEPT kv_cache
      // (which has its own pool below). Count derived from event-level
      // detector_id splits.
      count = countFamilyDSpectralEvents(events);
      // ids inflated from category-level (no per-signal cell breakdown
      // available); family-level cell_key is the available granularity.
      // KNOWN UNIT MISMATCH (documented per remediation 2026-06-10 L2):
      // `count` excludes kv_cache events but the per-cell breakdown covers
      // the whole family_D category (kv_cache included), so `ids.length`
      // can exceed `count`. Splitting the stubs would require per-signal
      // cell data the sweep result does not carry; consumers must treat
      // `count` as authoritative and `ids` as best-effort stubs.
      ids.push(...inflate('family_D'));
      break;
    }
    case 'family_D_kv_cache': {
      count = events['family_D_kv_cache'] ?? 0;
      // ids: best-effort empty; family_D per-cell breakdown doesn't
      // distinguish kv_cache vs other signals.
      break;
    }
    case 'family_E_conformal': {
      count = counts.family_E ?? 0;
      ids.push(...inflate('family_E'));
      break;
    }
    case 'mmd_betting': {
      // Q68 Phase-3.d.C consolidation — `mmd_variant` flag retired;
      // all family_C_mmd events now flow to mmd_betting pool unconditionally.
      count = counts.family_C_mmd ?? 0;
      ids.push(...inflate('family_C_mmd'));
      break;
    }
    case 'mmd_bootstrap_null': {
      // Q68 Phase-3.d.C consolidation — classical bootstrap-null detector
      // retired (engine/detectors/sequential-mmd.ts evaluateSequentialMMD
      // removed). Pool preserved with always-zero count for schema
      // backward-compat. Q69 Phase-3.d.D close: CAVEAT_EXEMPT_FAMILIES
      // set retired per Q69.1; mmd_bootstrap_null entry no longer needed
      // for CAVEAT-test exemption (CAVEAT clause RETIRED-SPEC-SIDE).
      count = 0;
      break;
    }
    case 'family_B_pattern_match': {
      count = counts.family_b ?? 0;
      ids.push(...inflate('family_b'));
      break;
    }
  }

  return { count, ids };
}

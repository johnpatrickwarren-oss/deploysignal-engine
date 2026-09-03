import { applyGuards, internalConsistency, meanRule, arlRule } from './guards.mjs';
import { COVERAGE_FLOOR, FAULT_CLASSES, INERTNESS_FLOOR, INERTNESS_SHIFT_SIGMA, TIERS, assertVerdict,
  E_DETECTOR_Z, E_DETECTOR_CENSOR_MAX, E_DETECTOR_CANONICAL_SHIFT_SIGMA, effectiveShift, eDetectorDelayBound } from './constants.mjs';
import { effectivePhi, phiIsEstimated } from './nulls.mjs';
import { isWired } from './envelope.mjs';

// Finding 4: crossing_rate is an e_process instrument (see CLASS_INSTRUMENTS), so S2
// candidacy has to include it -- otherwise crossing_rate-only cells (no stopped_mean, no
// exceedance, no increment_estimator) never reach the scorer at all.
// C1: `mean_e` joins the list for the same reason -- it is a terminal_e_value instrument
// (CLASS_INSTRUMENTS), so a mean-bearing cell is a validity candidate on its own.
// v1.C69: `arl0_T` is e_detector's S2 instrument (CLASS_INSTRUMENTS), same reason as the two above.
const isValidityCell = (c) =>
  'increment_estimator' in c || 'stopped_mean' in c || 'exceedance' in c || 'crossing_rate' in c || 'mean_e' in c || 'arl0_T' in c;
// Fix round 2: rate_e_ge_20 is a vocabulary gap, not an evidence gap. The terminal-evalue
// CONTROL_power cells (safe_t, universal_inference) are live power evidence at the
// registered shift, recorded as an e>=20 detection rate under a different field name.
const isPowerCell = (c) => 'detection_rate' in c || 'rate_e_ge_20' in c;
const powerRate = (c) => (c.detection_rate ?? c.rate_e_ge_20);

// Finding 1: mapped is an explicit vocabulary, not identity. 'not-refuted' is the
// corpus's dominant clearance token (h0-battery, terminal-evalue, ...); reading
// cell.verdict straight through silently discarded it and no card could ever PASS.
// Any token outside this table is not a known clearance/refutation result -- it is
// missing evidence, and must be named, never dropped.
//
// FIX 2 (live power study, 2026-08-07 report §5.2): 'FAIL' is every h0-battery-family
// harness's own refutation token (terminal-evalue/harness/run.mjs:115: `verdict: lo > alpha
// ? 'FAIL' : 'not-refuted'`; the same pattern recurs in h0-battery, family-ce-nulls and
// family-c-pool). Before this fix it was absent from the map, so a harness's own recorded
// refutation (safe_t at phi=0.99, exceedance 0.1420 > alpha) scored as missing evidence
// instead of REFUTED -- fail-open in regime, had the cell been in regime.
const VERDICT_MAP = { CLEARED: 'CLEARED', 'not-refuted': 'CLEARED', REFUTED: 'REFUTED', FAIL: 'REFUTED' };

// Round 3 finding 1: for test_martingale-class cells, when the top-level verdict field is
// absent, supermartingale_verdict carries the same information under a different name
// (sequential_mmd's 136 matched cells: no verdict, supermartingale_verdict: 'REFUTED' on
// every one). Only test_martingale, because supermartingale_verdict is that class's own
// instrument's verdict field -- reading it for another class would be exactly the foreign-
// verdict mistake finding 2 fixes in the other direction.
const rawClassVerdict = (cell, cls) => {
  if (cell.verdict !== undefined) return cell.verdict;
  if (cls === 'test_martingale' && cell.supermartingale_verdict !== undefined) return cell.supermartingale_verdict;
  return undefined;
};

// C2 -- the regime check, fail-closed on phi.
//
// Three outcomes, not two. `refused` marks a cell the card's regime cannot speak about at
// all because its phi is unmeasured: the pre-fix rule read `cell.phi == null` as "in
// regime", which admitted every phi-less cell into every claimed phi bound for free
// (1,600+ of the corpus's cells carry no phi field). Refusing instead matches the engine's
// own gate -- `detectors/validity-envelope.ts`'s `assertValidForFdrPath` refuses a detector
// whose phi it cannot check rather than assuming it is fine -- and it is recorded, never
// silently dropped. Derivation runs first (lib/nulls.mjs), so a cell whose null_id encodes
// its phi is scored, not refused.
//
// `phi_known` is the machine form of a guarantee sentence that quantifies over KNOWN phi
// (safe-t: "given known phi <= 0.95"). Cells whose phi came out of a finite calibration
// window sit outside such a regime -- they BOUND it rather than failing it, which is the
// protocol's "cells outside the claimed regime bound the regime" clause and exactly how
// safe-t stays usable at oracle phi while being wrong at estimated phi.
function regimeCheck(cell, regime) {
  // v1.C69 (C69.5): an optional list of null-id prefixes the card claims. A cell whose null is
  // outside the list bounds the regime and does not fail it. Absent, nothing changes. 'N1'
  // matches 'N1' and 'N1-…', never 'N10'.
  if (Array.isArray(regime.null_prefixes) && regime.null_prefixes.length > 0) {
    const id = typeof cell.null_id === 'string' ? cell.null_id : '';
    if (!regime.null_prefixes.some((p) => id === p || id.startsWith(`${p}-`))) {
      return { in: false, refused: false, reason: `null ${cell.null_id ?? '(none)'} outside the claimed null classes [${regime.null_prefixes.join(', ')}]` };
    }
  }
  const phi = effectivePhi(cell);
  if (regime.phi_max != null && phi == null) {
    return { in: false, refused: true, reason: 'phi unmeasured, refused (fail-closed)' };
  }
  if (regime.phi_known === true && phiIsEstimated(cell)) {
    return { in: false, refused: false, reason: `outside the known-phi regime: estimated phi (${cell.null_id ?? 'no null_id'})` };
  }
  if (phi != null && regime.phi_max != null && phi > regime.phi_max) {
    return { in: false, refused: false, reason: `phi ${phi} > regime phi_max ${regime.phi_max}` };
  }
  if (cell.m != null && regime.m_min != null && cell.m < regime.m_min) {
    return { in: false, refused: false, reason: `m ${cell.m} < regime m_min ${regime.m_min}` };
  }
  return { in: true, refused: false, reason: null };
}

const inRegime = (cell, regime) => regimeCheck(cell, regime).in;

const minTier = (tiers) => {
  const present = tiers.filter((t) => t != null);
  if (present.length === 0) return null;
  return present.reduce((best, t) => (TIERS.indexOf(t) < TIERS.indexOf(best) ? t : best), present[0]);
};

// Round 3 finding 4: no silent suppression. Every excluded[]/missing[] entry names the
// verdict token it suppressed, when one exists (a foreign-instrument-ignored verdict does
// not count here -- that has its own explicit foreign_verdict_ignored annotation instead).
const withSuppression = (entry, token) => {
  if (token === undefined) return entry;
  return { ...entry, suppressed_verdict: token, reason: `${entry.reason}; suppressed verdict: ${token}` };
};

const tallySuppressed = (entries) => {
  const tally = {};
  for (const e of entries) {
    if (e.suppressed_verdict !== undefined) tally[e.suppressed_verdict] = (tally[e.suppressed_verdict] ?? 0) + 1;
  }
  return tally;
};

// Task 7 brief's "S1 note" specified this function but no task-7 commit ever
// added it (checked lib/score.mjs and every test through 08ae73a: no
// `scoreS1` anywhere). v1's honest floor: reachability has no machine-readable
// runs yet for any card, so S1 is a declared/missing check against
// prior_evidence, not a scored cell -- DECLARED when the card cites a stage
// S1 entry (and points at a wiki page), MISSING otherwise. Upgrading S1 to
// run-backed is a MISSING-CELLS item, not this function's job.
// I1: match any stage token CONTAINING 'S1', not just the bare string. family_E's card
// cites its reachability evidence under stage 'S1+S2' (one study covering both), and an
// equality test read that as no S1 evidence at all.
export function scoreS1(card) {
  return { status: (card.prior_evidence ?? []).some((e) => typeof e.stage === 'string' && e.stage.includes('S1')) ? 'DECLARED' : 'MISSING' };
}

export function scoreS2(card, cells) {
  const regime = card.guarantee.regime;
  const perCell = [];
  const excluded = [];
  const missing = [];

  const meanRuleOverrides = [];

  const candidates = cells.filter(isValidityCell);
  const guarded = candidates.map((cell) => ({ cell, guard: applyGuards(cell, card.class), rawVerdict: rawClassVerdict(cell, card.class) }));

  // Finding 4 (round 2): VOID no longer poisons the whole stage. Track which runs produced
  // a genuine instrument-class mismatch and exclude every cell from that run -- a run's own
  // defect doesn't erase evidence a different, healthy run produced.
  const mismatchVoidedRuns = new Set(guarded.filter((g) => g.guard.status === 'VOID').map((g) => g.cell.__run));

  // Finding 3 (round 3): internalConsistency is class-scoped (test_martingale only -- see
  // guards.mjs) and wired here through the same per-run voiding mechanism as instrument
  // mismatch: a flagged cell voids every cell sharing its __run, not just itself.
  const consistencyFlags = internalConsistency(candidates, card.class);
  const consistencyVoidedRuns = new Set(consistencyFlags.map((f) => f.__run));
  const consistencyReasonsByRun = new Map();
  for (const f of consistencyFlags) {
    if (!consistencyReasonsByRun.has(f.__run)) consistencyReasonsByRun.set(f.__run, []);
    consistencyReasonsByRun.get(f.__run).push(f.reason);
  }

  const voidedRuns = new Set([...mismatchVoidedRuns, ...consistencyVoidedRuns]);

  for (const { cell, guard, rawVerdict } of guarded) {
    if (voidedRuns.has(cell.__run)) {
      const reasons = [];
      if (mismatchVoidedRuns.has(cell.__run)) reasons.push('run voided: instrument-class mismatch');
      if (consistencyVoidedRuns.has(cell.__run)) reasons.push(...consistencyReasonsByRun.get(cell.__run));
      excluded.push(withSuppression(
        { detector: cell.detector, null_id: cell.null_id, __run: cell.__run, reason: reasons.join('; ') },
        rawVerdict,
      ));
      continue;
    }
    if (guard.status === 'NON_FINITE') {
      excluded.push(withSuppression({ detector: cell.detector, null_id: cell.null_id, reason: guard.reason }, rawVerdict));
      continue;
    }
    // Promoted minor 6: vacuous cells are evidence gaps, not per-cell verdicts. They
    // belong in missing[], and a stage can still PASS on its other cleared cells.
    if (guard.status === 'VACUOUS') {
      missing.push(withSuppression({ detector: cell.detector, null_id: cell.null_id, reason: 'vacuous: wealth never moved' }, rawVerdict));
      continue;
    }
    const regimeStatus = regimeCheck(cell, regime);
    // C2 fail-closed: an unmeasured phi is refused, not admitted. Recorded with whatever
    // verdict token it was carrying, so the refusal is visible in the suppressed tally.
    if (regimeStatus.refused) {
      missing.push(withSuppression(
        { detector: cell.detector, null_id: cell.null_id, reason: regimeStatus.reason },
        rawVerdict,
      ));
      continue;
    }
    const out_of_regime = !regimeStatus.in;

    // Finding 2 (round 3): a foreign-instrument verdict (increment_verdict, tied to
    // increment_estimator -- test_martingale's instrument, not this cell's class's) is
    // discarded ON PURPOSE, not folded into "unmapped verdict token". The sui 170319Z run
    // shape: no class verdict field at all, only increment_verdict from the wrong instrument.
    if (rawVerdict === undefined && card.class !== 'test_martingale' && cell.increment_verdict !== undefined) {
      missing.push({
        detector: cell.detector,
        null_id: cell.null_id,
        reason: `no class-instrument verdict recorded (foreign increment_verdict=${cell.increment_verdict} ignored)`,
        foreign_verdict_ignored: `increment_verdict=${cell.increment_verdict} (invalid instrument for class)`,
      });
      continue;
    }

    // v1.C69: e_detector cells are scored by the arl rule on their own fields, not by the
    // recorded token (which internalConsistency has already checked agrees). INCONCLUSIVE is
    // missing evidence, named, never a verdict.
    if (card.class === 'e_detector') {
      const arl = arlRule(cell);
      if (arl.mapped === 'INCONCLUSIVE') {
        missing.push(withSuppression({ detector: cell.detector, null_id: cell.null_id, reason: arl.reason }, rawVerdict));
        continue;
      }
      perCell.push({ ...cell, mapped: arl.mapped, out_of_regime, out_of_regime_reason: regimeStatus.reason, arl_rule_reason: arl.reason });
      continue;
    }

    const mapped = VERDICT_MAP[rawVerdict];
    if (!mapped) {
      missing.push({ detector: cell.detector, null_id: cell.null_id, reason: `unmapped verdict token ${rawVerdict}`, suppressed_verdict: rawVerdict });
      continue;
    }

    // C1 -- the mean rule. Applies only where the recorded token CLEARED the cell: the
    // mean above 1 overrides a clearance, and a cell already REFUTED needs no help.
    const mean = mapped === 'CLEARED' ? meanRule(cell, card.class) : null;
    if (mean) {
      meanRuleOverrides.push({ detector: cell.detector, null_id: cell.null_id, suppressed_verdict: rawVerdict, reason: mean.reason });
      perCell.push({
        ...cell, mapped: 'REFUTED', out_of_regime,
        out_of_regime_reason: regimeStatus.reason,
        mean_rule_applied: true, mean_rule_reason: mean.reason, overridden_verdict: rawVerdict,
      });
      continue;
    }
    perCell.push({ ...cell, mapped, out_of_regime, out_of_regime_reason: regimeStatus.reason });
  }

  // The overridden exceedance token is a discarded verdict like any other, so it joins the
  // suppressed tally -- the mean rule threw away a recorded 'not-refuted'.
  const suppressed_verdicts = tallySuppressed([...excluded, ...missing, ...meanRuleOverrides]);

  // Stage VOID only if every in-regime candidate came from a voided run (finding 4, round 2).
  const candidateInRegime = candidates.filter((c) => inRegime(c, regime));
  const voidedInRegime = candidateInRegime.filter((c) => voidedRuns.has(c.__run));
  if (candidateInRegime.length > 0 && voidedInRegime.length === candidateInRegime.length) {
    return { status: 'VOID', perCell, excluded, missing, mean_rule_overrides: meanRuleOverrides, suppressed_verdicts };
  }

  const inRegimeMapped = perCell.filter((c) => !c.out_of_regime && (c.mapped === 'CLEARED' || c.mapped === 'REFUTED'));

  let status;
  if (inRegimeMapped.some((c) => c.mapped === 'REFUTED')) {
    status = 'REFUTED';
  } else if (inRegimeMapped.length === 0) {
    status = 'MISSING';
  } else {
    status = 'PASS';
  }

  return { status, perCell, excluded, missing, mean_rule_overrides: meanRuleOverrides, suppressed_verdicts };
}

export function scoreS3(card, cells) {
  const regime = card.guarantee.regime;
  const perCell = [];
  const excluded = [];
  const missing = [];

  const candidates = cells.filter(isPowerCell);

  // Minor 5(a) (round 3): shift/regime scoping runs before guards, so excluded[]/missing[]
  // only ever name cells that were actually in scope for this stage -- an out-of-shift or
  // out-of-regime cell was never a candidate to begin with, guard or no guard.
  //
  // Round 4 minor: out-of-scope cells are now NAMED rather than dropped on a bare
  // `continue`. Aggregated per (detector, shift) with a count: the corpus holds 144
  // detector-audit-power cells at the other registered effect size (delta* = 0.75 sigma),
  // and 48 identical lines per card would bury the report. delta* = 0.75 sigma is
  // registered evidence, not a gap -- it is simply not the shift the inertness floor is
  // defined at (INERTNESS_SHIFT_SIGMA), which is what the line says.
  const offShift = new Map();
  const unmeasuredPhi = new Map();
  const bump = (map, key, entry) => {
    const cur = map.get(key);
    if (cur) cur.count += 1; else map.set(key, { ...entry, count: 1 });
  };

  const isCanonicalDelayCell = (c) => card.class === 'e_detector' && 'delay_canonical' in c && c.shift_sigma === E_DETECTOR_CANONICAL_SHIFT_SIGMA;

  for (const cell of candidates) {
    if (cell.shift_sigma !== INERTNESS_SHIFT_SIGMA) {
      // v1.C69: an e_detector canonical delay cell is scored by the delay pass below, so it is
      // not an off-shift gap.
      if (!isCanonicalDelayCell(cell)) {
        bump(offShift, `${cell.detector}\0${cell.shift_sigma}`, { detector: cell.detector, shift_sigma: cell.shift_sigma ?? null });
      }
      continue;
    }
    // C2 note: S3 does NOT fail closed on an unmeasured phi. A pooled power control
    // (terminal-evalue's CONTROL_power cells) has no null_id and no phi by construction --
    // it averages over the whole battery -- and refusing it would delete the only power
    // evidence both terminal detectors have, turning a power reading into a validity
    // question. Power is not a validity guarantee, so the unmeasured phi is recorded as a
    // gap and the cell is still scored. The per-null pairing this leaves open is the
    // separate `pairingGaps` finding.
    if (regime.phi_max != null && effectivePhi(cell) == null) {
      bump(unmeasuredPhi, String(cell.detector), { detector: cell.detector, null_id: cell.null_id ?? null });
    } else if (!inRegime(cell, regime)) {
      continue;
    }

    const rawVerdict = cell.verdict;
    // Finding 2 (round 3, S3 leg): S3 had no guards at all. Runs whose wealth process is
    // non-finite are non-executable, not inert -- they must not drag detection_rate: 0 into
    // the floor determination (family_A_mixture_supermartingale's non-finite N5 runs did
    // exactly this). Minor 5(c): VOID/VACUOUS candidates are named and excluded too, never
    // silently scored.
    const guard = applyGuards(cell, card.class);
    if (guard.status === 'VOID') {
      excluded.push(withSuppression({ detector: cell.detector, null_id: cell.null_id, reason: guard.reason }, rawVerdict));
      continue;
    }
    if (guard.status === 'VACUOUS') {
      missing.push(withSuppression({ detector: cell.detector, null_id: cell.null_id, reason: 'vacuous: wealth never moved' }, rawVerdict));
      continue;
    }
    if (guard.status === 'NON_FINITE') {
      excluded.push(withSuppression({ detector: cell.detector, null_id: cell.null_id, reason: guard.reason }, rawVerdict));
      continue;
    }

    const rate = powerRate(cell);
    if (!Number.isFinite(rate)) {
      missing.push(withSuppression({ detector: cell.detector, null_id: cell.null_id, reason: 'non-finite detection_rate' }, rawVerdict));
      continue;
    }
    // Minor 5(b): a present-but-null/non-finite detection_rate must not survive onto
    // perCell as-is -- a literal null reads as < INERTNESS_FLOOR and would misreport as
    // inert. Only a genuinely finite detection_rate is kept unchanged; everything else
    // (including rate_e_ge_20-only cells) is annotated with the resolved rate.
    perCell.push(Number.isFinite(cell.detection_rate) ? cell : { ...cell, detection_rate: rate });
  }

  for (const e of offShift.values()) {
    // Two different gaps, and they must not be described in the same words. A cell at
    // delta* = 0.75 sigma is registered evidence at the other house effect size. A cell
    // with NO shift_sigma recorded (the family-ce-nulls power cells) is a cell whose effect
    // size is unknown, which is a defect in the run, not evidence at another shift.
    missing.push({
      detector: e.detector,
      null_id: null,
      reason: e.shift_sigma == null
        ? `power cell with no shift_sigma recorded x${e.count}: its effect size is unknown, so it cannot be `
          + `placed at the inertness-floor shift (${INERTNESS_SHIFT_SIGMA}) — not scored for INERT`
        : `power cell at shift_sigma=${e.shift_sigma} x${e.count}: registered effect size, but not the `
          + `inertness-floor shift (${INERTNESS_SHIFT_SIGMA}) — not scored for INERT`,
    });
  }
  for (const e of unmeasuredPhi.values()) {
    missing.push({
      detector: e.detector,
      null_id: e.null_id,
      reason: `phi unmeasured on a power cell x${e.count}: scored anyway (power is not a validity claim); `
        + 'the per-null pairing gap is recorded separately',
    });
  }

  // v1.C69 (C69.3 b): the delay floor. Every in-regime e_detector cell at the class canonical
  // severity must have delay_canonical + Z*se <= D*(alpha_arl, delta_eff), D* the Theorem 4.3 +
  // Prop. B.2 bound at the effective whitened shift. Censored cells are gaps, not verdicts.
  const delayCells = [];
  const slow = [];
  if (card.class === 'e_detector') {
    for (const cell of cells) {
      if (!isCanonicalDelayCell(cell)) continue;
      const regimeStatus = regimeCheck(cell, regime);
      if (regimeStatus.refused) {
        missing.push(withSuppression({ detector: cell.detector, null_id: cell.null_id, reason: regimeStatus.reason }, cell.verdict));
        continue;
      }
      if (!regimeStatus.in) continue;
      const guard = applyGuards(cell, card.class);
      if (guard.status !== 'OK') {
        excluded.push(withSuppression({ detector: cell.detector, null_id: cell.null_id, reason: guard.reason }, cell.verdict));
        continue;
      }
      if (!(Number.isFinite(cell.censored) && cell.censored <= E_DETECTOR_CENSOR_MAX)) {
        missing.push(withSuppression({ detector: cell.detector, null_id: cell.null_id,
          reason: `delay cell censored fraction ${cell.censored} > ${E_DETECTOR_CENSOR_MAX} (or unrecorded): the censored mean understates the delay, not scoreable` }, cell.verdict));
        continue;
      }
      const phi = effectivePhi(cell);
      const upper = Number.isFinite(cell.delay_upper95) ? cell.delay_upper95 : cell.delay_canonical + E_DETECTOR_Z * cell.delay_se;
      if (phi == null || ![cell.alpha_arl, cell.shift_sigma, upper].every(Number.isFinite)) {
        missing.push(withSuppression({ detector: cell.detector, null_id: cell.null_id, reason: 'delay cell lacks a finite phi, alpha_arl, shift_sigma or delay bound input' }, cell.verdict));
        continue;
      }
      const delta_eff = effectiveShift(cell.shift_sigma, phi);
      const { bound } = eDetectorDelayBound(cell.alpha_arl, delta_eff);
      const entry = { ...cell, delay_upper95: upper, delta_eff, delay_bound: bound, slow: upper > bound };
      delayCells.push(entry);
      if (entry.slow) slow.push(entry);
    }
  }

  const suppressed_verdicts = tallySuppressed([...excluded, ...missing]);

  let status;
  if (perCell.length === 0 || (card.class === 'e_detector' && delayCells.length === 0)) {
    status = 'MISSING';
  } else if (perCell.some((c) => c.detection_rate < INERTNESS_FLOOR)) {
    status = 'INERT';
  } else if (slow.length > 0) {
    status = 'SLOW';
  } else {
    status = 'PASS';
  }

  return { status, perCell, excluded, missing, suppressed_verdicts, delayCells, slow };
}

// coverageFor -- fault-class coverage, a grouping layer over the same power evidence S3
// scores, not a replacement for it. Cells opt into a fault class via `fault_class`; cells
// without it (the pre-existing 3sigma shift power cells) are invisible here by
// construction (filtered on `fault_class === classId`) and S3's own scoring of them is
// untouched. Same guard/suppression house pattern as S3: excluded cells are named with
// their reason and suppressed verdict token, never silently dropped, and never counted
// either way toward a class's status.
export function coverageFor(card, cells) {
  const coverage = {};
  for (const classId of Object.keys(FAULT_CLASSES)) {
    const classCells = cells.filter((c) => c.fault_class === classId);
    const excluded = [];
    const survivors = [];

    for (const cell of classCells) {
      const guard = applyGuards(cell, card.class);
      const rawVerdict = cell.verdict;
      if (guard.status === 'VOID' || guard.status === 'NON_FINITE') {
        excluded.push(withSuppression({ detector: cell.detector, null_id: cell.null_id ?? null, reason: guard.reason }, rawVerdict));
        continue;
      }
      if (guard.status === 'VACUOUS') {
        excluded.push(withSuppression({ detector: cell.detector, null_id: cell.null_id ?? null, reason: 'vacuous: wealth never moved' }, rawVerdict));
        continue;
      }
      // Mirrors scoreS3's post-guard finite-rate check (score.mjs, isPowerCell/powerRate
      // path): a cell can pass every guard and still carry no usable power reading (neither
      // detection_rate nor rate_e_ge_20 finite). Without this check such a cell survived
      // into canonicalCells with powerRate() === undefined, which is not >= COVERAGE_FLOOR,
      // so `covering` came back undefined and the class silently read NOT_POWERED instead
      // of the true NO_EVIDENCE -- a guard-passing but reading-less cell must be excluded
      // and named, not treated as a powered-but-failing measurement.
      if (!Number.isFinite(powerRate(cell))) {
        excluded.push(withSuppression({ detector: cell.detector, null_id: cell.null_id ?? null, reason: 'no finite power rate recorded' }, rawVerdict));
        continue;
      }
      survivors.push(cell);
    }

    const suppressed_verdicts = tallySuppressed(excluded);

    if (survivors.length === 0) {
      coverage[classId] = { status: 'NO_EVIDENCE', cells: survivors, canonical: null, excluded, suppressed_verdicts };
      continue;
    }

    const canonicalCells = survivors.filter((c) => c.canonical === true);
    const covering = canonicalCells.find((c) => powerRate(c) >= COVERAGE_FLOOR);
    const canonicalCell = covering ?? canonicalCells[0] ?? null;
    const canonical = canonicalCell ? { severity: canonicalCell.severity, rate: powerRate(canonicalCell) } : null;

    coverage[classId] = { status: covering ? 'COVERED' : 'NOT_POWERED', cells: survivors, canonical, excluded, suppressed_verdicts };
  }
  return coverage;
}

// I3 -- the two free-text shipped-path checks, anchored.
//
// A p-value shipped path, not a mention of the words. `\bp-value\b` with a negation guard:
// "terminal e-value, not a p-value" describes an e-value path and must not be refused.
const P_VALUE_PATH = /(?:^|[^a-z-])p-values?\b/i;
const NEGATED_P_VALUE = /\b(?:not|never|no longer|rather than|instead of)\s+(?:a\s+)?p-value/i;
// A bootstrap-SUBSTITUTED threshold, not a mention of bootstraps. family_D's kind ends
// "analytical 1/alpha threshold (no bootstrap substitution)" -- a positive-claim pattern
// plus a negation guard is what keeps it out of UNPRICED.
const BOOTSTRAP_SUBSTITUTION = /bootstrap[\s-]+(?:threshold[\s-]+)?substitut/i;
const NEGATED_BOOTSTRAP = /\bno\s+bootstrap/i;
// S4.2: the resolution the delivering machinery claims, as a number in scientific
// notation ("bootstrap resolves 2e-3 at N=500"). The first such number is the resolution;
// plain integers in the same sentence (N=500) are not resolutions.
const RESOLUTION = /(\d+(?:\.\d+)?[eE]-\d+)/;

export function scoreS4(card, opts = {}) {
  const kind = card.shipped_path.kind ?? '';
  const budget = card.budget ?? {};
  const reasons = [];
  let status = 'PASS';

  // v1.C69 (C69.4): an e_detector must NOT enter the FDR path. PASS iff its budget is advisory
  // and its id is absent from DETECTOR_ENVELOPES; either the other way is a REFUSE. The v1
  // "no envelope wiring" gap is not recorded here, because for this class absence is the rule.
  if (card.class === 'e_detector') {
    if (budget.participating !== false) {
      reasons.push('e_detector budget must be advisory (participating: false): an ARL guarantee is not an e-value and cannot draw from the e-BH budget (v1.C69 S4)');
      status = 'REFUSE';
    }
    if (Array.isArray(opts.envelopeKeys) && isWired(card.detector_id, card.aliases, opts.envelopeKeys)) {
      reasons.push('e_detector id is wired into DETECTOR_ENVELOPES: the FDR gate must refuse it (ADR 0029), so wiring is a defect (v1.C69 S4)');
      status = 'REFUSE';
    }
    if (!Array.isArray(opts.envelopeKeys)) reasons.push('envelope map not supplied: absence of wiring unverified');
    return { status, reasons };
  }

  // S4.4 wiring: recorded, never blocking in v1. P1 (the gate has no production caller)
  // means no card's USE is enforced today anyway, so an unwired envelope is a gap to name,
  // not grounds to refuse a detector whose maths is sound.
  if (Array.isArray(opts.envelopeKeys) && !isWired(card.detector_id, card.aliases, opts.envelopeKeys)) {
    reasons.push('no envelope wiring');
  }

  // S4.2 alpha resolvability. Only a positive booked alpha can be finer than anything.
  const booked = typeof budget.alpha_booked === 'number' && budget.alpha_booked > 0 ? budget.alpha_booked : null;
  if (booked !== null) {
    const claim = RESOLUTION.exec(budget.resolution_claim ?? '');
    const resolvable = claim ? Number(claim[1]) : null;
    if (resolvable !== null && booked < resolvable) {
      reasons.push(`alpha booked ${booked} is finer than the claimed resolution ${resolvable} of the machinery that delivers it (S4.2)`);
      status = 'REFUSE';
    } else if (resolvable === null && budget.participating) {
      reasons.push('alpha resolution unverifiable');
    }
  }

  if (P_VALUE_PATH.test(kind) && !NEGATED_P_VALUE.test(kind) && budget.participating) {
    reasons.push('shipped path is a p-value combination and the budget is participating: unanswered combination question is a refusal, not a pass (C25)');
    return { status: 'REFUSE', reasons };
  }
  if (status === 'REFUSE') return { status, reasons };

  if (BOOTSTRAP_SUBSTITUTION.test(kind) && !NEGATED_BOOTSTRAP.test(kind)) {
    // Finding 3: a prior_evidence[stage=S4] entry with runs: null is a *declared* c-bound
    // question, not a *measured* c-bound artifact. Only runs != null clears the gate.
    const hasCBound = (card.prior_evidence ?? []).some((e) => e.stage === 'S4' && e.runs != null);
    if (!hasCBound) {
      reasons.push('shipped path substitutes a bootstrap threshold and no measured c-bound artifact (prior_evidence[stage=S4] with runs != null) is cited');
      return { status: 'UNPRICED', reasons };
    }
  }

  return { status, reasons };
}

// I2 -- the pairing check. Protocol S3: "Every S2 validity cell inside the claimed regime
// gets a paired power arm at the registered effect sizes." An in-regime CLEARED validity
// cell with no power cell at the same null is an unmeasured cell, and a pooled power
// control cannot stand in for it: the sequential-UI failure was a detector that was valid
// everywhere and inert everywhere, and a pooled rate averaged over the battery is exactly
// the shape that hides it. This does NOT fail the stage in v1 -- pooled CONTROL evidence
// still passes S3 -- the gap is recorded so the missing arms can be run.
export function pairingGaps(s2, s3) {
  const powered = new Set((s3.perCell ?? []).map((c) => `${c.detector}::${c.null_id ?? ''}`));
  const gaps = new Map();
  for (const c of s2.perCell ?? []) {
    if (c.out_of_regime || c.mapped !== 'CLEARED') continue;
    const key = `${c.detector}::${c.null_id ?? ''}`;
    if (powered.has(key) || gaps.has(key)) continue;
    gaps.set(key, {
      detector: c.detector,
      null_id: c.null_id ?? null,
      line: `unpaired: ${c.detector} ${c.null_id ?? '(no null_id)'} validity cell has no power arm`,
    });
  }
  return [...gaps.values()];
}

// I8 -- excluded cells that carried no verdict token at all. `suppressed_verdicts` covers
// what was thrown away WITH a verdict; this covers the rest, so a reader of
// MISSING-CELLS.md can see the whole excluded population and not just its noisy half.
export function untokenedExclusions(stage) {
  const groups = new Map();
  for (const e of stage.excluded ?? []) {
    if (e.suppressed_verdict !== undefined) continue;
    const key = `${e.detector}::${e.reason}`;
    const cur = groups.get(key);
    if (cur) cur.count += 1; else groups.set(key, { detector: e.detector, reason: e.reason, count: 1 });
  }
  return [...groups.values()].map((g) => `excluded without token: ${g.detector} x${g.count} (${g.reason})`);
}

export function overallVerdict(card, s1, s2, s3, s4) {
  const cardRegime = card.guarantee.regime;
  const reasons = [];

  // I1 -- S1 is recorded on every card and blocks nothing. v1's S1 is a declaration check
  // against prior_evidence, not a run: no machine-readable reachability run exists for any
  // card. Making that floor block USE would refuse the whole portfolio on a missing
  // artifact rather than on evidence, so the floor is named in reasons[] instead. Upgrading
  // S1 to run-backed is a MISSING-CELLS item.
  if (s1?.status !== 'DECLARED') reasons.push('S1 reachability not run-backed (v1 floor)');

  // R3 -- regime narrowing is structural, not prose. Every cell the regime excluded is
  // listed on the emitted regime object, so a reader of the card JSON can see what the
  // published regime does NOT cover without parsing reasons[] strings. The card's own
  // regime is copied, never mutated.
  const excluded_cells = [
    ...s2.perCell.filter((c) => c.out_of_regime).map((c) => ({
      stage: 'S2', detector: c.detector, null_id: c.null_id ?? null, mapped: c.mapped,
      reason: c.out_of_regime_reason ?? 'outside the claimed regime',
    })),
  ];
  const regime = { ...cardRegime, excluded_cells };
  const done = (verdict, tier) => {
    assertVerdict(verdict);
    return { verdict, tier, regime, reasons };
  };

  if (s2.status === 'VOID') {
    reasons.push('S2 is VOID');
    return done('NOT_EXECUTABLE', null);
  }

  if (s2.status === 'REFUTED') {
    reasons.push('S2 in-regime refutation');
    return done('REFUSE', null);
  }

  if (s2.status === 'MISSING' || s3.status === 'MISSING') {
    reasons.push('S2 or S3 has no scoreable evidence');
    return done('NOT_EXECUTABLE', null);
  }

  if (s2.status !== 'PASS') throw new Error(`unknown S2 status "${s2.status}"`);

  const s2Supporting = s2.perCell.filter((c) => !c.out_of_regime && c.mapped === 'CLEARED');

  // Promoted minor 5: some-inert shrinks the regime, not the verdict. USE holds as long
  // as at least one claimed S3 cell is powered; ADVISORY only when every claimed cell is
  // inert. Inert cells are named in reasons[] as excluded from the USE regime.
  const s3Inert = s3.perCell.filter((c) => c.detection_rate < INERTNESS_FLOOR);
  const s3Powered = s3.perCell.filter((c) => c.detection_rate >= INERTNESS_FLOOR);

  for (const c of s3Inert) {
    excluded_cells.push({
      stage: 'S3', detector: c.detector, null_id: c.null_id ?? null, mapped: 'INERT',
      reason: `inert: detection_rate ${c.detection_rate} < floor ${INERTNESS_FLOOR} at shift ${INERTNESS_SHIFT_SIGMA} sigma`,
    });
  }

  if (s3Powered.length === 0) {
    reasons.push('S3 inert across all claimed cells: valid-but-inert fails USE');
    // Promoted minor 7: tier still reflects supporting S2 evidence, not null.
    return done('ADVISORY', minTier(s2Supporting.map((c) => c.__tier)));
  }

  for (const c of s3Inert) {
    reasons.push(`${c.detector} ${c.null_id ?? '(no null_id)'} inert (detection_rate=${c.detection_rate}): excluded from the USE regime`);
  }

  const tier = minTier([...s2Supporting.map((c) => c.__tier), ...s3Powered.map((c) => c.__tier)]);

  // v1.C69 (C69.3): SLOW is the delay-floor analogue of valid-but-inert -- valid, powered, but
  // not as fast as its registered bound -- and lands in the same slot, ADVISORY, with the cells
  // named on the regime object.
  if (s3.status === 'SLOW') {
    for (const c of s3.slow ?? []) {
      excluded_cells.push({
        stage: 'S3', detector: c.detector, null_id: c.null_id ?? null, mapped: 'SLOW',
        reason: `slow: delay_upper95 ${c.delay_upper95} > registered bound ${c.delay_bound} at delta_eff ${c.delta_eff}`,
      });
      reasons.push(`${c.detector} ${c.null_id ?? '(no null_id)'} slow (delay_upper95=${c.delay_upper95} > D*=${c.delay_bound}): canonical delay above its registered bound`);
    }
    reasons.push('S3 SLOW: valid but slower than the registered delay bound fails USE');
    return done('ADVISORY', tier);
  }

  if (s4.status === 'REFUSE') {
    reasons.push(...s4.reasons, 'budget participation refused');
    return done('ADVISORY', tier);
  }

  if (s4.status === 'UNPRICED') {
    reasons.push(...s4.reasons, 'USE capped at ADVISORY until the c-bound is measured');
    return done('ADVISORY', tier);
  }

  reasons.push(...s4.reasons);
  return done('USE', tier);
}

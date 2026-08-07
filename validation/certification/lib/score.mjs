import { applyGuards, internalConsistency } from './guards.mjs';
import { INERTNESS_FLOOR, INERTNESS_SHIFT_SIGMA, TIERS } from './constants.mjs';

// Finding 4: crossing_rate is an e_process instrument (see CLASS_INSTRUMENTS), so S2
// candidacy has to include it -- otherwise crossing_rate-only cells (no stopped_mean, no
// exceedance, no increment_estimator) never reach the scorer at all.
const isValidityCell = (c) =>
  'increment_estimator' in c || 'stopped_mean' in c || 'exceedance' in c || 'crossing_rate' in c;
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
const VERDICT_MAP = { CLEARED: 'CLEARED', 'not-refuted': 'CLEARED', REFUTED: 'REFUTED' };

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

const inRegime = (cell, regime) =>
  (cell.phi == null || regime.phi_max == null || cell.phi <= regime.phi_max) &&
  (cell.m == null || regime.m_min == null || cell.m >= regime.m_min);

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

export function scoreS2(card, cells) {
  const regime = card.guarantee.regime;
  const perCell = [];
  const excluded = [];
  const missing = [];

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
    const out_of_regime = !inRegime(cell, regime);

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

    const mapped = VERDICT_MAP[rawVerdict];
    if (!mapped) {
      missing.push({ detector: cell.detector, null_id: cell.null_id, reason: `unmapped verdict token ${rawVerdict}`, suppressed_verdict: rawVerdict });
      continue;
    }
    perCell.push({ ...cell, mapped, out_of_regime });
  }

  const suppressed_verdicts = tallySuppressed([...excluded, ...missing]);

  // Stage VOID only if every in-regime candidate came from a voided run (finding 4, round 2).
  const candidateInRegime = candidates.filter((c) => inRegime(c, regime));
  const voidedInRegime = candidateInRegime.filter((c) => voidedRuns.has(c.__run));
  if (candidateInRegime.length > 0 && voidedInRegime.length === candidateInRegime.length) {
    return { status: 'VOID', perCell, excluded, missing, suppressed_verdicts };
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

  return { status, perCell, excluded, missing, suppressed_verdicts };
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
  for (const cell of candidates) {
    if (cell.shift_sigma !== INERTNESS_SHIFT_SIGMA) continue;
    if (!inRegime(cell, regime)) continue;

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

  const suppressed_verdicts = tallySuppressed([...excluded, ...missing]);

  let status;
  if (perCell.length === 0) {
    status = 'MISSING';
  } else if (perCell.some((c) => c.detection_rate < INERTNESS_FLOOR)) {
    status = 'INERT';
  } else {
    status = 'PASS';
  }

  return { status, perCell, excluded, missing, suppressed_verdicts };
}

export function scoreS4(card) {
  const kind = card.shipped_path.kind ?? '';
  const reasons = [];

  if (kind.includes('p-value') && card.budget.participating) {
    reasons.push('shipped path is a p-value combination and the budget is participating: unanswered combination question is a refusal, not a pass (C25)');
    return { status: 'REFUSE', reasons };
  }

  if (kind.includes('bootstrap threshold substitution')) {
    // Finding 3: a prior_evidence[stage=S4] entry with runs: null is a *declared* c-bound
    // question, not a *measured* c-bound artifact. Only runs != null clears the gate.
    const hasCBound = (card.prior_evidence ?? []).some((e) => e.stage === 'S4' && e.runs != null);
    if (!hasCBound) {
      reasons.push('shipped path substitutes a bootstrap threshold and no measured c-bound artifact (prior_evidence[stage=S4] with runs != null) is cited');
      return { status: 'UNPRICED', reasons };
    }
  }

  return { status: 'PASS', reasons };
}

export function overallVerdict(card, s2, s3, s4) {
  const regime = card.guarantee.regime;
  const reasons = [];

  if (s2.status === 'VOID') {
    reasons.push('S2 is VOID');
    return { verdict: 'NOT_EXECUTABLE', tier: null, regime, reasons };
  }

  if (s2.status === 'REFUTED') {
    reasons.push('S2 in-regime refutation');
    return { verdict: 'REFUSE', tier: null, regime, reasons };
  }

  if (s2.status === 'MISSING' || s3.status === 'MISSING') {
    reasons.push('S2 or S3 has no scoreable evidence');
    return { verdict: 'NOT_EXECUTABLE', tier: null, regime, reasons };
  }

  const s2Supporting = s2.perCell.filter((c) => !c.out_of_regime && c.mapped === 'CLEARED');

  // Promoted minor 5: some-inert shrinks the regime, not the verdict. USE holds as long
  // as at least one claimed S3 cell is powered; ADVISORY only when every claimed cell is
  // inert. Inert cells are named in reasons[] as excluded from the USE regime.
  const s3Inert = s3.perCell.filter((c) => c.detection_rate < INERTNESS_FLOOR);
  const s3Powered = s3.perCell.filter((c) => c.detection_rate >= INERTNESS_FLOOR);

  if (s3Powered.length === 0) {
    reasons.push('S3 inert across all claimed cells: valid-but-inert fails USE');
    // Promoted minor 7: tier still reflects supporting S2 evidence, not null.
    const tier = minTier(s2Supporting.map((c) => c.__tier));
    return { verdict: 'ADVISORY', tier, regime, reasons };
  }

  for (const c of s3Inert) {
    reasons.push(`${c.detector} ${c.null_id ?? '(no null_id)'} inert (detection_rate=${c.detection_rate}): excluded from the USE regime`);
  }

  const tier = minTier([...s2Supporting.map((c) => c.__tier), ...s3Powered.map((c) => c.__tier)]);

  if (s4.status === 'REFUSE') {
    reasons.push(...s4.reasons, 'budget participation refused');
    return { verdict: 'ADVISORY', tier, regime, reasons };
  }

  if (s4.status === 'UNPRICED') {
    reasons.push(...s4.reasons, 'USE capped at ADVISORY until the c-bound is measured');
    return { verdict: 'ADVISORY', tier, regime, reasons };
  }

  return { verdict: 'USE', tier, regime, reasons };
}

import { CLASS_INSTRUMENTS, TERMINAL_MEAN_BOUND, E_DETECTOR_Z } from './constants.mjs';

// Union of every instrument field the protocol recognizes, across all classes.
const ALL_INSTRUMENTS = Object.values(CLASS_INSTRUMENTS).flat();

// Finding 4: instrument-class mismatch VOIDs a cell only when the class's own instrument
// is ABSENT and a foreign instrument (one belonging to a different class) is present.
// A foreign instrument present ALONGSIDE the class's own instrument is annotation, not a
// veto -- e.g. a sequential_ui_e_process (e_process) cell that carries increment_estimator
// (test_martingale's instrument) next to its own crossing_rate scores by crossing_rate.
export function applyGuards(cell, cls) {
  if (cell.non_finite_wealth > 0) return { status: 'NON_FINITE', reason: `non_finite_wealth=${cell.non_finite_wealth}` };

  const own = CLASS_INSTRUMENTS[cls] ?? [];
  const ownPresent = own.filter((f) => f in cell);
  const foreignPresent = ALL_INSTRUMENTS.filter((f) => !own.includes(f) && f in cell);

  if (ownPresent.length === 0 && foreignPresent.length > 0) {
    return { status: 'VOID', reason: `class ${cls} instrument (${own.join('|')}) absent; foreign instrument present: ${foreignPresent.join(', ')}` };
  }

  // increment_estimator's own data-quality guards (finiteness, vacuousness) only apply
  // when it is this class's own instrument -- a foreign increment_estimator present as
  // annotation next to a healthy class instrument doesn't get vetoed on its data quality.
  if (cls === 'test_martingale' && cell.increment_estimator) {
    const inc = cell.increment_estimator;
    if (![inc.mean, inc.sd, inc.lower95_one_sided].every(Number.isFinite))
      return { status: 'NON_FINITE', reason: 'non-finite increment estimator' };
    if (inc.sd === 0) return { status: 'VACUOUS', reason: 'zero-width interval: the wealth process never moved' };
  }

  if (foreignPresent.length > 0) {
    return { status: 'OK', reason: `foreign fields present alongside the class instrument (annotation, not veto): ${foreignPresent.join(', ')}` };
  }

  return { status: 'OK', reason: null };
}

// C1 -- THE MEAN RULE. Protocol S2, guards, fourth bullet: "for terminal classes the mean
// carries evidence only above 1 (stats/terminal-mean-is-not-measurable); exceedance alone
// never clears a cell whose mean exceeds its registered bound." S0's class table names the
// terminal instrument as "exceedance AND mean above 1, scored jointly", so a cell cleared on
// exceedance with a mean over the bound has failed half its own instrument.
//
// ASYMMETRIC BY CONSTRUCTION. [[stats/terminal-mean-is-not-measurable]]: a sample mean
// BELOW 1 proves nothing (a mean-1 martingale reads 0.03 at N=4000), while a reading ABOVE
// 1 "is strong evidence of violation, and understates it" because the bias runs downward.
// So this rule only ever refutes; it never clears, and it never rescues a REFUTED cell.
//
// WHICH FIELD IS THE BOUND TESTED ON. safe-t's frozen card falsifier asks for a "one-sided
// 95% lower bound of mean(e) > 1". The terminal-evalue harness records `lower_95` as the
// one-sided binomial lower bound on the EXCEEDANCE, compared against alpha
// (harness/run.mjs:115), not on the mean; the mean's own interval, when recorded, lives in
// `mean_e_lower_95` (POWER-PER-CELL-ADDENDUM-2026-08-07.md change (a)). So:
//   - a recorded `mean_e_lower_95` above the bound is the card's own falsifier, literally,
//     and fires on its own;
//   - the point estimate `mean_e` above the bound is the protocol's own wording ("whose
//     mean exceeds its registered bound") and is sound in this direction only because of
//     the downward bias above.
// Testing `lower_95 > 1` literally would compare an exceedance rate against a mean bound
// and could never fire (safe-t's worst cell: lower_95 0.013 beside mean_e 9,710).
//
// FIX 1 (live power study, 2026-08-07 report §5.1). STRONGEST SIGNAL, NOT PRECEDENCE.
// The rule used to prefer a recorded bound over the point estimate outright, so a recorded
// bound at the 0 clamp -- which [[stats/terminal-mean-is-not-measurable]] says is
// UNINFORMATIVE, not exculpatory, because s/sqrt(n) grows faster than a heavy-tailed mean --
// silently cleared a cell the point estimate refuted. The live run recorded exactly that
// collision: safe_t N4-p09's 2026-08-02 cells (no bound, mean_e 9,710) scored REFUTED; its
// 2026-08-07 cells (identical mean_e, bound clamped to 0.0000) scored CLEARED. Both signals
// are now tested independently and either can refute; neither, and nothing on this path,
// ever clears.
export function meanRule(cell, cls) {
  if (cls !== 'terminal_e_value') return null;
  const recorded = cell.mean_e_lower_95;
  const recordedFinite = Number.isFinite(recorded);
  if (recordedFinite && recorded > TERMINAL_MEAN_BOUND) {
    return { reason: `mean rule: exceedance verdict overridden (one-sided 95% lower bound on mean(e) ${recorded} > ${TERMINAL_MEAN_BOUND})` };
  }
  if (Number.isFinite(cell.mean_e) && cell.mean_e > TERMINAL_MEAN_BOUND) {
    const boundNote = recordedFinite
      ? `recorded lower bound ${recorded} <= ${TERMINAL_MEAN_BOUND} is uninformative, not exculpatory (stats/terminal-mean-is-not-measurable) — point estimate governs`
      : `no interval on the mean is recorded — lower_95 ${cell.lower_95} bounds the exceedance, not the mean`;
    return {
      reason: `mean rule: exceedance verdict overridden (mean_e ${cell.mean_e} > registered bound ${TERMINAL_MEAN_BOUND}; ${boundNote})`,
    };
  }
  return null;
}

// Round 3 finding 3: increment_estimator's mean/crossing_rate contradiction is only a
// genuine internal impossibility when increment_estimator is the CLASS's own scoring
// instrument (test_martingale). On e_process cells (the sui shape: increment_estimator
// present alongside crossing_rate as a foreign, descriptive-only annotation) a huge mean
// recorded beside crossing_rate: 0 is expected, not impossible -- it was never scored.
// Amendment v1.C69 -- THE ARL RULE, the e_detector class's S2 instrument scored from its fields.
// Three outcomes, registered before any run (e-detector-cert PREREGISTRATION §2): CLEARED when
// the one-sided lower bound clears 1/alpha_arl, REFUTED when the upper bound is below it,
// INCONCLUSIVE (missing evidence, never a verdict) between. The T-censored arl0_T is a lower
// bound on E_inf[N*], so censoring can only make clearance harder.
export function arlRule(cell) {
  const arl = cell.arl0_T, se = cell.arl0_se, a = cell.alpha_arl;
  if (![arl, se, a].every(Number.isFinite) || !(a > 0 && a < 1) || se < 0) {
    return { mapped: 'INCONCLUSIVE', reason: `arl rule: arl0_T=${arl}, arl0_se=${se}, alpha_arl=${a} not all finite and admissible` };
  }
  const floor = 1 / a, lo = arl - E_DETECTOR_Z * se, hi = arl + E_DETECTOR_Z * se;
  if (lo >= floor) return { mapped: 'CLEARED', reason: `arl rule: arl0_T ${arl} - ${E_DETECTOR_Z}*se ${se} = ${lo} >= 1/alpha_arl ${floor}` };
  if (hi < floor) return { mapped: 'REFUTED', reason: `arl rule: arl0_T ${arl} + ${E_DETECTOR_Z}*se ${se} = ${hi} < 1/alpha_arl ${floor}` };
  return { mapped: 'INCONCLUSIVE', reason: `arl rule: [${lo}, ${hi}] straddles 1/alpha_arl ${floor}; needs more N` };
}

// The harness token an e_detector S2 cell records, mapped onto the arl rule's vocabulary so a
// disagreement between what the harness wrote and what its own fields say can be detected.
const E_DETECTOR_TOKEN = { 'not-refuted': 'CLEARED', CLEARED: 'CLEARED', FAIL: 'REFUTED', REFUTED: 'REFUTED', INCONCLUSIVE: 'INCONCLUSIVE' };

export function internalConsistency(cells, cls) {
  const flags = [];
  // v1.C69: for e_detector the recorded token must agree with the arl rule recomputed from the
  // cell's own fields -- the arm-3 lesson (a harness whose token and numbers disagree) applied to
  // this class. A flagged cell voids its run, like the test_martingale check below.
  if (cls === 'e_detector') {
    for (const c of cells) {
      if (!('arl0_T' in c) || c.verdict === undefined) continue;
      const recorded = E_DETECTOR_TOKEN[c.verdict];
      const rule = arlRule(c).mapped;
      if (recorded !== rule) {
        flags.push({ detector: c.detector, null_id: c.null_id, __run: c.__run,
          reason: `${c.detector} ${c.null_id}: recorded token ${c.verdict} (${recorded ?? 'unmapped'}) disagrees with the arl rule on its own fields (${rule})` });
      }
    }
    return flags;
  }
  if (cls !== 'test_martingale') return flags;
  for (const c of cells) {
    const inc = c.increment_estimator;
    if (inc && Number.isFinite(inc.mean) && inc.mean > 1e6 && c.crossing_rate === 0) {
      flags.push({
        detector: c.detector,
        null_id: c.null_id,
        __run: c.__run,
        reason: `${c.detector} ${c.null_id}: increment mean ${inc.mean} with crossing_rate 0 is internally impossible`,
      });
    }
  }
  return flags;
}

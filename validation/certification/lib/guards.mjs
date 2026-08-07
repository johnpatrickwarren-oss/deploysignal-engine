import { CLASS_INSTRUMENTS, TERMINAL_MEAN_BOUND } from './constants.mjs';

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
// 95% lower bound of mean(e) > 1". No run in the corpus records such a bound: the
// terminal-evalue harness records `lower_95` as the one-sided binomial lower bound on the
// EXCEEDANCE, compared against alpha (harness/run.mjs:94), and the mean's own interval is a
// registered-but-unrecorded secondary (PREREGISTRATION section 4, T2). So:
//   - if a run ever records `mean_e_lower_95`, that is the card's falsifier and it wins;
//   - otherwise the point estimate `mean_e` is tested against the bound, which is the
//     protocol's own wording ("whose mean exceeds its registered bound") and is sound in
//     this direction only because of the downward bias above.
// Testing `lower_95 > 1` literally would compare an exceedance rate against a mean bound
// and could never fire (safe-t's worst cell: lower_95 0.013 beside mean_e 9,710).
export function meanRule(cell, cls) {
  if (cls !== 'terminal_e_value') return null;
  const recorded = cell.mean_e_lower_95;
  if (Number.isFinite(recorded)) {
    return recorded > TERMINAL_MEAN_BOUND
      ? { reason: `mean rule: exceedance verdict overridden (one-sided 95% lower bound on mean(e) ${recorded} > ${TERMINAL_MEAN_BOUND})` }
      : null;
  }
  if (Number.isFinite(cell.mean_e) && cell.mean_e > TERMINAL_MEAN_BOUND) {
    return {
      reason: `mean rule: exceedance verdict overridden (mean_e ${cell.mean_e} > registered bound ${TERMINAL_MEAN_BOUND}; `
        + `no interval on the mean is recorded — lower_95 ${cell.lower_95} bounds the exceedance, not the mean)`,
    };
  }
  return null;
}

// Round 3 finding 3: increment_estimator's mean/crossing_rate contradiction is only a
// genuine internal impossibility when increment_estimator is the CLASS's own scoring
// instrument (test_martingale). On e_process cells (the sui shape: increment_estimator
// present alongside crossing_rate as a foreign, descriptive-only annotation) a huge mean
// recorded beside crossing_rate: 0 is expected, not impossible -- it was never scored.
export function internalConsistency(cells, cls) {
  const flags = [];
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

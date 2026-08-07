import { CLASS_INSTRUMENTS } from './constants.mjs';

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

export function internalConsistency(cells) {
  const flags = [];
  for (const c of cells) {
    const inc = c.increment_estimator;
    if (inc && Number.isFinite(inc.mean) && inc.mean > 1e6 && c.crossing_rate === 0)
      flags.push(`${c.detector} ${c.null_id}: increment mean ${inc.mean} with crossing_rate 0 is internally impossible`);
  }
  return flags;
}

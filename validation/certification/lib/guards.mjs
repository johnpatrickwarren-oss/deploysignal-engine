const isValidityCell = (c) => 'increment_estimator' in c || 'stopped_mean' in c || 'exceedance' in c;

export function applyGuards(cell, cls) {
  if (cell.non_finite_wealth > 0) return { status: 'NON_FINITE', reason: `non_finite_wealth=${cell.non_finite_wealth}` };
  const inc = cell.increment_estimator;
  if (inc) {
    if (cls === 'e_process' || cls === 'terminal_e_value')
      return { status: 'VOID', reason: `increment estimator is not a valid instrument for class ${cls}` };
    if (![inc.mean, inc.sd, inc.lower95_one_sided].every(Number.isFinite))
      return { status: 'NON_FINITE', reason: 'non-finite increment estimator' };
    if (inc.sd === 0) return { status: 'VACUOUS', reason: 'zero-width interval: the wealth process never moved' };
  }
  if (cls === 'terminal_e_value' && 'stopped_mean' in cell)
    return { status: 'VOID', reason: 'e-process instrument on a terminal_e_value cell' };
  if (cls === 'e_process' && 'exceedance' in cell && !('stopped_mean' in cell))
    return { status: 'VOID', reason: 'terminal instrument on an e_process cell' };
  if (isValidityCell(cell) && !inc && cls === 'test_martingale')
    return { status: 'VOID', reason: 'test_martingale cell without an increment estimator' };
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

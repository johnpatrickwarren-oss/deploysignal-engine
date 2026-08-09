// validation/coverage/tools/strict-phi-counterfactual.mjs
//
// PROBE, not a harness. Writes nothing, emits no cell, draws no random number, reads no
// registered seed. It reads ONLY committed JSON from an already-scored certification run.
//
// Registered in ../PREREGISTRATION.md, Erratum v1.5 (WORKLIST C43), section C43.5 — every figure
// in that section's two tables is this script's output. Committed per tools/README.md's provenance
// standard (the C50 review's F6 finding).
//
// THE QUESTION. `safe_t_e_value`'s card narrows its regime to `phi_known: true`. The scorer reads
// that narrowing through `phiIsEstimated` (validation/certification/lib/nulls.mjs:94-98), which
// treats an iid null's phi as KNOWN even when the detector fitted it internally -- the ruling
// recorded at nulls.mjs:28-49, which also names the stricter reading it rejected: "phi is known iff
// the caller passed it". This probe prices that stricter reading: which cells leave the regime, and
// which stage statuses and class answers move.
//
// THE ONE NON-MECHANICAL INPUT is the per-harness threading predicate below, verified at the three
// call sites rather than assumed.
//
// Usage: node validation/coverage/tools/strict-phi-counterfactual.mjs <scored-run-dir>
//   e.g. ... validation/certification/results/run-20260809T080049Z

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const RUN = process.argv[2];
if (!RUN) throw new Error('usage: strict-phi-counterfactual.mjs <validation/certification/results/run-*>');
const read = (f) => JSON.parse(readFileSync(join(RUN, f), 'utf8'));

// Did the harness that produced this cell hand safe-t an `opts.ar1Phi`?
//   validation/terminal-evalue/harness/run.mjs:28-37 (NULLS, `oracle: true` on N1 and N3-*) and
//     :43 (`ns.oracle ? { ar1Phi: ns.phi } : undefined`)
//   validation/h0-battery/harness/nulls.mjs:53,61-63 (the same table, one grammar)
//   validation/coverage/harness/run-battery.mjs:616 (`phi > 0 ? { ar1Phi: phi } : undefined`)
const threads = (cell) => (cell.__study === 'coverage'
  ? (cell.phi ?? 0) > 0
  : /^N1$|^N3-p/.test(cell.null_id ?? ''));

const COVERAGE_FLOOR = 0.50;        // validation/certification/lib/constants.mjs
const INERTNESS_FLOOR = 0.10;       // idem
const rateOf = (c) => c.detection_rate ?? c.rate_e_ge_20;
const tally = (rows) => rows.reduce((t, r) => {
  const k = r.mapped ?? r.verdict ?? '(no verdict field)';
  return { ...t, [k]: (t[k] ?? 0) + 1 };
}, {});

const card = read('safe_t_e_value.card.json');
console.log(`run ${RUN}\ncard ${card.card.detector_id}  overall ${card.overall.verdict}/${card.overall.tier}`
  + `  regime ${JSON.stringify(card.card.guarantee.regime.phi_known)}\n`);

for (const st of ['s2', 's3']) {
  const cells = card[st].perCell ?? [];
  const inHead = cells.filter((c) => !c.out_of_regime);
  const kept = inHead.filter(threads);
  const dropped = inHead.filter((c) => !threads(c));
  const ids = (rows) => [...new Set(rows.map((c) => `${c.__study}:${c.null_id ?? '(no null_id)'}`))].sort().join(', ');
  console.log(`${st}: status ${card[st].status} | in regime at HEAD ${inHead.length} -> strict ${kept.length}`);
  console.log(`   kept    ${ids(kept)}  ${JSON.stringify(tally(kept))}`);
  console.log(`   dropped ${ids(dropped)}  ${JSON.stringify(tally(dropped))}`);
  const rates = kept.map(rateOf).filter(Number.isFinite);
  if (rates.length) console.log(`   min surviving power rate ${Math.min(...rates)} (INERTNESS_FLOOR ${INERTNESS_FLOOR})`);
  console.log(`   NOTE: every dropped cell above is ${[...new Set(Object.keys(tally(dropped)))].join('/')} `
    + '— the drop hides no refutation');
}

// The class-answer leg is a HYPOTHETICAL: coverageFor (lib/score.mjs:358-404) reads no regime, so
// this moves only if the class-answer layer were ALSO gated, which nothing registers.
console.log('\nclass answers, if the strict reading were ALSO applied to the class-answer layer:');
for (const [cls, blk] of Object.entries(card.coverage)) {
  const canon = (blk.cells ?? []).filter((c) => c.canonical === true);
  const strict = canon.filter(threads);
  const status = strict.some((c) => rateOf(c) >= COVERAGE_FLOOR) ? 'COVERED' : 'NOT_POWERED';
  console.log(`   ${cls}: HEAD ${blk.status}`
    + `${blk.canonical ? ` (${blk.canonical.severity} ${blk.canonical.rate})` : ''}`
    + ` | canonical cells ${canon.length} -> strict ${strict.length} | strict ${status}`);
}

console.log('\nthe fallback carriers, read from their own committed cards:');
for (const f of ['universal_inference_e_value.card.json', 'group_average_e_value.card.json']) {
  const c = read(f);
  const cov = Object.fromEntries(Object.entries(c.coverage).map(([k, v]) => [k, `${v.status} ${v.canonical?.rate ?? '-'}`]));
  console.log(`   ${c.card.detector_id}: overall ${c.overall.verdict}`
    + `, phi_known ${JSON.stringify(c.card.guarantee.regime.phi_known)}, ${JSON.stringify(cov)}`);
}

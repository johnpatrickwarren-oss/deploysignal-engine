// validation/coverage/tools/strict-phi-counterfactual.mjs
//
// PROBE, not a harness. Writes nothing, emits no cell, draws no random number, reads no
// registered seed. It reads ONLY committed JSON from an already-scored certification run.
//
// Registered in ../PREREGISTRATION.md, Erratum v1.5 (WORKLIST C43) section C43.5 and the review
// correction append's F1 — every figure in those tables is this script's output. Committed per
// tools/README.md's provenance standard (the C50 review's F6 finding).
//
// F1 (review). The first version of this probe scored only safe_t_e_value's stages and read the
// class answers as if only `coverageFor` could move them. That misses the mechanism that actually
// bites: a class answers YES iff some card with overall verdict USE has it COVERED
// (verdict.mjs:362), so the strict reading can strike a class by DEMOTING ITS CARRIER with
// coverageFor untouched. Two cards are one S2 cell wide -- point_tail_bet_e_value and
// group_average_e_value -- and both fall to NOT_EXECUTABLE, which costs K4 its YES under the strict
// reading ALONE. This version scores every card in the run, through overallVerdict.
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

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { scoreS2, scoreS3, coverageFor, overallVerdict } from '../../certification/lib/score.mjs';
import { FAULT_CLASSES } from '../../certification/lib/constants.mjs';

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

// ---------------------------------------------------------------------------------------------
// THE PORTFOLIO LEG (F1). The strict reading, expressed in the one field the scorer reads:
// `phiIsEstimated` tests `cell.phi_source` first (validation/certification/lib/nulls.mjs:94-98), so
// tagging every non-threaded cell 'estimated' IS the strict reading. Cards without `phi_known` are
// unaffected by construction: regimeCheck's branch (lib/score.mjs:66) cannot fire for them.
const strict = (c) => (threads(c) ? c : { ...c, phi_source: 'estimated' });

const cards = readdirSync(RUN).filter((f) => f.endsWith('.card.json'))
  .map((f) => JSON.parse(readFileSync(join(RUN, f), 'utf8')));

const scored = cards.map((o) => {
  const s2 = scoreS2(o.card, (o.s2.perCell ?? []).map(strict));
  const s3 = scoreS3(o.card, (o.s3.perCell ?? []).map(strict));
  const covCells = Object.values(o.coverage).flatMap((b) => b.cells ?? []);
  return {
    id: o.card.detector_id,
    phi_known: o.card.guarantee.regime.phi_known ?? null,
    head: { s2: o.s2.status, s3: o.s3.status, verdict: o.overall.verdict, tier: o.overall.tier, coverage: o.coverage },
    strictS2: s2.status,
    strictS3: s3.status,
    strict: overallVerdict(o.card, o.s1, s2, s3, o.s4),
    // HEAD's class layer reads no regime (lib/score.mjs:358-404); `covGated` is the SECOND,
    // unregistered change -- regime-gating the class-answer layer -- priced separately.
    covUngated: coverageFor(o.card, covCells),
    covGated: coverageFor(o.card, covCells.map(strict)
      .filter((c) => !(o.card.guarantee.regime.phi_known === true && c.phi_source === 'estimated'))),
    // Re-scoring reads perCell only, so a card whose cells were already routed to excluded/missing
    // cannot be reproduced exactly. Reported per card rather than hidden: family_E_conformal's 66 S2
    // cells all sit in excluded (voided run), so its VOID cannot be reproduced from perCell.
    inputComplete: (o.s2.excluded ?? []).length === 0 && (o.s2.missing ?? []).length === 0,
  };
});

console.log('\ncard verdicts under the strict reading (HEAD -> strict):');
for (const r of scored) {
  const moved = r.head.s2 !== r.strictS2 || r.head.s3 !== r.strictS3 || r.head.verdict !== r.strict.verdict;
  console.log(`  ${moved ? '**' : '  '} ${r.id.padEnd(34)} phi_known=${String(r.phi_known).padEnd(5)}`
    + ` S2 ${r.head.s2}->${r.strictS2}  S3 ${r.head.s3}->${r.strictS3}`
    + `  overall ${r.head.verdict}/${r.head.tier} -> ${r.strict.verdict}/${r.strict.tier}`
    + `${r.inputComplete ? '' : '   [re-score input INCOMPLETE: cells sit in excluded/missing]'}`);
}

const answer = (key, verdictOf, covOf) => {
  const carriers = scored.filter((r) => verdictOf(r) === 'USE' && covOf(r)[key]?.status === 'COVERED');
  return carriers.length ? `YES (${carriers.map((r) => r.id).join(', ')})` : 'NO';
};
console.log('\nclass answers (verdict.mjs:362 rule, portfolio-wide):');
console.log(`  ${'class'.padEnd(9)}${'HEAD'.padEnd(52)}${'strict reading ALONE'.padEnd(52)}strict + regime-gated coverage`);
for (const k of Object.keys(FAULT_CLASSES)) {
  const head = answer(k, (r) => r.head.verdict, (r) => r.head.coverage);
  const alone = answer(k, (r) => r.strict.verdict, (r) => r.covUngated);
  const gated = answer(k, (r) => r.strict.verdict, (r) => r.covGated);
  const flips = head.startsWith('YES') && !(alone.startsWith('YES') && gated.startsWith('YES'));
  console.log(`  ${flips ? '**' : '  '}${k.padEnd(7)}${head.padEnd(52)}${alone.padEnd(52)}${gated}`);
}

// validation/coverage/tools/relabel-rescore.mjs
//
// PROBE, not a harness. Writes nothing, emits no cell, draws no random number, reads no registered
// seed. It reads ONLY committed JSON from an already-scored certification run.
//
// Registered in ../PREREGISTRATION.md, Amendment v2.C43.1 section C43.1.3 — the table there is this
// script's output. Committed per tools/README.md's provenance standard (the C50 review's F6 finding,
// and the review's own F5 against this branch for leaving it in a scratch directory).
//
// THE QUESTION. C43.1 relabels this battery's `null_id` per detector, because `N1` asserts an
// `opts.ar1Phi` threading that `safe_t`, `group_average_e_value` and `universal_inference` never
// receive. `null_id` is scorer-mechanical: `lib/collect.mjs:16-27` derives `phi_source` from it and
// `lib/score.mjs:66` gates the known-phi regime on that. So before the harness changed, the relabel's
// scoring consequence had to be measured rather than argued: substitute the new ids into the
// COMMITTED cells, re-annotate exactly as collect.mjs does, and re-run the REAL scorer.
//
// Usage: node validation/coverage/tools/relabel-rescore.mjs <scored-run-dir>
//   e.g. ... validation/certification/results/run-20260809T080049Z

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { scoreS2, scoreS3, coverageFor, pairingGaps } from '../../certification/lib/score.mjs';
import { derivePhiParams } from '../../certification/lib/nulls.mjs';

const RUN = process.argv[2];
if (!RUN) throw new Error('usage: relabel-rescore.mjs <validation/certification/results/run-*>');
const read = (f) => JSON.parse(readFileSync(join(RUN, f), 'utf8'));

// Amendment v2.C43.1 C43.1.2's registered mapping, and only it: every other detector keeps the
// shared N1/N3-p06 convention or its own out-of-grammar literal.
const RELABEL = {
  safe_t: (phi) => (phi === 0 ? 'N2-m100' : 'N3-p06'),
  group_average_e_value: (phi) => (phi === 0 ? 'N2-m100' : 'N3-p06'),
  universal_inference: (phi) => (phi === 0 ? 'N2-m100' : 'N4-p06'),
};

// Re-annotate exactly as lib/collect.mjs:16-27 does after substituting the id: `phi_source` is set
// unconditionally, `params` only when absent (which is why the emitted 'oracle' survives -- the
// residue named at C43.1.6 item 2 and the review's F8).
const relabel = (cell) => {
  if (cell.__study !== 'coverage') return cell;
  const f = RELABEL[cell.detector];
  if (!f) return cell;
  const null_id = f(cell.phi ?? 0);
  if (null_id === cell.null_id) return cell;
  const d = derivePhiParams(null_id);
  return { ...cell, null_id, phi_source: d.phi_source, params: cell.params ?? d.params };
};

const CARDS = ['safe_t_e_value', 'group_average_e_value', 'universal_inference_e_value', 'point_tail_bet_e_value'];
for (const name of CARDS) {
  const card = read(`${name}.card.json`);
  const covCells = Object.values(card.coverage).flatMap((b) => b.cells ?? []);
  const all = [...(card.s2.perCell ?? []), ...(card.s3.perCell ?? []), ...covCells];
  const changed = all.filter((c) => relabel(c) !== c);
  const s2 = scoreS2(card.card, (card.s2.perCell ?? []).map(relabel));
  const s3 = scoreS3(card.card, (card.s3.perCell ?? []).map(relabel));
  const cov = (cells) => Object.entries(cells).map(([k, v]) => `${k}:${v.status}`).join(' ');
  console.log(`== ${name}`);
  console.log(`   rows relabelled: ${changed.length} of ${all.length}`
    + `  ${[...new Set(changed.map((c) => `${c.detector} phi=${c.phi} ${c.null_id}->${relabel(c).null_id}`))].join(', ') || '(none)'}`);
  console.log(`   S2 ${card.s2.status} -> ${s2.status}`
    + `   in-regime ${(card.s2.perCell ?? []).filter((c) => !c.out_of_regime).length} -> ${s2.perCell.filter((c) => !c.out_of_regime).length}`);
  console.log(`   S3 ${card.s3.status} -> ${s3.status}`);
  console.log(`   coverage OLD ${cov(card.coverage)}`);
  console.log(`   coverage NEW ${cov(coverageFor(card.card, covCells.map(relabel)))}`);
  console.log(`   pairing ${JSON.stringify(card.pairing)} -> ${JSON.stringify(pairingGaps(s2, s3))}`);
}

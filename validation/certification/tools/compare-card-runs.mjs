// validation/certification/tools/compare-card-runs.mjs — the freeze table's identity check, mechanical.
// Compares every <detector_id>.card.json present in BOTH runs, ignoring the pin fields
// (card.engine_pin, card.source_files[].sha256) and the run-specific generated_from list, and prints
// IDENTICAL or the first differing path per card. Exit 1 if any shared card differs.
//
//   node validation/certification/tools/compare-card-runs.mjs <run-dir-A> <run-dir-B>
import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const [a, b] = process.argv.slice(2).map((p) => resolve(p));
if (!a || !b) { console.error('usage: compare-card-runs.mjs <run-dir-A> <run-dir-B>'); process.exit(2); }
const strip = (o) => {
  const c = structuredClone(o);
  delete c.card.engine_pin;
  c.card.source_files = c.card.source_files.map(({ path }) => ({ path }));
  delete c.generated_from;
  return c;
};
function firstDiff(x, y, path = '') {
  if (typeof x !== typeof y || Array.isArray(x) !== Array.isArray(y)) return path || '(root)';
  if (x && typeof x === 'object') {
    const keys = [...new Set([...Object.keys(x), ...Object.keys(y)])];
    for (const k of keys) { const d = firstDiff(x[k], y[k], path ? `${path}.${k}` : k); if (d) return d; }
    return null;
  }
  return Object.is(x, y) || x === y ? null : path || '(root)';
}
const cards = (d) => readdirSync(d).filter((f) => f.endsWith('.card.json')).sort();
const shared = cards(a).filter((f) => cards(b).includes(f));
let differing = 0;
for (const f of shared) {
  const x = strip(JSON.parse(readFileSync(join(a, f), 'utf8'))), y = strip(JSON.parse(readFileSync(join(b, f), 'utf8')));
  const d = firstDiff(x, y);
  if (d) { differing++; console.log(`${f}: DIFFERS at ${d}`); } else console.log(`${f}: IDENTICAL outside pins`);
}
console.log(`${shared.length} shared cards, ${differing} differing; only in A: ${cards(a).filter((f) => !cards(b).includes(f)).join(', ') || 'none'}; only in B: ${cards(b).filter((f) => !cards(a).includes(f)).join(', ') || 'none'}`);
process.exit(differing ? 1 : 0);

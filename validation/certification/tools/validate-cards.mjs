// validation/certification/tools/validate-cards.mjs
import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateCard } from '../lib/schema.mjs';

const cardsDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'cards');
let failed = false;
for (const f of readdirSync(cardsDir).filter((n) => n.endsWith('.json')).sort()) {
  const card = JSON.parse(readFileSync(join(cardsDir, f), 'utf8'));
  const errs = validateCard(card);
  if (errs.length) { failed = true; console.error(`${f}:\n  ${errs.join('\n  ')}`); }
  else console.log(`${f}: OK`);
}
process.exit(failed ? 1 : 0);

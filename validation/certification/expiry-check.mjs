import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fileSha256 } from './lib/freeze.mjs';

export function checkExpiry(cardsDir, repoRoot, siblingRoot = resolve(repoRoot, '..')) {
  const drifted = [];
  for (const f of readdirSync(cardsDir).filter((n) => n.endsWith('.json')).sort()) {
    const card = JSON.parse(readFileSync(join(cardsDir, f), 'utf8'));
    for (const sf of card.source_files ?? []) {
      if (!sf.sha256) continue;
      let actual = null;
      try {
        const abs = sf.path.startsWith('../')
          ? join(siblingRoot, sf.path.slice('../'.length))
          : resolve(repoRoot, sf.path);
        actual = fileSha256(abs);
      } catch { /* missing counts as drift */ }
      if (actual !== sf.sha256) drifted.push({ card: card.detector_id, path: sf.path, expected: sf.sha256, actual });
    }
  }
  return drifted;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const here = dirname(fileURLToPath(import.meta.url));
  const drifted = checkExpiry(join(here, 'cards'), join(here, '..', '..'), '/Users/johnwarren/concord');
  for (const d of drifted) console.error(`EXPIRED ${d.card}: ${d.path} (${d.actual === null ? 'missing' : 'changed'})`);
  if (!drifted.length) console.log('all cards current');
  process.exit(drifted.length ? 1 : 0);
}

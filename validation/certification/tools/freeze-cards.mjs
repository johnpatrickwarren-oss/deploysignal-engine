import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { stampPins } from '../lib/freeze.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..', '..');
const cardsDir = join(here, '..', 'cards');
const gitSha = execSync('git rev-parse HEAD', { cwd: repoRoot }).toString().trim();
const version = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8')).version;

for (const f of readdirSync(cardsDir).filter((n) => n.endsWith('.json')).sort()) {
  const p = join(cardsDir, f);
  const stamped = stampPins(JSON.parse(readFileSync(p, 'utf8')), { repoRoot, gitSha, version, siblingRoot: '/Users/johnwarren/concord' });
  writeFileSync(p, JSON.stringify(stamped, null, 2) + '\n');
  console.log(`${f}: pinned ${gitSha.slice(0, 7)}`);
}

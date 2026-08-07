import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';

export function fileSha256(absPath) {
  return createHash('sha256').update(readFileSync(absPath)).digest('hex');
}

export function stampPins(card, { repoRoot, gitSha, version, siblingRoot = resolve(repoRoot, '..') }) {
  const out = structuredClone(card);
  out.engine_pin = { version, sha: gitSha };
  out.source_files = out.source_files.map((f) => {
    const abs = f.path.startsWith('../')
      ? join(siblingRoot, f.path.slice('../'.length))
      : resolve(repoRoot, f.path);
    let sha256;
    try { sha256 = fileSha256(abs); }
    catch { throw new Error(`source file not found while freezing: ${f.path}`); }
    return { ...f, sha256 };
  });
  return out;
}

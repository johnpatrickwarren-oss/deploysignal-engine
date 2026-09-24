// test/library-boundary.test.ts — the library boundary (ADR 0033), enforced from the import graph.
//
// The engine is two trees. The LIBRARY (detectors/, fleet/, per-shard/, baseline/, types/ and the
// root modules guarantees.ts, signal-classes.ts, verdict-groups.ts, the resampler) is
// consumer-agnostic statistical machinery with its validity accounting. The consumer-shaped
// adapters that used to sit beside it left for their consumers (ADR 0033 steps 3–4, v0.8.0-pre).
// Three rules keep the library consumable on its own, and this test reads every source file to
// check them, so a new upward import fails CI rather than waiting for the next survey.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';

const ROOT = path.resolve(__dirname, '..', '..');

const LIBRARY_DIRS = ['detectors', 'fleet', 'per-shard', 'baseline', 'types'];
const LIBRARY_ROOT_FILES = fs.readdirSync(ROOT).filter((f) =>
  /^(guarantees|signal-classes|verdict-groups|per-detector-resampler-mode|_per-detector-resampler-.*)\.ts$/.test(f));

// v0.8.0-pre: adapters/ is gone (ADR 0033 steps 3–4 moved it to its consumers), so the library's
// only permitted import targets are the library itself.

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else if (e.name.endsWith('.ts') && !e.name.endsWith('.d.ts')) out.push(p);
  }
  return out;
}

interface Edge { file: string; target: string; typeOnly: boolean; line: number }

/** Every relative import in a file, resolved to a root-relative target without extension. */
function edgesOf(abs: string): Edge[] {
  const file = path.relative(ROOT, abs);
  const src = fs.readFileSync(abs, 'utf8');
  const edges: Edge[] = [];
  const lines = src.split('\n');
  lines.forEach((line, i) => {
    // `import type { X } from '../y'` / `import { type X } from` / inline `import('../y')` in a type
    // position are erased at compile time; `import { x } from` and `export { x } from` are runtime.
    const re = /(import\s+type\s+[^'"]*from\s*|import\s*\(\s*|(?:import|export)\s+[^'"]*from\s*)['"](\.[^'"]+)['"]/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(line)) !== null) {
      const spec = m[2];
      const typeOnly = /^import\s+type\s/.test(m[1]) || /^import\s*\(/.test(m[1])
        || /^import\s*\{\s*type\s[^}]*\}\s*from/.test(m[1]) && !/,\s*(?!type\s)\w/.test(m[1]);
      const target = path.relative(ROOT, path.resolve(path.dirname(abs), spec));
      edges.push({ file, target, typeOnly, line: i + 1 });
    }
  });
  return edges;
}

function topDir(rel: string): string { return rel.split(path.sep)[0]; }

const libraryFiles = [
  ...LIBRARY_DIRS.flatMap((d) => walk(path.join(ROOT, d))),
  ...LIBRARY_ROOT_FILES.map((f) => path.join(ROOT, f)),
];
const libraryEdges = libraryFiles.flatMap(edgesOf);

describe('library boundary (ADR 0033)', () => {
  test('the survey covers the tree: library files and edges were found', () => {
    assert.ok(libraryFiles.length > 80, `only ${libraryFiles.length} library files read`);
    assert.ok(libraryEdges.length > 100, `only ${libraryEdges.length} edges read`);
  });

  test('rule 1: the library imports only the library (adapters/ no longer exists)', () => {
    assert.ok(!fs.existsSync(path.join(ROOT, 'adapters')), 'adapters/ came back');
    const libraryRoot = new Set(LIBRARY_ROOT_FILES.map((f) => f.replace(/\.ts$/, '')));
    const bad = libraryEdges.filter((e) => !(LIBRARY_DIRS.includes(topDir(e.target)) || libraryRoot.has(e.target)));
    assert.deepEqual(bad.map((e) => `${e.file}:${e.line} -> ${e.target}`), []);
  });

  test('rule 2: detectors/ and baseline/ never import fleet/', () => {
    const bad = libraryEdges.filter((e) =>
      (topDir(e.file) === 'detectors' || topDir(e.file) === 'baseline') && topDir(e.target) === 'fleet');
    assert.deepEqual(bad.map((e) => `${e.file}:${e.line} -> ${e.target}`), []);
  });

  test('rule 3: types/ imports only types/ and the library root modules', () => {
    const libraryRoot = new Set(LIBRARY_ROOT_FILES.map((f) => f.replace(/\.ts$/, '')));
    const bad = libraryEdges.filter((e) => topDir(e.file) === 'types'
      && !(topDir(e.target) === 'types' || libraryRoot.has(e.target))
      );
    assert.deepEqual(bad.map((e) => `${e.file}:${e.line} -> ${e.target}`), []);
  });

  test('nothing consumer-shaped is back at the root', () => {
    for (const d of ['adapters', 'topology', 'events', 'l0', 'o0', 'ds-integration']) assert.ok(!fs.existsSync(path.join(ROOT, d)), `${d}/ is back`);
    for (const f of ['core', 'loader', 'topology-overlay', 'hardware-topology-source']) assert.ok(!fs.existsSync(path.join(ROOT, `${f}.ts`)), `${f}.ts is back`);
  });
});

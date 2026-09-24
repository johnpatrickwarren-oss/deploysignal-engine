// test/library-boundary.test.ts — the library boundary (ADR 0033), enforced from the import graph.
//
// The engine is two trees. The LIBRARY (detectors/, fleet/, per-shard/, baseline/, types/ and the
// root modules guarantees.ts, signal-classes.ts, verdict-groups.ts, the resampler) is
// consumer-agnostic statistical machinery with its validity accounting. ADAPTERS (adapters/) are
// consumer-shaped: topology sources, the DS↔Tessera contract, L0/O0, the DeploySignal heuristic
// core. Three rules keep the library consumable on its own, and this test reads every source file
// to check them, so a new upward import fails CI rather than waiting for the next survey.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';

const ROOT = path.resolve(__dirname, '..', '..');

const LIBRARY_DIRS = ['detectors', 'fleet', 'per-shard', 'baseline', 'types'];
const LIBRARY_ROOT_FILES = fs.readdirSync(ROOT).filter((f) =>
  /^(guarantees|signal-classes|verdict-groups|per-detector-resampler-mode|_per-detector-resampler-.*)\.ts$/.test(f));

/** Type-only references from library types into adapters, frozen. These are DeploySignal's
 *  orchestration hooks (optional fields on OrchestrateParams / VerdictGroup); they are erased at
 *  compile time, so the library has no runtime edge into adapters/. They leave with
 *  types/orchestration.ts when DeploySignal's runtime types migrate (ADR 0033 step 3). Adding one
 *  here is a decision, not a convenience. */
const ALLOWED_TYPE_ONLY_EDGES: ReadonlyArray<[file: string, target: string]> = [
  ['types/verdict.ts', 'adapters/o0/lifecycle-events'],
  ['types/verdict.ts', 'adapters/o0/reversibility-translator'],
  ['types/orchestration.ts', 'adapters/o0/lifecycle-events'],
  ['types/orchestration.ts', 'adapters/o0/lifecycle-events'],
  ['types/orchestration.ts', 'adapters/o0/reversibility-source'],
  ['types/orchestration.ts', 'adapters/topology-overlay'],
];

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

  test('rule 1: the library never imports adapters/ at runtime', () => {
    const bad = libraryEdges.filter((e) => topDir(e.target) === 'adapters' && !e.typeOnly);
    assert.deepEqual(bad.map((e) => `${e.file}:${e.line} -> ${e.target}`), []);
  });

  test('rule 1a: the type-only edges into adapters/ are exactly the frozen allowlist', () => {
    const got = libraryEdges.filter((e) => topDir(e.target) === 'adapters' && e.typeOnly)
      .map((e) => `${e.file} -> ${e.target}`).sort();
    const want = ALLOWED_TYPE_ONLY_EDGES.map(([f, t]) => `${f} -> ${t}`).sort();
    assert.deepEqual(got, want);
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
      && !(topDir(e.target) === 'adapters' && e.typeOnly));
    assert.deepEqual(bad.map((e) => `${e.file}:${e.line} -> ${e.target}`), []);
  });

  test('the adapter set is where the survey put it, and nothing else is at the root', () => {
    for (const d of ['topology', 'events', 'l0', 'o0', 'ds-integration']) {
      assert.ok(fs.existsSync(path.join(ROOT, 'adapters', d)), `adapters/${d} missing`);
      assert.ok(!fs.existsSync(path.join(ROOT, d)), `${d}/ still at the root`);
    }
    for (const f of ['core', 'loader', 'topology-overlay', 'hardware-topology-source']) {
      assert.ok(fs.existsSync(path.join(ROOT, 'adapters', `${f}.ts`)), `adapters/${f}.ts missing`);
      assert.ok(!fs.existsSync(path.join(ROOT, `${f}.ts`)), `${f}.ts still at the root`);
    }
  });
});

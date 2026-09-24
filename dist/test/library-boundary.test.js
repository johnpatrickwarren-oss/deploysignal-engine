"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// test/library-boundary.test.ts — the library boundary (ADR 0033), enforced from the import graph.
//
// The engine is two trees. The LIBRARY (detectors/, fleet/, per-shard/, baseline/, types/ and the
// root modules guarantees.ts, signal-classes.ts, verdict-groups.ts, the resampler) is
// consumer-agnostic statistical machinery with its validity accounting. The consumer-shaped
// adapters that used to sit beside it left for their consumers (ADR 0033 steps 3–4, v0.8.0-pre).
// Three rules keep the library consumable on its own, and this test reads every source file to
// check them, so a new upward import fails CI rather than waiting for the next survey.
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
const ROOT = path.resolve(__dirname, '..', '..');
const LIBRARY_DIRS = ['detectors', 'fleet', 'per-shard', 'baseline', 'types'];
const LIBRARY_ROOT_FILES = fs.readdirSync(ROOT).filter((f) => /^(guarantees|signal-classes|verdict-groups|per-detector-resampler-mode|_per-detector-resampler-.*)\.ts$/.test(f));
// v0.8.0-pre: adapters/ is gone (ADR 0033 steps 3–4 moved it to its consumers), so the library's
// only permitted import targets are the library itself.
function walk(dir) {
    const out = [];
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory())
            out.push(...walk(p));
        else if (e.name.endsWith('.ts') && !e.name.endsWith('.d.ts'))
            out.push(p);
    }
    return out;
}
/** Every relative import in a file, resolved to a root-relative target without extension. */
function edgesOf(abs) {
    const file = path.relative(ROOT, abs);
    const src = fs.readFileSync(abs, 'utf8');
    const edges = [];
    const lines = src.split('\n');
    lines.forEach((line, i) => {
        // `import type { X } from '../y'` / `import { type X } from` / inline `import('../y')` in a type
        // position are erased at compile time; `import { x } from` and `export { x } from` are runtime.
        const re = /(import\s+type\s+[^'"]*from\s*|import\s*\(\s*|(?:import|export)\s+[^'"]*from\s*)['"](\.[^'"]+)['"]/g;
        let m;
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
function topDir(rel) { return rel.split(path.sep)[0]; }
const libraryFiles = [
    ...LIBRARY_DIRS.flatMap((d) => walk(path.join(ROOT, d))),
    ...LIBRARY_ROOT_FILES.map((f) => path.join(ROOT, f)),
];
const libraryEdges = libraryFiles.flatMap(edgesOf);
(0, node_test_1.describe)('library boundary (ADR 0033)', () => {
    (0, node_test_1.test)('the survey covers the tree: library files and edges were found', () => {
        strict_1.default.ok(libraryFiles.length > 80, `only ${libraryFiles.length} library files read`);
        strict_1.default.ok(libraryEdges.length > 100, `only ${libraryEdges.length} edges read`);
    });
    (0, node_test_1.test)('rule 1: the library imports only the library (adapters/ no longer exists)', () => {
        strict_1.default.ok(!fs.existsSync(path.join(ROOT, 'adapters')), 'adapters/ came back');
        const libraryRoot = new Set(LIBRARY_ROOT_FILES.map((f) => f.replace(/\.ts$/, '')));
        const bad = libraryEdges.filter((e) => !(LIBRARY_DIRS.includes(topDir(e.target)) || libraryRoot.has(e.target)));
        strict_1.default.deepEqual(bad.map((e) => `${e.file}:${e.line} -> ${e.target}`), []);
    });
    (0, node_test_1.test)('rule 2: detectors/ and baseline/ never import fleet/', () => {
        const bad = libraryEdges.filter((e) => (topDir(e.file) === 'detectors' || topDir(e.file) === 'baseline') && topDir(e.target) === 'fleet');
        strict_1.default.deepEqual(bad.map((e) => `${e.file}:${e.line} -> ${e.target}`), []);
    });
    (0, node_test_1.test)('rule 3: types/ imports only types/ and the library root modules', () => {
        const libraryRoot = new Set(LIBRARY_ROOT_FILES.map((f) => f.replace(/\.ts$/, '')));
        const bad = libraryEdges.filter((e) => topDir(e.file) === 'types'
            && !(topDir(e.target) === 'types' || libraryRoot.has(e.target)));
        strict_1.default.deepEqual(bad.map((e) => `${e.file}:${e.line} -> ${e.target}`), []);
    });
    (0, node_test_1.test)('nothing consumer-shaped is back at the root', () => {
        for (const d of ['adapters', 'topology', 'events', 'l0', 'o0', 'ds-integration'])
            strict_1.default.ok(!fs.existsSync(path.join(ROOT, d)), `${d}/ is back`);
        for (const f of ['core', 'loader', 'topology-overlay', 'hardware-topology-source'])
            strict_1.default.ok(!fs.existsSync(path.join(ROOT, `${f}.ts`)), `${f}.ts is back`);
    });
});
//# sourceMappingURL=library-boundary.test.js.map
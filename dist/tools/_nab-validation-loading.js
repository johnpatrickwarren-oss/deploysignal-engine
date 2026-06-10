"use strict";
// tools/_nab-validation-loading.ts — Q64 SPEC-4 NAB dataset discovery,
// CSV parsing, label loading, and annotation derivation. Extracted
// verbatim from tools/run-nab-validation.ts; re-exported from there so
// every previously-importable name stays importable from the same path.
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.discoverNABDatasets = discoverNABDatasets;
exports.parseNABDatasetCsv = parseNABDatasetCsv;
exports.loadNABLabels = loadNABLabels;
exports.annotationsFromLabels = annotationsFromLabels;
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
// ── NAB dataset discovery + parsing ─────────────────────────────
/** Discover NAB dataset CSV files under <nabRepoPath>/data/<sub>/*.csv. */
function discoverNABDatasets(nabRepoPath, subBenchmarks) {
    const out = [];
    const dataRoot = path.join(nabRepoPath, 'data');
    if (!fs.existsSync(dataRoot)) {
        throw new Error(`NAB repository missing data/ directory at ${nabRepoPath}; verify nabRepoPath`);
    }
    for (const sub of subBenchmarks) {
        const subDir = path.join(dataRoot, sub);
        if (!fs.existsSync(subDir))
            continue;
        const entries = fs.readdirSync(subDir);
        for (const entry of entries) {
            if (!entry.endsWith('.csv'))
                continue;
            const abs = path.join(subDir, entry);
            const rel = path.join(sub, entry);
            out.push({ subBenchmark: sub, relPath: rel, absPath: abs });
        }
    }
    return out;
}
/** Parse NAB dataset CSV. Numenta convention: header row `timestamp,
 *  value`; per-tick observation. Returns per-tick value array (tick
 *  index = row index post-header). */
function parseNABDatasetCsv(absPath) {
    const data = fs.readFileSync(absPath, 'utf8');
    const lines = data.split('\n').filter((l) => l.trim().length > 0);
    // Validation (remediation 2026-06-10 M7): malformed rows used to push NaN
    // silently; empty files crashed with a TypeError on lines[0].
    if (lines.length === 0) {
        throw new Error(`NAB CSV ${path.basename(absPath)} is empty`);
    }
    const header = lines[0].split(',').map((s) => s.trim());
    const tsIdx = header.indexOf('timestamp');
    const valIdx = header.indexOf('value');
    if (tsIdx < 0 || valIdx < 0) {
        throw new Error(`NAB CSV ${path.basename(absPath)} missing 'timestamp' or 'value' header column. `
            + `Got: ${JSON.stringify(header)}`);
    }
    const values = [];
    const timestamps = [];
    for (let i = 1; i < lines.length; i++) {
        const f = lines[i].split(',');
        const v = parseFloat(f[valIdx]);
        if (!Number.isFinite(v)) {
            throw new Error(`NAB CSV ${path.basename(absPath)} row ${i + 1}: non-numeric 'value' ${JSON.stringify(f[valIdx])}`);
        }
        timestamps.push(f[tsIdx]);
        values.push(v);
    }
    return { values, timestamps };
}
/** Load NAB combined_windows.json labels file. Maps relative dataset
 *  path (e.g. 'realKnownCause/foo.csv') to array of [start_ts, end_ts]
 *  ISO strings. */
function loadNABLabels(labelsPath) {
    if (!fs.existsSync(labelsPath)) {
        throw new Error(`NAB labels missing at ${labelsPath}; verify nabRepoPath/labels/combined_windows.json`);
    }
    const data = fs.readFileSync(labelsPath, 'utf8');
    return JSON.parse(data);
}
/** Convert NAB ISO-timestamp anomaly windows to tick-index annotations
 *  by indexing into the per-dataset timestamps array. */
/** Normalize a NAB timestamp string for comparison.
 *  Labels carry microseconds (`"2014-04-10 07:15:00.000000"`) while
 *  CSVs drop them (`"2014-04-10 07:15:00"`). Strip the fractional
 *  seconds component so label timestamps match CSV timestamps for
 *  tick-bucket lookup. Also tolerates `T` separator and `Z` suffix
 *  defensively. */
function normalizeNABTimestamp(ts) {
    // Convert ISO 'T' separator to space; drop trailing 'Z'.
    let s = ts.replace('T', ' ').replace(/Z$/, '');
    // Strip fractional seconds.
    s = s.replace(/\.\d+$/, '');
    return s;
}
function annotationsFromLabels(labelWindows, timestamps) {
    const tsToTick = new Map();
    for (let i = 0; i < timestamps.length; i++)
        tsToTick.set(normalizeNABTimestamp(timestamps[i]), i);
    const out = [];
    for (const [startTs, endTs] of labelWindows) {
        const start = tsToTick.get(normalizeNABTimestamp(startTs));
        const end = tsToTick.get(normalizeNABTimestamp(endTs));
        if (start === undefined || end === undefined)
            continue; // label timestamp not in dataset
        out.push({ anomaly_window_start: start, anomaly_window_end: end });
    }
    return out;
}
//# sourceMappingURL=_nab-validation-loading.js.map
"use strict";
// VENDORED FROM DeploySignal main@5a72371 — 2026-05-16
// Source: deploysignal/engine/detectors/_q72-trace.ts
// Sync policy: vendored-at-pin
// Extract target: @johnpatrickwarren-oss/deploysignal-engine (Tessera Phase 2 close commitment)
// DO NOT modify internals without ADR; deltas only at architecturally-anchored extension points (see SCOPING-MEMO-v0.3 § 9).
Object.defineProperty(exports, "__esModule", { value: true });
exports.q72TraceEnabled = q72TraceEnabled;
exports.q72EmitProcessHeader = q72EmitProcessHeader;
exports.q72EmitCellHeader = q72EmitCellHeader;
exports.q72EmitTick = q72EmitTick;
let _fs = null;
let _writeStream = null;
let _initialized = false;
let _processHeaderEmitted = false;
const _cellHeadersEmitted = new Set();
/** True iff `Q72_TRACE` env var is set to a non-empty value. */
function q72TraceEnabled() {
    return typeof process !== 'undefined'
        && typeof process.env?.Q72_TRACE === 'string'
        && process.env.Q72_TRACE.length > 0;
}
function _ensureStream() {
    if (_initialized)
        return _writeStream;
    _initialized = true;
    if (!q72TraceEnabled())
        return null;
    // Lazy-load node:fs only when trace is actually active.
    // require() is intentional: ES `import` is hoisted to module-load
    // time and would break browser bundling regardless of runtime gating.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    _fs = require('node:fs');
    const tracePath = process.env.Q72_TRACE;
    _writeStream = _fs.createWriteStream(tracePath, { flags: 'a' });
    return _writeStream;
}
function _writeRecord(obj) {
    const stream = _ensureStream();
    if (!stream)
        return;
    stream.write(JSON.stringify(obj) + '\n');
}
/** Emit the once-per-process header at first call. Captures runtime
 *  identity (pid, node version, platform, argv) so the trace consumer
 *  can attribute records to a (Darwin vs Linux) × (seed) tuple. */
function q72EmitProcessHeader() {
    if (_processHeaderEmitted)
        return;
    if (!q72TraceEnabled())
        return;
    _processHeaderEmitted = true;
    _writeRecord({
        kind: 'process_header',
        pid: process.pid,
        argv: process.argv,
        cwd: process.cwd(),
        node_version: process.version,
        platform: process.platform,
        arch: process.arch,
        started_at: new Date().toISOString(),
    });
}
/** Emit per-cell header on first dispatch to that cell. Captures the
 *  betting_e_process_params snapshot + first-N baseline pool entries
 *  (so substrate divergence between platforms — different bandwidth
 *  or different baseline pool seed output — is observable upstream of
 *  the per-tick state delta).
 *
 *  `pool_first_5` carries the first 5 baseline-pool vectors verbatim;
 *  if Darwin and Linux produce differently-seeded pools (e.g.,
 *  Math.random leakage despite our deterministic seed function), the
 *  divergence shows up here before any tick-level delta. */
function q72EmitCellHeader(cellKey, bettingParams, poolFirst5, poolSize) {
    if (!q72TraceEnabled())
        return;
    if (_cellHeadersEmitted.has(cellKey))
        return;
    _cellHeadersEmitted.add(cellKey);
    _writeRecord({
        kind: 'cell_header',
        pid: process.pid,
        cell_key: cellKey,
        betting_params: bettingParams,
        pool_size: poolSize,
        pool_first_5: poolFirst5,
    });
}
function q72EmitTick(rec) {
    if (!q72TraceEnabled())
        return;
    _writeRecord({
        kind: 'tick',
        pid: process.pid,
        ...rec,
    });
}
//# sourceMappingURL=_q72-trace.js.map
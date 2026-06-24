// test/adr-0004-pr-d-baseline-lifecycle.test.ts — ADR 0004 PR D.
//
// Validates the epoch-level drift-trigger machine (Tessera ADR 0011 lifecycle, promoted). Two layers:
//
//   MACHINE (deterministic alarm streams) — the decision logic the engine owns:
//     1. a SUSTAINED alarm rate (≥ rateThreshold within window) triggers a re-record;
//     2. RATE, not RUN-LENGTH — a tight short run does NOT trigger, spread-out alarms that reach the
//        count DO (the ADR 0011 finding: per-fire run-length cannot tell drift from a fault);
//     3. an OCCASIONAL alarm (a fault, below the rate) never re-records;
//     4. cooldown suppresses a re-record storm; epoch/reRecords accounting; guards.
//
//   END-TO-END (engine betting e-process) — the integration: on slow DRIFT the lifecycle re-records and
//     cuts false alarms vs a STATIC baseline, while a SHARP fault is still detected (its first alarm
//     precedes the rate trigger, so re-recording does not cost detection) — the ADR 0011 headline.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  freshBaselineLifecycle,
  updateBaselineLifecycle,
  DEFAULT_RATE_WINDOW,
  DEFAULT_RATE_THRESHOLD,
  DEFAULT_COOLDOWN,
} from '../per-shard/baseline-lifecycle';
import { freshBettingState, updateBettingState } from '../detectors/betting-e-process';
import { computePerSignalAr1Phi } from '../detectors/family-a-mixture-supermartingale';

// Feed a boolean alarm pattern; return the per-tick reRecord flags.
function feed(state: ReturnType<typeof freshBaselineLifecycle>, fired: boolean[]): boolean[] {
  return fired.map((f) => updateBaselineLifecycle(state, f).reRecord);
}
function alarmsAt(ticks: number[], total: number): boolean[] {
  const a = new Array<boolean>(total).fill(false);
  for (const t of ticks) a[t] = true;
  return a;
}

// ── 1. Sustained rate triggers a re-record (at exactly the threshold-th alarm in window). ──────────
test('machine: a sustained alarm rate triggers a re-record at the threshold-th alarm', () => {
  const st = freshBaselineLifecycle({ window: 10, rateThreshold: 3, cooldown: 5 });
  const flags = feed(st, alarmsAt([0, 1, 2], 5));
  assert.deepEqual(flags, [false, false, true, false, false], 'reRecord on the 3rd alarm within the window');
  assert.equal(st.epoch, 1);
  assert.equal(st.reRecords, 1);
});

// ── 2. RATE, not RUN-LENGTH (the ADR 0011 negative). ──────────────────────────────────────────────
test('machine: it triggers on RATE not RUN-LENGTH — a tight short run does not, spread-out alarms do', () => {
  // (a) a tight run of 3 consecutive alarms (high "run-length") with threshold 4 → never triggers.
  const runState = freshBaselineLifecycle({ window: 20, rateThreshold: 4, cooldown: 5 });
  assert.ok(!feed(runState, alarmsAt([0, 1, 2], 25)).some(Boolean), 'a 3-alarm run (below the count) must not re-record');
  assert.equal(runState.reRecords, 0);
  // (b) 4 alarms SPREAD across the window (never consecutive) → triggers on the 4th. Run-length here is
  //     1 (no two adjacent), yet the rate reaches the threshold — so the signal is the count, not the run.
  const spreadState = freshBaselineLifecycle({ window: 20, rateThreshold: 4, cooldown: 5 });
  const flags = feed(spreadState, alarmsAt([0, 5, 10, 15], 16));
  assert.ok(flags[15], 'four spread-out alarms within the window must re-record (rate, not run-length)');
  assert.equal(spreadState.reRecords, 1);
});

// ── 3. An occasional alarm (a fault) is kept, never re-recorded. ──────────────────────────────────
test('machine: occasional alarms (spaced beyond the rate) never trigger a re-record', () => {
  // Alarms every 4 ticks with window 10, threshold 4 → at most 3 coexist in any window → no re-record.
  const st = freshBaselineLifecycle({ window: 10, rateThreshold: 4, cooldown: 5 });
  const ticks = Array.from({ length: 20 }, (_, k) => k * 4); // 0,4,8,…,76
  assert.ok(!feed(st, alarmsAt(ticks, 80)).some(Boolean), 'sparse alarms must not re-record (a fault keeps alarming)');
  assert.equal(st.reRecords, 0);
});

// ── 4. Cooldown suppresses a re-record storm; a fresh burst after cooldown re-triggers. ───────────
test('machine: cooldown suppresses re-triggering, then a fresh burst re-records again', () => {
  const st = freshBaselineLifecycle({ window: 10, rateThreshold: 3, cooldown: 20 });
  let rr = 0;
  // burst 1 (ticks 0-2) → re-record at 2 (cooldownUntil = 22)
  for (const f of feed(st, alarmsAt([0, 1, 2], 3))) if (f) rr++;
  // burst 2 (ticks 3-5) is within cooldown → suppressed
  for (let t = 3; t <= 5; t++) if (updateBaselineLifecycle(st, true).reRecord) rr++;
  // idle to past cooldownUntil=22
  for (let t = 6; t < 23; t++) updateBaselineLifecycle(st, false);
  // burst 3 (ticks 23-25) → re-records again
  for (let t = 23; t <= 25; t++) if (updateBaselineLifecycle(st, true).reRecord) rr++;
  assert.equal(rr, 2, 'exactly two re-records: the within-cooldown burst is suppressed');
  assert.equal(st.reRecords, 2);
});

// ── 5. Defaults + guards. ─────────────────────────────────────────────────────────────────────────
test('machine: defaults and option guards', () => {
  const st = freshBaselineLifecycle();
  assert.equal(st.window, DEFAULT_RATE_WINDOW);
  assert.equal(st.rateThreshold, DEFAULT_RATE_THRESHOLD);
  assert.equal(st.cooldown, DEFAULT_COOLDOWN);
  assert.throws(() => freshBaselineLifecycle({ window: 0 }), RangeError);
  assert.throws(() => freshBaselineLifecycle({ rateThreshold: 0 }), RangeError);
  assert.throws(() => freshBaselineLifecycle({ cooldown: -1 }), RangeError);
  assert.throws(() => freshBaselineLifecycle({ window: 1.5 }), RangeError);
});

// ── End-to-end with the engine betting e-process. ─────────────────────────────────────────────────
const RHO = 0.5, BASE = 1000, NOISE = 2, NLEN = 1800, M0 = 300, FAULT_AT = 1200, FAULT_SIZE = 8;
const ALPHA = 0.01, RECORD_WINDOW = 200;

function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => { s = ((s * 1664525) + 1013904223) >>> 0; return s / 0x100000000; };
}
function gaussian(rng: () => number): number {
  const u1 = Math.max(rng(), 1e-12), u2 = rng();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}
function ar1Base(rng: () => number): number[] {
  const v: number[] = []; let p = gaussian(rng);
  for (let t = 0; t < NLEN; t++) { p = RHO * p + Math.sqrt(1 - RHO * RHO) * gaussian(rng); v.push(BASE + NOISE * p); }
  return v;
}
function genDrift(rng: () => number, slope: number): number[] {
  const v = ar1Base(rng); for (let i = M0; i < NLEN; i++) v[i] += slope * (i - M0); return v;
}
function genFault(rng: () => number): number[] {
  const v = ar1Base(rng); for (let i = FAULT_AT; i < NLEN; i++) v[i] += FAULT_SIZE; return v;
}

/** Simple baseline calibration over a window: mean, AR(1) φ, innovation variance. */
function calibrate(w: number[]): { mean: number; phi: number; innovVar: number } {
  const mean = w.reduce((a, b) => a + b, 0) / w.length;
  const phi = computePerSignalAr1Phi(w, mean);
  const innov: number[] = [];
  for (let t = 1; t < w.length; t++) innov.push((w[t] - mean) - phi * (w[t - 1] - mean));
  const im = innov.reduce((a, b) => a + b, 0) / innov.length;
  const innovVar = Math.max(innov.reduce((a, b) => a + (b - im) ** 2, 0) / Math.max(1, innov.length - 1), 1e-9);
  return { mean, phi, innovVar };
}

/** A per-shard monitor: betting e-process with an engine baseline-lifecycle drift trigger. A huge
 *  rateThreshold ⇒ the lifecycle never fires ⇒ the STATIC (never-re-record) baseline. */
function runMonitor(values: number[], rateThreshold: number): { alarms: number[]; reRecords: number } {
  let cal = calibrate(values.slice(0, M0));
  let state = freshBettingState();
  const life = freshBaselineLifecycle({ rateThreshold });
  const threshold = 1 / ALPHA;
  const alarms: number[] = [];
  for (let i = M0; i < values.length; i++) {
    const M = updateBettingState(state, values[i], cal.mean, cal.innovVar, ALPHA, cal.phi);
    let fired = false;
    if (M >= threshold) { alarms.push(i); fired = true; state = freshBettingState(); }
    if (updateBaselineLifecycle(life, fired).reRecord) {
      cal = calibrate(values.slice(Math.max(0, i - RECORD_WINDOW), i));
      state = freshBettingState();
    }
  }
  return { alarms, reRecords: life.reRecords };
}

const STATIC = Number.MAX_SAFE_INTEGER; // never re-record

test('end-to-end: on slow drift the lifecycle re-records and cuts false alarms vs a static baseline', () => {
  const TRIALS = 40;
  let staticTot = 0, lifeTot = 0, rrTot = 0;
  for (let s = 0; s < TRIALS; s++) {
    const v = genDrift(lcg(13 + s * 91), 0.02);
    staticTot += runMonitor(v, STATIC).alarms.length;
    const life = runMonitor(v, DEFAULT_RATE_THRESHOLD);
    lifeTot += life.alarms.length; rrTot += life.reRecords;
  }
  const staticMean = staticTot / TRIALS, lifeMean = lifeTot / TRIALS, rrMean = rrTot / TRIALS;
  assert.ok(rrMean >= 1, `the lifecycle must re-record on drift; got ${rrMean.toFixed(2)}/trial`);
  assert.ok(lifeMean < 0.6 * staticMean, `lifecycle alarms ${lifeMean.toFixed(1)} must be well below static ${staticMean.toFixed(1)} (drift FP cut)`);
});

test('end-to-end: a sharp fault is still detected (its first alarm precedes the rate trigger)', () => {
  const TRIALS = 40;
  let staticDet = 0, lifeDet = 0;
  const detected = (alarms: number[]): boolean => alarms.some((a) => a >= FAULT_AT && a < FAULT_AT + 200);
  for (let s = 0; s < TRIALS; s++) {
    const v = genFault(lcg(77 + s * 91));
    if (detected(runMonitor(v, STATIC).alarms)) staticDet++;
    if (detected(runMonitor(v, DEFAULT_RATE_THRESHOLD).alarms)) lifeDet++;
  }
  assert.ok(staticDet / TRIALS >= 0.95, `static must detect the sharp fault; got ${(staticDet / TRIALS).toFixed(2)}`);
  assert.ok(lifeDet / TRIALS >= 0.95, `lifecycle must ALSO detect it (re-record does not cost detection); got ${(lifeDet / TRIALS).toFixed(2)}`);
});

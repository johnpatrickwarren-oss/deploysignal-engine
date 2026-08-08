// test/spectral-bet-e-process.test.ts — engine test pattern (node:test).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  spectralBetWindow,
  spectralBetWealth,
  W_K3,
  BINS_K3,
  KAPPA_K3,
} from '../detectors/spectral-bet-e-process';

const lcg = (s: number) => () => ((s = (s * 1664525 + 1013904223) >>> 0), s / 2 ** 32);
const gauss = (r: () => number) => Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r());

test('registered constants', () => {
  assert.equal(W_K3, 30);
  assert.deepEqual(BINS_K3, [1, 2, 3]);
  assert.equal(KAPPA_K3, 0.1);
});

test('per-window p is Uniform(0,1) under iid N(0,sigma): moments at n=4000 windows', () => {
  const r = lcg(20260808);
  const ps: number[] = [];
  for (let w = 0; w < 4000; w++) {
    const win = Array.from({ length: W_K3 }, () => 2 * gauss(r));
    for (const b of spectralBetWindow(win, 2).perBin) ps.push(b.p);
  }
  const m = ps.reduce((a, b) => a + b) / ps.length;
  const v = ps.reduce((a, b) => a + (b - m) ** 2, 0) / ps.length;
  assert.ok(Math.abs(m - 0.5) < 0.01, `mean ${m}`); // U(0,1): 0.5
  assert.ok(Math.abs(v - 1 / 12) < 0.005, `var ${v}`); // U(0,1): 1/12
});

test('healthy wealth crossing rate <= alpha at N=2000 trajectories of 6 windows', () => {
  const r = lcg(20260808 + 1);
  const alpha = 0.05;
  const threshold = 1 / alpha; // 20 — 1/alpha per the test-martingale Ville bound
  const logThreshold = Math.log(threshold);
  const N = 2000;
  let crossings = 0;
  for (let i = 0; i < N; i++) {
    const windows: number[][] = [];
    for (let w = 0; w < 6; w++) {
      windows.push(Array.from({ length: W_K3 }, () => 2 * gauss(r)));
    }
    const { log } = spectralBetWealth(windows, 2);
    if (log.some((l: number) => l >= logThreshold)) crossings++;
  }
  const rate = crossings / N;
  // Ville's inequality bounds P(any-time crossing) <= alpha exactly for a
  // test martingale under H0; 3sigma binomial tolerance covers MC noise.
  const tol = 3 * Math.sqrt((alpha * (1 - alpha)) / N);
  assert.ok(rate < alpha + tol, `crossing rate ${rate}, tolerance ${alpha + tol}`);
});

test('an f=1/10 oscillation at amp 0.75sigma drives average wealth above 1 (power smoke, no endpoint)', () => {
  const sigma = 2;
  const amp = 0.75 * sigma;
  const freq = 1 / 10; // = 3/30 — an exact Fourier bin (k=3), not leakage
  const r = lcg(20260808 + 2);
  const N = 500;
  let totalWealth = 0;
  for (let i = 0; i < N; i++) {
    const windows: number[][] = [];
    for (let w = 0; w < 6; w++) {
      const win = Array.from({ length: W_K3 }, (_, t) => amp * Math.sin(2 * Math.PI * freq * t) + sigma * gauss(r));
      windows.push(win);
    }
    const { wealth } = spectralBetWealth(windows, sigma);
    totalWealth += wealth;
  }
  const avgWealth = totalWealth / N;
  assert.ok(avgWealth > 1, `average wealth ${avgWealth}`);
});

test('sigma and window-length guards throw', () => {
  const win = new Array(W_K3).fill(0);
  assert.throws(() => spectralBetWindow(new Array(W_K3 - 1).fill(0), 1), /window\.length/);
  assert.throws(() => spectralBetWindow(new Array(W_K3 + 1).fill(0), 1), /window\.length/);
  assert.throws(() => spectralBetWindow(win, 0), /sigma/);
  assert.throws(() => spectralBetWindow(win, -1), /sigma/);
  assert.throws(() => spectralBetWealth([new Array(W_K3 - 1).fill(0)], 1));
});

// Review fix (round 1): the never-max combination rule had no test. Fixture
// is a pure cos(2*pi*t/W_K3) at exactly bin k=1, amp 1, sigma 1 — an
// analytic oracle, not a value copied from one run of the module: the DFT
// basis vectors are orthogonal at integer periods over a length-W_K3
// window, so a pure k=1 signal has Re_1 = W_K3/2 exactly, Im_1 = 0 exactly,
// and Re_2 = Im_2 = Re_3 = Im_3 = 0 exactly (no floating-point coincidence —
// verified against the module's own output before writing this fixture).
test('bins combine by averaging, never max (mutation-bound fixture)', () => {
  const sigma = 1;
  const window = Array.from({ length: W_K3 }, (_, t) => Math.cos((2 * Math.PI * t) / W_K3));
  const { perBin, eAvg } = spectralBetWindow(window, sigma, KAPPA_K3);

  // Independent oracle for k=1: Re_1 = W_K3/2, Im_1 = 0 ⇒ U_1 = (W_K3/2)^2 / W_K3 / sigma^2 = W_K3/4.
  const U1 = (W_K3 * W_K3) / 4 / W_K3 / (sigma * sigma);
  const p1 = Math.exp(-U1);
  const e1 = KAPPA_K3 * Math.pow(p1, KAPPA_K3 - 1); // pins kappa=0.1 inside the calibrator
  assert.ok(Math.abs(e1 - 85.4059) < 1e-3, `oracle e1 ${e1}`);
  assert.ok(Math.abs(perBin[0].e - e1) < 1e-6, `module e1 ${perBin[0].e} vs oracle ${e1}`);

  // k=2, k=3: orthogonal to a pure-k=1 signal ⇒ zero amplitude ⇒ p=1 ⇒ e=kappa.
  assert.ok(Math.abs(perBin[1].e - KAPPA_K3) < 1e-9, `e2 ${perBin[1].e}`);
  assert.ok(Math.abs(perBin[2].e - KAPPA_K3) < 1e-9, `e3 ${perBin[2].e}`);

  const expectedAvg = (perBin[0].e + perBin[1].e + perBin[2].e) / 3;
  assert.equal(eAvg, expectedAvg, 'eAvg is the mean, not the max — mutation eAvg->max fails this');
  assert.ok(Math.abs(eAvg - 28.5353) < 1e-3, `eAvg ${eAvg}`);
  assert.ok(eAvg < Math.max(...perBin.map((b) => b.e)), 'never-max: eAvg is strictly below the largest bin e');
});

// Review fix (round 1, Minor 2): the ADR 0026 NaN pathway, pinned for K3.
// A NaN in a window makes every bin's e NaN, so eAvg is NaN; the log
// increment is NaN, which advanceLogWealth holds at the prior log-wealth
// (0, i.e. wealth 1) rather than propagating to NaN/JSON null.
test('a NaN-containing window holds wealth at 1 (log 0) — ADR 0026 NaN pathway', () => {
  const nanWindow = new Array(W_K3).fill(0);
  nanWindow[5] = NaN;
  const { wealth, log } = spectralBetWealth([nanWindow], 1);
  assert.equal(log[0], 0, 'NaN window holds the log-wealth at its starting value');
  assert.equal(wealth, 1, 'and the linear view stays at 1, not NaN');
});

// Review fix (round 1, Minor 2): a p-underflow-to-0 ordinate (an
// astronomically large periodogram value, sigma held fixed) drives e to
// +Infinity through the calibrator (kappa * 0^(kappa-1) = Infinity), and
// the log-domain wealth accumulator saturates the linear view at
// Number.MAX_VALUE, never Infinity — the ADR 0026 saturation guarantee.
test('a p-underflow-to-0 ordinate saturates the wealth view at Number.MAX_VALUE, not Infinity', () => {
  const sigma = 1;
  // amp 1000 at exactly bin k=1: U_1 = (1000*W_K3/2)^2 / W_K3 / sigma^2, astronomically large.
  const hugeWindow = Array.from({ length: W_K3 }, (_, t) => 1000 * Math.cos((2 * Math.PI * t) / W_K3));
  const { perBin } = spectralBetWindow(hugeWindow, sigma);
  assert.equal(perBin[0].p, 0, 'the ordinate underflows p to exactly 0');
  assert.equal(perBin[0].e, Infinity, 'the calibrator sends p=0 to e=Infinity, pre-accumulation');

  const { wealth, log } = spectralBetWealth([hugeWindow], sigma);
  assert.equal(wealth, Number.MAX_VALUE, 'the linear view saturates finite, never Infinity');
  assert.ok(Number.isFinite(log[0]), 'log books stay exact and finite');
});

// coverage PREREGISTRATION.md Amendment v2.C1 C1.9 — domain guards.
//
// The pre-existing `sigma > 0` check admitted Infinity: `U = I/(sigma*sigma)` becomes 0, so
// `p = exp(-0) = 1` and `e = kappa` on every bin — a finite, plausible-looking, wrong answer on
// every window. NaN was already rejected (NaN > 0 is false); Infinity was not.
//
// `kappa` is a defaulted parameter and was never validated, while the module's own validity
// argument holds only for kappa in (0,1): `integral_0^1 kappa*p^(kappa-1) dp = 1` needs
// kappa > 0 for the integral to converge and kappa < 1 for the calibrator to be a bet on small
// p at all (kappa = 1 is the constant e = 1; kappa > 1 inverts the direction). A caller passing
// 0, 1, a negative, or a non-finite kappa gets a number back that is not an e-value.
test('C1.9: sigma must be FINITE and positive, not merely positive', () => {
  const w = Array.from({ length: W_K3 }, (_, t) => Math.sin(t));
  assert.throws(() => spectralBetWindow(w, Infinity), /finite/);
  assert.throws(() => spectralBetWindow(w, NaN));
  assert.throws(() => spectralBetWindow(w, 0));
  assert.throws(() => spectralBetWindow(w, -1));
  assert.doesNotThrow(() => spectralBetWindow(w, 1));
});

test('C1.9: kappa outside the open interval (0,1) throws — the calibrator identity needs it', () => {
  const w = Array.from({ length: W_K3 }, (_, t) => Math.sin(t));
  for (const bad of [0, 1, -0.1, 1.5, NaN, Infinity]) {
    assert.throws(() => spectralBetWindow(w, 1, bad), /kappa/, `kappa=${bad} must be refused`);
  }
  assert.doesNotThrow(() => spectralBetWindow(w, 1, KAPPA_K3));
  assert.doesNotThrow(() => spectralBetWindow(w, 1, 0.5));
});

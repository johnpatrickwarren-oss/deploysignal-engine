// validation/coverage/test/inject.test.mjs — property tests for the six injection
// generators (K1-K6). One test per generator asserting the named property from
// task-3-brief.md, plus a shared prefix-untouched test.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  rng, injectStep, injectUnison, injectOscillation, injectPoint, injectDrift, injectShapeMix,
} from '../lib/inject.mjs';

test('injectStep: adds delta*sigma to series[at..], leaves series[..at) untouched', () => {
  const series = Array.from({ length: 20 }, (_, i) => i);
  const out = injectStep(series, { sigma: 2, at: 5, delta: 1.5 });
  for (let t = 0; t < 5; t++) assert.equal(out[t], series[t]);
  for (let t = 5; t < 20; t++) assert.equal(out[t] - series[t], 1.5 * 2);
});

test('injectUnison: per-series shift equals eps*sigma exactly for every series', () => {
  const matrix = [
    Array.from({ length: 10 }, () => 1),
    Array.from({ length: 10 }, () => -3),
    Array.from({ length: 10 }, (_, i) => i),
  ];
  const out = injectUnison(matrix, { sigma: 2, at: 4, eps: 0.5 });
  for (let k = 0; k < matrix.length; k++) {
    for (let t = 4; t < 10; t++) {
      assert.equal(out[k][t] - matrix[k][t], 0.5 * 2);
    }
    for (let t = 0; t < 4; t++) assert.equal(out[k][t], matrix[k][t]);
  }
});

test('injectOscillation: max absolute added value never exceeds amp*sigma', () => {
  const series = new Array(200).fill(0);
  const amp = 0.75, sigma = 2, at = 10, freq = 0.05;
  const out = injectOscillation(series, { sigma, at, amp, freq });
  const bound = amp * sigma;
  let maxAbs = 0;
  for (let t = at; t < series.length; t++) maxAbs = Math.max(maxAbs, Math.abs(out[t] - series[t]));
  assert.ok(maxAbs <= bound + 1e-9, `max added ${maxAbs} exceeded bound ${bound}`);
});

test('injectPoint: exactly one index differs, by mult*sigma', () => {
  const series = new Array(30).fill(0);
  const out = injectPoint(series, { sigma: 3, at: 12, mult: 5 });
  let diffCount = 0, diffIndex = -1;
  for (let t = 0; t < series.length; t++) {
    if (out[t] !== series[t]) { diffCount++; diffIndex = t; }
  }
  assert.equal(diffCount, 1);
  assert.equal(diffIndex, 12);
  assert.equal(out[12] - series[12], 5 * 3);
});

test('injectDrift: added value equals slope*(t-at)*sigma for t>=at, zero before', () => {
  const series = new Array(25).fill(0);
  const slope = 1e-4, sigma = 4, at = 6;
  const out = injectDrift(series, { sigma, at, slope });
  for (let t = 0; t < at; t++) assert.equal(out[t], series[t]);
  for (let t = at; t < series.length; t++) {
    assert.equal(out[t] - series[t], slope * (t - at) * sigma);
  }
});

test('injectShapeMix: matched moments (mean~0, var~1) but kurtosis differs from 3 at n=10,000', () => {
  const n = 10000;
  const series = new Array(n).fill(0);
  const r = rng(42);
  const d = 1.5;
  const out = injectShapeMix(series, { sigma: 1, at: 0, d, rng: r });
  const mean = out.reduce((a, b) => a + b, 0) / n;
  const variance = out.reduce((a, b) => a + (b - mean) ** 2, 0) / n;
  const fourth = out.reduce((a, b) => a + (b - mean) ** 4, 0) / n;
  const kurtosis = fourth / (variance * variance);

  assert.ok(Math.abs(mean) < 4 / Math.sqrt(n), `mean ${mean} exceeded 4/sqrt(n)`);
  assert.ok(Math.abs(variance - 1) < 0.1, `variance ${variance} not within 0.1 of 1`);
  assert.ok(Math.abs(kurtosis - 3) > 0.05, `kurtosis ${kurtosis} did not differ from 3`);
});

test('shared: every generator leaves series[0..at-1] byte-identical (prefix untouched)', () => {
  const at = 8;
  const series = Array.from({ length: 20 }, (_, i) => Math.sin(i) + i * 0.01);
  const matrix = [series, series.map((v) => v + 1), series.map((v) => v - 1)];

  const unisonOut = injectUnison(matrix, { sigma: 1, at, eps: 0.3 });
  const pairs = [
    [injectStep(series, { sigma: 1, at, delta: 2 }), series],
    ...unisonOut.map((out, k) => [out, matrix[k]]),
    [injectOscillation(series, { sigma: 1, at, amp: 0.5, freq: 0.1 }), series],
    [injectPoint(series, { sigma: 1, at, mult: 4 }), series],
    [injectDrift(series, { sigma: 1, at, slope: 1e-3 }), series],
    [injectShapeMix(series, { sigma: 1, at, d: 1.2, rng: rng(7) }), series],
  ];

  for (const [out, original] of pairs) {
    for (let t = 0; t < at; t++) assert.equal(out[t], original[t]);
  }
});

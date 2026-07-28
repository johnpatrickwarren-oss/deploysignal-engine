// test/adr-0023-covariate-residualizer.test.ts — the covariate-augmented statistical residualizer
// (ADR 0023; Tessera ADR 0024 G2's cheap arm).
//
// Properties: (1) zero covariates = plain AR(p) — recovers φ on synthetic AR(1); (2) a real
// exogenous driver is absorbed (β recovered, one-step RMSE beats the plain arm); (3) the
// exogeneity lint rejects system-state names with no override; (4) frozen-fit one-step residuals
// on a fresh healthy window are ~N(0,1); (5) a fault in fresh data SURVIVES residualisation —
// the exogenous covariate cannot absorb it; (6) contract guards (order mismatch, lengths).

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  fitCovariateResidualizer, oneStepResiduals, assertExogenous, type CovariateSeries,
} from '../baseline/covariate-residualizer';

function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => { s = ((s * 1664525) + 1013904223) >>> 0; return s / 0x100000000; };
}
function gaussian(rng: () => number): number {
  const u1 = Math.max(rng(), 1e-12), u2 = rng();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}
const mean = (a: number[]): number => a.reduce((x, y) => x + y, 0) / a.length;
const sd = (a: number[]): number => { const m = mean(a); return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / a.length); };

/** y_t = c + β·w_t + u_t, u_t AR(1) with coefficient phi. Workload w is a slow square wave —
 *  exogenous, known to the scheduler ahead of time. */
function makeSeries(seed: number, n: number, opts: { beta?: number; phi?: number; c?: number } = {}): {
  y: number[]; w: CovariateSeries;
} {
  const beta = opts.beta ?? 0, phi = opts.phi ?? 0.6, c = opts.c ?? 10;
  const rng = lcg(seed);
  const y: number[] = [], wv: number[] = [];
  let u = 0;
  for (let t = 0; t < n; t++) {
    const w = Math.floor(t / 50) % 2; // workload class 0/1, 50-tick shifts
    u = phi * u + gaussian(rng);
    y.push(c + beta * w + u);
    wv.push(w);
  }
  return { y, w: { name: 'workload_class', kind: 'workload-class', values: wv } };
}

test('zero covariates = plain AR(p): recovers φ on synthetic AR(1), residual passes whiteness', () => {
  const { y } = makeSeries(101, 1200, { phi: 0.6 });
  const fit = fitCovariateResidualizer(y, []);
  assert.equal(fit.beta.length, 0);
  assert.ok(fit.arOrder >= 1, `AIC should select p ≥ 1 on AR(1) data, got ${fit.arOrder}`);
  assert.ok(Math.abs(fit.phi[0] - 0.6) < 0.08, `φ̂1=${fit.phi[0]} should be near 0.6`);
  assert.ok(fit.whiteness.pass, `one-step residual should be white, ρ̂1=${fit.residualLag1Rho}`);
});

test('an exogenous driver is absorbed: β recovered, one-step RMSE beats the plain arm', () => {
  const { y, w } = makeSeries(202, 1200, { beta: 3, phi: 0.6 });
  const aug = fitCovariateResidualizer(y, [w]);
  const plain = fitCovariateResidualizer(y, []);
  assert.ok(Math.abs(aug.beta[0] - 3) < 0.3, `β̂=${aug.beta[0]} should be near 3`);
  assert.ok(aug.oneStepRmse < plain.oneStepRmse * 0.95,
    `augmented RMSE ${aug.oneStepRmse} should beat plain ${plain.oneStepRmse} by ≥5%`);
  assert.ok(aug.whiteness.pass, `augmented residual should be white, ρ̂1=${aug.residualLag1Rho}`);
});

test('exogeneity lint: system-state names are rejected regardless of declared kind', () => {
  const bad: CovariateSeries = { name: 'gpu_temp_c', kind: 'workload-class', values: [1, 2, 3] };
  assert.throws(() => assertExogenous([bad]), /system-state response/);
  const { y } = makeSeries(303, 200);
  assert.throws(
    () => fitCovariateResidualizer(y, [{ name: 'sm_clock_mhz', kind: 'calendar', values: y.map(() => 1) }]),
    /system-state response/);
});

test('frozen fit, fresh healthy window: standardized one-step residuals are ~N(0,1)', () => {
  const { y, w } = makeSeries(404, 2400, { beta: 3, phi: 0.6 });
  const half = 1200;
  const fit = fitCovariateResidualizer(y.slice(0, half), [{ ...w, values: w.values.slice(0, half) }]);
  const out = oneStepResiduals(fit, y.slice(half), [{ ...w, values: w.values.slice(half) }]);
  const m = mean(out.standardized), s = sd(out.standardized);
  assert.ok(Math.abs(m) < 0.1, `healthy standardized mean ${m} should be ≈0`);
  assert.ok(Math.abs(s - 1) < 0.1, `healthy standardized sd ${s} should be ≈1`);
});

test('a fault in fresh data SURVIVES residualisation — the exogenous covariate cannot absorb it', () => {
  const { y, w } = makeSeries(505, 2400, { beta: 3, phi: 0.6 });
  const half = 1200;
  const fit = fitCovariateResidualizer(y.slice(0, half), [{ ...w, values: w.values.slice(0, half) }]);
  const faulty = y.slice(half).map((v, i) => (i >= 600 ? v + 2.5 : v)); // onset mid-window
  const out = oneStepResiduals(fit, faulty, [{ ...w, values: w.values.slice(half) }]);
  const p = fit.arOrder;
  const pre = out.standardized.slice(0, 600 - p);
  const post = out.standardized.slice(600 - p + 1);
  // AR(1) one-step innovations of a level shift retain (1−φ)·shift persistently after onset.
  const retained = (1 - fit.phi[0]) * 2.5 / Math.sqrt(fit.sigma2);
  assert.ok(mean(post) > mean(pre) + retained * 0.5,
    `post-onset mean ${mean(post)} should exceed pre ${mean(pre)} by ≥ half the retained shift ${retained}`);
});

test('contract guards: covariate order mismatch and length mismatch throw', () => {
  const { y, w } = makeSeries(606, 400, { beta: 1 });
  const w2: CovariateSeries = { name: 'sched_batch', kind: 'scheduler-intent', values: w.values };
  const fit = fitCovariateResidualizer(y, [w, w2]);
  assert.throws(() => oneStepResiduals(fit, y, [w2, w]), /order mismatch/);
  assert.throws(
    () => fitCovariateResidualizer(y, [{ ...w, values: w.values.slice(0, 10) }]),
    /has 10 values/);
});

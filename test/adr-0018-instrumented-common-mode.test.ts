// test/adr-0018-instrumented-common-mode.test.ts — the per-shard loading model on instrumented common-mode.
//
// Given MEASURED factor signals, a per-shard regression removes the common-mode WITHOUT absorbing a fault, so
// localisation works (ADR 0018 — estimating the factors from the GPU signals fails; measuring them works).
// Properties:
//   1. removes the common-mode on healthy shards and PRESERVES a fault on the faulted shard;
//   2. LOCALISES — the faulted shard has the largest residual shift, ≈ the true-factor oracle;
//   3. robust to moderate factor measurement noise; 4. guards.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { instrumentedCommonModeResiduals } from '../fleet/instrumented-common-mode';

function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => { s = ((s * 1664525) + 1013904223) >>> 0; return s / 0x100000000; };
}
function gaussian(rng: () => number): number {
  const u1 = Math.max(rng(), 1e-12), u2 = rng();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

const N = 30, NF = 3, T = 200, REF = 120, B0 = 120, NOISE = 1, DELTA = 10, VICTIM = 0;
const mean = (r: ReadonlyArray<number>, a: number, b: number): number => {
  let s = 0; for (let i = a; i < b; i++) s += r[i]; return s / (b - a);
};
const sd = (r: ReadonlyArray<number>, a: number, b: number): number => {
  const m = mean(r, a, b); let s = 0; for (let i = a; i < b; i++) s += (r[i] - m) ** 2; return Math.sqrt(s / (b - a));
};
const shift = (r: ReadonlyArray<number>): number => mean(r, B0, T) - mean(r, 0, REF);

interface Fleet { X: number[][]; factors: number[][]; membership: number[][]; lamTrue: number[][]; }
function genFleet(seed: number): Fleet {
  const rng = lcg(seed), g = (): number => gaussian(rng);
  // nonstationary measured factors: AR(1) + a per-factor deterministic shape (ramp / sinusoid / drift).
  const factors: number[][] = [];
  for (let k = 0; k < NF; k++) {
    const f = new Array(T); let p = g();
    for (let tt = 0; tt < T; tt++) {
      p = 0.6 * p + 0.8 * g();
      const shape = k === 0 ? 0.03 * tt : k === 1 ? 3 * Math.sin(2 * Math.PI * tt / 90) : 0.02 * tt - 2;
      f[tt] = p + shape;
    }
    factors.push(f);
  }
  const membership: number[][] = [], lamTrue: number[][] = [], X: number[][] = [];
  for (let i = 0; i < N; i++) {
    const dom = i % 2 === 0 ? [0, 1] : [0, 2]; // each shard loads on factor 0 plus one of {1,2} — crossed
    const lam = dom.map(() => 0.4 + 1.2 * rng());
    membership.push(dom); lamTrue.push(lam);
    const row = new Array(T);
    for (let tt = 0; tt < T; tt++) {
      let v = 5 * (i % 7) + NOISE * g();
      for (let a = 0; a < dom.length; a++) v += lam[a] * factors[dom[a]][tt];
      if (i === VICTIM && tt >= B0) v += DELTA;
      row[tt] = v;
    }
    X.push(row);
  }
  return { X, factors, membership, lamTrue };
}

const med = (xs: number[]): number => { const s = [...xs].sort((a, b) => a - b); return s[s.length >> 1]; };
function oracleResiduals(fl: Fleet): number[][] {
  const cf = fl.factors.map((f) => { const c = med(f.slice(0, REF)); return f.map((v) => v - c); });
  return fl.X.map((row, i) => {
    const lvl = med(row.slice(0, REF));
    const out = row.map((v) => v - lvl);
    fl.membership[i].forEach((fk, a) => { for (let tt = 0; tt < T; tt++) out[tt] -= fl.lamTrue[i][a] * cf[fk][tt]; });
    return out;
  });
}

test('instrumented common-mode: removes common-mode, preserves the fault, localises ≈ oracle', () => {
  const fl = genFleet(1);
  const R = instrumentedCommonModeResiduals(fl.X, REF, fl.factors, fl.membership);
  // 1. common-mode removed on healthy shards (residual variance ≪ raw)
  let ratios: number[] = [];
  for (let i = 0; i < N; i++) { if (i === VICTIM) continue; ratios.push(sd(R[i], 0, T) / sd(fl.X[i], 0, T)); }
  assert.ok(med(ratios) < 0.5, `healthy residual/raw sd ratio should be < 0.5; got ${med(ratios).toFixed(3)}`);
  // 2. fault preserved on the victim
  assert.ok(shift(R[VICTIM]) > 0.7 * DELTA, `victim fault should be preserved (> ${(0.7 * DELTA).toFixed(1)}); got ${shift(R[VICTIM]).toFixed(2)}`);
  // 3. LOCALISATION: the victim has the largest |residual shift| of all shards
  const shifts = R.map((r) => Math.abs(shift(r)));
  const argmax = shifts.indexOf(Math.max(...shifts));
  assert.equal(argmax, VICTIM, `victim should be the top-ranked shard by residual shift; got shard ${argmax}`);
  // 4. ≈ oracle: victim's residual shift is close to the true-factor oracle's
  const O = oracleResiduals(fl);
  assert.ok(Math.abs(shift(R[VICTIM]) - shift(O[VICTIM])) < 0.25 * DELTA,
    `instrumented should track the oracle; instr=${shift(R[VICTIM]).toFixed(2)} oracle=${shift(O[VICTIM]).toFixed(2)}`);
});

test('instrumented common-mode: localises under moderate factor measurement noise', () => {
  let hits = 0;
  for (let seed = 1; seed <= 6; seed++) {
    const fl = genFleet(seed);
    const rng = lcg(seed * 31 + 7);
    const noisy = fl.factors.map((f) => { const s = sd(f, 0, T); return f.map((v) => v + 0.1 * s * gaussian(rng)); }); // 10% noise
    const R = instrumentedCommonModeResiduals(fl.X, REF, noisy, fl.membership);
    const shifts = R.map((r) => Math.abs(shift(r)));
    if (shifts.indexOf(Math.max(...shifts)) === VICTIM) hits++;
  }
  assert.ok(hits >= 5, `should localise the victim in most seeds at 10% factor noise; got ${hits}/6`);
});

test('instrumented common-mode: empty membership leaves the level-removed series; ridge is accepted', () => {
  const fl = genFleet(2);
  const R = instrumentedCommonModeResiduals(fl.X, REF, fl.factors, fl.membership.map(() => []));
  // with no factors removed, the residual is just level-removed ⇒ still carries the common-mode (sd ≈ raw)
  assert.ok(sd(R[5], 0, T) > 0.8 * sd(fl.X[5], 0, T), 'empty membership should NOT remove common-mode');
  // ridge path runs and still localises
  const Rr = instrumentedCommonModeResiduals(fl.X, REF, fl.factors, fl.membership, { ridge: 1e-2 });
  const shifts = Rr.map((r) => Math.abs(shift(r)));
  assert.equal(shifts.indexOf(Math.max(...shifts)), VICTIM);
});

test('instrumented common-mode: guards', () => {
  const fl = genFleet(1);
  assert.throws(() => instrumentedCommonModeResiduals([], REF, fl.factors, fl.membership), /at least one shard/);
  assert.throws(() => instrumentedCommonModeResiduals(fl.X, 0, fl.factors, fl.membership), /calLen must be/);
  assert.throws(() => instrumentedCommonModeResiduals(fl.X, REF, [[1, 2, 3]], fl.membership), /factor 0 has length/);
  assert.throws(() => instrumentedCommonModeResiduals(fl.X, REF, fl.factors, [[0]]), /membership has length/);
  assert.throws(() => instrumentedCommonModeResiduals(fl.X, REF, fl.factors, fl.membership.map(() => [99])), /out of range/);
  assert.throws(() => instrumentedCommonModeResiduals(fl.X, REF, fl.factors, fl.membership, { ridge: -1 }), /ridge must be/);
});

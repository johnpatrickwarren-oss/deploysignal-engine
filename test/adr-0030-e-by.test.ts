// ADR 0030 (C62 b): the level-free mixture CS re-inverted at the e-BY level δ|S|/K, and the
// evidence surface carrying the inputs that make that possible.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { eByLevel, eBenjaminiYekutieli } from '../fleet/e-by';
import { mixtureConfidenceSequence, mixtureConfidenceSequenceAt } from '../detectors/mixture-confidence-sequence';
import { buildEvidence } from '../detectors/_evidence';

const lf = { S_t: 12.5, t: 40, sigma_squared: 1, sigma_squared_prior: 1 };

test('the level-free re-inversion reproduces the detector-level CS exactly', () => {
  for (const alpha of [0.05, 0.01, 1e-3, 0.4]) {
    const a = mixtureConfidenceSequence({ ...lf, alpha });
    const b = mixtureConfidenceSequenceAt(lf, alpha);
    assert.deepEqual(a, b);
    const v = lf.sigma_squared * lf.t + lf.sigma_squared_prior;
    const w = Math.sqrt(v * Math.log(v / (alpha * alpha * lf.sigma_squared_prior))) / lf.t;
    assert.ok(Math.abs(b.half_width - w) < 1e-12);
  }
  assert.throws(() => mixtureConfidenceSequenceAt({ ...lf, S_t: NaN }, 0.05), /finite/);
});

test('eByLevel is δ|S|/K with its domain enforced', () => {
  assert.equal(eByLevel(0.1, 3, 20), 0.1 * 3 / 20);
  assert.equal(eByLevel(0.1, 0, 20), 0);
  assert.equal(eByLevel(0.05, 20, 20), 0.05);
  assert.throws(() => eByLevel(0.1, 21, 20), /\|S\|/);
  assert.throws(() => eByLevel(0.1, 1, 0), /K must/);
  assert.throws(() => eByLevel(1, 1, 5), /delta/);
  assert.throws(() => eByLevel(0.1, 1.5, 5), /\|S\|/);
});

test('e-BY intervals are the CS at δ|S|/K per selected signal, wider than at δ, and empty on no selection', () => {
  const sel = [{ id: 'a', level_free: lf }, { id: 'b', level_free: { ...lf, S_t: -3, t: 7 } }];
  const out = eBenjaminiYekutieli(sel, 20, 0.1);
  assert.equal(out.selected_count, 2); assert.equal(out.K, 20); assert.equal(out.alpha_i, 0.1 * 2 / 20);
  assert.equal(out.intervals.length, 2);
  for (const [i, s] of sel.entries()) {
    const cs = mixtureConfidenceSequenceAt(s.level_free, out.alpha_i);
    assert.deepEqual(out.intervals[i], { id: s.id, alpha_i: out.alpha_i, center: cs.center, half_width: cs.half_width, lower: cs.lower, upper: cs.upper });
    assert.ok(out.intervals[i].half_width > mixtureConfidenceSequenceAt(s.level_free, 0.1).half_width);
  }
  const none = eBenjaminiYekutieli([], 20, 0.1);
  assert.equal(none.intervals.length, 0); assert.equal(none.alpha_i, 0);
  assert.match(out.guarantee, /Thm 13\.7/);
  // selecting everything reports at δ itself
  const all = eBenjaminiYekutieli(Array.from({ length: 20 }, (_, i) => ({ id: String(i), level_free: lf })), 20, 0.1);
  assert.equal(all.alpha_i, 0.1);
});

test('the evidence surface carries the CS only when given one; nothing else on it moves', () => {
  const base = { log_wealth: 1, log_increment: 0.1, bet: null, n: 5, threshold: 20, threshold_kind: 'ville' as const, log_peak_wealth: 1 };
  const without = buildEvidence(base);
  assert.ok(!('confidence_sequence' in without));
  const cs = { level_free: lf, alpha: 0.05, ...mixtureConfidenceSequenceAt(lf, 0.05) };
  const withCs = buildEvidence({ ...base, confidence_sequence: cs });
  assert.deepEqual(withCs.confidence_sequence, cs);
  const { confidence_sequence: _c, ...rest } = withCs;
  assert.deepEqual(rest, without);
});

// ── the shipped path: the Family A mixture verdict carries the CS with its level-free inputs ──
import { buildPerDatasetConfig } from '../tools/run-nab-per-dataset';
import { evaluateFamilyAShadowMixture } from '../detectors/_page-cusum-mixture';

test('the shipped mixture verdict carries confidence_sequence with level-free inputs that re-invert to it', () => {
  let seed = 0xBEEF;
  const rng = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
  const values = Array.from({ length: 500 }, () => rng() * 2 - 1);
  const { config } = buildPerDatasetConfig(values, 'p99_latency', 0.15);
  const states = {};
  const ctx = { hourOfDay: 0, ticksSinceDeploy: 10, deployAgeDays: 1, trafficPct: 100 }; // the stub config's single cell is hour 0
  let seen = 0;
  for (let t = 0; t < 30; t++) {
    const out = evaluateFamilyAShadowMixture(config as any, { p99_latency: 0.5 + rng() * 0.1 }, states as any, ctx as any);
    const v = out.find((d) => d.signal === 'p99_latency');
    if (!v?.evidence?.confidence_sequence) continue;
    seen++;
    const cs = v.evidence.confidence_sequence;
    const st = (states as any).p99_latency;
    assert.equal(cs.level_free.t, st.n); assert.equal(cs.level_free.S_t, st.S_t);
    assert.ok(cs.level_free.sigma_squared_prior > 0 && cs.alpha > 0 && cs.alpha < 1);
    const again = mixtureConfidenceSequenceAt(cs.level_free, cs.alpha);
    assert.deepEqual({ center: cs.center, half_width: cs.half_width, lower: cs.lower, upper: cs.upper, excludes_zero: cs.excludes_zero }, again);
    // and e-BY can price it as one of K = 6 signals at δ = 0.1
    const by = eBenjaminiYekutieli([{ id: 'p99_latency', level_free: cs.level_free }], 6, 0.1);
    assert.ok(Math.abs(by.intervals[0].half_width - mixtureConfidenceSequenceAt(cs.level_free, 0.1 / 6).half_width) < 1e-12);
  }
  assert.ok(seen >= 20, `the CS should be on the shipped verdict on most ticks, saw ${seen}`);
});

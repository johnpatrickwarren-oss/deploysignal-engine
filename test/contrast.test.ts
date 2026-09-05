// test/contrast.test.ts — the engine port of Tessera's contrast fit (per-shard/contrast.ts, C81 Part 1).
//
// Two halves. (1) LOCKSTEP against Tessera's COMPILED tools (tessera/tools/contrast.js and
// per-shard-whitening.js, built in place by Tessera's `tsc -p tsconfig.test.json`): every field of
// fitContrast / fitContrastFast / composeFit and every tick of applyContrast over 200 seeded streams
// of mixed φ, offset and scale — the C60 item 5 standard (0 mismatches). Skipped with a message when
// no Tessera checkout is reachable (CI); validation/contrast-null's harness runs the same comparison
// and records the counts in its manifest. (2) The construction's own properties (Tessera's
// test/contrast.test.ts, same seeds) and the envelope.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  fitContrast, fitContrastFast, applyContrast, composeFit, median, madScale,
  estimateContrastAr1, whitenContrast, contrastOf, contrastResidual,
  CONTRAST_NULL_ENVELOPE,
} from '../per-shard/contrast';

function mulberry32(a: number): () => number {
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function gaussian(rng: () => number): number {
  const u1 = Math.max(rng(), 1e-12), u2 = rng();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}
/** A persistent AR(1) contrast with an independent-baseline OFFSET (Tessera's test fixture). */
function offsetAr1(rng: () => number, n: number, phi: number, offset: number, scale: number): number[] {
  const d: number[] = []; let x = gaussian(rng);
  for (let t = 0; t < n; t++) { x = phi * x + Math.sqrt(1 - phi * phi) * gaussian(rng); d.push(offset + scale * x); }
  return d;
}

/** Tessera's compiled tools, from the first checkout that has them (a sibling of the engine checkout,
 *  or of the worktree root two levels up). */
function tesseraTools(): { contrast: any; whitening: any; dir: string } | null {
  const root = path.resolve(__dirname, '..', '..');
  const candidates = [path.resolve(root, '..', 'tessera'), path.resolve(root, '..', '..', '..', 'tessera')];
  for (const dir of candidates) {
    const c = path.join(dir, 'tools', 'contrast.js'), w = path.join(dir, 'tools', 'per-shard-whitening.js');
    if (fs.existsSync(c) && fs.existsSync(w)) {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      return { contrast: require(c), whitening: require(w), dir };
    }
  }
  return null;
}

/** The lockstep comparison, exported for the study harness: counts every compared field/tick. */
export function lockstepAgainstTessera(streams = 200): { comparisons: number; mismatches: number; dir: string } | null {
  const T = tesseraTools();
  if (!T) return null;
  let comparisons = 0, mismatches = 0;
  const eq = (a: number, b: number) => { comparisons++; if (!(a === b || (Number.isNaN(a) && Number.isNaN(b)))) mismatches++; };
  for (let s = 0; s < streams; s++) {
    const rng = mulberry32(1000 + s);
    const phi = [0, 0.3, 0.6, 0.82, 0.95, -0.4][s % 6];
    const n = [40, 60, 300, 1000, 2000][s % 5];
    const d = offsetAr1(rng, n, phi, (s % 7) * 25 - 50, 0.5 + (s % 4));
    const a = fitContrast(d), b = T.contrast.fitContrast(d);
    eq(a.phi, b.phi); eq(a.loc, b.loc); eq(a.scale, b.scale); eq(a.center, b.center);
    const af = fitContrastFast(d), bf = T.contrast.fitContrastFast(d);
    eq(af.phi, bf.phi); eq(af.loc, bf.loc); eq(af.scale, bf.scale); eq(af.center, bf.center);
    const ac = composeFit(a, af), bc = T.contrast.composeFit(b, bf);
    eq(ac.phi, bc.phi); eq(ac.loc, bc.loc); eq(ac.scale, bc.scale); eq(ac.center, bc.center);
    const d2 = offsetAr1(rng, n, phi, (s % 5) * 10, 1 + (s % 3));
    const ra = applyContrast(d2, a), rb = T.contrast.applyContrast(d2, b);
    eq(ra.length, rb.length);
    for (let t = 0; t < ra.length; t++) eq(ra[t], rb[t]);
    const ea = estimateContrastAr1(d), eb = T.whitening.estimateAr1(d);
    eq(ea.phi, eb.phi); eq(ea.sigma2, eb.sigma2);
    eq(whitenContrast(d[3], d[2], a.phi), T.whitening.whiten(d[3], d[2], b.phi));
    eq(whitenContrast(d[0], null, a.phi), T.whitening.whiten(d[0], null, b.phi));
    eq(median(d), T.contrast.median(d)); eq(madScale(d), T.contrast.madScale(d));
  }
  return { comparisons, mismatches, dir: T.dir };
}

test('LOCKSTEP: every field of fitContrast/fitContrastFast/composeFit and every tick of applyContrast equal Tessera\'s compiled tools (200 streams)', (t) => {
  const r = lockstepAgainstTessera(200);
  if (!r) { t.diagnostic('Tessera compiled tools not reachable; lockstep skipped (the study manifest records the count when they are)'); t.skip(); return; }
  assert.ok(r.comparisons > 100_000, `expected > 100k comparisons, got ${r.comparisons}`);
  assert.equal(r.mismatches, 0, `${r.mismatches} of ${r.comparisons} comparisons mismatch against ${r.dir}`);
});

// ── Tessera's own property tests, same seeds (test/contrast.test.ts) ──────────────

test('median/madScale: robust location + scale (MAD×1.4826), floored positive', () => {
  assert.equal(median([3, 1, 2]), 2);
  assert.ok(madScale([0, 0, 0, 0, 10]) >= 1e-9);
  const r = mulberry32(5);
  const s = madScale(Array.from({ length: 2000 }, () => gaussian(r)));
  assert.ok(s > 0.9 && s < 1.1, `MAD scale of N(0,1) ≈ 1, got ${s.toFixed(3)}`);
});

test('CENTERS before whitening: a big baseline offset does not make the seed tick an outlier', () => {
  const d = offsetAr1(mulberry32(12345), 1000, 0.82, 70, 3);
  const std = applyContrast(d, fitContrast(d));
  assert.ok(Math.abs(std[0]) < 5, `seed tick should not carry the offset, got ${std[0].toFixed(1)}σ`);
  assert.ok(Math.max(...std.map(Math.abs)) < 6);
});

test('standardizes a healthy contrast to ~unit scale', () => {
  const d = offsetAr1(mulberry32(7), 1500, 0.6, 40, 2.5);
  const std = applyContrast(d, fitContrast(d));
  const m = std.reduce((s, x) => s + x, 0) / std.length;
  const v = std.reduce((s, x) => s + (x - m) ** 2, 0) / std.length;
  assert.ok(v > 0.5 && v < 2, `got ${v.toFixed(2)}`);
});

test('applyContrast is prefix-stable (causal)', () => {
  const d = offsetAr1(mulberry32(99), 400, 0.7, 10, 2);
  const fit = fitContrast(d);
  const whole = applyContrast(d, fit), prefix = applyContrast(d.slice(0, 120), fit);
  for (let i = 0; i < 120; i++) assert.ok(Math.abs(whole[i] - prefix[i]) < 1e-9);
});

// ── the pair and the envelope ───────────────────────────────────────────────────

test('contrastOf: a shared component cancels tick for tick; a length mismatch is refused', () => {
  const rng = mulberry32(3);
  const shared = Array.from({ length: 500 }, () => 5 * gaussian(rng));
  const u = Array.from({ length: 500 }, () => gaussian(rng)), v = Array.from({ length: 500 }, () => gaussian(rng));
  const d = contrastOf({ treatment: shared.map((c, i) => c + u[i]), control: shared.map((c, i) => c + v[i]) });
  for (let i = 0; i < 500; i++) assert.ok(Math.abs(d[i] - (u[i] - v[i])) < 1e-9);
  assert.throws(() => contrastOf({ treatment: [1, 2, 3], control: [1, 2] }), /same length/);
  const fit = fitContrast(d.slice(0, 300));
  assert.deepEqual(contrastResidual({ treatment: shared.map((c, i) => c + u[i]), control: shared.map((c, i) => c + v[i]) }, fit), applyContrast(d, fit));
});

test('the envelope states the premise and carries the fit lengths as its regime', () => {
  assert.equal(CONTRAST_NULL_ENVELOPE.baseline, 'plug-in');
  assert.equal(CONTRAST_NULL_ENVELOPE.autocorrelation, 'ar1-whitened');
  assert.equal(CONTRAST_NULL_ENVELOPE.variance, 'robust');
  assert.ok(CONTRAST_NULL_ENVELOPE.premise.includes('treatment − control'));
  assert.deepEqual(CONTRAST_NULL_ENVELOPE.fitTicksMeasured, [60, 300, 2000]);
  assert.ok(Object.isFrozen(CONTRAST_NULL_ENVELOPE));
});

// ── the refusal record, pinned to the run; the gate; the registry and the guarantee row ─────────

import { eBenjaminiHochbergGuarded, envelopeFor } from '../fleet/e-bh-guarded';
import { guaranteeFor, ESTIMATED_BASELINE_GUARANTEES, APPROXIMATE_E_VALUE_BY_CONSTRUCTION } from '../guarantees';
import { DETECTOR_REGISTRY, type DetectorId } from '../types/audit';
import { CONTRAST_NULL_RUN } from '../per-shard/contrast';

test('the envelope\'s admission is exactly the registered run\'s P2 cells (validation/contrast-null)', () => {
  const runDir = path.resolve(__dirname, '..', '..', 'validation', 'contrast-null', 'results', 'live', CONTRAST_NULL_RUN);
  const cells = JSON.parse(fs.readFileSync(path.join(runDir, 'cells.json'), 'utf8')) as Array<Record<string, any>>;
  const manifest = JSON.parse(fs.readFileSync(path.join(runDir, 'manifest.json'), 'utf8'));
  assert.equal(manifest.exceptions, 0); assert.equal(manifest.quick, false);
  assert.equal(manifest.p1_study, 'FAILED'); assert.equal(manifest.p3_study, 'FAILED');
  const p2 = cells.filter((c) => c.path === 'contrast' && c.variant === 'null');
  const expected: any[] = []; const seen = new Set<string>();
  for (const x of p2) {
    const k = `${x.construction}|${x.level}|${x.m}`; if (seen.has(k)) continue; seen.add(k);
    const xs = p2.filter((y) => y.construction === x.construction && y.level === x.level && y.m === x.m);
    const rates = xs.map((y) => y.rate_per_1000);
    expected.push({ construction: x.construction, level: x.level, fitTicks: x.m,
      heldOn: xs.filter((y) => y.verdict === 'HELD').map((y) => y.null), failedOn: xs.filter((y) => y.verdict === 'FAILED').map((y) => y.null),
      ratePer1000: [+Math.min(...rates).toFixed(3), +Math.max(...rates).toFixed(3)] });
  }
  assert.deepEqual(JSON.parse(JSON.stringify(CONTRAST_NULL_ENVELOPE.admission)), expected);
  // nothing admitted: the plug-in cards hold on no null below m = 2000, and no m holds on every Gaussian-innovation null
  assert.equal(CONTRAST_NULL_ENVELOPE.validUnderEstimatedBaseline, false);
  assert.equal(CONTRAST_NULL_ENVELOPE.minCalibration, undefined);
  assert.ok(CONTRAST_NULL_ENVELOPE.evidence.includes(CONTRAST_NULL_RUN));
});

test('the gate REFUSES a contrast e-value by name unless the caller asserts fit >> horizon or a true offset', () => {
  assert.equal(envelopeFor('contrast_null_mixture'), CONTRAST_NULL_ENVELOPE);
  assert.equal(envelopeFor('contrast_null_betting'), CONTRAST_NULL_ENVELOPE);
  assert.throws(() => eBenjaminiHochbergGuarded([{ detectorId: 'contrast_null_mixture', eValue: 50 }], 0.1), /INVALID under an estimated baseline/);
  const admitted = eBenjaminiHochbergGuarded([{ detectorId: 'contrast_null_mixture', eValue: 50, assertions: { mMuchGreaterThanN: true } }], 0.1);
  assert.equal(admitted.selected.length, 1, 'e = 50 against K/(q·k) = 10: selected once the caller asserts the regime');
  assert.doesNotThrow(() => eBenjaminiHochbergGuarded([{ detectorId: 'contrast_null_betting', eValue: 50, assertions: { trueBaseline: true } }], 0.1));
});

test('the six contrast_null_{signal} ids are registered and resolve to the refusal row', () => {
  for (const sig of ['p99_latency', 'ttft', 'eval_score', 'tool_success_rate', 'downstream_err', 'cost_req']) {
    const id = `contrast_null_${sig}` as DetectorId;
    assert.ok((DETECTOR_REGISTRY.A as readonly string[]).includes(id), `${id} not in DETECTOR_REGISTRY.A`);
    const row = guaranteeFor(id)!;
    assert.equal(row.estimatedBaseline, CONTRAST_NULL_ENVELOPE, 'the live envelope object, not a copy');
    assert.equal(row.approximateEValue.form, 'epsilon_growing');
    assert.ok(row.evidence.includes(CONTRAST_NULL_RUN) && row.evidence.includes('REFUSED'));
  }
  assert.equal(ESTIMATED_BASELINE_GUARANTEES.contrast_null, CONTRAST_NULL_ENVELOPE);
  assert.equal(APPROXIMATE_E_VALUE_BY_CONSTRUCTION.contrast_null.form, 'epsilon_growing');
});

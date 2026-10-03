// ADR 0042 REJECTED 2026-10-03 (validation/twin-two-sample/REPORT.md): this construction has no designed null on arms
// that carry memory and cannot be given the sign kind's margin property. Retained as the study's instrument only;
// not a kind the twin gate offers; not consumed by DeploySignal. Do not wire into a gate.
// detectors/twin-two-sample.ts — ADR 0042: a two-sample betting kind between the twin's arms (Family C's
// Shekhar–Ramdas construction re-homed on a designed null). Per tick one vector per arm; a swap-equivariant
// coordinate-wise margin shrinks the pair toward each other by the declared band; standardization and the
// kernel-MMD witness are built from PAST ticks only (predictable); the payoff F_t = f_{t−1}(x'_t) − f_{t−1}(y'_t)
// has E[F_t | past] = 0 under exchangeability of the arms, so S_t = Π (1 + λ_{t−1} F_t) with |λ| ≤ ½ and
// |F| ≤ 1 is a test supermartingale; fires at 1/α (Ville). No proceed side. The engine estimates nothing the
// bound depends on: the witness and the scale are power devices.

import { rbf } from './sequential-mmd';
import { ONS_STEP_SIZE_C } from './_family-c-betting-witness';

export interface TwinTwoSampleCoordinate { id: string; margin?: { relative?: number; absolute?: number } }
export interface TwinTwoSampleSpec {
  id: string; alpha: number; coordinates: readonly TwinTwoSampleCoordinate[];
  /** past pairs the witness averages over (default 200) */ window?: number;
  /** past pairs the local level and scale are taken from (default 20): a shared slow drift (seasonality) that both
   *  arms carry is removed by centring on the recent past; predictable, applied identically to both arms */ localWindow?: number;
  lambdaMax?: number;
}

export interface TwinTwoSampleState {
  pastX: number[][]; pastY: number[][];           // standardized, margin-shrunk past pairs (bounded by window)
  recent: number[][];                                // the last localWindow margin-shrunk RAW vectors of both arms, for the local level and scale
  fMax: number;                                      // running max of past |F| before normalization (Shekhar–Ramdas running-max normalization; predictable)
  lambda: number; invHessian: number; logS: number;
  used: number; missing: number; fired: boolean; firedAt: number | null;
}
export interface TwinTwoSampleStep { state: TwinTwoSampleState; F: number | null; wealth: number; threshold: number; fire: boolean }

const BANDWIDTH_WARMUP = 10;

export function checkTwinTwoSampleSpec(spec: TwinTwoSampleSpec): void {
  if (!(typeof spec.id === 'string' && spec.id.length > 0)) throw new RangeError('twin-two-sample: id required');
  if (!(spec.alpha > 0 && spec.alpha < 1)) throw new RangeError(`twin-two-sample: ${spec.id}: alpha must lie in (0, 1)`);
  if (!Array.isArray(spec.coordinates) || spec.coordinates.length === 0) throw new RangeError(`twin-two-sample: ${spec.id}: at least one coordinate`);
  for (const c of spec.coordinates) {
    if (c.margin !== undefined) {
      const { relative, absolute } = c.margin;
      if (relative === undefined && absolute === undefined) throw new RangeError(`twin-two-sample: ${spec.id}/${c.id}: margin needs relative or absolute`);
      if (relative !== undefined && !(Number.isFinite(relative) && relative >= 0)) throw new RangeError(`twin-two-sample: ${spec.id}/${c.id}: margin.relative must be finite and >= 0`);
      if (absolute !== undefined && !(Number.isFinite(absolute) && absolute >= 0)) throw new RangeError(`twin-two-sample: ${spec.id}/${c.id}: margin.absolute must be finite and >= 0`);
    }
  }
  if (spec.window !== undefined && !(Number.isInteger(spec.window) && spec.window >= 2)) throw new RangeError(`twin-two-sample: ${spec.id}: window must be an integer >= 2`);
  if (spec.localWindow !== undefined && !(Number.isInteger(spec.localWindow) && spec.localWindow >= 2)) throw new RangeError(`twin-two-sample: ${spec.id}: localWindow must be an integer >= 2`);
  if (spec.lambdaMax !== undefined && !(spec.lambdaMax > 0 && spec.lambdaMax <= 0.5)) throw new RangeError(`twin-two-sample: ${spec.id}: lambdaMax must lie in (0, 0.5]`);
}

export function initTwinTwoSample(spec: TwinTwoSampleSpec): TwinTwoSampleState {
  checkTwinTwoSampleSpec(spec);
  const d = spec.coordinates.length;
  void d;
  return { pastX: [], pastY: [], recent: [], fMax: 0, lambda: 0, invHessian: 1, logS: 0, used: 0, missing: 0, fired: false, firedAt: null };
}

/** ADR 0042 §1: shrink the pair toward each other by the band; swapping x and y swaps the outputs. */
export function shrinkPair(spec: TwinTwoSampleSpec, x: readonly number[], y: readonly number[]): { x: number[]; y: number[] } {
  const xs = new Array<number>(x.length), ys = new Array<number>(y.length);
  for (let i = 0; i < x.length; i++) {
    const m = spec.coordinates[i].margin; const rel = m?.relative ?? 0, abs = m?.absolute ?? 0;
    const b = rel * (Math.abs(x[i]) + Math.abs(y[i])) / 2 + abs;
    const c = (x[i] + y[i]) / 2, d = x[i] - y[i];
    const dd = Math.sign(d) * Math.max(0, Math.abs(d) - b);
    xs[i] = c + dd / 2; ys[i] = c - dd / 2;
  }
  return { x: xs, y: ys };
}

/** Local level and scale from the recent pooled past (both arms), identical for both arms: predictable. */
function standardize(state: TwinTwoSampleState, v: readonly number[]): number[] {
  const out = new Array<number>(v.length); const R = state.recent; const n = R.length;
  for (let i = 0; i < v.length; i++) {
    if (n < 4) { out[i] = v[i]; continue; }
    let s = 0, ss = 0; for (const r of R) { s += r[i]; ss += r[i] * r[i]; }
    const mean = s / n; const varr = Math.max(0, ss / n - mean * mean); const sd = varr > 0 ? Math.sqrt(varr) : 1;
    out[i] = (v[i] - mean) / sd;
  }
  return out;
}

function medianPairwiseDistance(pts: number[][]): number {
  const ds: number[] = [];
  const m = Math.min(pts.length, 40); // cap the pairwise set at 40 points (780 pairs) for cost; predictable
  for (let i = 0; i < m; i++) for (let j = i + 1; j < m; j++) { let s = 0; for (let k = 0; k < pts[i].length; k++) { const d = pts[i][k] - pts[j][k]; s += d * d; } ds.push(Math.sqrt(s)); }
  if (ds.length === 0) return 1;
  ds.sort((a, b) => a - b); const med = ds[Math.floor(ds.length / 2)];
  return med > 0 ? med : 1;
}

/** The predictable witness at z: mean kernel to past canary vectors minus mean kernel to past control vectors. */
function witness(state: TwinTwoSampleState, z: number[], bw: number): number {
  if (state.pastX.length === 0 || state.pastY.length === 0) return 0;
  let a = 0; for (const p of state.pastX) a += rbf(z, p, bw); a /= state.pastX.length;
  let b = 0; for (const p of state.pastY) b += rbf(z, p, bw); b /= state.pastY.length;
  return a - b;
}

export function stepTwinTwoSample(spec: TwinTwoSampleSpec, state: TwinTwoSampleState, x: readonly number[], y: readonly number[]): TwinTwoSampleStep {
  const threshold = 1 / spec.alpha; const lambdaMax = spec.lambdaMax ?? 0.5; const window = spec.window ?? 200; const local = spec.localWindow ?? 20;
  const wealth = Math.exp(state.logS);
  if (state.fired) return { state, F: null, wealth, threshold, fire: true };
  if (x.length !== spec.coordinates.length || y.length !== spec.coordinates.length) throw new RangeError(`twin-two-sample: ${spec.id}: vectors must have ${spec.coordinates.length} coordinates`);
  if (!x.every(Number.isFinite) || !y.every(Number.isFinite)) return { state: { ...state, missing: state.missing + 1 }, F: null, wealth, threshold, fire: false };
  // 1. margin, 2. standardize from the past, 3. witness from the past, 4. bet with the predictable λ
  const shr = shrinkPair(spec, x, y);
  const xs = standardize(state, shr.x), ys = standardize(state, shr.y);
  const pooled = state.pastX.concat(state.pastY);
  const bw = pooled.length >= BANDWIDTH_WARMUP ? medianPairwiseDistance(pooled) : 1;
  // raw payoff in [−1, 1]; normalized by the running max of PAST |F| once ten ticks are in (the canonical
  // construction's running-max normalization; predictable since fMax reflects only past ticks), then clamped
  const raw = witness(state, xs, bw) - witness(state, ys, bw);
  const F = Math.max(-1, Math.min(1, state.used > BANDWIDTH_WARMUP && state.fMax > 0 ? raw / state.fMax : raw));
  const factor = 1 + state.lambda * F;
  const logS = state.logS + Math.log(Math.max(factor, 1e-12));
  // ONS update (_family-c-betting-witness.ts onsUpdate), inlined on this state
  let lambda = state.lambda, invH = state.invHessian;
  const denom = 1 + lambda * F;
  if (Math.abs(denom) >= 1e-12) { const z = -F / denom; invH += z * z; lambda = Math.max(-lambdaMax, Math.min(lambdaMax, lambda - (ONS_STEP_SIZE_C * z) / invH)); }
  // then admit the tick to the past (after scoring: predictability)
  const pastX = state.pastX.length >= window ? state.pastX.slice(1).concat([xs]) : state.pastX.concat([xs]);
  const pastY = state.pastY.length >= window ? state.pastY.slice(1).concat([ys]) : state.pastY.concat([ys]);
  let recent = state.recent.concat([shr.x, shr.y]); if (recent.length > 2 * local) recent = recent.slice(recent.length - 2 * local);
  const used = state.used + 1; const w = Math.exp(logS); const fire = w >= threshold;
  return { state: { pastX, pastY, recent, fMax: Math.max(state.fMax, Math.abs(raw)), lambda, invHessian: invH, logS, used, missing: state.missing, fired: fire, firedAt: fire ? used : null }, F, wealth: w, threshold, fire };
}

# Randomized-Twin Deploy Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Tasks 9–10 are a registered study: execute them under the `run-study` skill.

**Goal:** Give DeploySignal a detector that can be pointed at any service metric and returns rollback / proceed / extend with an error guarantee that does not depend on any estimated baseline, by comparing the canary against a concurrent control arm under randomized routing.

**Architecture:** One primitive: a one-sided bounded-mean betting e-process whose null mean is observed or fixed, never estimated (`detectors/_paired-bet.ts`). Two metric kinds reduce to it (`detectors/twin-contrast.ts`):
- **`rate`:** the canary's share of a tick's bad events, tested against its traffic share. Conditional on the arm totals and the event total, that share is Fisher-noncentral-hypergeometric in the odds ratio. It is exact at any routing split.
- **`sign`:** whether the canary's tick value is worse than the control's, tested against 1/2. It is exact when the two arms have equal routing weight.

A fusion module (`per-shard/twin-gate.ts`) runs two tests per metric, one for rollback and one for proceed, plus a sample-ratio guard. It emits `rollback | proceed | extend | inconclusive | invalid_experiment`. Estimation is allowed to affect power and bake-length planning (`per-shard/twin-planning.ts`), never validity.

**Tech Stack:** TypeScript (CommonJS, ES2020), `node:test`, `node:assert/strict`; study harness in `.mjs` driving `dist/` via `createRequire`.

**Spec:** ADR 0036, written in Task 1 (`decisions/0036-randomized-twin-gate.md`). Background:
- `knowledge/stats/pages/contrast-null.md`: the shared component cancels exactly, and the estimated offset is what killed ADR 0032.
- `knowledge/stats/pages/nab-null-survival-2026-09-04.md`: fitted temporal baselines fail on real telemetry.
- `knowledge/methodology/pages/threshold-free-observability.md`: claim (1).

## Global Constraints

- **Validity must not depend on an estimated quantity.** Every null mean the rollback or proceed wealth bets against is observed in the same tick (traffic share, arm totals) or fixed by the null (1/2). An estimate may set λ (predictably, from past ticks only) or a planning figure, nothing else.
- **Every new envelope carries `pairingPremise`,** and `assertValidForFdrPath` refuses a twin e-value unless the caller asserts `randomizedArms` (and `equalWeightArms` for `sign`).
- **The `sign` kind requires `canaryWeight === 0.5`.** `checkTwinGateConfig` throws otherwise.
- **Wealth is kept in the log domain** through `detectors/_wealth.ts` (`advanceLogWealth`, `wealthView`).
- **Library boundary (ADR 0033):** new files live in `detectors/` and `per-shard/` and import only library modules. `test/library-boundary.test.ts` enforces this.
- **Do not edit the vendored files** `detectors/betting-e-process.ts` and `detectors/family-a-mixture-supermartingale.ts`.
- **Study discipline:** `validation/twin-null/PREREGISTRATION.md` is committed before any harness code. No study number appears in code, ADR, CHANGELOG or wiki before the run.
- **This plan changes no rollback authority in DeploySignal.** Authority is Follow-on Plan B, conditional on the study (Task 10) and the real-service A/A test (Plan D).
- **Concurrent sessions:** before every commit, run `git rev-parse --abbrev-ref HEAD` (must print `main`) and `git status --porcelain`. Commit with a pathspec (`git commit -m … -- <paths>`). If HEAD is not `main`, stop and report.
- **Build and test:** `npm test` (= `tsc && node --test dist/test/*.test.js`). A single file: `npx tsc && node --test dist/test/<name>.test.js`.
- **Commit trailer:** `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`

## File Structure

| File | Responsibility |
|---|---|
| `decisions/0036-randomized-twin-gate.md` (create) | The decision, the premise, what is and is not claimed |
| `detectors/validity-envelope.ts` (modify) | New union members, `pairingPremise`, two assertions, `pairingAdmissible` in the FDR gate |
| `detectors/_paired-bet.ts` (create) | One-sided bounded-mean betting e-process with per-observation null mean |
| `detectors/twin-contrast.ts` (create) | Metric kinds → canary-worse score + null means; per-metric rollback/proceed state; two envelopes |
| `per-shard/twin-gate.ts` (create) | Multi-metric fusion, sample-ratio guard, verdict, sticky terminal states |
| `per-shard/twin-planning.ts` (create) | Ticks-to-detect planning figure (power only) |
| `guarantees.ts` (modify) | Two guarantee rows, two `ESTIMATED_BASELINE_GUARANTEES` keys, two approximate-e-value entries |
| `test/_seeded.ts` (create) | Seeded LCG and Poisson sampler for tests |
| `test/adr-0036-twin-envelope.test.ts`, `test/paired-bet.test.ts`, `test/twin-contrast.test.ts`, `test/twin-gate.test.ts`, `test/twin-planning.test.ts` (create) | Unit and Monte Carlo property tests |
| `validation/twin-null/PREREGISTRATION.md` (create, Task 9) | Registered study |
| `validation/twin-null/harness/run.mjs` (create, Task 10) | Study harness |
| `CHANGELOG.md` (modify) | `## Unreleased` entry |

---

### Task 1: ADR 0036 and the pairing premise in the validity envelope

**Files:**
- Create: `decisions/0036-randomized-twin-gate.md`
- Modify: `detectors/validity-envelope.ts` (unions at lines 19–39, `ValidityEnvelope` interface ending line 101, `FdrPathAssertions` ending line 198, `isValidForFdrPath` ~line 225, `assertValidForFdrPath` ~line 243)
- Test: `test/adr-0036-twin-envelope.test.ts`

**Interfaces:**
- Produces:
  - `BaselineKind` gains `'randomized-twin'`, `AutocorrelationKind` gains `'shared-cancels'`, `NullKind` gains `'paired-order'`, and `VarianceKind` gains `'none'`.
  - `ValidityEnvelope.pairingPremise?: 'exchangeable-arms' | 'exchangeable-equal-weight-arms'`
  - `FdrPathAssertions.randomizedArms?: boolean` and `FdrPathAssertions.equalWeightArms?: boolean`
  - `export function pairingAdmissible(env: ValidityEnvelope, assertions?: FdrPathAssertions): boolean`

- [ ] **Step 1: Write the ADR**

Create `decisions/0036-randomized-twin-gate.md`:

```markdown
# ADR 0036 — The randomized twin: a deploy null by construction, with nothing estimated

- **Date:** 2026-09-25
- **Status:** PROPOSED. Library only; no consumer authority. Study `2026-09-twin-null` registered
  (validation/twin-null/PREREGISTRATION.md), not run.
- **Register:** ADR 0032 (the contrast null, refused on its estimated offset); knowledge
  `stats/contrast-null`, `stats/nab-null-survival-2026-09-04`,
  `methodology/threshold-free-observability` claim (1).

## The gap

Every construction the portfolio gates on tests against a baseline estimated from history. The
envelopes say so (`validUnderEstimatedBaseline: false` for both Family A wealths), NAB null-survival
measured the plug-in false-alert rate flat in calibration length on real telemetry, and ADR 0032's
contrast null — which cancels the shared component exactly — was refused on the offset it
estimates from a fit window. A detector meant for any metric on any service cannot carry a fitted
baseline, because nobody will fit and certify one per metric.

## Decision

Test the canary against a CONCURRENT control arm on the old version under RANDOMIZED per-request
routing, with statistics whose null mean is observed in the same tick or fixed, so that no
parameter is estimated:

- `rate` — per tick, the canary's share X = b_c / (b_c + b_k) of bad events. Conditional on the arm
  totals and the bad-event total, b_c is Fisher noncentral hypergeometric in the odds ratio ψ of the
  arms' per-request bad-event probabilities. Rollback null ψ ≤ 1 ⇒ E[X] ≤ n_c / (n_c + n_k), the
  observed traffic share. Proceed null ψ ≥ 1 + ρ ⇒ E[X] ≥ the noncentral mean at 1 + ρ, computed
  exactly from the observed totals. Valid at any routing split.
- `sign` — per tick, S = 1 if the canary's value is worse than the control's. Under exchangeable
  arms of equal routing weight P(S = 1 | no tie) = 1/2. Proceed null P ≥ 1/2 + τ.

Each null is a bounded mean with a known null value, tested by the one-sided betting e-process
`detectors/_paired-bet.ts` (λ predictable, capped at half the positivity bound). Ville bounds
every look. Across N metrics rollback uses N/α (Bonferroni, valid under any dependence); proceed
requires every metric's proceed wealth over 1/α_P (intersection–union, no split). A sample-ratio
guard on the traffic share returns `invalid_experiment`.

## The premise, stated

`pairingPremise: 'exchangeable-arms'`: under H0, within a tick each arm's requests share one
per-request bad-event probability, equal between arms given the past. What the two arms share —
traffic level, seasonality, a shared outage, any shared autocorrelation — cancels by conditioning.
What does NOT cancel, and breaks validity, is ARM-SPECIFIC persistent state under H0: a cold
canary fleet, a control arm pinned to a degraded host, an AZ imbalance. `sign` additionally needs
equal routing weights (`exchangeable-equal-weight-arms`): with unequal arm sizes a skewed tick
statistic has different medians in the two arms. The study measures both boundaries.

Not premised: tails, scale, φ of shared components, a baseline, a calibration length.

## Consequences

- The FDR gate learns a third premise axis (`pairingAdmissible`) beside φ and tails.
- Rollback authority in DeploySignal is out of scope; it is conditional on the registered study
  and a real-service A/A test.
- Deployment topology matters: a CodeDeploy-style canary against the warm production fleet
  violates the premise at start-up (cold canary). A fresh control arm on the old version at the
  canary's weight satisfies it; a warm-up exclusion window is the fallback the study prices.
```

- [ ] **Step 2: Write the failing test**

Create `test/adr-0036-twin-envelope.test.ts`:

```ts
// test/adr-0036-twin-envelope.test.ts — ADR 0036: the pairing premise is part of the envelope, and
// the FDR gate asks for it.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  type ValidityEnvelope,
  BETTING_E_PROCESS_ENVELOPE,
  pairingAdmissible,
  isValidForFdrPath,
  assertValidForFdrPath,
} from '../detectors/validity-envelope';

const RATE_LIKE: ValidityEnvelope = {
  baseline: 'randomized-twin',
  autocorrelation: 'shared-cancels',
  null: 'paired-order',
  variance: 'none',
  validUnderEstimatedBaseline: true,
  statistic: 'e-value',
  pairingPremise: 'exchangeable-arms',
};
const SIGN_LIKE: ValidityEnvelope = { ...RATE_LIKE, pairingPremise: 'exchangeable-equal-weight-arms' };

test('an envelope without a pairing premise is unconstrained on this axis', () => {
  assert.equal(pairingAdmissible(BETTING_E_PROCESS_ENVELOPE, {}), true);
});

test('exchangeable-arms refuses without randomizedArms and admits with it', () => {
  assert.equal(pairingAdmissible(RATE_LIKE, {}), false);
  assert.equal(pairingAdmissible(RATE_LIKE, { randomizedArms: true }), true);
});

test('equal-weight premise needs both assertions', () => {
  assert.equal(pairingAdmissible(SIGN_LIKE, { randomizedArms: true }), false);
  assert.equal(pairingAdmissible(SIGN_LIKE, { equalWeightArms: true }), false);
  assert.equal(pairingAdmissible(SIGN_LIKE, { randomizedArms: true, equalWeightArms: true }), true);
});

test('isValidForFdrPath composes the pairing axis', () => {
  assert.equal(isValidForFdrPath(RATE_LIKE, {}), false);
  assert.equal(isValidForFdrPath(RATE_LIKE, { randomizedArms: true }), true);
});

test('assertValidForFdrPath names the missing pairing assertion', () => {
  assert.throws(() => assertValidForFdrPath(SIGN_LIKE, { randomizedArms: true }), /equalWeightArms/);
  assert.doesNotThrow(() => assertValidForFdrPath(SIGN_LIKE, { randomizedArms: true, equalWeightArms: true }));
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `npx tsc`
Expected: compile errors: `'randomized-twin'` is not assignable to `BaselineKind`, and `pairingAdmissible` has no exported member.

- [ ] **Step 4: Implement**

In `detectors/validity-envelope.ts`:

Extend the unions:

```ts
export type BaselineKind =
  | 'true'                    // a known, exact baseline (no estimation error)
  | 'plug-in'                 // a point estimate μ̂ frozen from a finite calibration window
  | 'unknown-mean-integrated' // the baseline mean is integrated out under a proper prior (right-Haar)
  | 'unknown-mean-mle'        // the mean is profiled out by an MLE over the null (universal inference)
  | 'randomized-twin';        // no baseline: a concurrent control arm under randomized routing (ADR 0036)

export type AutocorrelationKind =
  | 'iid'
  | 'ar1-whitened'
  | 'ar1-any-phi'             // valid for any φ without whitening (UI / sequential UI)
  | 'shared-cancels';         // any dependence SHARED by both arms cancels by conditioning (ADR 0036);
                              // arm-specific persistence is the pairing premise, not this axis
```

```ts
export type NullKind = 'mean-shift' | 'paired-order';
```

```ts
export type VarianceKind =
  | 'stable'
  | 'robust'
  | 'unknown-mle'             // σ profiled out rather than plugged in
  | 'none';                   // the statistic uses no scale (ADR 0036)
```

Add to `ValidityEnvelope`, after `tailPremise`:

```ts
  /** ADR 0036 — the PAIRING premise of a canary-vs-control statistic. Its null mean is observed
   *  (the traffic share) or fixed (1/2), so nothing is estimated; what validity rests on instead is
   *  the design:
   *    'exchangeable-arms'              — randomized per-request routing and no arm-specific
   *                                       persistent state under H0 (a cold canary fleet, a control
   *                                       pinned to a degraded host break it);
   *    'exchangeable-equal-weight-arms' — the above plus equal routing weights (the sign kind: a
   *                                       skewed tick statistic has different medians in arms of
   *                                       different size).
   *  An envelope carrying one REFUSES unless the caller asserts `randomizedArms` (and
   *  `equalWeightArms` for the second). */
  pairingPremise?: 'exchangeable-arms' | 'exchangeable-equal-weight-arms';
```

Add to `FdrPathAssertions`, after `incrementMean`:

```ts
  /** ADR 0036 — canary and control receive requests by randomized per-request routing and share
   *  everything under H0 but the version under test (no arm-specific persistent state). */
  randomizedArms?: boolean;
  /** ADR 0036 — the two arms carry equal routing weight. Needed by the 'sign' twin kind. */
  equalWeightArms?: boolean;
```

Add the check after `tailAdmissible`:

```ts
/** ADR 0036 — does the caller satisfy the envelope's pairing premise? An envelope without one is
 *  unconstrained here. */
export function pairingAdmissible(env: ValidityEnvelope, assertions: FdrPathAssertions = {}): boolean {
  if (env.pairingPremise === undefined) return true;
  if (!assertions.randomizedArms) return false;
  return env.pairingPremise === 'exchangeable-arms' || Boolean(assertions.equalWeightArms);
}
```

In `isValidForFdrPath`, change the return to:

```ts
  return phiAdmissible(env, assertions)
    && tailAdmissible(env, assertions)
    && pairingAdmissible(env, assertions)
    && (env.validUnderEstimatedBaseline
      || Boolean(assertions.trueBaseline || assertions.mMuchGreaterThanN));
```

At the end of `assertValidForFdrPath`, after the tail-premise block:

```ts
  if (!pairingAdmissible(env, assertions)) {
    const need = env.pairingPremise === 'exchangeable-equal-weight-arms'
      ? '{ randomizedArms, equalWeightArms }'
      : '{ randomizedArms }';
    throw new Error(
      `validity-envelope: this twin e-value's null is the design, not an estimate — assert ${need} `
      + 'only where canary and control receive randomized per-request routing'
      + (env.pairingPremise === 'exchangeable-equal-weight-arms' ? ' at equal weights' : '')
      + ' and share everything under H0 but the version under test (ADR 0036).',
    );
  }
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm test`
Expected: all tests pass, including the 5 new ones.

- [ ] **Step 6: Commit**

```bash
git rev-parse --abbrev-ref HEAD   # must print main
git add decisions/0036-randomized-twin-gate.md detectors/validity-envelope.ts test/adr-0036-twin-envelope.test.ts
git commit -m "ADR 0036: pairing premise in the validity envelope

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- decisions/0036-randomized-twin-gate.md detectors/validity-envelope.ts test/adr-0036-twin-envelope.test.ts
```

---

### Task 2: The paired-bet primitive

**Files:**
- Create: `detectors/_paired-bet.ts`
- Create: `test/_seeded.ts`
- Test: `test/paired-bet.test.ts`

**Interfaces:**
- Consumes: `advanceLogWealth`, `wealthView` from `detectors/_wealth.ts`
- Produces:
  - `interface PairedBetSpec { lo: number; hi: number; nullMean: number }`
  - `interface PairedBetState { log_K: number; n: number; sumY: number; sumY2: number }`
  - `PAIRED_BET_MAX_FRACTION = 0.5`
  - `initPairedBet(): PairedBetState`
  - `pairedBetLambdaMax(spec: PairedBetSpec): number`
  - `pairedBetLambda(state: PairedBetState, spec: PairedBetSpec): number`
  - `updatePairedBet(state: PairedBetState, spec: PairedBetSpec, x: number): PairedBetState`
  - `pairedBetWealth(state: PairedBetState): number`
  - `test/_seeded.ts`: `lcg(seed: number): () => number` and `poisson(rng: () => number, mean: number): number`

- [ ] **Step 1: Write the seeded helpers**

Create `test/_seeded.ts`:

```ts
// test/_seeded.ts — deterministic generators for the twin tests (ADR 0036). Not a test file: the
// runner's glob is dist/test/*.test.js.

/** 32-bit LCG (Numerical Recipes constants), output in (0, 1). */
export function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return (s + 0.5) / 4294967296;
  };
}

/** Poisson draw: Knuth below mean 30, rounded normal approximation above. */
export function poisson(rng: () => number, mean: number): number {
  if (mean <= 0) return 0;
  if (mean > 30) {
    const z = Math.sqrt(-2 * Math.log(rng())) * Math.cos(2 * Math.PI * rng());
    return Math.max(0, Math.round(mean + Math.sqrt(mean) * z));
  }
  const L = Math.exp(-mean);
  let k = 0;
  let p = 1;
  do { k++; p *= rng(); } while (p > L);
  return k - 1;
}
```

- [ ] **Step 2: Write the failing test**

Create `test/paired-bet.test.ts`:

```ts
// test/paired-bet.test.ts — ADR 0036: the one-sided bounded-mean betting e-process.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  type PairedBetSpec,
  initPairedBet, pairedBetLambda, pairedBetLambdaMax, updatePairedBet, pairedBetWealth,
} from '../detectors/_paired-bet';
import { lcg } from './_seeded';

const HALF: PairedBetSpec = { lo: 0, hi: 1, nullMean: 0.5 };

function feed(spec: PairedBetSpec, xs: number[]) {
  let s = initPairedBet();
  for (const x of xs) s = updatePairedBet(s, spec, x);
  return s;
}

test('each factor has conditional mean exactly 1 at the null boundary (two-point law)', () => {
  const specs: PairedBetSpec[] = [HALF, { lo: 0, hi: 1, nullMean: 0.1 }, { lo: -1, hi: 1, nullMean: -0.3 }];
  const rng = lcg(1);
  for (const spec of specs) {
    for (let k = 0; k < 50; k++) {
      const hist = Array.from({ length: 1 + Math.floor(rng() * 40) }, () => spec.lo + rng() * (spec.hi - spec.lo));
      const lam = pairedBetLambda(feed(spec, hist), spec);
      const pHi = (spec.nullMean - spec.lo) / (spec.hi - spec.lo);
      const e = pHi * (1 + lam * (spec.hi - spec.nullMean)) + (1 - pHi) * (1 + lam * (spec.lo - spec.nullMean));
      assert.ok(Math.abs(e - 1) < 1e-12, `E[factor] = ${e}`);
    }
  }
});

test('lambda stays in [0, lambdaMax] and every factor is at least 1/2', () => {
  const rng = lcg(2);
  const spec: PairedBetSpec = { lo: 0, hi: 1, nullMean: 0.2 };
  const lamMax = pairedBetLambdaMax(spec);
  let s = initPairedBet();
  for (let t = 0; t < 5000; t++) {
    const lam = pairedBetLambda(s, spec);
    assert.ok(lam >= 0 && lam <= lamMax, `lambda ${lam}`);
    assert.ok(1 + lam * (spec.lo - spec.nullMean) >= 0.5 - 1e-12);
    s = updatePairedBet(s, spec, rng() < 0.9 ? 1 : 0);
  }
});

test('Ville: under H0 the wealth crosses 1/alpha in at most alpha of runs (MC, 3 SE)', () => {
  const rng = lcg(3);
  const R = 2000, T = 500, alpha = 0.05;
  let crossed = 0;
  for (let r = 0; r < R; r++) {
    let s = initPairedBet();
    for (let t = 0; t < T; t++) {
      s = updatePairedBet(s, HALF, rng() < 0.5 ? 1 : 0);
      if (pairedBetWealth(s) >= 1 / alpha) { crossed++; break; }
    }
  }
  const bar = alpha + 3 * Math.sqrt(alpha * (1 - alpha) / R);
  assert.ok(crossed / R <= bar, `crossing rate ${crossed / R} > ${bar}`);
});

test('power: P(X=1) = 0.7 crosses 1/alpha within 500 ticks in at least 95% of runs', () => {
  const rng = lcg(4);
  const R = 400, T = 500, alpha = 0.05;
  let crossed = 0;
  for (let r = 0; r < R; r++) {
    let s = initPairedBet();
    for (let t = 0; t < T; t++) {
      s = updatePairedBet(s, HALF, rng() < 0.7 ? 1 : 0);
      if (pairedBetWealth(s) >= 1 / alpha) { crossed++; break; }
    }
  }
  assert.ok(crossed / R >= 0.95, `power ${crossed / R}`);
});

test('NaN holds the state; out-of-range throws; a bad spec throws', () => {
  const s = feed(HALF, [1, 0, 1]);
  assert.deepEqual(updatePairedBet(s, HALF, Number.NaN), s);
  assert.throws(() => updatePairedBet(s, HALF, 1.5), RangeError);
  assert.throws(() => pairedBetLambdaMax({ lo: 0, hi: 1, nullMean: 0 }), RangeError);
  assert.throws(() => pairedBetLambdaMax({ lo: 0, hi: 1, nullMean: 1.2 }), RangeError);
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `npx tsc`
Expected: FAIL. `Cannot find module '../detectors/_paired-bet'`.

- [ ] **Step 4: Implement**

Create `detectors/_paired-bet.ts`:

```ts
// detectors/_paired-bet.ts — ADR 0036: the one-sided bounded-mean betting e-process every
// randomized-twin statistic reduces to.
//
// H0: E[X_t | F_{t−1}] ≤ m_t for observations X_t ∈ [lo, hi], where the null mean m_t may change
// tick to tick (the observed traffic share) but is known when X_t arrives. Wealth
// K_t = ∏ (1 + λ_s (X_s − m_s)) with λ_s ∈ [0, λmax_s] chosen from ticks before s. Under H0 each
// factor has conditional mean 1 + λ_s (E[X_s | F] − m_s) ≤ 1 and is ≥ 1/2 (λmax = ½ / (m − lo)), so K
// is a nonnegative supermartingale and Ville gives P(sup_t K_t ≥ 1/α) ≤ α. The premise is the bound
// and the conditional mean — no baseline, no scale, no tail, no φ.
//
// λ is the GRAPA ratio (running mean over running second moment of Y = X − m, Waudby-Smith–Ramdas
// 2023 §5) shrunk by one pseudo-observation with Y = 0 and second moment ((hi − lo)/4)², then
// clipped to [0, λmax]. It uses only past ticks, which is all validity needs; its quality is power.

import { advanceLogWealth, wealthView } from './_wealth';

export interface PairedBetSpec {
  /** Smallest value an observation can take. */
  lo: number;
  /** Largest value an observation can take. */
  hi: number;
  /** H0: E[X | past] ≤ nullMean. Needs lo < nullMean ≤ hi. */
  nullMean: number;
}

export interface PairedBetState {
  /** Log-wealth (the source of truth; see _wealth.ts). */
  log_K: number;
  /** Observations consumed. */
  n: number;
  /** Σ (X − m). */
  sumY: number;
  /** Σ (X − m)². */
  sumY2: number;
}

/** λmax as a fraction of the positivity bound 1 / (m − lo): every factor stays ≥ 1 − this. */
export const PAIRED_BET_MAX_FRACTION = 0.5;

export function initPairedBet(): PairedBetState {
  return { log_K: 0, n: 0, sumY: 0, sumY2: 0 };
}

export function pairedBetLambdaMax(spec: PairedBetSpec): number {
  if (!(spec.lo < spec.nullMean && spec.nullMean <= spec.hi)) {
    throw new RangeError(
      `paired-bet: need lo < nullMean <= hi, got lo=${spec.lo} nullMean=${spec.nullMean} hi=${spec.hi}`,
    );
  }
  return PAIRED_BET_MAX_FRACTION / (spec.nullMean - spec.lo);
}

/** The bet for the NEXT observation, from past observations only. */
export function pairedBetLambda(state: PairedBetState, spec: PairedBetSpec): number {
  const lamMax = pairedBetLambdaMax(spec);
  const quarter = (spec.hi - spec.lo) / 4;
  const mean = state.sumY / (state.n + 1);
  const second = (quarter * quarter + state.sumY2) / (state.n + 1);
  const lam = mean / second;
  return lam <= 0 ? 0 : lam >= lamMax ? lamMax : lam;
}

/** Consume one observation. NaN carries no evidence and holds the state. Pure. */
export function updatePairedBet(state: PairedBetState, spec: PairedBetSpec, x: number): PairedBetState {
  if (Number.isNaN(x)) return state;
  if (x < spec.lo || x > spec.hi) {
    throw new RangeError(`paired-bet: observation ${x} outside [${spec.lo}, ${spec.hi}]`);
  }
  const lam = pairedBetLambda(state, spec);
  const y = x - spec.nullMean;
  return {
    log_K: advanceLogWealth(state.log_K, Math.log1p(lam * y), -Infinity),
    n: state.n + 1,
    sumY: state.sumY + y,
    sumY2: state.sumY2 + y * y,
  };
}

export function pairedBetWealth(state: PairedBetState): number {
  return wealthView(state.log_K);
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx tsc && node --test dist/test/paired-bet.test.js`
Expected: 5 tests PASS.

- [ ] **Step 6: Commit**

```bash
git rev-parse --abbrev-ref HEAD   # must print main
git add detectors/_paired-bet.ts test/_seeded.ts test/paired-bet.test.ts
git commit -m "detectors: paired-bet primitive (ADR 0036)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- detectors/_paired-bet.ts test/_seeded.ts test/paired-bet.test.ts
```

---

### Task 3: Twin metric kinds and their envelopes

**Files:**
- Create: `detectors/twin-contrast.ts`
- Test: `test/twin-contrast.test.ts`

**Interfaces:**
- Consumes: everything `detectors/_paired-bet.ts` produces; `type ValidityEnvelope` from `detectors/validity-envelope.ts`
- Produces:
  - `type TwinMetricKind = 'rate' | 'sign'`
  - `interface TwinMetricSpec { id: string; kind: TwinMetricKind; worse: 'higher' | 'lower'; tolerance: number }`
  - `interface RateObservation { canaryEvents: number; canaryTotal: number; controlEvents: number; controlTotal: number }`
  - `interface SignObservation { canary: number; control: number }`
  - `type TwinObservation = RateObservation | SignObservation`
  - `interface TwinScore { x: number; rollbackNull: number; proceedNull: number }`
  - `interface TwinMetricState { rollback: PairedBetState; proceed: PairedBetState; used: number; skipped: number; ties: number }`
  - `interface TwinMetricEvidence { rollbackE: number; proceedE: number; used: number; skipped: number; ties: number }`
  - `checkTwinMetricSpec(spec: TwinMetricSpec): void`
  - `fisherNoncentralMean(nc: number, nk: number, total: number, psi: number): number`
  - `twinScore(spec: TwinMetricSpec, obs: TwinObservation): TwinScore | 'skip' | 'tie'`
  - `initTwinMetric(): TwinMetricState`
  - `skipTwinMetric(state: TwinMetricState): TwinMetricState`
  - `updateTwinMetric(spec: TwinMetricSpec, state: TwinMetricState, obs: TwinObservation): TwinMetricState`
  - `twinMetricEvidence(state: TwinMetricState): TwinMetricEvidence`
  - `TWIN_RATE_ENVELOPE` and `TWIN_SIGN_ENVELOPE`, both `Readonly<ValidityEnvelope>`

- [ ] **Step 1: Write the failing test**

Create `test/twin-contrast.test.ts`:

```ts
// test/twin-contrast.test.ts — ADR 0036: rate and sign twin kinds.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  type TwinMetricSpec,
  checkTwinMetricSpec, fisherNoncentralMean, twinScore,
  initTwinMetric, updateTwinMetric, twinMetricEvidence,
  TWIN_RATE_ENVELOPE, TWIN_SIGN_ENVELOPE,
} from '../detectors/twin-contrast';
import { lcg, poisson } from './_seeded';

const ERR: TwinMetricSpec = { id: 'http_5xx', kind: 'rate', worse: 'higher', tolerance: 0.5 };
const LAT: TwinMetricSpec = { id: 'p99_ms', kind: 'sign', worse: 'higher', tolerance: 0.1 };

test('fisherNoncentralMean: psi = 1 is the central hypergeometric mean', () => {
  assert.ok(Math.abs(fisherNoncentralMean(300, 700, 10, 1) - 3) < 1e-12);
});

test('fisherNoncentralMean: 1 + 1 arms with one event is psi / (1 + psi)', () => {
  assert.ok(Math.abs(fisherNoncentralMean(1, 1, 1, 2) - 2 / 3) < 1e-12);
});

test('fisherNoncentralMean is increasing in psi', () => {
  const a = fisherNoncentralMean(500, 500, 20, 1);
  const b = fisherNoncentralMean(500, 500, 20, 1.5);
  const c = fisherNoncentralMean(500, 500, 20, 3);
  assert.ok(a < b && b < c && c < 20, `${a} ${b} ${c}`);
});

test('rate score: canary share of bad events, null = traffic share', () => {
  const s = twinScore(ERR, { canaryEvents: 6, canaryTotal: 300, controlEvents: 4, controlTotal: 700 });
  assert.ok(s !== 'skip' && s !== 'tie');
  assert.ok(Math.abs(s.x - 0.6) < 1e-12);
  assert.ok(Math.abs(s.rollbackNull - 0.3) < 1e-12);
  assert.ok(s.proceedNull > 0.3 && s.proceedNull < 1);
});

test('rate score with worse = lower counts failures (total − events)', () => {
  const spec: TwinMetricSpec = { ...ERR, worse: 'lower' };
  const s = twinScore(spec, { canaryEvents: 990, canaryTotal: 1000, controlEvents: 999, controlTotal: 1000 });
  assert.ok(s !== 'skip' && s !== 'tie');
  assert.ok(Math.abs(s.x - 10 / 11) < 1e-12);
});

test('rate score skips empty arms, zero bad events and a degenerate support', () => {
  assert.equal(twinScore(ERR, { canaryEvents: 0, canaryTotal: 0, controlEvents: 1, controlTotal: 10 }), 'skip');
  assert.equal(twinScore(ERR, { canaryEvents: 0, canaryTotal: 10, controlEvents: 0, controlTotal: 10 }), 'skip');
  assert.equal(twinScore(ERR, { canaryEvents: 5, canaryTotal: 5, controlEvents: 2, controlTotal: 2 }), 'skip');
  assert.throws(() => twinScore(ERR, { canaryEvents: 11, canaryTotal: 10, controlEvents: 0, controlTotal: 10 }), RangeError);
});

test('sign score: worse orientation, ties, and missing values', () => {
  const up = twinScore(LAT, { canary: 120, control: 100 });
  assert.ok(up !== 'skip' && up !== 'tie' && up.x === 1 && up.rollbackNull === 0.5);
  assert.ok(Math.abs(up.proceedNull - 0.6) < 1e-12);
  const lower = twinScore({ ...LAT, worse: 'lower' }, { canary: 120, control: 100 });
  assert.ok(lower !== 'skip' && lower !== 'tie' && lower.x === 0);
  assert.equal(twinScore(LAT, { canary: 100, control: 100 }), 'tie');
  assert.equal(twinScore(LAT, { canary: Number.NaN, control: 100 }), 'skip');
});

test('tolerance ranges are enforced per kind', () => {
  assert.throws(() => checkTwinMetricSpec({ ...ERR, tolerance: 0 }), RangeError);
  assert.throws(() => checkTwinMetricSpec({ ...ERR, tolerance: 11 }), RangeError);
  assert.throws(() => checkTwinMetricSpec({ ...LAT, tolerance: 0.5 }), RangeError);
  assert.doesNotThrow(() => checkTwinMetricSpec(LAT));
});

/** One tick of a rate pair: shared seasonal rate, unequal routing (normal-approximate binomial
 *  split, to keep the suite fast), per-arm multiplier. */
function rateTick(rng: () => number, t: number, w: number, canaryMult: number) {
  const season = 1 + 0.5 * Math.sin((2 * Math.PI * t) / 144);
  const n = poisson(rng, 1000 * season);
  const z = Math.sqrt(-2 * Math.log(rng())) * Math.cos(2 * Math.PI * rng());
  const nc = Math.min(n, Math.max(0, Math.round(n * w + Math.sqrt(n * w * (1 - w)) * z)));
  const nk = n - nc;
  const p = 0.01 * season;
  return {
    canaryEvents: Math.min(nc, poisson(rng, nc * p * canaryMult)), canaryTotal: nc,
    controlEvents: Math.min(nk, poisson(rng, nk * p)), controlTotal: nk,
  };
}

test('rate H0 (equal rates, w = 0.3, shared seasonality): false rollback within the Ville bound', () => {
  const rng = lcg(11);
  const R = 1000, T = 300, alpha = 0.05;
  let fired = 0;
  for (let r = 0; r < R; r++) {
    let st = initTwinMetric();
    for (let t = 0; t < T; t++) {
      st = updateTwinMetric(ERR, st, rateTick(rng, t, 0.3, 1));
      if (twinMetricEvidence(st).rollbackE >= 1 / alpha) { fired++; break; }
    }
  }
  const bar = alpha + 3 * Math.sqrt(alpha * (1 - alpha) / R);
  assert.ok(fired / R <= bar, `false rollback ${fired / R} > ${bar}`);
});

test('rate power: canary at twice the bad-event rate rolls back within 300 ticks in >= 95% of runs', () => {
  const rng = lcg(12);
  const R = 200, T = 300, alpha = 0.05;
  let fired = 0;
  for (let r = 0; r < R; r++) {
    let st = initTwinMetric();
    for (let t = 0; t < T; t++) {
      st = updateTwinMetric(ERR, st, rateTick(rng, t, 0.5, 2));
      if (twinMetricEvidence(st).rollbackE >= 1 / alpha) { fired++; break; }
    }
  }
  assert.ok(fired / R >= 0.95, `power ${fired / R}`);
});

test('rate proceed: identical arms clear a 50% odds tolerance within 300 ticks in >= 90% of runs', () => {
  const rng = lcg(13);
  const R = 200, T = 300, alpha = 0.05;
  let cleared = 0;
  for (let r = 0; r < R; r++) {
    let st = initTwinMetric();
    for (let t = 0; t < T; t++) {
      st = updateTwinMetric(ERR, st, rateTick(rng, t, 0.5, 1));
      if (twinMetricEvidence(st).proceedE >= 1 / alpha) { cleared++; break; }
    }
  }
  assert.ok(cleared / R >= 0.9, `proceed rate ${cleared / R}`);
});

test('the envelopes carry their pairing premises and estimate nothing', () => {
  assert.equal(TWIN_RATE_ENVELOPE.pairingPremise, 'exchangeable-arms');
  assert.equal(TWIN_SIGN_ENVELOPE.pairingPremise, 'exchangeable-equal-weight-arms');
  assert.equal(TWIN_RATE_ENVELOPE.baseline, 'randomized-twin');
  assert.equal(TWIN_RATE_ENVELOPE.validUnderEstimatedBaseline, true);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx tsc`
Expected: FAIL. `Cannot find module '../detectors/twin-contrast'`.

- [ ] **Step 3: Implement**

Create `detectors/twin-contrast.ts`:

```ts
// detectors/twin-contrast.ts — ADR 0036: canary vs a concurrent control arm, reduced to a bounded
// mean whose null value is observed or fixed.
//
// Every kind produces, per tick, a canary-worse score X ∈ [0, 1] and two null means:
//   rollback H0  E[X | past] ≤ rollbackNull   (the canary is no worse)
//   proceed  H0  E[X | past] ≥ proceedNull    (the canary is worse by at least the tolerance)
// Each is tested by its own paired-bet wealth (the proceed side on 1 − X against 1 − proceedNull).
//
// rate — bad events b and totals n per arm. X = b_c / (b_c + b_k). Conditional on n_c, n_k and the
//   bad-event total E, b_c is Fisher noncentral hypergeometric in the odds ratio ψ of the arms'
//   per-request bad-event probabilities, and its mean is increasing in ψ. So ψ ≤ 1 gives
//   E[X] ≤ n_c / (n_c + n_k) — the observed traffic share — and ψ ≥ 1 + tolerance gives
//   E[X] ≥ fisherNoncentralMean(n_c, n_k, E, 1 + tolerance) / E. Valid at any routing split.
// sign — one value per arm per tick. X = 1 if the canary's is worse. Exchangeable equal-weight arms
//   give P(X = 1 | no tie) = 1/2; the proceed null is 1/2 + tolerance. Ties carry no evidence.

import type { ValidityEnvelope } from './validity-envelope';
import {
  type PairedBetState,
  initPairedBet, updatePairedBet, pairedBetWealth,
} from './_paired-bet';

export type TwinMetricKind = 'rate' | 'sign';

export interface TwinMetricSpec {
  /** Free-form metric name; the gate keys observations by it. */
  id: string;
  kind: TwinMetricKind;
  /** Which direction of the metric is a regression. For 'rate', 'lower' means the events are
   *  successes and the bad events are total − events. */
  worse: 'higher' | 'lower';
  /** Smallest regression worth blocking on; sets the PROCEED test only, never rollback.
   *  rate: excess odds ratio ρ in (0, 10] (0.2 = 20% more bad events per request).
   *  sign: excess probability τ in (0, 0.5) that the canary's tick is worse (0.1 = 60% of ticks). */
  tolerance: number;
}

export interface RateObservation { canaryEvents: number; canaryTotal: number; controlEvents: number; controlTotal: number }
export interface SignObservation { canary: number; control: number }
export type TwinObservation = RateObservation | SignObservation;

export interface TwinScore { x: number; rollbackNull: number; proceedNull: number }

export interface TwinMetricState {
  rollback: PairedBetState;
  proceed: PairedBetState;
  used: number;
  skipped: number;
  ties: number;
}

export interface TwinMetricEvidence { rollbackE: number; proceedE: number; used: number; skipped: number; ties: number }

const RATE_MAX_TOLERANCE = 10;

export function checkTwinMetricSpec(spec: TwinMetricSpec): void {
  if (spec.kind === 'rate') {
    if (!(spec.tolerance > 0 && spec.tolerance <= RATE_MAX_TOLERANCE)) {
      throw new RangeError(`twin-contrast: ${spec.id}: a rate tolerance is an excess odds ratio in (0, ${RATE_MAX_TOLERANCE}], got ${spec.tolerance}`);
    }
  } else if (!(spec.tolerance > 0 && spec.tolerance < 0.5)) {
    throw new RangeError(`twin-contrast: ${spec.id}: a sign tolerance is an excess probability in (0, 0.5), got ${spec.tolerance}`);
  }
}

/** Mean of Fisher's noncentral hypergeometric: X = canary's count of `total` events over arms of
 *  nc and nk requests, odds ratio psi. Weights by the ratio recurrence, in the log domain. */
export function fisherNoncentralMean(nc: number, nk: number, total: number, psi: number): number {
  const lo = Math.max(0, total - nk);
  const hi = Math.min(total, nc);
  const logPsi = Math.log(psi);
  const logW: number[] = [0];
  for (let x = lo; x < hi; x++) {
    const prev = logW[logW.length - 1];
    logW.push(prev + Math.log(nc - x) - Math.log(x + 1) + Math.log(total - x) - Math.log(nk - total + x + 1) + logPsi);
  }
  const top = Math.max(...logW);
  let z = 0;
  let m = 0;
  for (let i = 0; i < logW.length; i++) {
    const w = Math.exp(logW[i] - top);
    z += w;
    m += w * (lo + i);
  }
  return m / z;
}

function isRate(obs: TwinObservation): obs is RateObservation {
  return (obs as RateObservation).canaryTotal !== undefined;
}

export function twinScore(spec: TwinMetricSpec, obs: TwinObservation): TwinScore | 'skip' | 'tie' {
  if (spec.kind === 'rate') {
    if (!isRate(obs)) throw new TypeError(`twin-contrast: ${spec.id}: a rate metric needs a RateObservation`);
    const { canaryEvents, canaryTotal, controlEvents, controlTotal } = obs;
    if (![canaryEvents, canaryTotal, controlEvents, controlTotal].every(Number.isFinite)) return 'skip';
    if (canaryEvents < 0 || controlEvents < 0 || canaryEvents > canaryTotal || controlEvents > controlTotal) {
      throw new RangeError(`twin-contrast: ${spec.id}: events must lie in [0, total]`);
    }
    if (canaryTotal === 0 || controlTotal === 0) return 'skip';
    const bc = spec.worse === 'higher' ? canaryEvents : canaryTotal - canaryEvents;
    const bk = spec.worse === 'higher' ? controlEvents : controlTotal - controlEvents;
    const e = bc + bk;
    if (e === 0) return 'skip';
    if (Math.max(0, e - controlTotal) === Math.min(e, canaryTotal)) return 'skip';
    return {
      x: bc / e,
      rollbackNull: canaryTotal / (canaryTotal + controlTotal),
      proceedNull: fisherNoncentralMean(canaryTotal, controlTotal, e, 1 + spec.tolerance) / e,
    };
  }
  if (isRate(obs)) throw new TypeError(`twin-contrast: ${spec.id}: a sign metric needs a SignObservation`);
  if (!Number.isFinite(obs.canary) || !Number.isFinite(obs.control)) return 'skip';
  if (obs.canary === obs.control) return 'tie';
  const canaryHigher = obs.canary > obs.control;
  const worse = spec.worse === 'higher' ? canaryHigher : !canaryHigher;
  return { x: worse ? 1 : 0, rollbackNull: 0.5, proceedNull: 0.5 + spec.tolerance };
}

export function initTwinMetric(): TwinMetricState {
  return { rollback: initPairedBet(), proceed: initPairedBet(), used: 0, skipped: 0, ties: 0 };
}

export function skipTwinMetric(state: TwinMetricState): TwinMetricState {
  return { ...state, skipped: state.skipped + 1 };
}

export function updateTwinMetric(spec: TwinMetricSpec, state: TwinMetricState, obs: TwinObservation): TwinMetricState {
  const s = twinScore(spec, obs);
  if (s === 'skip') return skipTwinMetric(state);
  if (s === 'tie') return { ...state, ties: state.ties + 1 };
  return {
    rollback: updatePairedBet(state.rollback, { lo: 0, hi: 1, nullMean: s.rollbackNull }, s.x),
    proceed: updatePairedBet(state.proceed, { lo: 0, hi: 1, nullMean: 1 - s.proceedNull }, 1 - s.x),
    used: state.used + 1,
    skipped: state.skipped,
    ties: state.ties,
  };
}

export function twinMetricEvidence(state: TwinMetricState): TwinMetricEvidence {
  return {
    rollbackE: pairedBetWealth(state.rollback),
    proceedE: pairedBetWealth(state.proceed),
    used: state.used,
    skipped: state.skipped,
    ties: state.ties,
  };
}

/** ADR 0036 — rate kind. */
export const TWIN_RATE_ENVELOPE: Readonly<ValidityEnvelope> = Object.freeze({
  baseline: 'randomized-twin',
  autocorrelation: 'shared-cancels',
  null: 'paired-order',
  variance: 'none',
  validUnderEstimatedBaseline: true,
  statistic: 'e-value',
  pairingPremise: 'exchangeable-arms',
  notes: 'Null mean is the observed traffic share (rollback) or the Fisher noncentral mean at the '
    + 'tolerance (proceed), both exact given the tick\'s arm totals and bad-event total. Premise: '
    + 'randomized per-request routing, no arm-specific persistent state under H0. Valid at any split. '
    + 'Study 2026-09-twin-null registered, not run.',
});

/** ADR 0036 — sign kind. */
export const TWIN_SIGN_ENVELOPE: Readonly<ValidityEnvelope> = Object.freeze({
  baseline: 'randomized-twin',
  autocorrelation: 'shared-cancels',
  null: 'paired-order',
  variance: 'none',
  validUnderEstimatedBaseline: true,
  statistic: 'e-value',
  pairingPremise: 'exchangeable-equal-weight-arms',
  notes: 'Null P(canary tick worse | no tie) = 1/2 by exchangeability of equal-weight arms; any '
    + 'scalar tick statistic (a percentile, a gauge, a count). Unequal weights break it for skewed '
    + 'statistics. Study 2026-09-twin-null registered, not run.',
});
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx tsc && node --test dist/test/twin-contrast.test.js`
Expected: 12 tests PASS.

- [ ] **Step 5: Commit**

```bash
git rev-parse --abbrev-ref HEAD   # must print main
git add detectors/twin-contrast.ts test/twin-contrast.test.ts
git commit -m "detectors: twin-contrast rate and sign kinds (ADR 0036)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- detectors/twin-contrast.ts test/twin-contrast.test.ts
```

---

### Task 4: Twin gate — fusion, sample-ratio guard, verdict

**Files:**
- Create: `per-shard/twin-gate.ts`
- Test: `test/twin-gate.test.ts`

**Interfaces:**
- Consumes: from Task 2, `initPairedBet`, `updatePairedBet`, `pairedBetWealth` and `PairedBetState`. From Task 3, `TwinMetricSpec`, `TwinMetricState`, `TwinObservation`, `checkTwinMetricSpec`, `initTwinMetric`, `skipTwinMetric`, `updateTwinMetric` and `twinMetricEvidence`.
- Produces:
  - `interface TwinGateConfig { metrics: readonly TwinMetricSpec[]; alphaRollback: number; alphaProceed: number; alphaSrm: number; canaryWeight: number; maxTicks: number }`
  - `type TwinVerdict = 'rollback' | 'proceed' | 'extend' | 'inconclusive' | 'invalid_experiment'`
  - `interface TwinGateState { tick: number; terminal: TwinVerdict | null; metrics: Readonly<Record<string, TwinMetricState>>; srmUp: PairedBetState; srmDown: PairedBetState }`
  - `interface TwinTickInput { canaryRequests: number; controlRequests: number; observations: Readonly<Record<string, TwinObservation | undefined>> }`
  - `interface TwinMetricReport { id: string; rollbackE: number; rollbackThreshold: number; proceedE: number; proceedThreshold: number; used: number; skipped: number; ties: number }`
  - `interface TwinGateDecision { verdict: TwinVerdict; tick: number; srmE: number; srmThreshold: number; metrics: TwinMetricReport[] }`
  - `checkTwinGateConfig(cfg: TwinGateConfig): void`
  - `initTwinGate(cfg: TwinGateConfig): TwinGateState`
  - `stepTwinGate(cfg: TwinGateConfig, state: TwinGateState, input: TwinTickInput): { state: TwinGateState; decision: TwinGateDecision }`

- [ ] **Step 1: Write the failing test**

Create `test/twin-gate.test.ts`:

```ts
// test/twin-gate.test.ts — ADR 0036: multi-metric fusion and the sample-ratio guard.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  type TwinGateConfig, type TwinTickInput,
  checkTwinGateConfig, initTwinGate, stepTwinGate,
} from '../per-shard/twin-gate';
import { lcg, poisson } from './_seeded';

const CFG: TwinGateConfig = {
  metrics: [
    { id: 'http_5xx', kind: 'rate', worse: 'higher', tolerance: 0.5 },
    { id: 'p99_ms', kind: 'sign', worse: 'higher', tolerance: 0.2 },
  ],
  alphaRollback: 0.01,
  alphaProceed: 0.05,
  alphaSrm: 0.001,
  canaryWeight: 0.5,
  maxTicks: 1000,
};

function tick(rng: () => number, canaryMult: number, canaryLatencyShift: number): TwinTickInput {
  const n = poisson(rng, 2000);
  let nc = 0;
  for (let i = 0; i < n; i++) if (rng() < 0.5) nc++;
  const nk = n - nc;
  return {
    canaryRequests: nc,
    controlRequests: nk,
    observations: {
      http_5xx: {
        canaryEvents: Math.min(nc, poisson(rng, nc * 0.01 * canaryMult)), canaryTotal: nc,
        controlEvents: Math.min(nk, poisson(rng, nk * 0.01)), controlTotal: nk,
      },
      p99_ms: { canary: 200 + canaryLatencyShift + 20 * (rng() - 0.5), control: 200 + 20 * (rng() - 0.5) },
    },
  };
}

function run(cfg: TwinGateConfig, rng: () => number, mult: number, shift: number) {
  let state = initTwinGate(cfg);
  let decision = stepTwinGate(cfg, state, tick(rng, mult, shift)).decision;
  for (let t = 0; t < cfg.maxTicks; t++) {
    const out = stepTwinGate(cfg, state, tick(rng, mult, shift));
    state = out.state;
    decision = out.decision;
    if (decision.verdict !== 'extend') break;
  }
  return decision;
}

test('config: a sign metric at unequal weights is refused', () => {
  assert.throws(() => checkTwinGateConfig({ ...CFG, canaryWeight: 0.1 }), /equal routing weights/);
});

test('config: empty metric list and duplicate ids are refused', () => {
  assert.throws(() => checkTwinGateConfig({ ...CFG, metrics: [] }), RangeError);
  assert.throws(() => checkTwinGateConfig({ ...CFG, metrics: [CFG.metrics[0], CFG.metrics[0]] }), RangeError);
});

test('a canary with 3x the error rate is rolled back', () => {
  const d = run(CFG, lcg(21), 3, 0);
  assert.equal(d.verdict, 'rollback');
  assert.ok(d.tick < 200, `tick ${d.tick}`);
});

test('a canary 15 ms slower on every tick is rolled back by the sign metric', () => {
  const d = run(CFG, lcg(22), 1, 15);
  assert.equal(d.verdict, 'rollback');
});

test('identical arms proceed', () => {
  const d = run(CFG, lcg(23), 1, 0);
  assert.equal(d.verdict, 'proceed');
});

test('a canary receiving no traffic is an invalid experiment', () => {
  const cfg: TwinGateConfig = { ...CFG, metrics: [CFG.metrics[0]] };
  let state = initTwinGate(cfg);
  let verdict = 'extend';
  for (let t = 0; t < 100 && verdict === 'extend'; t++) {
    const out = stepTwinGate(cfg, state, { canaryRequests: 0, controlRequests: 1000, observations: {} });
    state = out.state;
    verdict = out.decision.verdict;
  }
  assert.equal(verdict, 'invalid_experiment');
});

test('terminal verdicts are sticky', () => {
  const rng = lcg(24);
  let state = initTwinGate(CFG);
  let out = stepTwinGate(CFG, state, tick(rng, 3, 0));
  while (out.decision.verdict === 'extend') { state = out.state; out = stepTwinGate(CFG, state, tick(rng, 3, 0)); }
  const after = stepTwinGate(CFG, out.state, tick(rng, 1, 0));
  assert.equal(after.decision.verdict, out.decision.verdict);
  assert.equal(after.state.tick, out.state.tick);
});

test('maxTicks without a decision is inconclusive', () => {
  const cfg: TwinGateConfig = { ...CFG, maxTicks: 3 };
  const d = run(cfg, lcg(25), 1, 0);
  assert.equal(d.verdict, 'inconclusive');
});

test('rollback threshold is Bonferroni over metrics; proceed is not split', () => {
  const d = stepTwinGate(CFG, initTwinGate(CFG), tick(lcg(26), 1, 0)).decision;
  assert.ok(d.metrics.every((m) => m.rollbackThreshold === 2 / 0.01 && m.proceedThreshold === 1 / 0.05));
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx tsc`
Expected: FAIL. `Cannot find module '../per-shard/twin-gate'`.

- [ ] **Step 3: Implement**

Create `per-shard/twin-gate.ts`:

```ts
// per-shard/twin-gate.ts — ADR 0036: one deploy's canary-vs-control decision across N metrics.
//
// Error statement, each under its own null and each by Ville on the paired-bet wealths:
//   P(rollback | every metric no worse)                 ≤ alphaRollback  (N/α per metric: Bonferroni,
//                                                                          valid under any dependence)
//   P(proceed  | some metric worse by ≥ its tolerance)  ≤ alphaProceed   (proceed needs EVERY metric's
//                                                                          wealth over 1/α: intersection–
//                                                                          union, no split)
//   P(invalid_experiment | routing at canaryWeight)     ≤ alphaSrm       (two-sided sample-ratio guard:
//                                                                          the mean of two one-sided
//                                                                          wealths is a supermartingale)
// The guard is checked first: a canary that stops receiving traffic reads as invalid_experiment, and
// the consumer must treat that as halt-and-shift-back, not as a pass. Terminal verdicts are sticky.

import {
  type PairedBetState,
  initPairedBet, updatePairedBet, pairedBetWealth,
} from '../detectors/_paired-bet';
import {
  type TwinMetricSpec, type TwinMetricState, type TwinObservation,
  checkTwinMetricSpec, initTwinMetric, skipTwinMetric, updateTwinMetric, twinMetricEvidence,
} from '../detectors/twin-contrast';

export interface TwinGateConfig {
  metrics: readonly TwinMetricSpec[];
  alphaRollback: number;
  alphaProceed: number;
  alphaSrm: number;
  /** Configured routing share of the canary within the experiment: w_c / (w_c + w_k). */
  canaryWeight: number;
  maxTicks: number;
}

export type TwinVerdict = 'rollback' | 'proceed' | 'extend' | 'inconclusive' | 'invalid_experiment';

export interface TwinGateState {
  tick: number;
  terminal: TwinVerdict | null;
  metrics: Readonly<Record<string, TwinMetricState>>;
  srmUp: PairedBetState;
  srmDown: PairedBetState;
}

export interface TwinTickInput {
  canaryRequests: number;
  controlRequests: number;
  observations: Readonly<Record<string, TwinObservation | undefined>>;
}

export interface TwinMetricReport {
  id: string;
  rollbackE: number;
  rollbackThreshold: number;
  proceedE: number;
  proceedThreshold: number;
  used: number;
  skipped: number;
  ties: number;
}

export interface TwinGateDecision {
  verdict: TwinVerdict;
  tick: number;
  srmE: number;
  srmThreshold: number;
  metrics: TwinMetricReport[];
}

function inUnit(x: number): boolean { return x > 0 && x < 1; }

export function checkTwinGateConfig(cfg: TwinGateConfig): void {
  if (cfg.metrics.length === 0) throw new RangeError('twin-gate: at least one metric is required');
  const ids = new Set<string>();
  for (const m of cfg.metrics) {
    if (ids.has(m.id)) throw new RangeError(`twin-gate: duplicate metric id '${m.id}'`);
    ids.add(m.id);
    checkTwinMetricSpec(m);
  }
  if (![cfg.alphaRollback, cfg.alphaProceed, cfg.alphaSrm, cfg.canaryWeight].every(inUnit)) {
    throw new RangeError('twin-gate: alphas and canaryWeight must lie in (0, 1)');
  }
  if (!(Number.isInteger(cfg.maxTicks) && cfg.maxTicks >= 1)) {
    throw new RangeError(`twin-gate: maxTicks must be a positive integer, got ${cfg.maxTicks}`);
  }
  if (cfg.metrics.some((m) => m.kind === 'sign') && cfg.canaryWeight !== 0.5) {
    throw new RangeError(
      'twin-gate: a sign metric needs equal routing weights (canaryWeight 0.5): its null is the '
      + `exchangeability of two equal-sized arms (ADR 0036). Got canaryWeight ${cfg.canaryWeight}.`,
    );
  }
}

export function initTwinGate(cfg: TwinGateConfig): TwinGateState {
  checkTwinGateConfig(cfg);
  const metrics: Record<string, TwinMetricState> = {};
  for (const m of cfg.metrics) metrics[m.id] = initTwinMetric();
  return { tick: 0, terminal: null, metrics, srmUp: initPairedBet(), srmDown: initPairedBet() };
}

function srmE(state: TwinGateState): number {
  return (pairedBetWealth(state.srmUp) + pairedBetWealth(state.srmDown)) / 2;
}

function report(cfg: TwinGateConfig, state: TwinGateState, verdict: TwinVerdict): TwinGateDecision {
  const n = cfg.metrics.length;
  return {
    verdict,
    tick: state.tick,
    srmE: srmE(state),
    srmThreshold: 1 / cfg.alphaSrm,
    metrics: cfg.metrics.map((m) => {
      const ev = twinMetricEvidence(state.metrics[m.id]);
      return {
        id: m.id,
        rollbackE: ev.rollbackE,
        rollbackThreshold: n / cfg.alphaRollback,
        proceedE: ev.proceedE,
        proceedThreshold: 1 / cfg.alphaProceed,
        used: ev.used,
        skipped: ev.skipped,
        ties: ev.ties,
      };
    }),
  };
}

function decide(cfg: TwinGateConfig, state: TwinGateState): TwinVerdict {
  if (srmE(state) >= 1 / cfg.alphaSrm) return 'invalid_experiment';
  const n = cfg.metrics.length;
  const ev = cfg.metrics.map((m) => twinMetricEvidence(state.metrics[m.id]));
  if (ev.some((e) => e.rollbackE >= n / cfg.alphaRollback)) return 'rollback';
  if (ev.every((e) => e.proceedE >= 1 / cfg.alphaProceed)) return 'proceed';
  if (state.tick >= cfg.maxTicks) return 'inconclusive';
  return 'extend';
}

export function stepTwinGate(
  cfg: TwinGateConfig, state: TwinGateState, input: TwinTickInput,
): { state: TwinGateState; decision: TwinGateDecision } {
  if (state.terminal !== null) return { state, decision: report(cfg, state, state.terminal) };
  const { canaryRequests: c, controlRequests: k } = input;
  if (!(Number.isFinite(c) && Number.isFinite(k) && c >= 0 && k >= 0)) {
    throw new RangeError(`twin-gate: request counts must be finite and non-negative, got ${c}, ${k}`);
  }
  let { srmUp, srmDown } = state;
  if (c + k > 0) {
    const share = c / (c + k);
    srmUp = updatePairedBet(srmUp, { lo: 0, hi: 1, nullMean: cfg.canaryWeight }, share);
    srmDown = updatePairedBet(srmDown, { lo: 0, hi: 1, nullMean: 1 - cfg.canaryWeight }, 1 - share);
  }
  const metrics: Record<string, TwinMetricState> = { ...state.metrics };
  for (const m of cfg.metrics) {
    const obs = input.observations[m.id];
    metrics[m.id] = obs === undefined ? skipTwinMetric(metrics[m.id]) : updateTwinMetric(m, metrics[m.id], obs);
  }
  const next: TwinGateState = { tick: state.tick + 1, terminal: null, metrics, srmUp, srmDown };
  const verdict = decide(cfg, next);
  const settled: TwinGateState = { ...next, terminal: verdict === 'extend' ? null : verdict };
  return { state: settled, decision: report(cfg, settled, verdict) };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx tsc && node --test dist/test/twin-gate.test.js dist/test/library-boundary.test.js`
Expected: all PASS, and the library boundary stays clean.

- [ ] **Step 5: Commit**

```bash
git rev-parse --abbrev-ref HEAD   # must print main
git add per-shard/twin-gate.ts test/twin-gate.test.ts
git commit -m "per-shard: twin gate fusion and sample-ratio guard (ADR 0036)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- per-shard/twin-gate.ts test/twin-gate.test.ts
```

---

### Task 5: Bake-length planning

**Files:**
- Create: `per-shard/twin-planning.ts`
- Test: `test/twin-planning.test.ts`

**Interfaces:**
- Consumes: `initPairedBet`, `updatePairedBet`, `pairedBetWealth` (test only)
- Produces:
  - `interface RatePlanInput { kind: 'rate'; canaryShare: number; oddsRatio: number; badEventsPerTick: number; alpha: number }`
  - `interface SignPlanInput { kind: 'sign'; excessProbability: number; tieRate: number; alpha: number }`
  - `ticksToDetect(input: RatePlanInput | SignPlanInput): number`, which returns `Infinity` when there is no effect.

- [ ] **Step 1: Write the failing test**

Create `test/twin-planning.test.ts`:

```ts
// test/twin-planning.test.ts — ADR 0036: the bake-length planning figure. It is a POWER statement;
// validity never reads it.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ticksToDetect } from '../per-shard/twin-planning';
import { initPairedBet, updatePairedBet, pairedBetWealth } from '../detectors/_paired-bet';
import { lcg } from './_seeded';

test('sign: 0.2 excess at alpha 0.05 is ln(20) / 0.08 ticks', () => {
  const got = ticksToDetect({ kind: 'sign', excessProbability: 0.2, tieRate: 0, alpha: 0.05 });
  assert.ok(Math.abs(got - Math.log(20) / 0.08) < 1e-9, `${got}`);
});

test('sign: ties stretch the bake by 1 / (1 − tieRate)', () => {
  const a = ticksToDetect({ kind: 'sign', excessProbability: 0.2, tieRate: 0, alpha: 0.05 });
  const b = ticksToDetect({ kind: 'sign', excessProbability: 0.2, tieRate: 0.5, alpha: 0.05 });
  assert.ok(Math.abs(b - 2 * a) < 1e-9);
});

test('rate: share 0.5, odds 2, 20 bad events per tick at alpha 0.05 is ~20.35 ticks', () => {
  const got = ticksToDetect({ kind: 'rate', canaryShare: 0.5, oddsRatio: 2, badEventsPerTick: 20, alpha: 0.05 });
  assert.ok(Math.abs(got - 20.35) < 0.1, `${got}`);
});

test('no effect plans an infinite bake', () => {
  assert.equal(ticksToDetect({ kind: 'sign', excessProbability: 0, tieRate: 0, alpha: 0.05 }), Infinity);
  assert.equal(ticksToDetect({ kind: 'rate', canaryShare: 0.5, oddsRatio: 1, badEventsPerTick: 20, alpha: 0.05 }), Infinity);
});

test('sign: the simulated median crossing tick lies within [0.8x, 3x] of the plan', () => {
  const plan = ticksToDetect({ kind: 'sign', excessProbability: 0.2, tieRate: 0, alpha: 0.05 });
  const rng = lcg(31);
  const ticks: number[] = [];
  for (let r = 0; r < 400; r++) {
    let s = initPairedBet();
    for (let t = 1; t <= 2000; t++) {
      s = updatePairedBet(s, { lo: 0, hi: 1, nullMean: 0.5 }, rng() < 0.7 ? 1 : 0);
      if (pairedBetWealth(s) >= 20) { ticks.push(t); break; }
    }
  }
  ticks.sort((a, b) => a - b);
  const median = ticks[Math.floor(ticks.length / 2)];
  assert.ok(median >= 0.8 * plan && median <= 3 * plan, `median ${median}, plan ${plan}`);
});

test('inputs out of range throw', () => {
  assert.throws(() => ticksToDetect({ kind: 'sign', excessProbability: 0.6, tieRate: 0, alpha: 0.05 }), RangeError);
  assert.throws(() => ticksToDetect({ kind: 'rate', canaryShare: 0, oddsRatio: 2, badEventsPerTick: 20, alpha: 0.05 }), RangeError);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx tsc`
Expected: FAIL. `Cannot find module '../per-shard/twin-planning'`.

- [ ] **Step 3: Implement**

Create `per-shard/twin-planning.ts`:

```ts
// per-shard/twin-planning.ts — ADR 0036: how many ticks a twin bake needs to catch a given
// regression. A POWER figure: the second-order growth rate of the paired-bet wealth at the capped
// Kelly bet, ln(1/α) / growth. Inputs may be estimated from history (traffic, bad-event rate);
// nothing here is read by the rollback or proceed tests. The adaptive λ pays a learning cost the
// figure omits; study 2026-09-twin-null records the measured ratio.

export interface RatePlanInput {
  kind: 'rate';
  /** Canary traffic share within the experiment, in (0, 1). */
  canaryShare: number;
  /** Odds ratio of the regression to detect, > 0 (1.2 = 20% more bad events per request). */
  oddsRatio: number;
  /** Expected bad events per tick across both arms, > 0. */
  badEventsPerTick: number;
  alpha: number;
}

export interface SignPlanInput {
  kind: 'sign';
  /** P(canary tick worse) − 1/2 to detect, in [0, 0.5). */
  excessProbability: number;
  /** Fraction of ticks that tie, in [0, 1). */
  tieRate: number;
  alpha: number;
}

function growthPerTick(mu: number, m2: number, lamMax: number): number {
  if (mu <= 0) return 0;
  const lam = Math.min(mu / m2, lamMax);
  return lam * mu - (lam * lam * m2) / 2;
}

export function ticksToDetect(input: RatePlanInput | SignPlanInput): number {
  if (!(input.alpha > 0 && input.alpha < 1)) throw new RangeError(`twin-planning: alpha ${input.alpha}`);
  const target = Math.log(1 / input.alpha);
  if (input.kind === 'sign') {
    if (!(input.excessProbability >= 0 && input.excessProbability < 0.5)) {
      throw new RangeError(`twin-planning: excessProbability ${input.excessProbability}`);
    }
    if (!(input.tieRate >= 0 && input.tieRate < 1)) throw new RangeError(`twin-planning: tieRate ${input.tieRate}`);
    // X ∈ {0, 1}, null 1/2: E[(X − ½)²] = ¼ exactly; λmax = ½ / (½ − 0) = 1.
    const g = growthPerTick(input.excessProbability, 0.25, 1);
    return g > 0 ? target / g / (1 - input.tieRate) : Infinity;
  }
  const { canaryShare: pi, oddsRatio, badEventsPerTick: e } = input;
  if (!(pi > 0 && pi < 1)) throw new RangeError(`twin-planning: canaryShare ${pi}`);
  if (!(oddsRatio > 0)) throw new RangeError(`twin-planning: oddsRatio ${oddsRatio}`);
  if (!(e > 0)) throw new RangeError(`twin-planning: badEventsPerTick ${e}`);
  // Rare-event limit: the canary's share of bad events under the alternative.
  const share = (pi * oddsRatio) / (pi * oddsRatio + 1 - pi);
  const mu = share - pi;
  const m2 = (share * (1 - share)) / e + mu * mu;
  const g = growthPerTick(mu, m2, 0.5 / pi);
  return g > 0 ? target / g : Infinity;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx tsc && node --test dist/test/twin-planning.test.js`
Expected: 6 tests PASS. If the median test fails, do not widen the band. Record the measured ratio in the Task 10 report as the planning bias, and report the failure.

- [ ] **Step 5: Commit**

```bash
git rev-parse --abbrev-ref HEAD   # must print main
git add per-shard/twin-planning.ts test/twin-planning.test.ts
git commit -m "per-shard: twin bake-length planning figure (ADR 0036)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- per-shard/twin-planning.ts test/twin-planning.test.ts
```

---

### Task 6: Guarantee table rows

**Files:**
- Modify: `guarantees.ts`: imports (lines 40–43), `GUARANTEE_TABLE` (append before the closing `]` at the end of the array), `APPROXIMATE_E_VALUE_BY_CONSTRUCTION` (~line 390), `ESTIMATED_BASELINE_GUARANTEES` (~line 436)
- Test: `test/guarantees.test.ts` (append)

**Interfaces:**
- Consumes: `TWIN_RATE_ENVELOPE` and `TWIN_SIGN_ENVELOPE` from Task 3
- Produces: `guaranteeFor('twin_rate_http_5xx')` and `guaranteeFor('twin_sign_p99_ms')` return rows. `ESTIMATED_BASELINE_GUARANTEES` gains the keys `twin_rate` and `twin_sign`.

- [ ] **Step 1: Write the failing test**

Append to `test/guarantees.test.ts`:

```ts
test('ADR 0036: twin rows resolve by prefix, carry live envelopes, and claim a genuine e-value', () => {
  const rate = guaranteeFor('twin_rate_http_5xx');
  const sign = guaranteeFor('twin_sign_p99_ms');
  assert.ok(rate && sign);
  assert.equal(rate.estimatedBaseline, ESTIMATED_BASELINE_GUARANTEES.twin_rate);
  assert.equal(sign.estimatedBaseline, ESTIMATED_BASELINE_GUARANTEES.twin_sign);
  assert.equal(rate.validityClass, 'ville_anytime_valid');
  assert.equal(APPROXIMATE_E_VALUE_BY_CONSTRUCTION.twin_rate.form, 'e_value');
  assert.equal(APPROXIMATE_E_VALUE_BY_CONSTRUCTION.twin_sign.form, 'e_value');
  assert.match(rate.evidence, /REGISTERED, NOT RUN/);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx tsc`
Expected: FAIL. Property `twin_rate` does not exist on `ESTIMATED_BASELINE_GUARANTEES`.

- [ ] **Step 3: Implement**

Add the import beside the other envelope imports:

```ts
import { TWIN_RATE_ENVELOPE, TWIN_SIGN_ENVELOPE } from './detectors/twin-contrast';
```

Append two rows to `GUARANTEE_TABLE`:

```ts
  {
    idPrefixes: ['twin_rate_'],
    family: 'A',
    detector: 'randomized twin, rate kind: canary share of bad events vs traffic share, Fisher noncentral proceed null (ADR 0036)',
    implementation: 'detectors/twin-contrast.ts over detectors/_paired-bet.ts; fusion per-shard/twin-gate.ts',
    validityClass: 'ville_anytime_valid',
    estimatedBaseline: TWIN_RATE_ENVELOPE,
    alphaPolicy: 'ville_spend',
    evidence: 'By construction (ADR 0036): a bounded bet against a null mean observed in the same tick; '
      + 'nothing estimated. Unit and Monte Carlo property tests only (test/paired-bet.test.ts, '
      + 'test/twin-contrast.test.ts). Study 2026-09-twin-null REGISTERED, NOT RUN. No real-deploy (T3) '
      + 'measurement.',
    approximateEValue: {
      form: 'e_value',
      note: 'genuine e-process under the pairing premise (randomized routing, no arm-specific persistent '
        + 'state under H0); the premise boundary is what study 2026-09-twin-null measures.',
    },
  },
  {
    idPrefixes: ['twin_sign_'],
    family: 'A',
    detector: 'randomized twin, sign kind: P(canary tick worse) vs 1/2 at equal routing weights (ADR 0036)',
    implementation: 'detectors/twin-contrast.ts over detectors/_paired-bet.ts; fusion per-shard/twin-gate.ts',
    validityClass: 'ville_anytime_valid',
    estimatedBaseline: TWIN_SIGN_ENVELOPE,
    alphaPolicy: 'ville_spend',
    evidence: 'By construction (ADR 0036): exchangeability of equal-weight arms fixes the null at 1/2. '
      + 'Unit tests only (test/twin-contrast.test.ts, test/twin-gate.test.ts). Study 2026-09-twin-null '
      + 'REGISTERED, NOT RUN. No real-deploy (T3) measurement.',
    approximateEValue: {
      form: 'e_value',
      note: 'genuine e-process under exchangeable equal-weight arms; unequal weights break it for skewed '
        + 'tick statistics (checkTwinGateConfig refuses them).',
    },
  },
```

Add to `APPROXIMATE_E_VALUE_BY_CONSTRUCTION`:

```ts
  twin_rate: {
    form: 'e_value',
    note: 'ADR 0036: no estimated parameter; exact under the pairing premise at any routing split.',
  },
  twin_sign: {
    form: 'e_value',
    note: 'ADR 0036: no estimated parameter; exact under exchangeable equal-weight arms.',
  },
```

Add to `ESTIMATED_BASELINE_GUARANTEES`:

```ts
  /** ADR 0036: the randomized twin — no baseline at all; validity rests on the pairing premise. */
  twin_rate: TWIN_RATE_ENVELOPE,
  twin_sign: TWIN_SIGN_ENVELOPE,
```

- [ ] **Step 4: Run the full suite**

Run: `npm test`
Expected: all PASS. If a test asserts a literal count of `ESTIMATED_BASELINE_GUARANTEES` keys or `GUARANTEE_TABLE` rows, find it with `grep -n "length, [0-9]" test/guarantees.test.ts`, raise that literal by 2, and add a comment naming ADR 0036.

- [ ] **Step 5: Commit**

```bash
git rev-parse --abbrev-ref HEAD   # must print main
git add guarantees.ts test/guarantees.test.ts
git commit -m "guarantees: twin_rate and twin_sign rows (ADR 0036)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- guarantees.ts test/guarantees.test.ts
```

---

### Task 7: CHANGELOG

**Files:**
- Modify: `CHANGELOG.md` (under `## Unreleased`)

- [ ] **Step 1: Add the entry**

Under `## Unreleased`:

```markdown
- **ADR 0036 — the randomized twin (library only, PROPOSED).** `detectors/_paired-bet.ts` (one-sided
  bounded-mean betting e-process, per-observation null mean), `detectors/twin-contrast.ts` (`rate`:
  canary share of bad events vs the observed traffic share, Fisher noncentral proceed null; `sign`:
  P(canary tick worse) vs 1/2 at equal weights), `per-shard/twin-gate.ts` (rollback / proceed /
  extend / inconclusive / invalid_experiment; Bonferroni rollback, intersection–union proceed,
  two-sided sample-ratio guard), `per-shard/twin-planning.ts` (bake length, power only). The FDR gate
  gains `pairingAdmissible` (`randomizedArms`, `equalWeightArms`). No estimated baseline anywhere
  in the null. Study `2026-09-twin-null` registered, not run; no consumer authority.
```

- [ ] **Step 2: Commit**

```bash
git rev-parse --abbrev-ref HEAD   # must print main
git add CHANGELOG.md
git commit -m "changelog: ADR 0036 randomized twin

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- CHANGELOG.md
```

---

### Task 8: Code review gate

- [ ] **Step 1:** Run `npm test`. Expected: all tests pass. Record the count.
- [ ] **Step 2:** Invoke `superpowers:requesting-code-review` over the Tasks 1–7 commits. Ask the reviewer to check three things specifically:
  - every null mean passed to `updatePairedBet` is observed in the same tick or fixed;
  - λ is computed before the observation is consumed;
  - `fisherNoncentralMean` is monotone and exact at ψ = 1.
- [ ] **Step 3:** Fix the findings with a failing test first. Commit each fix on its own, scoped with a pathspec.

---

### Task 9: Register the study (before any harness code)

Execute under the `run-study` skill.

**Files:**
- Create: `validation/twin-null/PREREGISTRATION.md`
- Modify: `~/concord/knowledge/WORKLIST.md` (separate repo, separate commit)

- [ ] **Step 1: Write the registration**

Create `validation/twin-null/PREREGISTRATION.md`:

```markdown
# Pre-registration — the randomized twin null (`2026-09-twin-null`, ADR 0036)

- **Study id:** `2026-09-twin-null`
- **What it serves:** ADR 0036's claim that a canary-vs-control e-process with an observed or fixed
  null mean holds its Ville contract with nothing estimated, and where its pairing premise breaks.
- **Tier:** T1 (synthetic, oracle generator). No real-deploy claim; T3 is Follow-on Plan D.
- **Engine:** the commit that contains Tasks 1–8 of
  `docs/superpowers/plans/2026-09-25-randomized-twin-gate.md` (fill in the SHA at registration commit).
- **Status: REGISTERED, NOT RUN.** A later change is an amendment, appended and dated.

## 1. Generator

T = 2000 ticks, R = 1000 replications per cell, α = 0.05 for both tests (single metric per cell,
so no Bonferroni). Seed per cell i: `lcg(20260925 + 7919·i)`, one stream across its replications;
cells in the order of §3. Per tick:

- traffic N_t ~ Poisson(2000 · s_t), s_t = 1 + 0.5 sin(2πt / 1440);
- canary requests n_c = round(N_t w + √(N_t w (1−w)) z) clamped to [0, N_t]; control n_k = N_t − n_c;
- arm-specific persistent state a_t (one per arm, independent): AR(1), marginal sd σ_arm, coefficient φ,
  started at stationarity;
- cold start (CS cells only): canary a_t += 0.3 · exp(−t / 30);
- **rate**: bad-event probability p_t = 0.01 · s_t · o_t with shared outage o_t = 5 on t ∈ [800, 900),
  1 otherwise; bad events per arm ~ Poisson(n · p_t · exp(a_t)) (Poisson thinning: the regime where
  the conditional allocation is exactly binomial; the binomial correction at p = 0.01 is not measured);
- **sign**: tick value per arm = 100 · s_t · (3 on t ∈ [800, 900), else 1) + 10 · a_t + 30 · ℓ / √max(n, 1),
  ℓ a centered lognormal (σ 0.75): exp(0.75 z) − exp(0.28125);
- **sign-direct** (P5 only): canary worse with probability exactly 0.5 + τ.

Warm-up exclusion W: ticks t < W are generated and not fed to the detector.

Default tolerances: rate ρ = 0.5, sign τ = 0.1.

## 2. Measured quantities

Per cell: false-rollback rate (rollback wealth ≥ 1/α at any tick ≤ T), false-proceed rate (proceed
wealth ≥ 1/α), median crossing tick among crossings, each with its binomial SE. Bar
B = α + 2.58 · √(α(1−α)/R) = 0.0678.

## 3. Cells

| Group | Kind | w | φ | σ_arm | other | Bar |
|---|---|---|---|---|---|---|
| P1 | rate | 0.5, 0.1 | – | 0 | – | false rollback ≤ B |
| P1 | sign | 0.5 | – | 0 | – | false rollback ≤ B |
| P2 | rate, sign | 0.5, 0.1 | 0, 0.5, 0.9, 0.99 | 0.1, 0.3 | – | report only |
| P3 | sign | 0.1 | – | 0 | worse = higher, lower | report vs B |
| CS | rate, sign | 0.5 | – | 0 | cold start, W = 0 and W = 150 | W = 150: false rollback ≤ B |
| P4 | rate | 0.5, 0.1 | – | 0 | canary rate × 1.2 | report power, median tick, plan ratio |
| P4 | sign | 0.5 | – | 0 | canary value + 0.5, + 2 | report power, median tick |
| P5 | rate | 0.5, 0.1 | – | 0 | canary rate × 1.5 (ψ at the tolerance) | false proceed ≤ B |
| P5 | sign-direct | – | – | – | τ = 0.1 | false proceed ≤ B |

## 4. Predictions (registered)

- P1: PASS in every cell, false rollback ≤ 0.03 (the capped bet is conservative).
- P2: at φ = 0 PASS for every σ_arm (iid arm noise stays conditionally mean-zero); at σ_arm = 0.3 and
  φ ≥ 0.9, FAIL for both kinds. This is the premise boundary, not a defect.
- P3: w = 0.1 with worse = lower FAILS (the larger-spread arm's median sits below its mean for a
  right-skewed ℓ, so the small arm reads as worse on 'lower'); worse = higher stays within B.
- CS: W = 0 FAILS for both kinds; W = 150 PASSES.
- P4: rate × 1.2 at w = 0.5 detected in ≥ 80% of runs; measured median / `ticksToDetect` between 1 and 3.
- P5: PASS in every cell.

## 5. Ship rule

The twin path may be PROPOSED for DeploySignal rollback authority (Follow-on Plan B) only if every
P1 and P5 cell and the CS W = 150 cells pass. Any failure there: the envelope records it, no
authority. P2 and P3 results are written into the envelope notes as the premise boundary.
Authority additionally requires Follow-on Plan D (real-service A/A, T3).
```

- [ ] **Step 2: Add the worklist row**

In `~/concord/knowledge`, re-check `git rev-parse --abbrev-ref HEAD` (must be `main`) and `git status --porcelain`. Find the next free row number with `grep -o '^| C[0-9]\+' WORKLIST.md | sort -t C -k2 -n | tail -1`. Add a row in the existing format: `2026-09-twin-null — randomized twin null (engine ADR 0036), REGISTERED at <engine SHA>, not run; evidence: deploysignal-engine/validation/twin-null/PREREGISTRATION.md`. Commit it in the knowledge repo, scoped to `WORKLIST.md`.

- [ ] **Step 3: Commit the registration (engine)**

```bash
git rev-parse --abbrev-ref HEAD   # must print main
git add validation/twin-null/PREREGISTRATION.md
git commit -m "validation: register study 2026-09-twin-null (ADR 0036)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- validation/twin-null/PREREGISTRATION.md
```

---

### Task 10: Harness, run, report, wiki page

Execute under the `run-study` skill. The harness is written after the Task 9 commit.

**Files:**
- Create: `validation/twin-null/harness/run.mjs`
- Output: `validation/twin-null/results/run-<UTC timestamp>/results.json` and `REPORT.md`
- Wiki: `~/concord/knowledge/stats/pages/twin-null-<run date>.md`

- [ ] **Step 1: Write the harness**

Create `validation/twin-null/harness/run.mjs`:

```js
// validation/twin-null/harness/run.mjs — study 2026-09-twin-null (ADR 0036). Registered in
// ../PREREGISTRATION.md before this file existed; generator, cells, seeds and bars are §1–§5 there.
// Drives the committed dist/ (run `npx tsc` first).

import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const twin = require('../../../dist/detectors/twin-contrast.js');
const planning = require('../../../dist/per-shard/twin-planning.js');

const HERE = dirname(fileURLToPath(import.meta.url));
const T = 2000, R = 1000, ALPHA = 0.05, TRAFFIC = 2000, P0 = 0.01, DAY = 1440;
const BAR = ALPHA + 2.58 * Math.sqrt((ALPHA * (1 - ALPHA)) / R);

function lcg(seed) {
  let s = seed >>> 0;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return (s + 0.5) / 4294967296; };
}
function gaussian(rng) { return Math.sqrt(-2 * Math.log(rng())) * Math.cos(2 * Math.PI * rng()); }
function poisson(rng, mean) {
  if (mean <= 0) return 0;
  if (mean > 30) return Math.max(0, Math.round(mean + Math.sqrt(mean) * gaussian(rng)));
  const L = Math.exp(-mean); let k = 0, p = 1;
  do { k++; p *= rng(); } while (p > L);
  return k - 1;
}
function split(rng, n, w) {
  return Math.min(n, Math.max(0, Math.round(n * w + Math.sqrt(n * w * (1 - w)) * gaussian(rng))));
}
function centeredLognormal(rng) { return Math.exp(0.75 * gaussian(rng)) - Math.exp(0.28125); }

// §3, in registered order.
const CELLS = [];
CELLS.push({ id: 'P1-rate-w0.5', group: 'P1', kind: 'rate', w: 0.5 });
CELLS.push({ id: 'P1-rate-w0.1', group: 'P1', kind: 'rate', w: 0.1 });
CELLS.push({ id: 'P1-sign-w0.5', group: 'P1', kind: 'sign', w: 0.5 });
for (const kind of ['rate', 'sign']) for (const w of [0.5, 0.1]) for (const phi of [0, 0.5, 0.9, 0.99]) for (const sigmaArm of [0.1, 0.3]) {
  CELLS.push({ id: `P2-${kind}-w${w}-phi${phi}-s${sigmaArm}`, group: 'P2', kind, w, phi, sigmaArm });
}
CELLS.push({ id: 'P3-sign-w0.1-higher', group: 'P3', kind: 'sign', w: 0.1, worse: 'higher' });
CELLS.push({ id: 'P3-sign-w0.1-lower', group: 'P3', kind: 'sign', w: 0.1, worse: 'lower' });
for (const kind of ['rate', 'sign']) for (const warmup of [0, 150]) {
  CELLS.push({ id: `CS-${kind}-W${warmup}`, group: warmup === 0 ? 'CS0' : 'CS', kind, w: 0.5, cold: true, warmup });
}
CELLS.push({ id: 'P4-rate-w0.5-x1.2', group: 'P4', kind: 'rate', w: 0.5, rateMult: 1.2 });
CELLS.push({ id: 'P4-rate-w0.1-x1.2', group: 'P4', kind: 'rate', w: 0.1, rateMult: 1.2 });
CELLS.push({ id: 'P4-sign-w0.5-+0.5', group: 'P4', kind: 'sign', w: 0.5, signShift: 0.5 });
CELLS.push({ id: 'P4-sign-w0.5-+2', group: 'P4', kind: 'sign', w: 0.5, signShift: 2 });
CELLS.push({ id: 'P5-rate-w0.5-x1.5', group: 'P5', kind: 'rate', w: 0.5, rateMult: 1.5 });
CELLS.push({ id: 'P5-rate-w0.1-x1.5', group: 'P5', kind: 'rate', w: 0.1, rateMult: 1.5 });
CELLS.push({ id: 'P5-sign-direct', group: 'P5', kind: 'sign-direct', w: 0.5 });

function replicate(cell, rng) {
  const kind = cell.kind === 'sign-direct' ? 'sign' : cell.kind;
  const spec = { id: 'm', kind, worse: cell.worse ?? 'higher', tolerance: kind === 'rate' ? 0.5 : 0.1 };
  const sigma = cell.sigmaArm ?? 0, phi = cell.phi ?? 0, innov = sigma * Math.sqrt(1 - phi * phi);
  let aC = sigma > 0 ? sigma * gaussian(rng) : 0;
  let aK = sigma > 0 ? sigma * gaussian(rng) : 0;
  let st = twin.initTwinMetric();
  let rollbackAt = -1, proceedAt = -1;
  for (let t = 0; t < T; t++) {
    if (sigma > 0) { aC = phi * aC + innov * gaussian(rng); aK = phi * aK + innov * gaussian(rng); }
    const cold = cell.cold ? 0.3 * Math.exp(-t / 30) : 0;
    const season = 1 + 0.5 * Math.sin((2 * Math.PI * t) / DAY);
    const inOutage = t >= 800 && t < 900;
    let obs;
    if (cell.kind === 'sign-direct') {
      obs = rng() < 0.5 + spec.tolerance ? { canary: 1, control: 0 } : { canary: 0, control: 1 };
    } else {
      const n = poisson(rng, TRAFFIC * season);
      const nc = split(rng, n, cell.w), nk = n - nc;
      if (cell.kind === 'rate') {
        const p = P0 * season * (inOutage ? 5 : 1);
        obs = {
          canaryEvents: Math.min(nc, poisson(rng, nc * p * (cell.rateMult ?? 1) * Math.exp(aC + cold))), canaryTotal: nc,
          controlEvents: Math.min(nk, poisson(rng, nk * p * Math.exp(aK))), controlTotal: nk,
        };
      } else {
        const shared = 100 * season * (inOutage ? 3 : 1);
        obs = {
          canary: shared + 10 * (aC + cold) + (cell.signShift ?? 0) + (30 * centeredLognormal(rng)) / Math.sqrt(Math.max(nc, 1)),
          control: shared + 10 * aK + (30 * centeredLognormal(rng)) / Math.sqrt(Math.max(nk, 1)),
        };
      }
    }
    if (t < (cell.warmup ?? 0)) continue;
    st = twin.updateTwinMetric(spec, st, obs);
    const ev = twin.twinMetricEvidence(st);
    if (rollbackAt < 0 && ev.rollbackE >= 1 / ALPHA) rollbackAt = t;
    if (proceedAt < 0 && ev.proceedE >= 1 / ALPHA) proceedAt = t;
    if (rollbackAt >= 0 && proceedAt >= 0) break;
  }
  return { rollbackAt, proceedAt };
}

function median(xs) { if (xs.length === 0) return null; const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; }
function se(p) { return Math.sqrt((p * (1 - p)) / R); }

const results = [];
CELLS.forEach((cell, i) => {
  const rng = lcg(20260925 + 7919 * i);
  const rb = [], pr = [];
  for (let r = 0; r < R; r++) {
    const out = replicate(cell, rng);
    if (out.rollbackAt >= 0) rb.push(out.rollbackAt);
    if (out.proceedAt >= 0) pr.push(out.proceedAt);
  }
  const rollbackRate = rb.length / R, proceedRate = pr.length / R;
  const row = {
    id: cell.id, group: cell.group,
    rollbackRate, rollbackSE: se(rollbackRate), medianRollbackTick: median(rb),
    proceedRate, proceedSE: se(proceedRate), medianProceedTick: median(pr),
  };
  if (cell.group === 'P1' || cell.group === 'CS') row.verdict = rollbackRate <= BAR ? 'PASS' : 'FAIL';
  if (cell.group === 'P5') row.verdict = proceedRate <= BAR ? 'PASS' : 'FAIL';
  if (cell.group === 'P2' || cell.group === 'P3' || cell.group === 'CS0') row.withinBar = rollbackRate <= BAR;
  if (cell.group === 'P4' && cell.kind === 'rate') {
    row.planTicks = planning.ticksToDetect({ kind: 'rate', canaryShare: cell.w, oddsRatio: cell.rateMult, badEventsPerTick: TRAFFIC * P0, alpha: ALPHA });
    row.medianOverPlan = row.medianRollbackTick === null ? null : row.medianRollbackTick / row.planTicks;
  }
  results.push(row);
  process.stdout.write(`${cell.id}: rollback ${rollbackRate.toFixed(4)} proceed ${proceedRate.toFixed(4)}${row.verdict ? ' ' + row.verdict : ''}\n`);
});

const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
const out = join(HERE, '..', 'results', `run-${stamp}`);
mkdirSync(out, { recursive: true });
writeFileSync(join(out, 'results.json'), JSON.stringify({ study: '2026-09-twin-null', T, R, ALPHA, BAR, results }, null, 2));
const lines = [
  `# 2026-09-twin-null — run-${stamp}`, '',
  `T = ${T}, R = ${R}, α = ${ALPHA}, bar B = ${BAR.toFixed(4)}. Registered: ../../PREREGISTRATION.md.`, '',
  '| cell | group | false/true rollback | SE | median tick | proceed | SE | verdict / within B | median ÷ plan |',
  '|---|---|---|---|---|---|---|---|---|',
  ...results.map((r) => `| ${r.id} | ${r.group} | ${r.rollbackRate.toFixed(4)} | ${r.rollbackSE.toFixed(4)} | ${r.medianRollbackTick ?? '–'} | ${r.proceedRate.toFixed(4)} | ${r.proceedSE.toFixed(4)} | ${r.verdict ?? (r.withinBar === undefined ? '–' : r.withinBar ? 'within' : 'exceeds')} | ${r.medianOverPlan == null ? '–' : r.medianOverPlan.toFixed(2)} |`),
];
writeFileSync(join(out, 'REPORT.md'), lines.join('\n') + '\n');
process.stdout.write(`wrote ${out}\n`);
```

- [ ] **Step 2: Commit the harness before running it**

```bash
git rev-parse --abbrev-ref HEAD   # must print main
git add validation/twin-null/harness/run.mjs
git commit -m "validation: twin-null harness (registered study 2026-09-twin-null)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- validation/twin-null/harness/run.mjs
```

- [ ] **Step 3: Run**

Run: `npx tsc && node validation/twin-null/harness/run.mjs`
Expected: 48 lines of progress (3 P1 + 32 P2 + 2 P3 + 4 CS + 4 P4 + 3 P5), then `wrote validation/twin-null/results/run-…`. Expected wall time is 5–30 minutes. Run it in the background and wait for completion rather than polling.

- [ ] **Step 4: Score against the registration**

For every registered prediction in §4, record held or failed, with the cell's number. Apply the ship rule in §5 verbatim. Append the verdict to the run's `REPORT.md` under `## Verdict against the registration`.

- [ ] **Step 5: Write the results into code where they belong**

In the `notes` of `TWIN_RATE_ENVELOPE` and `TWIN_SIGN_ENVELOPE`, replace "Study 2026-09-twin-null registered, not run." with the run id and the numbers for P1, P2's boundary, P3 and CS. In the two `GUARANTEE_TABLE` rows' `evidence`, replace "REGISTERED, NOT RUN" with the run id and the verdict under the ship rule. Update the Task 6 test's `assert.match(rate.evidence, /REGISTERED, NOT RUN/)` to match the run id. Run `npm test`, then commit the results directory together with the code change, scoped with a pathspec.

- [ ] **Step 6: Wiki page**

Under `~/concord/knowledge/SCHEMA.md`, create `stats/pages/twin-null-<run date>.md` with:
- the claim;
- the engine SHA and version;
- tier T1;
- the table from `REPORT.md`;
- the verdict against the registration;
- the premise boundary P2/P3/CS measured.

Set `confidence` to `high` only if every bar was scored as registered. Link it from `stats/index.md`, and mark the Task 9 WORKLIST row as run, pointing at the page. Re-check branch and cleanliness in the knowledge repo, then commit with a pathspec.

---

## Follow-on plans (sequenced, each written as its own plan when its predecessor lands)

These are not placeholders. Each depends on a result this plan produces, and its detail depends on that result.

### Plan B — DeploySignal gate integration (after Task 10; authority flip after Plan D)

Repo `~/concord/deploysignal`. Canonical development happens in `deploysignal-private`; check which tree is current before starting.

1. Re-pin `@johnpatrickwarren-oss/deploysignal-engine` to the release that carries ADR 0036.
2. Profile schema (`profiles/schema/profile.schema.json`): add a `twin_arm` block with `canary_weight`, `alpha_rollback`, `alpha_proceed`, `alpha_srm`, `max_ticks`, and `metrics[] {id, kind: rate|sign, worse, tolerance}`. Add a `profiles/twin-generic.yaml` with no LLM signals.
3. Gate path `engine/gates/_health-twin.ts` wrapping `stepTwinGate`. It is the only family in a twin profile, so Family B's LLM rules do not run there.
4. HTTP service: `POST /v1/sessions` with `mode: "twin"` needs no `scenario.baseline`. The tick body carries per-arm counts and observations. The response carries `TwinGateDecision` plus `ticks_to_detect` from `twin-planning`.
5. Verdict mapping:

   | Engine verdict | DeploySignal verdict | Consumer action |
   |---|---|---|
   | `rollback` | rollback | roll back |
   | `proceed` | proceed | promote |
   | `extend` | extend | keep baking; response includes remaining-tick estimate |
   | `inconclusive` | hold | operator decides |
   | `invalid_experiment` | halt | shift traffic back to the old version |

6. Authority constant `TWIN_ARM_AUTHORITY = 'advisory'` in `engine/guarantees.ts`, beside `CONTRAST_ARM_AUTHORITY`. Flip it to `'rollback'` only when the Task 10 ship rule passed and Plan D passed. The flip is its own ADR.
7. Separately, fix the defects found on 2026-09-25:
   - the mixture evaluation loop iterates the hardcoded six signals (`deploysignal-engine/detectors/_page-cusum-mixture.ts:223`) while line 75 of the same file honours `cfg.family_a_signals`;
   - `engine/gates/_health-valid-path.ts:174` does the same;
   - profile `direction_of_better` and `δ_min` are never read (`engine/recalibration/direction-metadata.ts:30-45`);
   - the `low_traffic` rule pins extend below 60% canary share (`engine/gates/_health-defs.ts:348-350`).

### Plan C — Metric sources and deploy-orchestrator integration (parallel with B once B.4's tick body is fixed)

1. `service/sources/metric-source.ts`: the interface `fetchTick(metric, arm, windowStart, windowEnd) → RateObservation | SignObservation` plus per-arm request counts.
2. CloudWatch source (`GetMetricData`, one query per arm dimension):
   - ALB: `HTTPCode_Target_5XX_Count` / `RequestCount` per target group gives a `rate` metric at any weight;
   - ALB: `TargetResponseTime` p99 per target group gives a `sign` metric, which needs equal weights;
   - `sign` works for any namespace and dimension at equal weights.
3. Prometheus source (PromQL with an `arm` label):
   - counters give `rate`;
   - histogram bucket exceedance gives latency as `rate` at any weight: events = `count − bucket{le=L}`;
   - gauges give `sign`.
4. Deployment topology note. A CodeDeploy canary compares against the warm production fleet, which violates the premise (cold canary). The supported shape is three target groups (prod on the old version, baseline on the old version at the canary's weight, canary on the new version), with a weighted listener. The study's CS W=150 result sets the warm-up default if the plain canary shape is used.
5. CodeDeploy integration: an ECS blue/green `AfterAllowTraffic` lifecycle hook Lambda. It opens a twin session, polls sources each tick, and calls `PutLifecycleEventHookExecutionStatus` (`Succeeded` on proceed; `Failed` on rollback, halt or hold).
6. Argo Rollouts: update `service/gate-http/argo/analysis-template.yaml` to twin mode, with an experiment step that creates the baseline ReplicaSet at the canary weight.

### Plan D — Real-service validation (T3) before any authority

Register it under `run-study` before running.
1. **A/A test:** deploy the same version to canary and control on a real service, over at least 30 runs at the production bake length. Measure the false-rollback, false-proceed and invalid-experiment rates against their α.
2. **A/B with injected faults:** AWS FIS or Gremlin latency and error injection on the canary arm only, at the P4 effect sizes. Record power against `ticksToDetect`.
3. Write a wiki page with tier T3. If the A/A test passes, write the ADR that flips `TWIN_ARM_AUTHORITY`.

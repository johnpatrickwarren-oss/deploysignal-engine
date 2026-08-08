# Coverage-Gap Detectors (K4/K3/K6) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and certify the three ratified constructions — K4 conformal tail-bet, K3 periodogram betting e-process, K6 block-conformal shape bet — through the frozen coverage machinery, ending in updated COVERAGE.md answers (YES or an honest refutation per class).

**Architecture:** Three self-contained detector modules in `detectors/` (TypeScript, engine test pattern), one additive pre-registration amendment per detector group committed before its runs, adapters in the existing `validation/coverage/harness/run-battery.mjs`, registered runs, and cert re-scores. Build order K4 → K3 → K6; each group completes (run + re-score + answer) before the next starts, so an early refutation is recorded without stalling the rest.

**Tech Stack:** TypeScript detectors (tsc + node --test), plain `.mjs` harness extensions. No new dependencies.

**Authority:** `~/concord/knowledge/methodology/pages/coverage-gap-detectors.md` (RATIFIED 2026-08-08) governs; then `validation/coverage/PREREGISTRATION.md` (+ its amendments); then this plan. **One registered attempt per construction** — a refuted stop condition is recorded, the class stays NO, and the group's remaining tasks convert to write-back only. Never tune past a stop condition.

## Global Constraints

- Repo `~/concord/deploysignal-engine`, PR-gated, **never commit to `main`**. Branch `gap/k346-v1` off `main` (`cdc1c78`); worktree `~/.sdd-worktrees/engine-gap`.
- Registered constants (freeze in the amendment + cards, then never move): **κ = 0.1** for every κp^(κ−1) calibrator (derivation registered: log-optimal κ\* = −1/E_alt[log p]; at the registered alternatives p ≈ 1e-4 → κ\* ≈ 0.108, registered as 0.1); K4 calibration **n = 10,000** held-out scores, score `s = |x − median_ref| / MAD_ref`; K3 **W = 30**, Fourier bins **k ∈ {1, 2, 3}** (f = k/30), ordinate `U = I(f_k)/σ²` with `I(f_k) = |Σ_{t<W} x_t · e^(−i2πkt/W)|² / W`, per-window `p = exp(−U)` (exact Uniform(0,1) for iid N(0, σ²), k ∉ {0, W/2}); K6 **W = 30**, features **{sample kurtosis, |sample skew|}**, **m = 300** disjoint contiguous reference blocks, distance-rank conformal p per feature `p = (1 + #{ref blocks with |T_ref − med_T| ≥ |T_live − med_T|}) / (m + 1)` where `med_T` is the reference-block median of that feature.
- Combination rules (from the design page, non-negotiable): bins/features combine by **averaging** e-values (never max); windows combine by **product** (disjoint ⇒ martingale). K4 is per-point terminal (no product needed for its endpoint).
- Amendments are additive: new detector rows + healthy/S3 arms + constants + stop conditions + seeds continuing the CELL_SEED sequence; grids, floors, existing seeds, and endpoints untouched. Each amendment commits ALONE before its group's runs. Smoke runs route to `results/sim` (the harness already enforces N ≠ 2000 → sim).
- Stop conditions (registered per group in the amendment): K4 — healthy-arm per-point exceedance Wilson 95% lower bound > α. K3 — healthy-arm crossing rate Wilson LB > α. K6 — healthy crossing Wilson LB > α on the T1 battery **or on the T2 clustersynth arm**; T2 is required for a K6 YES. A fired stop condition = REFUTED: record, file, class stays NO.
- Commits: `-m` before `--` pathspec; trailer `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`. Cards freeze before their group's registered runs. All suites green at every task end (`npm test`, `npm run test:cert`, coverage suite).

## File Structure

```
detectors/point-tail-bet-e-value.ts        # K4 (Task 1)
detectors/spectral-bet-e-process.ts        # K3 (Task 6)
detectors/shape-block-conformal-bet.ts     # K6 (Task 9)
test/point-tail-bet-e-value.test.ts        # Task 1
test/spectral-bet-e-process.test.ts        # Task 6
test/shape-block-conformal-bet.test.ts     # Task 9
validation/coverage/PREREGISTRATION.md     # Amendments v2.K4 (Task 2), v2.K3 (Task 7), v2.K6 (Task 10)
validation/certification/cards/point_tail_bet_e_value.json      # Task 3
validation/certification/cards/spectral_bet_e_process.json      # Task 7
validation/certification/cards/shape_block_conformal_bet.json   # Task 10
validation/coverage/harness/run-battery.mjs                     # adapters (Tasks 4, 8, 11)
validation/coverage/harness/run-clustersynth-arm.mjs            # K6 T2 arm (Task 11)
```

---

### Task 1: K4 module — conformal tail-bet e-value

**Files:**
- Create: `detectors/point-tail-bet-e-value.ts`
- Test: `test/point-tail-bet-e-value.test.ts`

**Interfaces:**
- Produces: `calibrateTailBet(rows: number[]): TailBetCalibration` (computes `median_ref`, `mad_ref`, and the sorted score array from held-out rows; throws if `rows.length < 10_000` or MAD is 0) — `TailBetCalibration = { median: number; mad: number; sortedScores: number[] }`. And `pointTailBetEValue(x: number, cal: TailBetCalibration, kappa?: number): { e: number; p: number; score: number }` with `kappa` defaulting to `KAPPA = 0.1` (exported const): `score = |x − cal.median| / cal.mad`; `p = (1 + countGte(cal.sortedScores, score)) / (n + 1)` (binary search); `e = kappa * p^(kappa−1)`.

- [ ] **Step 1: Failing tests**

```ts
// test/point-tail-bet-e-value.test.ts — node:test + assert/strict, engine pattern
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calibrateTailBet, pointTailBetEValue, KAPPA } from '../detectors/point-tail-bet-e-value';

const lcg = (s: number) => () => ((s = (s * 1664525 + 1013904223) >>> 0), s / 2 ** 32);
const gauss = (r: () => number) => Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r());

test('KAPPA is the registered constant', () => { assert.equal(KAPPA, 0.1); });

test('calibrate refuses short or degenerate rows', () => {
  assert.throws(() => calibrateTailBet([1, 2, 3]));
  assert.throws(() => calibrateTailBet(new Array(10000).fill(7)));
});

test('validity: healthy exceedance at alpha=0.05 within binomial tolerance', () => {
  const r = lcg(20260808);
  const cal = calibrateTailBet(Array.from({ length: 10000 }, () => gauss(r)));
  let exceed = 0; const N = 4000;
  for (let i = 0; i < N; i++) if (pointTailBetEValue(gauss(r), cal).e >= 20) exceed++;
  // E[1{e>=20}] = P(p <= (20/kappa)^(1/(kappa-1))) = (200)^(-1/0.9) ≈ 0.00279; 3σ tolerance
  const p0 = Math.pow(200, -1 / 0.9);
  assert.ok(exceed / N < p0 + 3 * Math.sqrt(p0 / N), `exceedance ${exceed / N}`);
});

test('mean e under H0 <= 1 within tolerance (calibrator integral)', () => {
  const r = lcg(42);
  const cal = calibrateTailBet(Array.from({ length: 10000 }, () => gauss(r)));
  let s = 0; const N = 20000;
  for (let i = 0; i < N; i++) s += pointTailBetEValue(gauss(r), cal).e;
  assert.ok(s / N < 1.15, `mean e ${s / N}`); // heavy-tailed; refusal-direction check only
});

test('a beyond-calibration point is decisive on its own', () => {
  const r = lcg(7);
  const cal = calibrateTailBet(Array.from({ length: 10000 }, () => gauss(r)));
  const { e, p } = pointTailBetEValue(1e6, cal);
  assert.equal(p, 1 / 10001);
  assert.ok(e > 300 && e < 500, `e ${e}`); // 0.1 * (1/10001)^(-0.9) ≈ 398
});
```

- [ ] **Step 2:** `npm test` → the new file FAILS (module not found).
- [ ] **Step 3: Implement** — ~60 lines; binary search for `countGte`; MAD = median(|x − median|) · 1 (raw MAD, no consistency constant — the score is rank-based so scale constants cancel; say so in the docstring); docstring cites the two-step validity argument (conformal super-uniformity under exchangeability; ∫κp^(κ−1) = 1) and the design page.
- [ ] **Step 4:** `npm test` green (299 + 5).
- [ ] **Step 5: Commit** scoped to the two files + dist.

### Task 2: Amendment v2.K4 (freezes before K4 runs)

**Files:** Modify `validation/coverage/PREREGISTRATION.md` (append `## Amendment v2.K4 — 2026-08-08, before any K4 candidate run`).

Registers: the K4 constants block from Global Constraints verbatim (κ with its derivation, n, score formula); detector `point_tail_bet_e_value` on the four K4 fault cells (reusing their frozen CELL_SEEDs; the held-out stream at the registered `HELDOUT_SEED` offsets pattern, continuing `+500000`); a healthy arm (no injection, N=2000, emitting `exceedance`, `mean_e`, `verdict` per the A1 pattern) and an S3 arm at `shift_sigma: 3`; endpoint for K4 cells: **per-point e ≥ 20 at the injected tick** = detection (the class endpoint; the design's one-point-decisive property), with window-crossing recorded descriptive; the stop condition from Global Constraints; predictions with falsifiers: healthy exceedance ≈ (200)^(−1/0.9) ≈ 0.0028 ≤ α; K4 canonical (5σ-point) detection ≥ 0.50 expected YES — falsifier: canonical rate < 0.50.

- [ ] Write; cross-check every constant against Task 1's exports; commit ALONE.

### Task 3: K4 card + freeze

**Files:** Create `validation/certification/cards/point_tail_bet_e_value.json`; freeze via `tools/freeze-cards.mjs`.

Card: class `terminal_e_value`; sources `detectors/point-tail-bet-e-value.ts`; guarantee `per-point conformal tail-bet: p = (1+rank)/(n+1) is super-uniform under exchangeability of held-out and live scores (distribution-free, exact); e = 0.1*p^(-0.9) satisfies E[e|H0] <= 1 by the calibrator integral identity`; quantifiers `[{text:'under exchangeability, any score distribution', tag:'proof', proof_artifact:'conformal super-uniformity + integral of kappa*p^(kappa-1) = 1; unit test asserts both'}]`; regime `{phi_max: 0, m_min: 10000, baseline: 'held-out empirical', nulls: 'exchangeable/iid', phi_known: true}` (serial dependence out-of-claim; the `-ar1` cell measures it); budget participating true; falsifier `healthy-arm per-point exceedance Wilson 95% lower bound > 0.05`; prior_evidence → the coverage study + the design page. Freeze (expiry: this restamps all cards' shared-lib hashes only if lib changed — it did not; expect pin bump on the new card only). validate-cards 12/12, expiry-check current, test:cert green (golden gains the new card row registered at its true pre-run state `NOT_EXECUTABLE`).

- [ ] Author; validate; freeze commit; golden-table extension commit if needed (delta named).

### Task 4: K4 adapter + smoke

**Files:** Modify `validation/coverage/harness/run-battery.mjs`; extend `validation/coverage/test/run-battery.test.mjs`.

Adapter: build calibration once per cell from the registered held-out stream (`calibrateTailBet` from `dist/detectors/point-tail-bet-e-value.js`); per trajectory, per tick in the test window: `pointTailBetEValue(x_t, cal)`; detection = any injected-tick e ≥ 20 (K4 cells) / exceedance counting on the healthy arm. Census assertions extend: the registry census grows by the amendment's exact row count (4 fault + 2 arms = 6 `point_tail_bet_e_value` rows; pin per-detector counts). Smoke (--n 20, sim-routed) exercises the adapter; `adapter_failures === 0`.

- [ ] TDD; suites green; commit scoped to `validation/coverage`.

### Task 5: K4 registered run + re-score + answer

- [ ] Suites green → `node validation/coverage/harness/run-battery.mjs --classes K4 --arms point_tail_bet_e_value` at registered N (live; single invocation for the group; confirm census union before reading). Read fully; stop-condition check FIRST (healthy exceedance), then endpoints. Commit run.
- [ ] `npm run cert:verdict`; expected: `point_tail_bet_e_value` → USE (S2 healthy arm + S3 arm + S4 clean) and K4 → YES at canonical ≥ 0.50 — a different outcome is a finding; report against the amendment's predictions, never tune. Golden delta commit per the registered-delta pattern. Commit cert run.
- [ ] Record the K4 answer in the task report with every endpoint number.

### Task 6: K3 module — periodogram betting e-process

**Files:** Create `detectors/spectral-bet-e-process.ts`; test `test/spectral-bet-e-process.test.ts`.

**Interfaces:** `spectralBetWindow(window: number[], sigma: number, kappa?: number): { perBin: Array<{ k: number; U: number; p: number; e: number }>; eAvg: number }` — for k ∈ BINS = [1,2,3]: `U_k = |Σ_{t<W} window[t]·e^(−i2πkt/W)|² / (W·σ²)`, `p_k = exp(−U_k)`, `e_k = κ·p_k^(κ−1)`, `eAvg = mean(e_k)`; throws unless `window.length === 30` and `sigma > 0`. And `spectralBetWealth(windows: number[][], sigma: number): { wealth: number; log: number[] }` — product of `eAvg` over disjoint windows (log-domain accumulation; the engine's log-wealth convention per ADR 0026).

- [ ] **Step 1: Failing tests**

```ts
test('per-window p is Uniform(0,1) under iid N(0,sigma): moments at n=4000 windows', () => {
  const r = lcg(20260808); const ps: number[] = [];
  for (let w = 0; w < 4000; w++) {
    const win = Array.from({ length: 30 }, () => 2 * gauss(r));
    for (const b of spectralBetWindow(win, 2).perBin) ps.push(b.p);
  }
  const m = ps.reduce((a, b) => a + b) / ps.length;
  const v = ps.reduce((a, b) => a + (b - m) ** 2, 0) / ps.length;
  assert.ok(Math.abs(m - 0.5) < 0.01, `mean ${m}`);      // U(0,1): 0.5
  assert.ok(Math.abs(v - 1 / 12) < 0.005, `var ${v}`);    // U(0,1): 1/12
});
test('healthy wealth crossing rate <= alpha at N=2000 trajectories of 6 windows', ...); // crossing 1/0.05=20; assert rate < 0.05 + 3σ
test('an f=1/10 oscillation at amp 0.75σ drives wealth up', ...);  // wealth > 1 on average over seeds — power smoke, not an endpoint
test('sigma and window-length guards throw', ...);
```

(Write all four in full at implementation time; the shapes above are the required assertions.)

- [ ] Steps 2–5: RED → implement (~80 lines; DFT by direct summation over 3 bins — no FFT dependency) → green → commit.

### Task 7: Amendment v2.K3 + K3 card + freeze

Same pattern as Tasks 2–3. Amendment registers: constants (W, BINS, κ, known-σ regime — the battery passes the generator's true σ, which for these cells is genuinely oracle: state that this closes the I1-class gap for this detector); detector on the six K3 cells + healthy and S3 arms; endpoint: wealth ≥ 20 within the test span; injection-frequency note registered in advance: f = 0.05 is not a Fourier frequency of W = 30 — leakage across bins k∈{1,2} is expected and the canonical cell's power bears it (a low canonical rate with strong k=3-cell rates would be a grid-vs-bin finding, reported); stop condition + predictions with falsifiers. Card: class `test_martingale` (window-indexed; increment instrument), quantifier `proof` (per-window exact uniformity + product over disjoint windows), regime known-σ machine-encoded (`sigma_known: true`), falsifier per Global Constraints. Freeze; suites green.

### Task 8: K3 adapter + smoke + registered run + re-score + answer

Same pattern as Tasks 4–5 (`--classes K3 --arms spectral_bet_e_process`). Expected per the design: YES plausible but genuinely uncertain at canonical (leakage note); an inert canonical with powered grid cells is the pre-named alternative outcome. Record the answer.

### Task 9: K6 module — block-conformal shape bet

**Files:** Create `detectors/shape-block-conformal-bet.ts`; test `test/shape-block-conformal-bet.test.ts`.

**Interfaces:** `calibrateShapeBlocks(rows: number[], W?: number): ShapeCalibration` — slices the held-out rows into `m` disjoint contiguous W-blocks (m = floor(rows.length / W); throws if m < 100), computes per-block kurtosis and |skew|, stores per-feature sorted |deviation-from-median| arrays + medians. `shapeBetWindow(window: number[], cal: ShapeCalibration, kappa?: number): { perFeature: Array<{ name: 'kurtosis'|'absSkew'; T: number; p: number; e: number }>; eAvg: number }` — per feature: `p = (1 + #{ref |dev| ≥ live |dev|}) / (m + 1)`, `e = κp^(κ−1)`, average. `shapeBetWealth(windows: number[][], cal): { wealth: number; log: number[] }` — product.

- [ ] Tests (full code at implementation): moment formulas verified against a hand-computed 6-point array; healthy crossing ≤ α at N=2000×6 windows (iid and AR(1) φ=0.6 with the calibration drawn from the SAME AR(1) process — the contiguity property under test: blocks carry the dependence, so validity holds without knowing φ); bimodal d=1.5 windows drive wealth up (power smoke); guards throw. RED → implement → green → commit.

### Task 10: Amendment v2.K6 + K6 card + freeze

Amendment registers: constants (W, features, m, κ); detector on the four K6 cells + healthy/S3 arms; **the T2 clustersynth arm**: healthy shards from `~/concord/clustersynth` (the engine consumes it the way `validation/shape-battery`'s csui harness did — READ that harness for the shard-realization call), per coordinate: reference = that coordinate's first 9,000 ticks (calibration), live = the remainder in W-blocks; endpoint: healthy-shard crossing rate; the T2-required-for-YES rule with the 82%-history citation; stop conditions (T1 and T2 separately); predictions with falsifiers (registered honest: T1 pass expected; T2 is the open question — the predecessor died here). Card: class `test_martingale`, regime stationary + clean baseline (`contamination_out_of_claim: true` machine-encoded), quantifier `proof` for block-conformal super-uniformity **under block exchangeability** with the stationarity premise stated as the regime bound. Freeze; suites green.

### Task 11: K6 adapters + T2 arm + smoke + registered runs + re-score + answer

**Files:** run-battery adapter (T1 cells + arms) + Create `validation/coverage/harness/run-clustersynth-arm.mjs` (T2: walks healthy clustersynth shards, per-coordinate calibrate-then-score, emits cells `{detector, fault_class: 'K6', arm: 'T2-clustersynth', counter, crossing_rate, n_windows, verdict}` to the same run-dir shape, sim/live routing per registered N). Smoke both. Registered runs: T1 battery (`--classes K6 --arms shape_block_conformal_bet`) then the T2 arm (registered shard count from the amendment). Stop-condition checks FIRST on both. Re-score; K6 YES requires USE + COVERED + T2 pass — the scorer does not know about T2, so the amendment registers that the K6 COVERAGE.md row is overridden to NO by the wiki write-back if T2 fails, and Task 12's verdict text must reflect whichever way it lands (if T2 fails: the class answer stays NO and the card's verdict is re-scored after filing a REFUTED annotation — follow the amendment's registered procedure). Record the answer with every number.

### Task 12: PR + wiki write-back

- [ ] Push `gap/k346-v1`; PR titled 'Coverage-gap detectors: K4 tail-bet, K3 periodogram bet, K6 block-conformal shape' with the updated COVERAGE.md table, per-detector outcomes vs registered predictions, any refutations with their stop-condition numbers, 'Merging is the operator's call.', attribution footer.
- [ ] Wiki (main + clean check first): `stats/pages/coverage-gap-detectors-run-2026-08-08.md` (source; the three answers with full endpoint tables; refutations filed with their records; the K4 one-point-decisive measurement; K3 leakage finding if present; K6 T1+T2 outcomes with the history comparison to the predecessor's 82%); outcomes section appended to `methodology/coverage-gap-detectors.md` (dated, original intact); matrix outcomes updated on `methodology/fault-class-coverage-matrix.md`; WORKLIST: close-or-annotate C40 (K3) and C41 (K6) per outcome, add follow-ons the runs surface (next free C-ids, recount first); indexes + log; ONE scoped commit. Update the visual artifact (same file path/URL): flip K3/K4/K6 chips from 'New design' to their measured outcomes with rates, and change the footer's design-illustration sentence for whichever panels now carry measurements.

## Self-Review (completed at write time)

- **Spec coverage:** every design-page element has a task — constructions (1/6/9), cards with quantifier tags (3/7/10), amendments-before-runs (2/7/10), one-attempt stop conditions (Global + 5/8/11), T2 bar (10/11), certification path steps 1–5 (2–5, 7–8, 10–11), write-back either way (12). K3's aGRAPA-λ option deliberately narrowed to fixed κ (registered; the design page says 'allowed', not required) — noted here as the one narrowing.
- **Placeholder scan:** Tasks 6/9 test bodies are specified by required assertions rather than full code — each names its exact statistical assertion and tolerance basis; implementers write them in full with the shapes given. No TBDs.
- **Type consistency:** `calibrateTailBet`/`pointTailBetEValue`/`KAPPA`, `spectralBetWindow`/`spectralBetWealth`, `calibrateShapeBlocks`/`shapeBetWindow`/`shapeBetWealth` consistent across their group's tasks.

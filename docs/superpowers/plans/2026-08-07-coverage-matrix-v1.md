# Fault-Class Coverage Matrix v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Answer, per the six ratified fault classes, whether an e-value-producing detector covers it — through registered injection batteries scored by the certification pipeline — and emit COVERAGE.md with six yes/no rows.

**Architecture:** Extend the shipped certification tree (`validation/certification/`) with a fault-class dimension on power cells and a coverage scorer; add one injection-battery study (`validation/coverage/`) with six registered class batteries driving the certified detectors plus two new cheap candidates (group-average e-value; K4 held-out conformal route); re-score and emit the coverage table.

**Tech Stack:** Node ≥ 20 built-ins, plain `.mjs` (same as certification). No new dependencies.

**Authority:** `~/concord/knowledge/methodology/pages/fault-class-coverage-matrix.md` (RATIFIED 2026-08-07). Where this plan and that page disagree, the page wins and the disagreement is a plan bug to report. The certification protocol's rules (mechanical verdict, no silent suppression, append-only, frozen constants) apply throughout.

## Global Constraints

- Repo: `~/concord/deploysignal-engine`, PR-gated — **never commit to `main`**. Branch `cover/matrix-v1` **off `main` after PR #51 merges** (verify `git merge-base --is-ancestor` of the cert HEAD into main first). Use a worktree (superpowers:using-git-worktrees), suggested at `~/.sdd-worktrees/engine-cover`.
- Registered constants freeze in Task 1's commit and do not move inside coverage v1: **coverage floor 0.50 at canonical severity**; class grids exactly as given in Task 1's code (copied from the ratified page); the six class ids `K1..K6`.
- The battery pre-registration (Task 5) commits **before** any battery run. A registered run is append-only under `validation/coverage/results/live/run-<UTC>/` with a manifest (`study`, `git_sha`, seed, N, class grid). No result overwritten; reruns only for a named code defect, fixed test-first.
- A surprise (verdict delta, unexpected power) is a finding to report, never something to tune away.
- Commits: `-m` before `--` pathspec; message ends `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`; prose per WRITING-STYLE (no "not just X but Y", no weasel quantifiers).
- Claim cards for the two new candidates freeze (engine SHA + source hashes via the existing `tools/freeze-cards.mjs`) **before** the battery runs that score them.

## File Structure

```
validation/certification/
├── lib/constants.mjs        # Modify: FAULT_CLASSES, COVERAGE_FLOOR (Task 1)
├── lib/score.mjs            # Modify: per-class S3 grouping + coverageFor() (Task 1)
├── lib/collect.mjs          # Modify: wide-format csui adapter (Task 4)
├── verdict.mjs              # Modify: COVERAGE.md emission (Task 2)
├── cards/group_average_e_value.json      # Create (Task 6)
├── cards/family_E_conformal_heldout.json # Create (Task 7)
validation/coverage/
├── PREREGISTRATION.md       # Create (Task 5) — frozen grids, floors, fallback rules
├── lib/inject.mjs           # Create (Task 3) — six injection generators, pure functions
├── harness/run-battery.mjs  # Create (Task 8) — drives detectors over generated series
├── test/inject.test.mjs     # Create (Task 3)
├── test/run-battery.test.mjs# Create (Task 8)
detectors/group-average-e-value.ts        # Create (Task 6) — the K2 composition
tools/stamp-heldout-family-e.mjs          # Create (Task 7) — K4 held-out calibration stamping
```

---

### Task 1: Fault-class registry, coverage floor, per-class S3 grouping, coverageFor

**Files:**
- Modify: `validation/certification/lib/constants.mjs`
- Modify: `validation/certification/lib/score.mjs`
- Test: `validation/certification/test/coverage-score.test.mjs` (new file; existing tests untouched)

**Interfaces:**
- Consumes: existing `scoreS3(card, cells)` cell predicates (`detection_rate`/`rate_e_ge_20`, `shift_sigma`, guards).
- Produces: `FAULT_CLASSES` (frozen object below), `COVERAGE_FLOOR = 0.50`, and `coverageFor(card, cells) -> {[classId]: {status: 'COVERED'|'NOT_POWERED'|'NO_EVIDENCE', cells: [], canonical: {severity, rate}|null}}`. Power cells opt into a class via a `fault_class` field; cells without it remain plain S3 evidence (backward compatible — the 3σ shift cells from existing runs have no `fault_class` and existing S3 behavior must not change).

- [ ] **Step 1: Write the failing test**

```js
// validation/certification/test/coverage-score.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FAULT_CLASSES, COVERAGE_FLOOR } from '../lib/constants.mjs';
import { coverageFor } from '../lib/score.mjs';

const card = {
  detector_id: 'safe_t_e_value', aliases: ['safe_t'], class: 'terminal_e_value',
  guarantee: { regime: { phi_max: 0.95, m_min: null, phi_known: true } },
  budget: { participating: true }, prior_evidence: [],
};
const pcell = (over = {}) => ({ detector: 'safe_t', fault_class: 'K1', severity: '1.5sigma',
  canonical: true, detection_rate: 0.86, shift_sigma: null, phi: 0, __tier: 'T1', verdict: 'POWERED', ...over });

test('registry: six classes, frozen shape', () => {
  assert.deepEqual(Object.keys(FAULT_CLASSES), ['K1', 'K2', 'K3', 'K4', 'K5', 'K6']);
  assert.equal(FAULT_CLASSES.K1.canonical, '1.5sigma');
  assert.equal(FAULT_CLASSES.K2.canonical, 'K10-e0.5sigma');
  assert.equal(FAULT_CLASSES.K3.canonical, 'A0.75sigma-f0.05');
  assert.equal(FAULT_CLASSES.K4.canonical, '5sigma-point');
  assert.equal(FAULT_CLASSES.K5.canonical, 'slope1e-4');
  assert.equal(FAULT_CLASSES.K6.canonical, 'mix-d1.5');
  assert.equal(COVERAGE_FLOOR, 0.50);
});

test('COVERED when canonical cell at or above floor', () => {
  const cov = coverageFor(card, [pcell()]);
  assert.equal(cov.K1.status, 'COVERED');
  assert.equal(cov.K1.canonical.rate, 0.86);
});

test('NOT_POWERED below floor at canonical; grid cells reported but not deciding', () => {
  const cov = coverageFor(card, [pcell({ detection_rate: 0.31 }), pcell({ severity: '3sigma', canonical: false, detection_rate: 0.99 })]);
  assert.equal(cov.K1.status, 'NOT_POWERED');
  assert.equal(cov.K1.cells.length, 2);
});

test('NO_EVIDENCE when a class has no fault_class cells', () => {
  const cov = coverageFor(card, [pcell()]);
  assert.equal(cov.K3.status, 'NO_EVIDENCE');
});

test('cells without fault_class are ignored by coverage (legacy S3 evidence)', () => {
  const legacy = { detector: 'safe_t', shift_sigma: 3, detection_rate: 0.96, __tier: 'T1', verdict: 'pass' };
  const cov = coverageFor(card, [legacy]);
  assert.equal(cov.K1.status, 'NO_EVIDENCE');
});

test('guards apply: non-finite coverage cell is excluded, not counted', () => {
  const cov = coverageFor(card, [pcell({ non_finite_wealth: 12 })]);
  assert.equal(cov.K1.status, 'NO_EVIDENCE');
});
```

- [ ] **Step 2: Run to verify failure** — `node --test validation/certification/test/coverage-score.test.mjs` → FAIL (no export).

- [ ] **Step 3: Implement.** In `constants.mjs` append (frozen, registered with this commit):

```js
export const COVERAGE_FLOOR = 0.50;
export const FAULT_CLASSES = Object.freeze({
  K1: { name: 'per-metric step shift',      canonical: '1.5sigma',        grid: ['0.75sigma', '1.5sigma', '3sigma'] },
  K2: { name: 'group-in-unison',            canonical: 'K10-e0.5sigma',   grid: ['K5-e0.25sigma', 'K5-e0.5sigma', 'K10-e0.25sigma', 'K10-e0.5sigma', 'K10-e0.75sigma', 'K20-e0.25sigma', 'K20-e0.5sigma'] },
  K3: { name: 'sub-threshold oscillation',  canonical: 'A0.75sigma-f0.05', grid: ['A0.5sigma-f0.02', 'A0.5sigma-f0.05', 'A0.75sigma-f0.02', 'A0.75sigma-f0.05', 'A0.75sigma-f0.1'] },
  K4: { name: 'far-outside-norm point',     canonical: '5sigma-point',    grid: ['3sigma-point', '5sigma-point', '8sigma-point'] },
  K5: { name: 'slow drift',                 canonical: 'slope1e-4',       grid: ['slope5e-5', 'slope1e-4', 'slope5e-4'] },
  K6: { name: 'distributional shape change', canonical: 'mix-d1.5',       grid: ['mix-d1.0', 'mix-d1.5', 'mix-d2.0'] },
});
```

In `score.mjs`, add `coverageFor(card, cells)`: filter cells with a `fault_class` field matching the card (reuse the existing alias matching via caller — cells arrive pre-matched by `cellsFor`), apply `applyGuards` (excluded cells named, counting neither way, same suppression rules as S3), group by `fault_class`; per class: `NO_EVIDENCE` if no surviving cells; else find the cell(s) with `canonical: true` — `COVERED` iff any canonical cell's power rate (`detection_rate ?? rate_e_ge_20`) ≥ `COVERAGE_FLOOR`, else `NOT_POWERED`; carry all cells and the canonical rate. Do not modify `scoreS3`'s existing behavior for `fault_class`-less cells (the legacy test above pins that).

- [ ] **Step 4: Full suite green** — `node --test validation/certification/test/*.test.mjs` (all existing + new pass).

- [ ] **Step 5: Commit** — `git commit -m "coverage: fault-class registry, floor, coverageFor" -- validation/certification`.

---

### Task 2: COVERAGE.md emission and machine-check

**Files:**
- Modify: `validation/certification/verdict.mjs`
- Modify: `validation/certification/test/report-consistency.test.mjs`

**Interfaces:**
- Consumes: `coverageFor` (Task 1); the CLI's existing per-card flow and `CERT_RESULTS_DIR` override.
- Produces: each run dir additionally contains `COVERAGE.md` — a six-row table `| class | answer | detector(s) | tier | canonical rate |` where **answer = YES iff at least one card with overall verdict USE has that class COVERED** (detector column lists them), else **NO** with the best non-USE or NOT_POWERED context in the detail lines below the table; per-card JSONs gain a `coverage` key (the `coverageFor` output). Machine-check: every COVERAGE.md row re-derivable from the card JSONs (extend `report-consistency.test.mjs` with the same independent re-derivation pattern it already uses for the verdict table).

- [ ] **Step 1: Extend the machine-check test first** (failing): for each run dir with a `COVERAGE.md`, parse the six rows, recompute the answer from the card JSONs (`overall.verdict === 'USE'` and `coverage[K].status === 'COVERED'`), assert equality, and assert the YES rows' tier equals the min tier of the supporting cells.
- [ ] **Step 2: Verify it fails** on a temp-dir CLI run (no COVERAGE.md yet).
- [ ] **Step 3: Implement emission** in `verdict.mjs`: call `coverageFor(card, cells)` per card, attach to the card JSON, and after the loop write `COVERAGE.md` with the aggregation rule above; classes with only NO answers include one line naming what blocks them (best status found, e.g. `K3: NO — best: family_D_spectral_e_detector NOT_POWERED 0.12 (verdict REFUSE)`).
- [ ] **Step 4: Full suite green; run the CLI once against a temp `CERT_RESULTS_DIR`** and read the emitted COVERAGE.md (all six rows present; with no battery runs yet, all six read NO/NO_EVIDENCE — correct at this stage).
- [ ] **Step 5: Commit** — scoped to `validation/certification`.

---

### Task 3: The six injection generators

**Files:**
- Create: `validation/coverage/lib/inject.mjs`
- Test: `validation/coverage/test/inject.test.mjs`

**Interfaces:**
- Produces (all pure, all take a seeded RNG `rng()` from the harness — reuse the PRNG that `validation/terminal-evalue/harness/run.mjs` actually drives — verified by Task 3 to be the LCG `rng` from `validation/h0-battery/harness/nulls.mjs:7-17`, not mulberry32 as this plan originally said):
  - `injectStep(series, {sigma, at, delta})` — adds `delta*sigma` to `series[at..]`.
  - `injectUnison(matrix, {sigma, at, eps})` — matrix is `K` series; adds `eps*sigma` to every series from `at`. Property under test: per-series shift equals `eps*sigma` exactly (individually sub-threshold is a property of `eps`, chosen by the grid).
  - `injectOscillation(series, {sigma, at, amp, freq})` — adds `amp*sigma*sin(2π*freq*(t-at))` for `t≥at`. Property: max absolute added value ≤ `amp*sigma` (never crosses a level threshold above amp).
  - `injectPoint(series, {sigma, at, mult})` — adds `mult*sigma` at exactly index `at`. Property: exactly one index differs.
  - `injectDrift(series, {sigma, at, slope})` — adds `slope*(t-at)*sigma` for `t≥at`. *(Corrected 2026-08-07 by Task 3 review: this plan originally cited "the drift-sweep formula `v' = v + slope·t·σ`" — wrong on both functional form and anchor; the registered C35 study is multiplicative and anchored at `(t - T_INJECT)`. The additive `(t-at)` form here is this battery's own registered form; Task 5 registers it as such and does not cite C35's formula.)*
  - `injectShapeMix(series, {sigma, at, d})` — from `at`, replaces innovations with a two-component mixture with **matched mean and variance** and component separation `d*sigma`: draw `z = (b ? +d/2 : -d/2) + w*s` with `b ~ Bernoulli(0.5)`, `w ~ N(0,1)`, and `s = sqrt(max(0, 1 - d*d/4))` so that `E[z]=0`, `Var[z]=1`. Property under test: sample mean within `4/sqrt(n)` of 0 and sample variance within `0.1` of 1 at n=10,000 (matched moments), and sample kurtosis differs from 3 (shape actually changed).

- [ ] **Step 1: Write the failing tests** — one `test()` per generator asserting the named property with a fixed-seed RNG (`const rng = mulberry32(42)`; copy the PRNG into the test file if not exported by the harness), plus a shared test that every generator leaves `series[0..at-1]` byte-identical (pre-injection prefix untouched).
- [ ] **Step 2: Verify failure.** `node --test validation/coverage/test/inject.test.mjs`
- [ ] **Step 3: Implement** — pure functions, no I/O, ~60 lines total. Copy the PRNG implementation into `inject.mjs` if the harness does not export one (do not import across studies).
- [ ] **Step 4: Tests pass; commit** scoped to `validation/coverage`.

---

### Task 4: Wide-format adapter (unlock T2)

**Files:**
- Modify: `validation/certification/lib/collect.mjs`
- Test: extend `validation/certification/test/collect.test.mjs`

**Interfaces:**
- Consumes: the csui cell shape found 2026-08-07: `{arm, counter, n_sui, n_ui, sui_crossing, sui_stopped_mean, sui_verdict, ui_exceedance, ...}` in `validation/shape-battery/results/live/csui-*` — READ several real cells first; there are `ui_*` fields beyond `ui_exceedance` and possibly power fields; enumerate them in your report.
- Produces: `loadEvidence` splits each wide cell into per-detector cells: prefix `sui_` → `detector: 'sequential_ui_e_process'` with the prefix stripped (`sui_crossing` → `crossing_rate`, `sui_stopped_mean` → `stopped_mean`, `sui_verdict` → `verdict`), prefix `ui_` → `detector: 'universal_inference_e_value'` likewise; `arm`/`counter` preserved on both; non-prefixed fields copied to both. Cells from studies whose manifest study name matches `/clustersynth/i` keep `__tier: 'T2'` (already the rule). The adapter activates only when a cell has no `detector` field AND at least one recognized prefix; anything else keeps current behavior (unsupported → stderr skip line).

- [ ] **Step 1: Failing fixture test** — a wide cell with both prefixes yields exactly 2 cells with correct field mapping and `__tier: 'T2'`; a detector-bearing cell is untouched; an unrecognized no-detector cell still prints `skipped:`.
- [ ] **Step 2–4: Implement, suite green, smoke** — `loadEvidence('validation')` cell count rises (report old→new); spot-check one real csui-derived `sequential_ui_e_process` cell.
- [ ] **Step 5: Commit** scoped to the two files.

---

### Task 5: The battery pre-registration (freezes before any run)

**Files:**
- Create: `validation/coverage/PREREGISTRATION.md`

Content (write it fully; this is the frozen instrument): the six classes with grids and canonical severities **copied verbatim from `FAULT_CLASSES`** (one source of truth: state that the constants module is normative and the doc mirrors it); N=2000 trajectories per cell, T=300 ticks, onset at t=100, baseline iid Gaussian with oracle parameters plus an AR(1) φ=0.6 replicate of the canonical cell per class (labelled `-ar1`); scored endpoint per cell: detection rate = fraction of trajectories where the detector's e-value crosses 1/α at α=0.05 within the post-onset window (for terminal detectors: the windowed terminal read the certification's terminal cells already use — match the terminal-evalue harness's windowing exactly and cite the line); coverage floor 0.50 at canonical severity (mirrors `COVERAGE_FLOOR`); detectors under test: `safe_t`, `universal_inference`, `group_average_e_value` (K2 candidate), `family_E_conformal_heldout` (K4 candidate), plus `family_D_spectral_e_detector` on K3 only (measured for the record; its REFUSE verdict already bars USE); fallback rules: a detector/class cell whose adapter throws on >1% of trajectories is NOT-EXECUTABLE for that cell, named; seeds fixed and listed; **a failed endpoint is a publishable result and thresholds do not move**.

- [ ] **Step 1: Write the document.** **Step 2:** Cross-check every grid string against `FAULT_CLASSES` (exact match). **Step 3: Commit alone** — `git commit -m "coverage: pre-registration, frozen before any battery run" -- validation/coverage/PREREGISTRATION.md`.

---

### Task 6: Group-average e-value (K2 candidate) + claim card

**Files:**
- Create: `detectors/group-average-e-value.ts`
- Create: `validation/certification/cards/group_average_e_value.json`
- Test: `test/group-average-e-value.test.ts` (TypeScript, engine's `node --test dist/` pattern)

**Interfaces:**
- Produces: `groupAverageEValue(eValues: number[]): number` — arithmetic mean; throws on empty input or any negative/NaN input (an e-value is nonnegative; garbage in must be an error, not a number). Docstring states the theorem it rests on and its source: the average of e-values is an e-value under arbitrary dependence (`~/concord/knowledge/stats/pages/e-value.md` — combination rules; also cited by `fleet/combine.ts` if it already carries an averaging path — READ `fleet/combine.ts` first and if an equivalent audited combiner already exists, wrap or re-export it rather than duplicating, and say so in your report).
- Card (freeze via existing `tools/freeze-cards.mjs` AFTER Task 7 creates its card too — one freeze commit for both): `detector_id: 'group_average_e_value'`, `aliases: ['group_average']`, class `terminal_e_value` (the components are terminal safe-t reads), `source_files`: the new module + `detectors/safe-t-e-value.ts` (component), guarantee sentence `arithmetic mean of component e-values is an e-value under arbitrary dependence of the components; validity inherits from component validity (safe-t: known-phi <= 0.95, estimated baseline)`, quantifiers `[{text:'under arbitrary dependence', tag:'proof', proof_artifact:'e-value merging (average), stats/e-value combination rules; unit test asserts mean'}]`, regime copied from safe-t's card, budget participating true, falsifier `exceedance of the group e-value > alpha on a healthy unison-null battery cell`, prior_evidence `[{stage:'S2', study:'coverage', runs:'coverage/results/live/*', wiki:'methodology/fault-class-coverage-matrix'}]`.

- [ ] **Steps:** failing TS test (mean of [2,4] is 3; throws on [] and on [-1] and on [NaN]); implement; `npm test` green; commit module+test. Card JSON authored; `node validation/certification/tools/validate-cards.mjs` green; committed unfrozen (freeze happens in Task 7 Step 5 with card 2).

---

### Task 7: K4 held-out conformal route + claim card + freeze

**Files:**
- Create: `tools/stamp-heldout-family-e.mjs`
- Create: `validation/certification/cards/family_E_conformal_heldout.json`
- Test: `validation/coverage/test/heldout-stamp.test.mjs`

**Interfaces:**
- Consumes: `detectors/conformal.ts` exports `freshConformalEValueState()` and `evaluateConformalWeightedEValue(...)` — READ `conformal.ts:416-520` to get the exact state/params contract before writing anything; the certification card for family_E documents that only `force_weighted_e_value` selects the e-value kind.
- Produces: `stampHeldoutFamilyE({calibrationRows, alpha})` — computes the weighted-e-value calibration params from **held-out data rows** (real held-out synthetic: generated by the battery harness with an independent seed, n ≥ 10,000 per cell, per the ratified page) instead of the χ_p Monte Carlo synthesis in `deploysignal`'s calibrator. The card: `detector_id: 'family_E_conformal_heldout'`, class `terminal_e_value`, sources the stamping tool + `detectors/conformal.ts`, guarantee sentence `hedged tail-indicator e-value with the tail quantile calibrated on held-out data (n >= 10,000/cell); P(indicator|H0) = alpha holds by exchangeability of held-out calibration and live draws — synthetic tiers only until a real corpus exists (C37)`, quantifiers `[{text:'by exchangeability', tag:'empirical', proof_artifact:null}]`, budget participating true, falsifier `crossing rate > alpha on the held-out-calibrated healthy battery`, prior_evidence pointing at the coverage study.
- Freeze: **Step 5 here runs `freeze-cards` once for both new cards** (engine SHA + hashes) and commits `cards/` — before Task 9's runs, satisfying the global constraint.

- [ ] **Steps:** read conformal.ts contract; failing test (stamped params from 10,000 N(0,1)-scored held-out rows give an indicator rate within [0.03, 0.07] at α=0.05 over 2,000 fresh healthy draws — validity smoke, not the registered endpoint); implement; suite green; author card; validate-cards green; freeze both new cards (expiry-check must print `all cards current` after); commit (module+test, then cards+freeze as its own commit).

---

### Task 8: The battery harness

**Files:**
- Create: `validation/coverage/harness/run-battery.mjs`
- Test: `validation/coverage/test/run-battery.test.mjs`

**Interfaces:**
- Consumes: `inject.mjs` generators (Task 3); detector entry points — `safeTwoSampleTEValue(vals, cal, test, ...)` and `universalInferenceMeanShiftEValue(vals, cal, test)` exactly as `validation/terminal-evalue/harness/run.mjs:42-45` calls them (READ that harness fully and reuse its windowing, calibration split, and PRNG verbatim — cite lines in your report); `groupAverageEValue` (dist build); the held-out stamper (Task 7).
- Produces: cells in the certification's power shape **plus** `fault_class`, `severity`, `canonical` (bool), `phi` (0 or 0.6 per the `-ar1` replicate), `detection_rate`, `n`, `verdict` (`'POWERED'|'INERT'` by the registered floor — the study's own token), written to `results/live/run-<UTC>/summary.json` with a manifest. K2 cells drive `group_average_e_value` over K per-metric safe-t e-values on the unison matrix; K4 cells drive the held-out conformal evaluator; K1/K3/K5/K6 drive safe-t and UI per series; K3 additionally drives family_D via the detector-audit harness's adapter (READ `validation/detector-audit/harness/run-power.mjs` for the family_D invocation and reuse it).
- Smoke mode: `--n 20` for tests; the test asserts one cell per class × detector appears, fields complete, `canonical` marked exactly once per class × detector, and a deliberately-injected 3σ K1 step at n=20 yields detection_rate > 0 (the harness actually detects).

- [ ] **Steps:** failing smoke test; implement; test green; full-suite green; commit scoped to `validation/coverage`.

---

### Task 9: The registered battery runs

- [ ] **Step 1:** `npm test` + `npm run test:cert` green first.
- [ ] **Step 2:** Run the battery live per the pre-registration (N=2000; expect minutes-scale; run classes as separate invocations if the harness supports it, all into one run dir or sequential run dirs — manifest each).
- [ ] **Step 3:** Read the emitted summary in full. Report every class × detector canonical rate and verdict. Surprises reported, not tuned.
- [ ] **Step 4:** Commit results append-only, scoped.

---

### Task 10: Coverage re-score and the six answers

- [ ] **Step 1:** `npm run cert:verdict` — new official run now includes battery evidence; read REPORT.md + COVERAGE.md + MISSING-CELLS.md fully.
- [ ] **Step 2:** Verify machine-checks: `npm run test:cert` (report-consistency + golden — if golden verdicts moved because new CARDS exist, that is expected: the golden table gains the two candidate cards' rows; verdict changes on the ORIGINAL nine are findings to report).
- [ ] **Step 3:** `node validation/certification/expiry-check.mjs` → `all cards current`.
- [ ] **Step 4:** Commit the run. Record in the task report: the six-row COVERAGE.md verbatim, and for each row one sentence of interpretation grounded in the cells.

---

### Task 11: PR

- [ ] Push `cover/matrix-v1`; `gh pr create` titled "Fault-class coverage matrix v1: six certified yes/no answers" with body: the COVERAGE.md table, the two new candidate cards, the wide-format adapter, links to the ratified wiki page, "Merging is the operator's call.", Claude Code attribution footer.

### Task 12: Wiki write-back

- [ ] Before writes: `cd ~/concord/knowledge && git branch --show-current` (must be `main`), status clean. Write `stats/pages/coverage-matrix-2026-08-07.md` (type `source`): the six-row table verbatim with tier labels, per-class canonical rates, what each NO is blocked on, the named-not-built candidates (K3 spectral e-process on disjoint-window periodogram ordinates; K6 empirical-reference two-sample betting e-process with per-coordinate-φ null) each with one paragraph of scope, and a what-this-does-not-establish section (synthetic tiers; P1 gate still unwired; real-data tier blocked on C37). Update `stats/index.md` (one line), `WORKLIST.md` (D6 row → outcome + close; add rows for the two named-not-built candidates with the next free C-ids — **recount the highest id first**, C38 existed as of 2026-08-07), append `log.md`. Scoped commit. Report PR URL + wiki sha + the six answers.

---

## Self-Review (completed at write time)

- **Spec coverage:** surface + coverage definition (T1), emission (T2), batteries (T3, T5, T8, T9), cheap candidates (T6, T7), adapter (T4), re-score + answers (T10), named-not-built + wiki (T12), PR (T11). Harness-sufficiency question is answered by construction (all changes additive — if an implementer hits a structural wall, that is a finding for the report, not something to force).
- **Placeholder scan:** clean; generators, registry, and tests carry real code; harness tasks carry exact consumed signatures with mandated file reads where shapes live on disk.
- **Type consistency:** `coverageFor`, `FAULT_CLASSES`, `COVERAGE_FLOOR`, `fault_class`/`severity`/`canonical` cell fields, `groupAverageEValue`, `stampHeldoutFamilyE` consistent across tasks.

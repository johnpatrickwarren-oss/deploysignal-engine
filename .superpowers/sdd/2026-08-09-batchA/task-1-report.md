# Task 1 report — open-items batch A (C51.1 + C47.1)

Branch `open/batch-a`, worktree `~/.sdd-worktrees/engine-batchA`, off `main@7529a63`.
Six commits, no merge performed. Working tree clean apart from this ledger directory.

## Commits

| sha | what |
|---|---|
| `8458033` | prereg: Amendment v2.C51.1 — the crossing-time field, registered before the emission |
| `5d35a72` | coverage: emit `crossing_time` on the shape-accumulator rows |
| `00ad713` | prereg: Amendment v2.C47.1 — the K4 self-fit probe, both outcomes registered in advance |
| `7353a52` | validation: the K4 self-fit exchangeability probe |
| `46eb7ab` | prereg: C47.1 results — outcome (a) |
| `3e6ee9e` | cert: card identity re-freeze — pins plus one disclosed note field, dedicated commit |

## ITEM 1 — C51.1, the crossing-time field

**Premise verified from code, and the defect was a REGISTRATION defect, not a code defect.**
`detectors/shape-ecdf-accumulator.ts:451-472` has always returned `crossingIndex`;
`harness/run-battery.mjs`'s accumulator adapter destructured `const { wealth, log } = ...` and
discarded it, and **no field carrying a crossing TIME was ever registered on any row, for either
shape detector.** K6A.1.12 registered a prediction (`4,950` ticks), a per-draw band
(`[3,300, 5,700]`), a censoring rate (`23.2%`) and a falsifier against a quantity with no field.

**Registered (`8458033`, prereg text alone):** `crossing_time`, object-valued on the
`increment_estimator`/`p_uniformity` model, units **ticks from the post-onset start** at
`crossing_tick = (crossingIndex + 1) * W`, with the Kaplan–Meier censored-quantile convention written
out in full so `median === null` IS the falsifier's "censored median". Emitted on all six
`shape_ecdf_accumulator` rows (cells 43–46 + arm 47's S2 and S3). **No verdict authority** (C39 /
K3.1.3 wording). **Not** on `shape_block_conformal_bet` — its `shapeBetWealth` exposes no
`crossingIndex` and re-deriving one in the harness is the K6A.2.1-item-12 defect shape; named
not-done.

**Registered arithmetic finding:** `median === null` ⟺ `n_crossed/n < 0.50` ⟺ the row's rate
`< 0.50`, so K6A.1.12's second falsifier clause — "a censored median with detection `> 0.50`" — is
**arithmetically impossible** and is a consistency check on the harness rather than an independent
event. Registered as a test.

**Scope is FUTURE runs. `run-20260809T035934Z`'s cell-44 median falsifier stays UNEVALUATED.** No
rerun authorized, one-attempt rule (§0 rule 7) is the reason, and C51.1.5 tables the four routes that
would make it readable with their status — **none is currently scheduled**: a live `--classes K6-slow`
run (not scheduled), C51 item (4) (open, unregistered), a named-defect rerun (no defect named), and
`run-acrossdraw.mjs` (would not trigger one — it emits no cell rows). C51 item (1) is discharged as
*the field exists*, not as *the falsifier was tested*.

**Code (`5d35a72`).** Adapter reads `crossingIndex` and asserts `crossed === (crossingIndex >= 0)`,
throwing on disagreement — this pins the harness `THRESHOLD = 1/ALPHA` (`:82`) to the module's
`LOG_WEALTH_THRESHOLD_K6SLOW = log(1/ALPHA_K6SLOW)` (`:124-128`), one rule computed twice in two
files, so a future divergence surfaces as `adapter_failures` instead of a `crossing_time`
inconsistent with its own `detection_rate`. Gated on a `crossingTimes` capability flag in
`SHAPE_DETECTORS`, never a detector-id literal at an emission site.

**Paired smoke, at the registered acceptance and matching it exactly** (`--n 20`, all seven classes,
same seeds, `COVERAGE_RESULTS_DIR` redirected):

```
rows compared                    103
pre-existing fields changed        0
new fields                         1   crossing_time, on exactly 6 rows
```

**Mutation kills, measured by reverting the harness after each:** `(i+1)*W → i*W` kills 2 tests;
Kaplan–Meier → `median()` over the crossed subsample kills 6; the threshold assertion removed kills
2; the capability gate ignored kills 10.

**Stated, not papered over:** the per-row denominator (`N` on fault/S3, `s2n` on S2) is **not
mutation-observable** — all three coincide whenever `adapter_failures` and `non_finite_wealth` are
`0`, and K6A.1.12 registers both as structural zeros for this class. Replacing it with
`indices.length` fails no test, measured. Pinned at the source instead, and disclosed in the
code-commit append to v2.C51.1. No positive control forces an adapter throw on this class.

## ITEM 2 — C47.1, quantifying the K4 self-fit

**PREMISE VERIFIED FROM CODE FIRST, and it came out NARROWER than K4.1.10 says.** Two corrections:

1. **Line citation stale.** K4.1.10 cites `point-tail-bet-e-value.ts:69-77`; `calibrateTailBet` is at
   **`:81-94`** at HEAD (the lines moved when C1.9 inserted `assertKappaInUnitInterval`). `:69-77` is
   now `countGte`.
2. **`MAD` cancels exactly — the departure is driven by the MEDIAN alone.** `countGte` compares
   `|a_i − m|/mad` against `|x − m|/mad` and `mad > 0` is enforced at `:89-91`, so `p` is invariant to
   `mad`. K4.1.10's *"a median/MAD pulled slightly toward itself"* is corrected by quote-and-correct
   to **"a MEDIAN"**. Asserted against the real module at four rescalings in the probe, not merely
   derived. **K4.1.10's verdict stands unweakened** — the self-fit is real and is exactly where the
   erratum says it is; its attribution was one term too wide.

**Design (`00ad713`, registered before the probe existed).** As-built self-fit against an out-of-fold
reference fitted on a disjoint split — exactly exchangeable by derivation, and the construction the
outcome-(b) restructure would build — both scored by the **unmodified module**, paired, at the
registered `n = 10,000` on the registered `phi = 0` normal substrate. **Both endpoints computed
EXACTLY in closed form against the substrate CDF** (`p(x)` is a step function of `|x − m|`), which
removes the live-point sampling noise and is what makes a `1e-6`-scale reading possible. `R = 4,000`,
seed base `6.3e8`, registered escalation to `40,000` if the paired se exceeds `3e-5`, plus a
registered second-generator arm because C1.3 already recorded one lattice artefact from this study's
PRNG.

**MEASURED EXCESS — REGISTERED OUTCOME (a) FIRED.**

| reading | paired excess | se | % of the distance to the `alpha = 0.05` bar |
|---|---|---|---|
| `R = 4,000`, study PRNG | **`4.546721e-6`** | `1.527037e-6` | **`0.0094%`** |
| `R = 4,000`, splitmix64 | **`2.584698e-6`** | `1.497497e-6` | **`0.0054%`** |
| `R = 40,000`, study PRNG (disclosed post-measurement) | `1.355543e-6` | `4.71553e-7` | `0.0028%` |
| `R = 40,000`, splitmix64 (disclosed post-measurement) | `1.032108e-6` | `4.72877e-7` | `0.0021%` |

Outcome threshold `0.004825359960837106` (10% of `0.05 − 0.0017464003916289452`). **Outcome (a),
NEGLIGIBLE — the excess is three orders of magnitude inside it at every reading.** WORKLIST C47 item
(1) **closes as QUANTIFIED**; no restructure registered, none built. Prediction `|excess| <= 1e-4`
**HELD** (22–39× inside). **K4.1.10's anti-conservative DIRECTION is confirmed by measurement for the
first time** — positive on both generators. `E[e] <= 1` on both arms with `≈ 0.375` of margin. On
`E[e]` the excess is `≈ 1.6e-4` on `≈ 0.625`.

**Registered generator-agreement rule FIRED at `R = 4,000`** (`gap 1.962e-6 > max(se) 1.527e-6`), so
per that rule **neither single number is quoted as the answer and the registered reading is the range
`[2.58e-6, 4.55e-6]`** — and outcome (a) fires at both ends and everywhere between, so the disposition
does not depend on which is right. **Correction to that rule, which this author wrote:** it compares
two independent means against ONE arm's se rather than `sqrt(se1²+se2²)`; correctly scaled the gap is
**`z = 0.92`**, i.e. no disagreement at all, and the rule as written fires at `z ≈ 0.7`. **Not used to
un-fire the rule** — the fired consequence was applied as registered — but registered as the form any
future generator arm in this document must use. At `R = 40,000` the generators agree (`gap 3.23e-7`
vs `max(se) 4.73e-7`), confirming the `R = 4,000` firing was precision, not substance.

**The probe's own positive control, worth more than the headline:** the out-of-fold arm, exactly
exchangeable by derivation, reproduces the closed-form ideal `27/10001 = 0.0026997300269973` on all
four (generator, `R`) combinations, within `+0.77`, `−0.19`, `+0.60`, `+1.06` se. Nothing was tuned to
make it land there.

**Registered as the reading:** `n × (excess / level)` is `16.8` / `9.6` at `R = 4,000` and `5.0` /
`3.8` at `R = 40,000` — **`O(1/n)` with a single-digit-to-low-double-digit constant**, which is what
K4.1.10 predicted qualitatively and nobody had measured.

**Registered context that must not be misread as the self-fit (C47.1.4):** against the exchangeable
ideal at `n = 10,000`, the registered run's arm-32 S2 row reads `exceedance 0.001855` vs
`0.0026997300269973` (**−31.3%**) and `mean_e 0.527556` vs `0.6245891523884999` (**−15.5%**) — both
**conservative**, both one calibration draw's realization (the effect the pairing cancels by design),
and **both in the OPPOSITE direction to the self-fit**, so that run's reading was never evidence
either way. Also registered: a discrete conformal `p` at `n = 10,000` gives up **37.5%** of the
calibrator's `E[e] = 1` headroom before any construction detail enters, so `mean_e` should never have
been read against `1`.

**Named not-done:** `family_E_conformal_heldout` (the other held-out K4 candidate) unprobed; the
single-calibration-draw effect unbounded by this work; **no `n`-sweep run**, so the `O(1/n)` RATE
rests on derivation and the constant's size, not on a measured slope.

## Card re-freeze (`3e6ee9e`)

Dedicated, LAST commit. One `source_files[].sha256` moved (`shape_ecdf_accumulator`'s
`run-battery.mjs` pin, `ad483326…` → `8e914508…`); the other fourteen changed only `engine_pin.sha`
(`d8e60eb` → `46eb7ab`). **Plus one card text field, disclosed in advance at C47.1.6(a):**
`point_tail_bet_e_value`'s `guarantee.regime.exchangeability_note` gains the measured number. **Not
pins-only, and the README freeze-history row says so in its first sentence.** `guarantee.sentence`
left unchanged and named: it describes the construction (which does self-fit both statistics), not the
attribution.

Audited field by field: no detector source sha moved; no other `guarantee` or `regime` field on any
card, and no `falsifier`, `shipped_path`, `budget`, `prior_evidence`, `class`, `aliases`,
`detector_id`, `protocol_version` or `family` field, changed anywhere. `engine_pin.version` is
`0.6.6-pre` on all fifteen.

**Verdicts checked, not assumed.** `cert:verdict` re-run at HEAD and compared card-by-card against
`results/run-20260809T080049Z`: **15 cards, ONE field moved — the note text itself.**
`point_tail_bet_e_value` stays `USE`/`T1` with identical `reasons[]`; no stage status, tier or class
answer moved anywhere. **The run directory it wrote was removed rather than committed** — a
certification run was not in scope for this batch, and it was executed as a verification step only.

## Suites at branch HEAD

| suite | before | after |
|---|---|---|
| `npm test` | 351 / 0 fail | **351 / 0 fail** |
| `npm run test:cert` | 181 / 0 fail | **181 / 0 fail** |
| `npm run test:coverage-battery` | 144 (143 pass, 1 skip) | **151 (150 pass, 1 skip, 0 fail)** — 7 new C51.1 tests |
| `cert:validate-cards` | 15 OK | **15 OK** |
| `cert:expiry` | current | **all cards current** |

## Concerns

1. **The C51.1 field exists; K6A.1.12's median falsifier is still unread.** Making it evaluable and
   evaluating it are different things, and nothing is scheduled that would do the second. If the
   operator wants the falsifier tested, that needs its own registration — and a live run is a
   one-attempt event on those cells.
2. **The registered generator-agreement rule I wrote in v2.C47.1 was scaled wrong and fired on a
   null result.** It cost nothing here because the disposition holds at both ends of the range, but a
   rule that fires at `z ≈ 0.7` would have blocked a real answer on a closer call. Corrected for
   future use, in the append; the original stands.
3. **The `O(1/n)` rate is not measured, only its constant at one `n`.** An `n`-sweep
   (`n ∈ {2,500, 10,000, 40,000}`) would cost minutes with the probe as committed and would turn a
   derivation into a measurement. Not registered, not run.
4. **`family_E_conformal_heldout` may carry the same self-fit and was not examined.** It is the other
   held-out K4 candidate on the same runs. Whether its bounded-increment construction has the
   analogous asymmetry is an open question this batch did not open.

---

## Review-correction append, 2026-08-09 — APPROVED with corrections, landed in `ab918b2` + `6128ef0`

**The disposition did not move; the number quoted as the reading did.** An independent review derived
the estimand in closed form and measured it at ~100x this probe's precision.

**The corrected reading: `≈ 1.0956e-6`** (pooled-median estimator `1.095594e-6 ± 4.68e-9` across 3
PRNGs; closed form `2*phi(T)/(2*n*phi(0)) = 1.110875e-6` at `T = 3.0000074`, agreement `1.39%`).
Re-derived independently at this commit and reproduced to seven significant figures.

**My registered headline `[2.58e-6, 4.55e-6]` does NOT contain the true value; my
disclosed-post-measurement range `[1.03e-6, 1.36e-6]` does.** The cause is the rule defect I filed as
my own concern 2: C47.1.2's generator-agreement rule compared two independent arm means against ONE
arm's se, fired at `z = 0.92`, and its registered consequence promoted the under-replicated `R = 4,000`
pair to the headline while labelling the precise `R = 40,000` pair as deciding nothing. **The defect
did not merely add noise to the record — it promoted the wrong pair of numbers.** Now measured rather
than hypothetical.

**Outcome (a) margin restated: `4,404x` inside the threshold.** Prediction still HELD (`91x` inside
the `1e-4` band). Direction **confirmed at `z = +234`**, against the `t ≈ 2.2`–`2.9` this probe reached.

**My concern 3 is CLOSED.** The reviewer ran the `n`-sweep: `n × excess` is `0.0098` / `0.0110` /
`0.0113` at `n = 2,500` / `10,000` / `40,000` — flat across a 16-fold range — constant `4.06`, agreeing
with the closed form to `0.7%`–`2%`. **The `O(1/n)` rate is measured, not derived.**

**My concern 4 is CLOSED.** `family_E_conformal_heldout` is not in the self-fit class. Verified from
code rather than accepted on relay: `tools/stamp-heldout-family-e.mjs:73` scores rows as
`Math.abs(v)` — an absolute value about a FIXED zero, `Sigma = [[1]]` frozen by A2 — so nothing is
estimated from the rows then ranked. The relayed wording is recorded as the coordinator's relay, and
flagged as NOT the reviewer's verbatim paragraph, which did not reach me.

**Two corrections to my own verification reporting:**
- **Mutation-kill counts were 2x inflated on all four rows.** Node's spec reporter lists each failure
  twice and I counted with `grep -c`. Re-measured deduplicated: **`1 / 3 / 1 / 5`**, not `2 / 6 / 2 / 10`.
  The `(i+1)*W` off-by-one and the threshold assertion are each killed by exactly **one** test — thinner
  cover than I reported.
- **"15 cards, ONE field moved" was scoped to my comparison key**, which excluded pins by construction.
  The emitted `.card.json` embeds the whole card, so a fresh verdict run also carries 15 inherited
  `card.engine_pin.sha` moves and one inherited `card.source_files[].sha256` move. **Corrected: no
  verdict, tier, stage status or class answer moved on any of the 15 cards, and the only non-pin field
  to move was the note.**

**Still open on both detectors:** the shared single-calibration-draw realization effect, registered
unbounded at C47.1.4. No precision on `1.1e-6` touches it.

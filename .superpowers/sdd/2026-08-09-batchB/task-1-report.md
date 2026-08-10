# Batch B task 1 report — C38.5 and C38.4

Branch `open/batch-b`, worktree `~/.sdd-worktrees/engine-batchB`, base `main@3f556c1`.
Engine `0.6.6-pre`. Wiki treated read-only throughout; nothing under `~/concord/knowledge` was
written.

## Premise verdicts, from code and from the real scorer

**Item 1 (C38.5) — TRUE on the consequence, INCOMPLETE on the reason.**
`family_C_safe_hotelling` really had no scoreable S2 evidence: the real scorer
(`node validation/certification/verdict.mjs`, scratch results root) emitted `s2.status: MISSING`
with `perCell`, `excluded` **and** `missing` all three empty, and overall `NOT_EXECUTABLE` on
`["S1 reachability not run-backed (v1 floor)", "S2 or S3 has no scoreable evidence"]`.

The row's stated reason — "no scoreable in-regime validity evidence exists for that card at all" —
reads as absent measurement. **36 validity cells for this detector are pooled**, in canonical
`h0-battery/results/live/run-20260801T064627Z` (12 nulls × 3 α). They are not excluded; they are
never candidates. `validation/certification/lib/score.mjs:11-12`:

```js
const isValidityCell = (c) =>
  'increment_estimator' in c || 'stopped_mean' in c || 'exceedance' in c || 'crossing_rate' in c || 'mean_e' in c;
```

An h0-battery P1 row carries `fires fire_rate lower_95 verdict mean_logM` and none of those five.
That is h0-battery Amendment **A1.3**'s second gap, which **A1.8** left open by name.

Why it cost a verdict on this card and no other of the four: the other three test_martingale h0
detectors get their `increment_estimator` cells from `detector-audit-sequential/seq-20260805T025650Z`
(11, 9 and 12 `s2.perCell` entries, verified per card), and
`validation/detector-audit/harness/run-sequential.mjs:31-35` defines `SEQUENTIAL` as exactly
`{family_A_betting_e_process, family_A_mixture_supermartingale, family_D_spectral_e_detector}`. That
set follows detector-audit §2, whose scope table is derived from `fleet/e-bh-guarded.ts`'s
`DETECTOR_ENVELOPES` (`:35-49`, six keys, no Hotelling variant) — the same absence the card's S4
reports as "no envelope wiring".

**Item 2 (C38.4) — PREMISE FALSE, and stale rather than wrong at filing.** The row says 29 in-regime
validity cells have no paired per-null power arm. The real scorer at HEAD reports **11**, every one
`sequential_ui_e_process` (`pairingGaps`, `lib/score.mjs:475-489`). The 29 → 11 movement predates
this batch and is already recorded in `validation/certification/README.md` at the
`run-20260807T202419Z` paragraph: `universal_inference_e_value`'s per-null arms landed on
2026-08-07 and dropped 18 of them.

Two further premise findings, both read off code:

- **`_hotelling-safe.ts` has no φ input at all.** No identifier matching `phi`, `ar1`, `prewhiten`
  or `pre-whiten` appears in its 143 lines; `evaluateSafeHotelling` (`:54-143`) reads only
  `cell.covariance`, `cell.safe_hotelling_params.*`, `alpha` and `x`. This **resolves A1.2's third
  measurement**, which recorded that family C's rows are byte-identical across the φ fix and left
  open "either family C never read the threaded φ, or it does not pre-whiten at all". It is the
  second, structurally: the adapter cannot thread what the function does not accept.
- **`evaluateSafeHotelling` never reads `cell.mean` either** (`:104-109` take the quadratic forms on
  raw `x`). Harmless in a mean-zero battery, and it is why only `σ̂`, never `μ̂`, matters at N2/N4.

**One correction to the commissioning brief.** The brief said new S2 evidence could move the card to
USE, ADVISORY or REFUSE. **USE was unreachable.** `scoreS4` returns `UNPRICED` for this card
(bootstrap threshold substitution, no measured c-bound cited — `lib/score.mjs:455-463`, WORKLIST C38
item 6) and `overallVerdict:581-584` caps an UNPRICED card at ADVISORY. Reachable set:
{REFUSE, ADVISORY, NOT_EXECUTABLE}. Registered as such in A3.7 before the run.

## What was registered, in order, before anything ran

1. `754787e` — h0-battery `PREREGISTRATION.md` **Amendment A3**: scope, both arms, nulls, seeds,
   threshold rule, stop conditions, closed-form predictions with bands, and the outcome→verdict
   mapping. The registration act is the commit.
2. `bc6a4f7` — **correction append to A3.5**, registered before the harness implemented it: stop
   condition 1 as first written (`HEAD == 3f556c1`) is structurally unsatisfiable, because A3's own
   registration is a commit. The harness's first invocation printed exactly that refusal. Replaced by
   the engine-version pin, a sha256 check of `detectors/_hotelling-safe.ts` against the value the
   frozen card pins, and an ancestor check on A3's registration commit — check 2 being strictly
   stronger than what it replaces.
3. `93d0f5b` — the harness and its **one** live run.
4. `6b180cb` — the certification re-score, the golden delta, the corpus census, the README, and A3's
   results append with three corrections the run forces on my own registered derivation.

## What the run measured

`validation/h0-battery/results/live/inc-20260810T064226Z`, study id
`2026-08-h0-battery-class-instrument-arm`, 24 cells, 12 s elapsed. All five A3.5 stop conditions
cleared, including A3.5(4): N1's and N7's increment means are bit-identical, gap **0** — required of
a detector that reads no windows flag.

Arm A3-V, increment estimator, verdict on the card's frozen 1.0005 falsifier. `house_rule_verdict`
(detector-audit §3's 1.0 threshold, recorded with no verdict authority) **agreed on all 12 cells**,
so A3.4's contested threshold pair did not separate on this data and stays contested on the argument.

| null | mean | one-sided [lower, upper] | verdict |
|---|---|---|---|
| N1 | 0.996229 | [0.993155, 0.999304] | CLEARED |
| N7 | 0.996229 | [0.993155, 0.999304] | CLEARED |
| N2-m500 | 1.009998 | [1.005816, 1.014181] | REFUTED |
| N2-m100 | 1.088833 | [1.042489, 1.135178] | REFUTED |
| N2-m30 | 1.380324 | [1.218159, 1.542489] | REFUTED |
| N3-p03 | 1.042966 | [1.035568, 1.050364] | REFUTED |
| N3-p06 | 1.223540 | [1.194093, 1.252988] | REFUTED |
| N3-p09 | 1.602687 | [1.521725, 1.683648] | REFUTED |
| N4-p06-m100 | 1.776661 | [1.642059, 1.911262] | REFUTED |
| N4-p09-m100 | 2.233611e+5 | [−1.384e+5, 5.851e+5] | inconclusive |
| N5 | 1.062039e+143 | [−6.850e+142, 2.809e+143] | inconclusive |
| N6 | non-finite | — | NON_FINITE exclusion |

Arm A3-W, 3σ detection rate: N1 0.9725, N2-m30 0.7940, N2-m100 0.9035, N2-m500 0.9735, N3-p03
0.9515, N3-p06 0.8655, N3-p09 0.6545, N4-p06-m100 0.7280, N4-p09-m100 0.4190, N5 0.6625, N6 0.7400,
N7 0.9725.

**Prediction scorecard, stated as scored rather than as summarised.** Headline outcome: **hit** —
A3.7 registered REFUTED → REFUSE as the predicted mapping and that is what occurred. Per-cell bands
on A3-V: **10 of 12** (N3-p09 and N5 outside). Per-cell verdict tokens: **5 of 12**. Arm A3-W's
band: **3 of 12**. Corpus-level predictions: **all** held — no other card moved on any stage, no
`COVERAGE.md` class answer moved, this card's `pairing` is `[]`, corpus-wide unpaired stayed 11, the
pooled corpus went 2266 → 2290 with `2026-07-h0-battery` still 148, S3 stayed PASS at `perCell`
1 → 13.

**N6's record carries `null` where the run printed `Infinity`.** `JSON.stringify` maps `Infinity` to
`null`, so `increment_estimator` reads `{n: 2000, mean: null, sd: null, se: null,
lower95_one_sided: null, upper95_one_sided: null}`. The verbatim stderr line was
`N6  inc=Infinity [NaN,NaN] inconclusive (house inconclusive) cross=0.3145 power=0.7400`.
`applyGuards` fires identically (`Number.isFinite(null)` is false) and the cell is excluded and
named, so no scored outcome depends on it. **Named, not fixed**: patching the serializer after the
run would leave the harness unable to reproduce the artifact it produced, which is the property worth
more than a lossless field. Owed.

## Three corrections the run forced on my own registered derivation (A3's results append)

1. **The AR(1) estimand is `1/√(1−φ²)`, not 1.** A3.6 derived that `E[exp(z_t)]` depends only on the
   marginal law, which is right, and then asserted the marginal is `N(0, I₂)`, which is wrong. The
   detector is `vector: 2` (`detectors.mjs:117`) and the harness fills both coordinates from
   consecutive draws of one scalar stream (`run.mjs:35`), so under AR(1)
   `Cov(x_t) = [[1, φ], [φ, 1]]` while the adapter configures `Σ = σ²I₂`. Then
   `E[exp(z_t)] = ½·det(I − ½Σ)^{−1/2} = 1/√(1−φ²)` = 1.0483 / 1.2500 / 2.2942 at φ = 0.3/0.6/0.9.
   **Consequence beyond this arm:** N3/N4 withhold the oracle **covariance** from a vector detector —
   the same class of defect as the φ-threading one that superseded two 2026-08-01 runs, on a
   different input, affecting every `family_C_safe_hotelling` N3/N4 row in this study including the
   four committed P1 runs'. The cells stand as scored, nothing is retro-superseded on a post-hoc
   finding, and **the verdict does not depend on them**: N2-m30/m100/m500 are iid nulls where the
   induced correlation is exactly 0, they refute on `σ̂` alone, and S2 is REFUTED without a single
   N3/N4 cell.
2. **The instrument under-reads its own estimand, and cannot refute a catastrophic failure.** Three
   independent readings agree: N1 measures 0.996229 with an upper bound of 0.999304 against a derived
   exact 1 (the estimand sits *outside* the interval); the N3 cells read 0.5% / 2.1% / 30% below
   closed form; and a 4,000,000-draw Monte Carlo of the estimand alone under-reads it by
   0.3% / 1.7% / 15.7% at the same φ. So the true anti-conservatism is worse than measured
   everywhere. A3.6 registered the artefact risk as **spurious REFUTED**; the sign is corrected — at
   an exactly-calibrated null the normal-approximation interval fails on the **low** side, so it
   manufactures **clearances**, and N1/N7's CLEARED is the reading in this arm not to trust. And the
   three worst cells refute nothing: once the sample sd outgrows the mean the one-sided lower bound
   goes negative, so `increment_estimator` refutes **mildly** invalid detectors and goes quiet on
   badly invalid ones. That applies to every such cell in the corpus and needs a heavy-tail bound
   registered where the instrument lives (detector-audit §3).
3. **Arm A3-W's band held at 3 of 12 nulls.** §5 counts only a **first** fire in ticks 100–300
   (`run.mjs:118-125`, reproduced faithfully), so trajectories already firing under H₀ count as
   undetected; measured, `detection_rate ≈ 1 − crossing_rate` across the 12 nulls. §5's construction
   conflates "did not respond to the shift" with "was already firing at the null". No stage status
   turns on it — every rate clears `INERTNESS_FLOOR` 0.10.

## Item 2's real gaps: named, not filled

The 11 unpaired cells are all `sequential_ui_e_process`, and the instruction was not to invent a
fault construction. It has none, at four independent places:

- `validation/detector-audit/harness/run-sequential-ui.mjs:52-92` runs nulls only and injects nothing.
- h0-battery lists it OUT_OF_SCOPE for want of an adapter shape (`detectors.mjs:149-150`).
- detector-audit §6 registers no power arm for it.
- its card's own S3 route is the `clustersynth-ui` study (`prior_evidence[1]`, stage `S2+S3`), which
  is blocked on the wide-format adapter WORKLIST C38 item 3 tracks.

Its S3 is **MISSING**, not pooled-but-unpaired, so a power arm would move its verdict off
NOT_EXECUTABLE — a new registration, not a pairing fix. Registered as out of scope at A3.8 and owed
back to C38 item 4.

## Suites, at the final commit

| suite | baseline | final |
|---|---|---|
| `npm test` | 351 pass / 0 fail | **351 pass / 0 fail** |
| `npm run test:cert` | 181 pass / 0 fail | **181 pass / 0 fail** |
| `npm run test:coverage-battery` | 150 pass / 1 skipped / 0 fail | **150 pass / 1 skipped / 0 fail** |
| `node --test validation/h0-battery/tests/*.mjs` | 7 pass / 0 fail | **7 pass / 0 fail** |
| `npm run cert:validate-cards` | 15 OK | **15 OK** |
| `npm run cert:expiry` | all cards current | **all cards current** |

**No card was re-frozen and none needed to be.** No card pins any `validation/h0-battery/` file
(audited across all fifteen `source_files` lists), and `lib/score.mjs`, `verdict.mjs`,
`lib/collect.mjs`, `lib/constants.mjs`, `lib/guards.mjs` and every detector source are untouched.

## What I did not do

- No wiki page was written or edited. The C38 row's item 4 figure (29) and item 5 wording both need
  correcting on the wiki, and that is the parent's to file.
- No card content change: not the regime, not the falsifier, and not
  `prior_evidence[stage=S2].runs`, whose glob `h0-battery/results/live/run-*` does **not** match this
  arm's `inc-` directory. The arm scores regardless (`cellsFor` matches on detector id), but the
  card's citation is now incomplete. Owed.
- No re-run of any cell, no supersession of any run, no edit to any committed run directory, and no
  retro-supersession of the N3/N4 rows correction 1 found fault with.
- A1.3's second gap is closed for **one** card, by measurement. The other three cards' 36 P1 rows
  each remain invisible to the S2 vocabulary; all three are already REFUSE, so it costs no verdict
  today.
- Nothing was done about C38 items 2, 3 or 6.

# Pre-registration — the bounded-bet e-SR: the heavy-tail fallback built and certified (`2026-09-e-sr-bounded`, C77)

- **Study id:** `2026-09-e-sr-bounded`
- **Register:** `knowledge/WORKLIST.md` C77; protocol Amendment v1.C77 on
  `knowledge/methodology/pages/detector-certification-protocol.md` (wiki commit `1fac4d4`,
  2026-09-04), which this file mirrors and which governs on any disagreement.
- **Design:** `knowledge/stats/pages/e-sr-mean-shift-design.md` names the fallback and does not
  build it: "a bounded-bet increment `1 + λ·clip(r)/B`, Tessera's `gBounded`, would survive
  tails and scale error at a delay cost". `knowledge/stats/pages/e-sr-delay-2026-09-03.md` and
  `e-detector-cert-2026-09-03.md` measured the Gaussian e-SR's ARL at a fifth of the claim on
  N5, N6 and N8; `nab-time-to-alert-2026-09-04.md` found it alerting on 20 of 23 real quiet
  stretches. This study builds the fallback and certifies it under the `e_detector` class with
  those three nulls **inside** the claimed regime.
- **Discipline:** `knowledge/methodology/pre-registration-discipline`; `harness-discipline`.
- **Status: REGISTERED, NOT RUN.** At this commit `detectors/e-sr-mean-shift.ts` has no
  `increment` parameter, no `e_sr_mean_shift_bounded` id exists anywhere, `lib/constants.mjs`
  has no bounded growth function, no card and no harness exist. Committed first so no floor,
  grid, seed, prediction or golden row below is chosen after a number is seen. A later change
  is an amendment, appended and dated.

## 1. What will be built (registered, not yet written)

1. **`ESrMeanShiftParams.increment?: 'gaussian' | 'bounded'`**, default `'gaussian'` and
   byte-identical behaviour when absent. `'bounded'` runs the same SR recursion per λ, the same
   uniform mixture, the same log-domain accumulation and the same CUSUM companion on the
   increment `g_λ(r) = 1 + λ·clip(r, ±B)/B`, `B = BOUND_CLIP = 3`, over the default grid
   `BOUND_LAMBDAS = ±{0.1, 0.3, 0.6, 0.9}` (both imported from `fleet/calibration-monitor.ts`,
   the gate's own increment; `|λ| ≤ 0.9` keeps `g_λ ≥ 0.1 > 0`). `E[g_λ | F_{t−1}] = 1`
   whenever the *clipped* residual is conditionally mean-zero — any tail, any scale error, no
   sub-Gaussian premise; Theorem 2.4 then gives `E∞[N*] ≥ 1/α_ARL` for the mixture. A caller
   may pass `lambdas` with the bounded increment only if every `|λ| < 1` (else throw).
2. **Registry id `e_sr_mean_shift_bounded`** with its own `E_SR_MEAN_SHIFT_BOUNDED_ENVELOPE`
   (`statistic: 'e-detector'`, refused by `assertValidForFdrPath` like the Gaussian's;
   `variance: 'any'` is not a vocabulary word, so the envelope keeps the shared fields and the
   notes carry the premise). Nothing enters `DETECTOR_ENVELOPES`.
3. **ADR 0031** recording the option, its premise and the delay price.
4. **Scorer (v1.C77):** `lib/constants.mjs` gains `boundedIncrementGrowth(deltaEff)` (the
   quadrature of C77.3) and `eDetectorDelayBound(alphaArl, deltaEff, increment = 'gaussian')`;
   `lib/score.mjs` passes `card.guarantee.regime.increment`. Tests pin the four registered
   values of C77.3 and the four of C69.3 (unchanged).
5. **Card `cards/e_sr_mean_shift_bounded.json`**, class `e_detector`,
   `guarantee.regime = { phi_max 0.9, m_min 30, null_prefixes ['N1','N2','N3','N4','N5','N6','N7','N8'], increment 'bounded', alpha_arl 1e-3 }`;
   S1 MISSING by construction (no engine surface compiles either e-SR). Golden row §5.
6. **Harness `validation/e-sr-bounded/harness/run.mjs`** emitting cells that carry `detector:
   'e_sr_mean_shift_bounded'` (pooled by the collector, as the C69 cells are) — and comparator
   cells for the Gaussian e-SR that carry `detector_id` only, so they never pool into the
   `e_sr_mean_shift` card.

No detector, calibration or gate outside these files changes. The Gaussian e-SR's numbers are
unchanged by construction; the harness asserts it (§3, G0).

## 2. The premise, stated once, with its one known exception

The bounded increment is an e-process iff `E[clip(r_t, ±3) | F_{t−1}] = 0`. A symmetric
conditional law at the reference location satisfies it at any scale and any tail (clipping a
symmetric variable is symmetric). A skewed law does not: for the standardized lognormal N5
(σ = 0.75, mean 0, variance 1) the right tail beyond +3 is clipped while the left support ends
at −1.15, so `E[clip(r)] ≈ −0.028` (derived: `E[(r − 3)⁺] = (m·Φ̄(c − 0.75) − m·Φ̄(c))/sd − 3·Φ̄(c)`
with `c = 2.085`, `m = 1.325`, `sd = 1.151`), and the `λ = −0.9` component's per-tick increment
mean is `1 + 0.9·0.028/3 ≈ 1.0083`. Under estimation (N2, N4) a location error `ε` enters both
increments at first order; the bounded one's coefficient is `λ/B ≤ 0.3` against the Gaussian's
`λ ≤ 3`.

## 3. Cells

Substrates: the h0-battery's `NULLS` and `N8_COMBINED`, imported unchanged; trajectory
construction copied from `validation/e-detector-cert/harness/run.mjs` (oracle μ, σ, φ on
`params: 'oracle'` nulls; on `'estimated'` nulls the null's `m` draws come off the same stream
before tick 1, φ̂ clamped to ±0.95). The adapter is the module itself, its `fired` asserted
against `log_M ≥ log(1/α)` every tick. `SIGMA = 1`.

- **G0 (instrument).** The module with `increment: 'gaussian'` and with the key absent produces
  byte-identical `log_M` sequences on 200 ticks of N1 (the default is unchanged), and the bounded
  per-λ recursion equals the brute-force SR sum on 40 ticks (as the Gaussian test does).
- **S2 cells** (13, pooled): N1, N2-m30, N2-m100, N2-m500, N3-p03, N3-p06, N3-p09,
  N4-p06-m100, N4-p09-m100, N7, **N5, N6, N8 — all in regime**. `alpha_arl = 1e-3`,
  `T = 20,000`, `N = 2,000`. Fields as the C69 harness emits them.
- **S3 cells** (39, pooled): the thirteen nulls × `shift_sigma ∈ {0.75, 1.5, 3}`, K1 step at
  `ν = 200`, `T = 1,200`, `N = 2,000`; fields as C69, `delay_bound_registered` from the
  **bounded** D* (C77.3) for the reader.
- **H2 cells** (comparison, `detector_id` only): on N1 at 1.5σ, ν = 200, T = 1,200, N = 2,000,
  identical draws: the bounded e-SR and the Gaussian e-SR (`increment: 'gaussian'`), α_ARL 1e-3.
- **H3 cells** (increment estimator, `detector_id` only): per null (13) and per grid λ (8), the
  mean and se of `g_λ(r_t)` over `N = 2,000` trajectories × `T = 1,000` ticks of the null with
  no threshold (the H5a instrument of `2026-09-e-sr-delay`), plus `mean M_20` on the two-point
  grid `±0.1` (band `[16, 24]`).

Seeds: `20260906 + 7919·i + SALT`, `SALT = {S2: 0, S3: 1_000_003 + 100·k, H2: 2_000_003,
H3: 3_000_003}`. No catch anywhere; `exceptions` recorded and must be 0.

Output: `results/live/run-<UTC>/{manifest.json, summary.json (S2 + S3 cells), comparison.json
(H2, H3), REPORT.md}`; `analysis/check_report.mjs` re-renders REPORT.md byte-for-byte and takes
an `--expect` file.

## 4. Endpoints and registered predictions

- **H1 — the ship gate.** ARL: every one of the thirteen S2 cells CLEARED under the C69.2 rule
  (`arl0_T − 1.645·se ≥ 1,000`), *heavy tails included*. Prediction: N1, N3-*, N6, N7, N8
  CLEARED (symmetric laws; the premise holds exactly); N2-* and N4-* CLEARED with more margin
  than the Gaussian e-SR had (its N2-m30 sat at 1,148); **N5 is the risk**: the −0.028 clipped
  mean drives the negative-λ components upward at 0.8% per tick, and the prediction is CLEARED
  with the least margin of the thirteen, INCONCLUSIVE not excluded. Oracle-cell `arl0_T` is
  predicted in `[1,000, 2,000]`; no tighter prediction is made for a small-variance increment.
- **H2 — the delay price.** On N1 at 1.5σ, ν = 200, identical draws: bounded conditional mean
  delay vs the Gaussian e-SR's. Prediction from the growth rates (C77.3): the ratio is near
  `1.125/0.344 ≈ 3.3`, so ≈ 20–25 ticks against the Gaussian's ≈ 7.0; both under their own
  bounds (bounded 34.9, Gaussian 13.0). Reported as a ratio with both means; the card scores the
  bounded cells against 34.9 (S3), and the price is the finding either way.
- **H3 — the increment estimator.** `mean g_λ` within 3 se of 1 for every λ on every null, with
  one registered exception: on N5 the negative-λ components are predicted **above** 1 by about
  `0.9·0.028/3 = 0.0083` at λ = −0.9 (and by `λ·0.0093` in general), a 3-se failure at
  `N·T = 2·10⁶` pairs, and the positive-λ components below 1 by the same amount. H3 HELD iff
  every cell outside N5 passes; the N5 cells are reported against the derived offset (pass iff
  within 3 se of `1 − λ·0.0093`, the sign convention `λ > 0` → below 1). `mean M_20 ∈ [16, 24]`
  on N1.
- **H4 — the estimation price.** `arl0_T` at N2-m30 (the S2 cell) against the Gaussian e-SR's
  1,148 (`e-detector-cert` A1 re-run, N = 20,000). Prediction: higher (the bounded increment's
  location-error coefficient is ten times smaller); HELD iff `arl0_T(N2-m30) ≥ 1,148`.
- **S3 (the card).** No inert cell (3σ detection ≥ 0.10 on all thirteen; predicted ≥ 0.99).
  Every in-regime canonical cell under its bounded D* (34.9 at φ = 0; 47.0, 71.9, 239.9 at
  0.3, 0.6, 0.9); N8 (φ = 0.9, t₃) is the least certain.

**Golden row, registered here:** `e_sr_mean_shift_bounded: {verdict: 'USE', tier: 'T1',
s1: 'MISSING', s2: 'PASS', s3: 'PASS', s4: 'PASS'}`. The sixteen existing rows unchanged, and
the sixteen existing card JSONs byte-identical outside pins under the edited scorer (the C69
check, mechanical, before the freeze).

## 5. Ship rule

The `increment` parameter, the id, the envelope, the ADR and the scorer amendment merge whatever
the run says (the default is unchanged, so nothing shipped changes behaviour). The card is
frozen with the scorer's verdict in a dedicated pins-only commit after the sixteen existing
cards re-score identical outside pins. **H1 FAILED on any null** (a REFUTED in-regime S2 cell) →
the card is REFUSE, the regime is not narrowed by hand, and the study page says the fallback
does not survive that null; an INCONCLUSIVE cell is named as missing evidence and may be re-run
at higher N by a dated amendment, as C69 did. No tag is cut: C76 runs inside the engine and
needs no consumer pin. Falsifiers of the design: H1 FAILED on N6 or N8 (the symmetric heavy
tails the increment exists for) refutes the increment as built; H2 above 6× refutes the design
page's "at a delay cost" as a price worth paying.

## 6. Harness rules and what is not measured

Seeded as above, deterministic, no catch, append-only results, manifest with engine sha, the
module's and the scorer's sha256, `N`, seeds, wall time. Not measured: any consumer wiring (S1
MISSING); onsets other than a K1 step; α_ARL other than 10⁻³; anything at T2 or T3 (C76 takes
the module to NAB); a centred clip for skewed laws (the fix N5 would want, not built here);
Tessera's `srEDetector` prototype (not compared).

## Amendment A1 — 2026-09-04, after the unscored N = 20 pilot (`results/sim/`), before any scored run

Three instrument facts the pilot exposed, and one expectation revised on the record before the
scored run; no floor, rule, grid, seed or golden row moves.

1. **S2 at N = 20,000** (S3 stays at 2,000). On a residual that is exactly zero every bounded
   increment equals 1 and the SR recursion gives `M_t = t`, so the alarm lands at exactly
   `1/α_ARL` (asserted in `test/e-sr-mean-shift.test.ts`); the pilot read `arl0_T` 1,015 ± 159
   on N1 at N = 20, consistent with an oracle ARL that sits at the floor rather than 1.8× above
   it as the Gaussian's does. At N = 2,000 the rule's `1.645·se` (≈ 26) could not resolve a
   cell whose truth is within a few percent of 1,000; at N = 20,000 (se ≈ 5) it can. §4's
   H1 prediction for the oracle cells is unchanged: CLEARED, in `[1,000, 2,000]`, and the number
   the page will carry is how far above the floor they sit.
2. **The Gaussian e-SR runs as an identical-draws comparator on every S2 cell** (cells carry
   `detector_id: 'e_sr_mean_shift'` in `comparison.json`, never `detector`, so they pool into no
   card). H4 keeps its registered reference (1,148 at N2-m30) and gains the identical-draws ratio
   on every null.
3. **H3's standard error is computed across trajectories** (the mean of `g_λ` per trajectory,
   then the se of those N means), not across `N·T` pairs. The pilot read `z = 12.7` on N2-m30
   with the pair-level se because a trajectory's calibration error is frozen for its 1,000
   ticks and the pairs are not independent draws. The 3-se rule and the N5 offset are unchanged.
4. **Expectation revised, on the record before the scored run.** The pilot read `arl0_T` 261,
   487, 375 and 284 on N2-m30, N2-m100, N4-p06-m100 and N4-p09-m100 (N = 20), against the
   Gaussian e-SR's 1,148 / 1,320 / 1,511 / 1,185. §4 predicted the opposite. The mechanism I
   now expect: the bounded grid's smallest bet, `λ = 0.1`, reads a location error of order
   `1/√m` in the standardized residual as a persistent shift and drifts up on every stream, while
   the Gaussian grid starts at `λ = 0.25` and the streams whose error is below ≈ 0.125σ never
   alarm, carrying its censored mean. Under estimation the increment is a *marginal* e-process
   (the mean of `g_λ` across streams is 1, H3) and the run length collapses anyway, because the
   error is frozen per stream — the front-loaded run-length distribution
   [[stats/arl-delay-2026-09-03]] recorded for the Family A cards. **So H1 is now expected to
   FAIL on N2-* and N4-*, H4 to FAIL, and the card to read REFUSE under §5**; the golden row
   stays as registered (a prediction, now expected wrong), and the golden test will carry the
   measured verdict with the failed prediction named. Nothing is narrowed by hand: the estimated
   nulls stay in the claimed regime and decide it.

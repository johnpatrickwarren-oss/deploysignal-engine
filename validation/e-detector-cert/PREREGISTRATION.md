# Pre-registration — certifying the e-SR mean-shift detector under the `e_detector` class (`2026-09-e-detector-cert`)

- **Study id:** `2026-09-e-detector-cert`
- **Register:** `knowledge/WORKLIST.md` C69; protocol Amendment v1.C69 on
  `knowledge/methodology/pages/detector-certification-protocol.md` (wiki commit `df9cfdd`,
  2026-09-03), which this file mirrors and which governs on any disagreement.
- **Discipline:** `knowledge/methodology/pre-registration-discipline`;
  `knowledge/methodology/harness-discipline`.
- **Status: REGISTERED, NOT RUN.** At this commit the class does not exist in
  `validation/certification/lib/constants.mjs`, the scorer has no branch for it, no card and no
  harness exist. This file is committed first so that no floor, grid, seed or prediction below
  can be chosen after a number is seen. Later commits must not edit it; a change is an
  amendment, appended and dated.

## 1. The system

`detectors/e-sr-mean-shift.ts` (ADR 0029, C68), unchanged by this study: the 16-λ SR mixture on
the standardized AR(1)-whitened residual, alarm at `M_t ≥ 1/α_ARL`, `α_ARL = 1e-3` by default.
Its ARL and delay at oracle and estimated parameters are on the record
(`validation/e-sr-mean-shift/results/live/run-20260903T185933Z`,
`knowledge/stats/pages/e-sr-delay-2026-09-03.md`); those cells carry `detector_id`, not
`detector`, and are not pooled by the certification collector. This study produces the cells
that are.

## 2. The class (what the scorer will implement)

- `CLASSES` gains `'e_detector'`; `CLASS_INSTRUMENTS.e_detector = ['arl0_T', 'delay_canonical']`.
- **S2 per cell.** `z = 1.645`. CLEARED iff `arl0_T − z·arl0_se ≥ 1/alpha_arl`; REFUTED iff
  `arl0_T + z·arl0_se < 1/alpha_arl`; else INCONCLUSIVE, recorded as missing evidence. The scorer
  recomputes the token from `arl0_T`, `arl0_se`, `alpha_arl`; a recorded `verdict` token that
  disagrees voids the run (class-scoped `internalConsistency`). `E∞[min(N*, T)] ≤ E∞[N*]`, so
  censoring can only make clearance harder.
- **S3 per cell.** (a) The unchanged inertness floor on `detection_rate` at `shift_sigma = 3`
  (`INERTNESS_FLOOR = 0.10`). (b) On every in-regime cell with `shift_sigma = 1.5` (K1
  canonical): PASS iff `delay_canonical + z·delay_se ≤ D*`, where
  `D*(alpha_arl, δ_eff) = g/D + V/D² + 1`, `D = δ_eff²/2`, `V = δ_eff²`,
  `g = min_{η ∈ [1.001, 8], step 0.001} η·log(1/alpha_arl) + log(1 + log(144)/log(η))`, and
  `δ_eff = shift_sigma · sqrt((1 − φ)/(1 + φ))` with φ the null's generating coefficient from
  the null-id grammar (`lib/nulls.mjs`), 0 when absent. Registered values at `alpha_arl = 1e-3`,
  `shift_sigma = 1.5`: φ = 0 → 13.0; 0.3 → 23.3; 0.6 → 49.1; 0.9 → 229.6 (one decimal; the
  scorer uses the unrounded function). A canonical cell with `censored > 0.01` is missing, not
  scored. Stage status MISSING / INERT / SLOW / PASS; SLOW → ADVISORY overall.
- **S4.** PASS iff `budget.participating === false` and the id is absent from
  `DETECTOR_ENVELOPES` in `fleet/e-bh-guarded.ts`; else REFUSE. No "no envelope wiring" reason
  for this class.
- **Regime.** New optional key `guarantee.regime.null_prefixes` (any class; absent = unchanged).
  The e-SR card: `null_prefixes ['N1', 'N2', 'N3', 'N4', 'N7']`, `phi_max 0.9`, `m_min 30`.
- Nothing else in `score.mjs`, `guards.mjs` or `constants.mjs` changes behaviour for the three
  v1 classes. The fifteen existing golden rows are the check.

## 3. Cells

Substrates: the h0-battery's `NULLS` and `N8_COMBINED`, imported unchanged. Adapter and
trajectory construction copied from `validation/e-sr-mean-shift/harness/run.mjs` (that file
executes on import, so its functions are copied, not imported, and the copy is asserted against
the module's own `log_M` at every tick: the harness re-derives nothing, it reads the module).
`SIGMA = 1`; oracle μ, σ, φ on `params: 'oracle'` nulls; on `params: 'estimated'` nulls the
null's `m` calibration draws come off the same stream before tick 1 and μ̂, σ̂, φ̂ are fitted
as in the e-SR harness (φ̂ clamped to ±0.95).

**S2 cells** (13): N1, N2-m30, N2-m100, N2-m500, N3-p03, N3-p06, N3-p09, N4-p06-m100,
N4-p09-m100, N7 (in class; N7 is iid Gaussian with a rolling-window flag the per-tick detector
ignores, so it duplicates N1 for this detector and is run anyway — the protocol says N1–N7
verbatim), N5, N6, N8 (outside; bound the regime). `alpha_arl = 1e-3`, `T = 20,000`, `N = 2,000`.
Fields: `detector, null_id, params, phi (oracle nulls), m (estimated nulls), alpha_arl, T, n,
p_alarm_T, arl0_T, arl0_se, arl0_lower95, median_run_length, verdict, exceptions`.

**S3 cells** (30): the ten in-class nulls × `shift_sigma ∈ {0.75, 1.5, 3}`, K1 step at onset
`ν = 200`, `T = 1,200`, `N = 2,000`, `alpha_arl = 1e-3`. Fields: `detector, null_id, params, phi,
m, alpha_arl, T, nu, shift_sigma, fault_class: 'K1', severity ('0.75sigma' | '1.5sigma' |
'3sigma'), canonical (true on 1.5sigma), n, p_pre_onset_alarm, n_conditional, detection_rate,
delay_canonical (present on every S3 cell as the conditional mean delay; the scorer reads it only
at shift_sigma = 1.5), delay_se, delay_upper95, delay_median, delay_p90, censored, delta_eff,
delay_bound_registered (D*, for the reader; the scorer computes its own), exceptions`.
`detection_rate` = fraction of trajectories with no alarm before ν that alarm by T;
`delay_canonical` = mean of `min(N* − ν, T − ν)` over those trajectories; `censored` = fraction
of them with no alarm by T.

Seeds: `20260905 + 7919·i + SALT`, `SALT = {S2: 0, S3: 1_000_003 + 100·k}`, k the grid index
(0.75σ → 0, 1.5σ → 1, 3σ → 2). Every trajectory records `exceptions` (must be 0); no catch.

Output: `results/live/run-<UTC>/{manifest.json, summary.json, REPORT.md}` with
`manifest.git_sha`, `harness_sha256`, `n`, seeds, wall time; `summary.json = {cells: [...]}`.
`analysis/check_report.mjs` re-derives every number in `REPORT.md` from `summary.json`.

## 4. Registered predictions

- S2: all ten in-class cells CLEARED. Nearest the floor: N2-m30 (C68: `arl0_T` 1,128 at
  N = 2,000; predicted `arl0_lower95` ≈ 1,085). N4-p06-m100 and N4-p09-m100 are unmeasured;
  predicted CLEARED. N5, N6, N8 REFUTED, outside the regime (verdict unaffected).
- S3: no inert cell (3σ detection ≥ 0.10 everywhere, predicted ≥ 0.99). Every in-class
  canonical cell under `D*`: iid cells ≈ 7 ticks vs 13.0; the AR(1) cells are unmeasured; the
  prediction is under the bound at every φ, with the φ = 0.9 cells the least certain.
- Golden row: `e_sr_mean_shift: {verdict: 'USE', tier: 'T1', s1: 'MISSING', s2: 'PASS',
  s3: 'PASS', s4: 'PASS'}`. The fifteen existing rows unchanged.
- Coverage: the K1 row gains an `e_sr_mean_shift` canonical cell at ≥ 0.50 (COVERED).

## 5. Ship rule

The class, the scorer branch, the card and the golden row ship whatever the script says; the
card is frozen with that verdict in a dedicated pins-only commit after the fifteen existing
cards are re-run and compared field by field (pins and timestamps excluded). A REFUTED in-class
cell is a REFUSE and narrows nothing by hand. Any existing card moving under the edited scorer
is a defect in the branch, fixed test-first before anything ships.

## 6. What this study does not measure

Any consumer wiring (no engine surface compiles this detector; S1 is MISSING and the card says
so); onsets other than a K1 step; the bounded-bet fallback for heavy tails; anything at T2 or
T3; `alpha_arl` other than the shipped 1e-3.

# DRAFT — Amendment v2.K7 to `validation/coverage/PREREGISTRATION.md`: a seventh class, drift-saturation (NOT REGISTERED, NOT EXECUTED)

**Status: draft only.** Written after `validation/drift-saturation/results/live/run-20260905T053212Z`
(C78) so that it can name a measured canonical; it carries no authority. It becomes an amendment
only when appended to `validation/coverage/PREREGISTRATION.md` under its own number and date by a
later registered worklist item, before any coverage run that scores it. Nothing in the coverage
matrix, the certification cards or `COVERAGE.md` changes at this commit.

## K7.1 The class

**K7 — drift-saturation (incident-shaped growth).** One principal's rate on a shared service
grows monotonically from a stable baseline over a long horizon, then saturates at the service's
capacity; the service's latency steps (K1) at the saturation tick. The fault the class names is
the growth, and the endpoint is whether an alert lands *before* the saturation, not whether a
window scores after it. It differs from K5 (slow drift) in three registered ways: the horizon
(500 and 2,000 ticks against K5's 200-tick window), the terminating saturation with a K1 step on
a second signal, and the endpoint (time-to-alert relative to saturation).

Generator: `validation/drift-saturation/harness/run.mjs` `growth()` (PREREGISTRATION §1) — shapes
`linear`, `exponential` (κ = 4), `staircase` (5 steps); capacity `C = 4σ`; onset `ν = 500`;
horizons `H ∈ {500, 2000}`; latency step `1.5σ` at `S = ν + H`; nulls N1 and N3-p06 at oracle
parameters. The generator would be copied, not imported, into `validation/coverage/lib/inject.mjs`
as `injectGrowth(series, {sigma, at, H, shape, C})` with a unit test pinning the three shapes'
values at `u ∈ {0, 0.2, 0.5, 1}` against the C78 harness.

## K7.2 The endpoint and the floor (the part that is new to the matrix)

The matrix's coverage test is a terminal power cell: `powered ≥ 0.50` at the canonical severity.
K7 cannot be scored that way without losing the class: C78's P4 arm measured the K5 canonical
instrument (safe-t on a 200-tick post-onset window) at **0.024** on K7's canonical cell, while
every run-length construction alerted before saturation on ≥ 0.85 of replications. The proposed
cell endpoint is therefore **P1 from C78: the fraction of replications whose first alert lands in
`[ν, S)`**, unconditional (a baseline alert spends the run), with the lead time `S − t*` reported
beside it. Floor: `P1 ≥ 0.50` at the canonical cell, the matrix's existing floor read on a
different fraction. This needs an S3 extension: a `time_to_alert` endpoint kind alongside the
terminal `detection_rate`, with the scorer reading `t*` per replication instead of a terminal
`e`. That is the harness change the matrix's "four additive extensions" did not anticipate.

## K7.3 Canonical cell and grid

Canonical: **`linear`, `H = 2000`, `C = 4σ`, N1** (C78 cell `j = 2`; per-tick increment
`0.002σ`, five times below K5's canonical, cumulative twice K5's terminal). Grid: the 12 C78
cells. The `-ar1` cell is N3-p06 at the canonical shape and horizon, measured out-of-claim as
K4's and K5's were.

## K7.4 Candidates, and what C78 measured for each (T1, no verdict authority)

| construction | P1 at canonical | lead/H | behind the 'bounded' gate | proposed status |
|---|---|---|---|---|
| e-SR mean shift (α_ARL 10⁻³) | 0.846 | 0.92 | keeps every pre-saturation alert (the monitor revokes after it) | candidate; **not an e-value** — its card is `e_detector`, so a K7 YES via the e-SR would be a run-length YES, which the matrix's definition ("card verdict USE … powered") does not yet admit |
| Family A mixture (α 0.05) | 0.970 | 0.85 | keeps 0.95 of 0.97 | candidate, but REFUSE under estimation on the record (C23, C76); YES only in the oracle regime |
| universal inference, consecutive 100-tick windows (α 0.05) | 1.000 | 0.75 | keeps 0.10 | candidate; the only construction that also holds its contract on real telemetry (C76) |
| sequential UI (α 0.05) | 0.004 | — | — | not a candidate as shipped (`changeFrom` at the monitoring start; the alternative's one post-change mean is diluted by the quiet stretch) |

The matrix's answer would be **K7 YES (T1) via universal inference on consecutive windows**,
with the e-SR and the mixture as faster but not-e-value or not-valid-under-estimation
alternatives, and with the gate finding attached: the 'bounded' calibration monitor revokes
before saturation on 100% of replications in every cell, at about the mixture's alert tick, so
**a K7 detector behind that gate is abstained unless it alerts before the monitor does**. The
monitor is itself the earliest K7 detector in the study on every cell but the e-SR's.

## K7.5 What executing this would require, in order

1. A registered worklist item naming this draft and the S3 `time_to_alert` extension.
2. The extension, TDD, with the coverage harness's own tests (`npm run test:coverage-battery`).
3. `injectGrowth` copied into `inject.mjs` with its unit test; `substrate_sha256` changes and
   every committed coverage run's manifest keeps the old hash (a new hash, not a rewritten one).
4. The amendment appended to `validation/coverage/PREREGISTRATION.md` as v2.K7 with the grid,
   floor, seeds, predictions (C78's numbers are the predictions, with their falsifiers) and the
   fallback for the e-SR's non-e-value status.
5. The run, the re-score, `COVERAGE.md` with a K7 row, the wiki page, the matrix page's outcomes.

## K7.6 What this draft does not claim

No T2 or T3 evidence exists for K7. C78 is oracle-parameter synthetic; C76 showed the plug-in
constructions do not hold their contract on real quiet stretches, and nothing here changes that.
The July 2026 registry outage is the prompt for the class, not a data point in it.

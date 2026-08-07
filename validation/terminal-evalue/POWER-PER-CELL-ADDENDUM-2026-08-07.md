# Addendum to POWER-PER-CELL-PREREG — live execution and two recording additions

**Registered 2026-08-07, committed before the run it governs.** Forward re-registration under
`knowledge/methodology/pre-registration-discipline` rule 1. Amends
`POWER-PER-CELL-PREREG.md` (registered 2026-08-05) and inherits every endpoint of
`PREREGISTRATION.md`.

**No endpoint or threshold changes.** `N = 4000`, `n_test = 100`, `SEED = 20260801`,
`ALPHAS = [0.05, 0.01]`, the ten-null battery, the 3σ power shift, the 50% power-control floor
and the T1 exceedance rule are all unchanged. Every prediction P1–P4 of the 2026-08-05
pre-registration still stands as written and is scored again here.

## Why this addendum exists

The certification re-score (`validation/certification/results/run-20260807T202419Z/MISSING-CELLS.md`,
standing gaps) records two facts about the 2026-08-05 work:

1. The power-per-cell and φ-sweep runs exist only under `results/sim/`. No run under
   `results/live/` carries a `power_this_cell` field, so no registered evidence backs the numbers
   published on the wiki page `stats/power-per-cell-2026-08-05`.
2. 29 in-regime terminal validity cells carry no paired per-null power arm.

## Change (a) — record a one-sided 95% lower bound on mean(e)

`validation/certification/cards/safe_t_e_value.json`'s frozen falsifier reads

> exceedance > alpha (0.05), or one-sided 95% lower bound of mean(e) > 1, in a cell with phi <= 0.95

and no run in the corpus records that bound. `validation/certification/lib/guards.mjs:63` therefore
falls back to the point estimate `mean_e`, and says so in the emitted reason string. The addendum
adds the named instrument.

**Estimator, stated exactly.** Normal approximation on the sample mean of the finite null-arm
e-values, not a bootstrap:

```
n     = number of finite e values in the cell        (the same sample mean_e is computed from)
mu    = mean(e)
s^2   = sum (e_i - mu)^2 / (n - 1)                   (sample variance, n-1 denominator)
lower = max(0, mu - 1.645 * s / sqrt(n))
```

`z = 1.645` is the constant already used by the cell's binomial exceedance bound
(`harness/run.mjs:50`), so both intervals on a cell use one quantile. The clamp at 0 applies
because `e >= 0`; it can only lower the bound, so it cannot make the falsifier fire. `NaN` when
`n < 2`. Recorded as `mean_e_lower_95`, alongside `mean_e_sd` (`s`), because the bound cannot be
read without the spread that produced it.

Normal-approximation, not bootstrap, for one reason: it is closed form, so it is exactly
reproducible from the recorded `mean_e`, `mean_e_sd` and `n` by any reader, and it consumes no
RNG stream — the run stays bit-reproducible at the registered seed. A percentile bootstrap would
need a new seeded stream and would carry no better coverage on this distribution.

**Where the estimator is unproven, stated before the number.** Neither estimator has valid
coverage here. `knowledge/stats/terminal-mean-is-not-measurable` shows a process with
`E[M] = 1` exactly reading a sample mean of 0.0288 at N=4000, with the bias running downward
because the mean is carried by draws that do not appear in a feasible sample. A normal interval
built on that sample inherits the same defect: on a cell whose `p99(e)` is 87 and whose `mean_e`
is 9,710, `s` is set by a handful of draws and `s / sqrt(n)` can exceed the mean itself. So
`mean_e_lower_95` carries evidence only when it lies **above 1**, exactly as `mean_e` does, and a
reading at 0 is uninformative rather than reassuring.

## Change (b) — the run is executed in live mode

`--mode live`, 2026-08-07, writing `results/live/run-<UTC>/`. This is a provenance change, and I
state its size honestly rather than overselling it: **`--mode` selects the output directory and
nothing else.** `harness/run.mjs:15` reads the flag and `harness/run.mjs:57` uses it to choose
`results/live` against `results/sim`; no generator, detector call, seed or endpoint branches on
it, and the same is true of all 20 study harnesses under `validation/` (no `MODE ===` test exists
outside the directory selection). The harness is deterministic at `SEED = 20260801`, so the
validity columns of this live run must equal the 2026-08-02 live run
(`results/live/run-20260802T041353Z`) digit for digit at the same `N`. The gap the certification
recorded is that no *registered* run carries the per-cell power field, not that the sim numbers
were computed differently.

## Change (c) — emit each per-cell power arm as its own scoreable cell

**This third change was not in the brief I was given, which named two.** I register it because the
gap this run was commissioned to close cannot close without it, and running without it would
widen that gap instead.

`validation/certification/lib/score.mjs:16` recognizes a power cell by
`'detection_rate' in c || 'rate_e_ge_20' in c`. The 2026-08-05 change records its per-cell power
under the name `power_this_cell`, which that predicate does not read, so a live run of the
2026-08-05 harness as written would add 0 power arms to the certification and — because it also
adds new cleared in-regime validity cells — would *increase* the unpaired-cell count.

The addition is recording only, of a number the harness already computes. Alongside each
`<det>__<null>__a<alpha>.json` validity cell the run now writes one
`POWER__<det>__<null>.json` carrying `{control: 'power_per_cell', detector, null_id, m,
shift_sigma: 3, n, rate_e_ge_20, power_verdict}`. `rate_e_ge_20` is the field name the scorer
already reads on this study's pooled `CONTROL_power__*` cells, and `score.mjs:13-16` calls the
name difference "a vocabulary gap, not an evidence gap". No number is recomputed: `rate_e_ge_20`
on the power cell is the same value `power_this_cell` carries on the validity cell. The power cell
carries no `exceedance` and no `mean_e`, so it is not a validity candidate, and no bare `verdict`
field, so no power token can be read as a validity verdict.

This is the harder-to-pass reading of a free choice, per the discipline page's own rule: it
exposes per-null inertness to certification stage S3 that a pooled control averages away. Its
predicted consequences are registered below, before the run.

## Registered predictions for this run

P1–P4 of `POWER-PER-CELL-PREREG.md` are re-scored unchanged. These are additional.

- **P-A1 (the instrument, two-sided on purpose).** On `safe_t N4-p09` — the cell whose `mean_e` is
  9,709.99 and whose `p99_e` is 87.34 — the recorded `mean_e_lower_95` will be **uninformative
  (at or near the 0 clamp)**, so the mean rule will **not** fire there under the card's own named
  falsifier, where it does fire today on the point-estimate fallback. If instead the bound comes
  in above 1, the refutation is confirmed on the instrument the card actually names. Either
  outcome is the result; neither is adjusted.
- **P-A2.** On every in-regime cell of both terminal detectors (`mean_e` between 0.09 and 0.23),
  `mean_e_lower_95` will be below `mean_e` and far below 1, so change (a) moves no in-regime
  verdict.
- **P-A3.** Change (c) will move `universal_inference_e_value` stage S3 from **PASS to INERT**,
  because its `N3-p09` and `N4-p09` power arms read **0.0275** against the registered inertness
  floor of 0.10, and the pooled control at 0.7016 is what hid them. Its overall verdict will stay
  **USE T1** with those cells named as excluded from the USE regime, because
  `overallVerdict` narrows the regime rather than the verdict when some cells are powered.
- **P-A4.** `safe_t_e_value` stage S3 will stay **PASS**: its lowest in-regime per-cell power is
  `N3-p09` at 0.896, and its `N4-*` arms sit outside the known-φ regime and are not scored.
- **P-A5.** The unpaired-cell count for the two terminal cards will fall from 18 of the 29 lines to
  0. The 11 `sequential_ui_e_process` lines are untouched by this run and stay.
- **P-A6.** `validation/certification/test/golden-verdicts.test.mjs` will **fail**, and not only
  on P-A3. Three of its assertions fix a corpus **cardinality** — `n4.length === 2` for safe-t
  (line 76), `n4.length === 4` for UI (line 93) — which counts cells across every live run rather
  than within one. Appending a registered run to an append-only corpus therefore breaks the frozen
  golden table by construction. I record that as a contradiction between two frozen artifacts of
  protocol v1 and do not resolve it here: the table is not mine to move.

## What this addendum does not change

- No new null, no new detector, no new α, no new shift, no new floor.
- It does not make the mean measurable. See the second half of change (a).
- It does not touch `validation/certification/lib/score.mjs` or `verdict.mjs`, both of which are
  pinned `source_files` on three cards; a scorer change would expire those cards, and closing the
  pairing gap in the scorer's vocabulary instead of the study's recording was rejected for that
  reason.
- One fault shape (+3σ mean shift) and synthetic nulls only, as before.

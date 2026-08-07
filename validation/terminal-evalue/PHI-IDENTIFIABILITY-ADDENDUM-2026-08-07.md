# Addendum to PHI-IDENTIFIABILITY-PREREG — make the φ sweep a registered run

**Registered 2026-08-07, committed before the run it governs.** Forward re-registration under
`knowledge/methodology/pre-registration-discipline` rule 1. Amends
`PHI-IDENTIFIABILITY-PREREG.md` (registered 2026-08-05).

**No endpoint or threshold changes.** The grid stays
`φ ∈ {0, 0.3, 0.6, 0.8, 0.9, 0.95, 0.99}`, `m = 100`, `n_test = 100`, `N = 2000`, `α = 0.05`,
the +3σ test-window shift, the seed base `4242 + i * 7919`, the mulberry32 generator and the
Box–Muller transform in `harness/phi-sweep.mjs`. Predictions P1–P3 of the 2026-08-05
pre-registration are scored again exactly as written.

## Why this addendum exists

`harness/phi-sweep.mjs` as written **records nothing**. It prints a table to stdout and exits;
there is no `results/` directory, no manifest, no code SHA and no seed record. The table on
`stats/power-per-cell-2026-08-05` was transcribed from that console output, which is why the
certification re-score lists the φ sweep among its standing gaps
(`validation/certification/results/run-20260807T202419Z/MISSING-CELLS.md`). Pre-registration rule 6
requires a `results/run-<UTC>/manifest.json` per run. Until the harness writes one there is no live
run to produce, so this is a precondition of executing the registered study, not a change to it.

## Change (i) — append-only run directory

The harness now writes `results/<mode>/run-<UTC>/` containing `manifest.json` (study id, mode,
engine version, git SHA, node version, seed base, N, m, n_test, α, grid) and one cell file per
`(detector, φ)`, matching the layout `harness/run.mjs` already uses and
`validation/certification/lib/collect.mjs` already reads. `--mode live` selects `results/live`.
Nothing existing is rewritten.

**Cell shape.** Per `(detector, φ)`, one validity cell
`<det>__<null_id>__a0.05.json` carrying `{detector, null_id, m, alpha, n, phi, exceedance,
lower_95, verdict, mean_e, mean_e_sd, mean_e_lower_95, p_e_ge_10, p99_e, error_count}`, plus one
power cell `POWER__<det>__<null_id>.json` carrying `{control: 'power_per_cell', detector, null_id,
m, shift_sigma: 3, n, rate_e_ge_20, power_verdict}`. `mean_e_lower_95` is the estimator registered
in `POWER-PER-CELL-ADDENDUM-2026-08-07.md` change (a), unchanged. The split into two files keeps a
null-arm cell from carrying a shifted-arm field, and it is the same shape that addendum's change
(c) registers for `harness/run.mjs`.

**Null ids follow the registered grammar** in `validation/certification/lib/nulls.mjs:54`, whose
own header names the φ sweep as a user of it: `φ = 0` is `N2-m100` (the sweep's `φ = 0` arm is iid
Gaussian with μ and σ estimated from a 100-point calibration window, which is exactly that null),
and `φ > 0` is `N4-p03 / p06 / p08 / p09 / p095 / p099` (AR(1) with φ fitted from the calibration
window — the sweep passes no `opts.ar1Phi` to safe-t, so its φ is estimated at every grid point,
including where `harness/run.mjs` supplies an oracle φ under `N3`). Recording these ids rather than
a private vocabulary makes the sweep legible to certification instead of adding a fourteenth
wide-format study to the 426-cell detector-less gap the re-score already names. The generator
differs from `h0-battery/harness/nulls.mjs` in its AR(1) burn-in — `phi-sweep.mjs` starts at
`prev = 0`, `run.mjs:19` starts at one Gaussian draw — so an `N4-p09` cell from this study is a
same-law, different-seed, different-burn-in replicate of `run.mjs`'s, not a bit-level reproduction
of it.

## Change (ii) — a defect fix, named

`harness/phi-sweep.mjs:3` resolves the compiled detectors from the absolute path
`/Users/johnwarren/concord/deploysignal-engine/dist/detectors/`. Run from a worktree, it therefore
measures the **main checkout's** build, not the branch under test, and it fails outright on any
other machine. Corrected to resolve `dist/detectors/` relative to the harness file, as
`harness/run.mjs:9-12` already does.

**This moves no number today, and that is checked rather than assumed.** `sha256` of
`dist/detectors/safe-t-e-value.js`, `dist/detectors/universal-inference-e-value.js` and of the two
`.ts` sources is identical between this worktree and `~/concord/deploysignal-engine` at the time of
registration, and `detectors/safe-t-e-value.ts` matches the `sha256` pinned on the frozen safe-t
card. The fix removes a way for the sweep to silently measure the wrong build, and it is recorded
as a defect fix under rule 7 rather than as an improvement.

## Change (iii) — error counting, and a smoke flag

Two smaller recording additions, both required by `knowledge/methodology/harness-discipline`:

- Rule 2, no bare catch. The four `catch(_){}` blocks at `phi-sweep.mjs:20-23` swallowed every
  detector exception into a silently shorter denominator. Each now increments a counter that is
  recorded per cell as `error_count` and printed. The exceedance and power denominators are
  unchanged — still the count of finite values — so the published rates reproduce.
- `--n` accepts an N for smoke checks under rule 1. Its default is the registered `N = 2000`, and
  the manifest records the N actually used, so a smoke run cannot be mistaken for the study.

## Change (iv) — live mode

Executed `--mode live` on 2026-08-07. As in the companion addendum, `--mode` selects the output
directory and nothing else; no generator or endpoint branches on it.

## Registered predictions

P1–P3 of `PHI-IDENTIFIABILITY-PREREG.md` stand. These are additional and concern the run's effect
on certification, since the sweep's cells become scoreable for the first time.

- **P-B1.** The published table reproduces. UI power `0.6270 / 0.1810 / 0.0270 / 0.0005 / 0.0000`
  and safe-t power `1.0000 / 0.9565 / 0.7145 / 0.6615 / 0.9150` at
  `φ = 0.60 / 0.80 / 0.90 / 0.95 / 0.99`, with safe-t exceedance `0.1420` at `φ = 0.99`. The wiki
  numbers came from an unrecorded console run of the same seed, so a mismatch means the code moved
  between 2026-08-05 and now, and would be reported as such.
- **P-B2.** Every safe-t cell from this sweep falls **outside** the safe-t card's regime — φ is
  estimated at every grid point and the card quantifies over known φ — so the sweep cannot refute
  safe-t's certification. Its `φ = 0.99` exceedance of 0.1420 will appear as a regime-bounding
  excluded cell, which is the correct place for it.
- **P-B3.** The sweep's UI cells sit **inside** the UI card's regime (`phi_max` 0.99, no
  `phi_known` restriction), so its `φ = 0.9 / 0.95 / 0.99` power arms at `0.0270 / 0.0005 / 0.0000`
  will be scored against the 0.10 inertness floor and will contribute to the S3 move registered as
  P-A3. The UI card's own `power_phi_max: 0.8` is **not read** by `lib/score.mjs`'s regime check,
  so it will not pre-exclude them.
- **P-B4.** `error_count` will be 0 in every cell. A nonzero count is part of the result.

## What this cannot establish

The 2026-08-05 pre-registration's limits are unchanged: one detector pair, one fault shape, and
this is a claim about the profiled-AR(1) construction, not about all possible detectors. Making the
sweep a registered run adds provenance, not evidence — the numbers were computed the same way in
August 5's console session, and nothing here re-derives them independently.

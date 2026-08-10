# Addendum to POWER-PER-CELL-PREREG — the like-for-like live replication at N = 2000

**Registered 2026-08-10, committed before the run it governs.** Forward re-registration under
`knowledge/methodology/pre-registration-discipline` rule 1. Amends `POWER-PER-CELL-PREREG.md`
(registered 2026-08-05) and `POWER-PER-CELL-ADDENDUM-2026-08-07.md`, and inherits every endpoint of
`PREREGISTRATION.md`.

**No endpoint, threshold, seed, null, detector, α or floor changes.** `n_test = 100`,
`SEED = 20260801`, `ALPHAS = [0.05, 0.01]`, the ten-null battery, the 3σ power shift, the 50%
power-control floor and the T1 exceedance rule are all unchanged. P1–P4 of the 2026-08-05
pre-registration and P-A1–P-A6 of the 2026-08-07 addendum are not re-scored here; this addendum
adds one execution at one `N` and one comparison.

## 1. The premise this addendum was commissioned on is FALSE at HEAD, and I state that before anything else

`knowledge/WORKLIST` C38 item (2) reads:

> The 2026-08-05 power-per-cell/phi-sweep runs exist only under `results/sim`; no live run backs
> `stats/power-per-cell-2026-08-05`'s numbers.

**That was true on 2026-08-07 and is not true at HEAD.** Two live runs exist and carry the
registration in their own manifests:

| run | study | `mode` | manifest `prereg` / `addenda` | cells |
|---|---|---|---|---|
| `results/live/run-20260807T215034Z` | `2026-08-terminal-evalue`, `n: 4000` | `live` | `PREREGISTRATION.md`, `POWER-PER-CELL-PREREG.md`; `POWER-PER-CELL-ADDENDUM-2026-08-07.md` | 90, of which 58 carry `power_this_cell` and 29 are `POWER__*` arms |
| `results/live/run-20260807T215105Z` | `2026-08-phi-identifiability`, `n: 2000` | `live` | `PHI-IDENTIFIABILITY-PREREG.md`; `PHI-IDENTIFIABILITY-ADDENDUM-2026-08-07.md` | 28, all 28 carrying `phi` |

The wiki page also already carries a `LIVE-REPLICATED 2026-08-07` banner. **The WORKLIST row is
stale against the page it cites**, and correcting it is not this addendum's to do.

## 2. What is still missing, which is why there is a run at all

The banner claims, verbatim: *"Every number this page publishes reproduces exactly, including
safe-t's 0.1420 exceedance at φ=0.99."* **Half of that is verified from committed artifacts and half
of it is not, and the difference is one number: `N`.**

**The φ half reproduces exactly.** All twenty published φ-sweep figures — five φ values × (UI
exceedance, UI power, safe-t exceedance, safe-t power) — are byte-recomputable from
`results/live/run-20260807T215105Z/cells/`, at the same `N = 2000`, `m = 100`, `seed_base = 4242`
the page states. Verified cell by cell 2026-08-10. Nothing about that half is in question.

**The power-per-cell half is not a like-for-like comparison and the banner does not say so.** The
page's power table is a reading of `results/sim/run-20260805T230306Z`, whose manifest records
`n: 2000`. The 2026-08-07 live run records `n: 4000`. **No live run at `N = 2000` exists**, so the
page's power numbers have never been produced by a run under `results/live/`. What the 2026-08-07
run established is that the same *endpoints* survive a different Monte-Carlo `N`; it did not
reproduce the *numbers* the page prints, and three of them differ:

| cell | page / sim `N = 2000` | live `N = 4000` | Δ | Δ relative |
|---|---|---|---|---|
| safe-t, N2 m=30/100/500, power | 1.0000 | 1.0000 | 0 | 0 |
| safe-t, N4-p09, power | 0.7125 | 0.71275 | +0.00025 | +0.04% |
| **UI, N3-p09 / N4-p09, power** | **0.0275** | **0.02225** | **−0.00525** | **−19.1%** |
| UI, pooled power | 0.70155 (published as 0.7016) | 0.703025 | +0.001475 | +0.21% |
| safe-t, N4-p09, `mean_e` | 2,112 | 9,710 | ×4.6 | +360% |
| safe-t, N4-p09, exceedance @ α=0.05 | 0.0175 | 0.0160 | −0.0015 | −8.6% |

The page's own body already concedes the last two rows — *"exceedances reproduce (0.0175 against
0.0160 at a different N) while the heavy-tailed means do not (2,112 against 9,710)"*. **So the page
contradicts its own banner: the body says two numbers move with `N` and the banner says every number
reproduces exactly.** I record that as a contradiction between two passages of one artifact and do
not resolve it; the page is not mine to edit.

## 3. A provenance defect in the sim run the page rests on, found while checking the premise

`results/sim/run-20260805T230306Z/manifest.json` stamps `git_sha: 4b31a1206d85a6a36645f4b5715ee2efa55055ee`.
**The committed harness at that sha cannot have produced that run's cells.** At
`4b31a12`, `harness/run.mjs` closes the `for (const alpha of ALPHAS)` block — inside which `c` and
`alpha` are declared `const` — and then executes `c.power_this_cell = pcRate` and
`fs.writeFileSync(... a${alpha}.json ...)` outside it. In an ES module that is
`ReferenceError: c is not defined`, thrown on the first cell, before any file carrying a
`power_this_cell` field is written. Confirmed by executing the same scoping shape under this repo's
Node (`v25.9.0`). The run's 58 validity cells all carry `power_this_cell`.

**So the numbers the wiki page publishes were produced by uncommitted working-tree code, and the
recorded `git_sha` does not identify it.** The values themselves are not thereby wrong — the
`pcRate` arithmetic is identical at HEAD, which is why §4 predicts they reproduce — but their
provenance stamp is. That makes the run below the **first execution of committed code at the page's
`N`**, not a formality.

## 4. Change — one live run at `N = 2000`, and only that

`node harness/run.mjs --mode live --n 2000`, writing `results/live/run-<UTC>/`. One attempt; if it
fails it is reported failed and not re-attempted under this registration.

`--mode` still selects the output directory and nothing else, re-verified at HEAD:
`harness/run.mjs:15` reads the flag and `harness/run.mjs:76` uses it to choose `results/live`
against `results/sim`. No generator, detector call, seed, endpoint or field branches on it. Each
trajectory is seeded independently of `N` (`harness/run.mjs:85`, `rng(SEED + i * 7919)`), so the
`N = 2000` sample is the first 2,000 trajectories of the `N = 4000` sample and the two runs are
nested, not independent draws.

The only committed change to `harness/run.mjs` since `4b31a12` is `fc74a61`, the 2026-08-07
addendum's recording additions: `meanSd`, `meanLower95`, the two new cell fields, the `POWER__*`
files, and the repair of the scoping defect in §3. None of it consumes RNG. That is the whole basis
for the predictions.

## 5. Registered predictions

Predictions are the sim numbers themselves, with a band of zero, because the mechanism claimed is
determinism rather than agreement between two samples. Bands from recorded variance are stated where
the prediction is not a determinism claim.

- **PR1 (the point of the run).** On all **61** cell keys the two runs share — 58
  `<det>__<null>__a<alpha>.json` and 3 `CONTROL_power__<det>.json` — every numeric field present in
  both is **equal in full double precision** to `results/sim/run-20260805T230306Z`:
  `exceedance`, `lower_95`, `verdict`, `mean_e`, `p_e_ge_10`, `p99_e`, `nan_count`, `n`,
  `power_this_cell`, `power_verdict`, and `rate_e_ge_20` on the three controls. **Band: exact.** A
  single deviating digit falsifies the determinism claim of §4 and is the finding, reported and not
  corrected.
- **PR2.** The run writes **90** cells: the 61 above plus **29** `POWER__<det>__<null>.json` arms
  that the sim run predates. On each, `rate_e_ge_20` equals the `power_this_cell` on its own
  validity cells to full precision. **Band: exact.**
- **PR3.** `mean_e_sd` and `mean_e_lower_95` are present on all 58 validity cells and absent from
  the sim run, so they are **new, not replicated**, and nothing here scores them. Recorded for the
  corpus.
- **PR4 (the page's four published power figures, at their own `N`, quoted at the precision the sim
  run records rather than the precision the page prints).** safe-t N2 m=30/100/500 power `1`;
  safe-t N4-p09 power `0.7125`; UI N3-p09 and N4-p09 power `0.0275`; UI pooled
  `rate_e_ge_20 = 0.70155` (the page's `0.7016`). For completeness the other two pooled controls
  are `safe_t 0.96085` and `nuisance_robust_bf_CONTROL 0.9531701890989989`. **Band: exact.** If
  these come in at the `N = 4000` values (`0.02225`, `0.71275`, `0.703025`) instead, the determinism
  claim is false and §2's deviation table was measuring something other than `N`.
- **PR5 (stated so the run cannot be read as closing more than it does).** The cross-`N` deviations
  tabled in §2 will **not** shrink, because this run does not re-measure at `N = 4000`. In
  particular UI's inert cells stay a **−19.1%** relative gap between the two `N`, and safe-t's
  N4-p09 `mean_e` stays a **4.6×** gap. **A live run at the page's `N` closes a provenance gap and
  does not make a heavy-tailed mean stable.**

## 6. What this addendum does not change, and what it does not establish

- **No card is edited and none is re-frozen.** No card's `source_files` names any file under
  `validation/terminal-evalue/` (audited across all 15 cards, 2026-08-10).
- **No wiki page is edited.** The banner over-claim of §2, the body/banner contradiction, and the
  stale WORKLIST row are recorded here and owed upward.
- **The provenance defect of §3 is not repaired.** `results/` is append-only; the sim run's manifest
  keeps its wrong `git_sha` and this addendum is the record of it. No prior run is superseded.
- **It does not make the mean measurable.** `knowledge/stats/terminal-mean-is-not-measurable`
  applies unchanged, and §5 PR5 says so in advance.
- **It buys provenance, not power.** `--mode` is a directory selector. A live run of a deterministic
  harness is evidence that committed code produces the published numbers, and evidence of nothing
  else about the detectors.
- One fault shape (+3σ mean shift) and synthetic nulls only, as before.
- **The φ sweep is not re-run.** It already has a live run at its own `N` and §2 verifies all twenty
  of its published figures against it.

## 7. House rules, mapped

(1) Committed before the run. (2) No endpoint or threshold moves. (3) The deviation table in §2 is
arithmetic on two already-published runs, quoted to bound what this run can close — no candidate
endpoint is analysed in advance of it. (4) `PREREGISTRATION.md` §9's fallback untouched. (5) No new
substrate: same nulls, same detectors, same generator. (6) One registered attempt; `results/` is
appended to and nothing is overwritten. (7) No prior run is superseded or re-run. (8) Binding on the
report of this run: it must state the deviation count against `run-20260805T230306Z` field by field,
including zero.

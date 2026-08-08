# Detector certification (protocol v1)

## What this directory is

This is the mechanical implementation of the detector certification protocol, ratified
2026-08-06. The protocol itself — the four-stage gate (S1 reachability, S2 validity, S3
power, S4 budget/shipped-path), the VOID/REFUTED/MISSING semantics, and the USE/ADVISORY/
REFUSE/NOT_EXECUTABLE verdict vocabulary — is specified at
`~/concord/knowledge/methodology/pages/detector-certification-protocol.md`. That page is
the protocol; this directory is one engine's compliance harness for it. Read the wiki page
first if the *why* behind a scoring rule is unclear — this README covers only how to run
the harness and what its output means.

## How to run

```
npm run cert:verdict
```

This runs `verdict.mjs`, which reads every frozen card in `cards/`, matches it against
registered evidence under `validation/*/results/live/` (via `lib/collect.mjs`), scores each
card through `scoreS1`/`scoreS2`/`scoreS3`/`scoreS4`/`overallVerdict` (`lib/score.mjs`), and
writes one append-only `results/run-<UTC ISO basic>/` directory containing:

- `manifest.json` — git sha, node version, protocol version, `report_format`, and a sha256 of
  every card file that fed the run (via `lib/freeze.mjs`'s `fileSha256`).
- `<detector_id>.card.json` — one per card:
  `{card, s1, s2, s3, s4, pairing, overall, generated_from}`.
- `REPORT.md` — one table row per card: detector, class, S1/S2/S3/S4 status, a `suppressed`
  column summarizing any nonempty `suppressed_verdicts` tally (e.g. `ANTI-CONSERVATIVE x25,
  conservative x23`, or `—` when nothing was suppressed), the overall verdict, and tier.
  The footer carries both standing caveats verbatim — the ADR-0012 real-telemetry anomaly
  and the unmet P1 gate — because they attach to every row and are not derivable from any
  card's stage scores.
- `MISSING-CELLS.md` — every stage MISSING/UNPRICED gap, every per-cell missing/excluded
  entry, every unpaired validity cell (an in-regime cleared cell with no power arm at the
  same null), excluded cells that carried no verdict token, every nonempty
  suppressed-verdict tally, S4 findings that record a gap without changing the status (no
  envelope wiring, alpha resolution unverifiable), and two standing protocol-wide gaps
  (the `clustersynth-ui` detector-less-cell shape and the sim-only power/phi-sweep runs)
  that don't reduce to any single card's stage scores.

`results/` is append-only: each run gets its own timestamped directory, and nothing already
written is ever edited or deleted by a later run.

### Which run is current

**Current: `results/run-20260807T220905Z`.** Run directories are named `run-<UTC basic>`, so
lexicographic order is chronological and the greatest name is the current run — there is no
pointer file, because a pointer would be the one file in an append-only tree that every run
rewrote.

`results/run-20260807T215155Z` is **preserved and superseded**. It is the last run scored
against the pre-fix scorer, which had two verdict-integrity defects the live power study
found (see `.superpowers/sdd/2026-08-06-detector-certification-v1/study-power-live-report.md`
§5): the mean rule (`lib/guards.mjs`) preferred a recorded `mean_e_lower_95` over the
point-estimate `mean_e` outright, so `safe_t` `N4-p09`'s 2026-08-07 cells (mean_e 9,710,
bound clamped to 0.0000) cleared in that run even though its 2026-08-02 cells with the
identical mean_e and no recorded bound refuted; and `'FAIL'` — the terminal-evalue harness's
own refutation token (`run.mjs:115`) — was absent from `VERDICT_MAP`, so `safe_t`'s one
recorded T1 refutation (φ = 0.99, out of regime either way) scored as missing evidence. Both
are fixed: the mean rule now takes the strongest of the two signals and never clears, and
`FAIL` maps to `REFUTED`. **No overall verdict or tier moved on any of the nine cards** —
verified by diffing every `<detector_id>.card.json`'s `overall.{verdict,tier}` between the
two runs. `safe_t_e_value`'s `s2.mean_rule_overrides` grows from 3 to 7 (the 2026-08-07
`N4-p09` pair now refutes instead of clearing) and its suppressed tally changes from
`FAIL x1, not-refuted x3` to `not-refuted x7` (`FAIL` cells no longer get suppressed — they
map straight to `REFUTED` and score normally). All are out of safe-t's published
estimated-φ-excluded regime, so `s2.status` itself does not move.

`results/run-20260807T202419Z` is **preserved and superseded**. It is the first run scored
against the two live terminal-evalue runs of 2026-08-07
(`validation/terminal-evalue/results/live/run-20260807T215034Z` and `run-20260807T215105Z`,
registered by that study's two 2026-08-07 addenda) that supersedes it, and its differences are
evidence deltas rather than scoring corrections. Three: `universal_inference_e_value` moves S3
**PASS → INERT** on per-null power arms of 0.0222 at φ = 0.9 and 0.0000 at φ = 0.99 that its
pooled control of 0.7030 averaged away, keeping **USE T1** on a regime narrowed to φ < 0.9; the
unpaired-validity-cell count falls from **29 to 11**, the remaining 11 all
`sequential_ui_e_process`; and safe-t's suppressed tally moves from `not-refuted x2` to
`FAIL x1, not-refuted x3`. See `study-power-live-report.md` in the SDD directory for what the
new `mean_e_lower_95` instrument did and did not fire on.

`results/run-20260807T193113Z` is **preserved and superseded**. It is the first official
re-score, and it is kept rather than corrected for two reasons. It is the record of what the
protocol said before the mean rule and the fail-closed phi check existed, which is the only
way the correction is auditable — the delta is visible by diffing two `REPORT.md`s, which is
what append-only is for. And it is the artifact three commits and a wiki page already cite;
rewriting it would leave those citations pointing at numbers that were never published. Its
one substantive difference: it scored `safe_t_e_value` **USE T1 on an unnarrowed regime**,
because its `N4-p09` cells cleared on a 0.016 exceedance while carrying `mean_e` 9,709.99.
That verdict is withdrawn. The current run reaches USE T1 for safe-t on a regime narrowed to
known phi, with those cells named as excluded.

Each run records a `report_format` in its manifest — the shape of the run's emitted
markdown, not the protocol version, which stays 1. Format 1 has no S1 column and no caveat
footer; format 2 has both; format 3 additionally carries, in `COVERAGE.md`'s detail section,
one line per YES class naming any card that also measured the class COVERED but is barred
from carrying it by its own non-USE verdict. `test/report-consistency.test.mjs` reads that
field so a preserved run is checked against the shape it was written under.

### Card pins, and why the sha moved four times

The nine cards have been frozen four times. Each freeze restamped `engine_pin.sha` and
recomputed `source_files[].sha256`:

| freeze | pin | what changed in the cards |
|---|---|---|
| `959d622` | `7dc473b` | the original freeze of the nine claim cards |
| `095dd81` | `017599f` | corrected detector **aliases**, so evidence keyed under a detector's other names could be matched; no endpoint moved |
| `6eef189` | `45ce230` | added `detectors/validity-envelope.ts`, `lib/score.mjs` and `verdict.mjs` to every card's expiry surface, and `regime.phi_known: true` to safe-t (the machine form of its own frozen guarantee sentence) |
| (this freeze) | `77067e6` | `lib/score.mjs`'s pinned sha256 moved: the mean-rule strongest-signal fix and the `FAIL` → `REFUTED` vocabulary fix (see "Which run is current" above). `verdict.mjs`'s sha256 is unchanged — it wasn't touched. No card content changed; only the pin. |

**Every detector source file is byte-identical across all four pins.** The restamp records
when a card was frozen, not a change in the detector it describes. Verifiable directly:

```
for sha in 7dc473b 017599f 45ce230; do
  git show $sha:detectors/safe-t-e-value.ts | shasum -a 256
done
```

which prints `8a5103401ab0…` three times, matching the `sha256` in
`cards/safe_t_e_value.json`. The same holds for the other eight detector modules and for
`detectors/validity-envelope.ts` (`750808f33eaf…`).

### `CERT_RESULTS_DIR`

Set this environment variable to redirect where `run-<UTC>/` is created, overriding the
default `validation/certification/results/`. `test/report-consistency.test.mjs` and
`test/golden-verdicts.test.mjs` use it to drive the CLI end-to-end against a temp directory,
so the test suite never creates or edits the real `results/` — an official run is a
deliberate act with a commit behind it, not a side effect of running tests.

```
CERT_RESULTS_DIR=/tmp/cert-scratch node validation/certification/verdict.mjs
```

### `CERT_SIBLING_ROOT`

`expiry-check.mjs` and `tools/freeze-cards.mjs` resolve a card `source_files[].path`
beginning `../` against a **sibling workspace root** — `family_E_conformal` pins
`../deploysignal/tools/calibrators/family-e.ts`, which lives in a different repo. The CLI
defaults that root to `/Users/johnwarren/concord`; set `CERT_SIBLING_ROOT` to override it:

```
CERT_SIBLING_ROOT=/path/to/workspace node validation/certification/expiry-check.mjs
```

A pin the tool cannot read counts as drift, and it does not currently distinguish "the file
changed" from "the sibling repo isn't checked out here" — which is why CI runs the expiry
check as a reported, non-gating step (see `.github/workflows/ci.yml`).

## Test entry points

```
npm run test:cert     # the harness's own tests (node --test over test/*.test.mjs)
```

`npm test` builds and runs the compiled `dist/test` suite and does **not** cover this
directory: the harness is plain `.mjs` outside `dist/`. Both run in CI.
`test/golden-verdicts.test.mjs` freezes the nine verdicts and their stage statuses; it drives
the CLI against the real corpus, so any change that moves a verdict fails by name.

## Card vs. detector card

A **card** (`cards/<detector_id>.json`) is a frozen *input*: the claim under test — the
detector's guarantee sentence, its regime, its shipped path, its budget participation, its
falsifier, and its prior evidence citations — pinned to a specific engine commit
(`engine_pin.sha`) and source-file hashes (`source_files[].sha256`) by `tools/freeze-cards.mjs`.
Cards are hand-authored and machine-frozen; `tools/validate-cards.mjs` checks them against
`lib/schema.mjs` before a run will touch them.

A **detector card** (`results/run-<UTC>/<detector_id>.card.json`) is the mechanical *output*
of scoring a card against the evidence available at run time: the frozen `card` verbatim,
plus `s1`/`s2`/`s3`/`s4`/`overall` verdict objects and `generated_from.runs` (the list of
`study/run` pairs whose cells fed the score). A card is authored once and re-frozen only when
its claim changes; a detector card is regenerated every run and never hand-edited.

## Append-only and frozen-constants rules

- **`results/` is append-only.** Every run writes a new `run-<UTC>/` directory. Never edit or
  delete a prior run's output — if a scoring rule changes, that's a new run, and the delta is
  visible by diffing two `REPORT.md`s, not by rewriting one.
- **Cards are frozen, not live.** A card's `engine_pin`, `source_files[].sha256`, and claim
  content only change through `tools/freeze-cards.mjs`, never by hand-editing
  `results/*/*.card.json` or the card source under `cards/`. `verdict.mjs` refuses to run
  against a card whose `engine_pin.sha` is `null` (unfrozen).
- **Scoring constants are frozen.** `INERTNESS_FLOOR`, `INERTNESS_SHIFT_SIGMA`,
  `TERMINAL_MEAN_BOUND` and the tier order live in `lib/constants.mjs` and are registered
  with the card freeze — see that file's own comment before moving them; a mechanical-verdict
  protocol's numbers can't drift between runs without becoming a different protocol.
- **The verdict is mechanical.** `verdict.mjs` maps recorded per-cell `verdict` fields through
  an explicit vocabulary table; it never re-derives a verdict from raw wealth/e-value data.
  Anything the scorer can't map to a known token is named in `missing[]`/`excluded[]` and
  surfaced in `MISSING-CELLS.md`, never silently dropped. Two rules override a recorded
  token, both stated by the protocol and both refusal-only:
  - the **mean rule** (`lib/guards.mjs`) — a `terminal_e_value` cell cleared on exceedance
    whose mean exceeds the registered bound of 1 maps REFUTED, and the overridden token
    joins the suppressed tally. It never clears and never rescues: a sample mean *below* 1
    carries no evidence at all (`stats/terminal-mean-is-not-measurable`).
  - **fail-closed phi** (`lib/nulls.mjs`, `lib/score.mjs`) — a validity cell whose φ is
    unknown after derivation from the registered null-id grammar is refused, not admitted.
    S3 does not fail closed: a pooled power control has no null and no φ by construction,
    and power is not a validity claim, so the gap is recorded and the cell is still scored.

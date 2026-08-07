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

- `manifest.json` — git sha, node version, protocol version, and a sha256 of every card file
  that fed the run (via `lib/freeze.mjs`'s `fileSha256`).
- `<detector_id>.card.json` — one per card: `{card, s1, s2, s3, s4, overall, generated_from}`.
- `REPORT.md` — one table row per card: detector, class, S2/S3/S4 status, a `suppressed`
  column summarizing any nonempty `suppressed_verdicts` tally (e.g. `ANTI-CONSERVATIVE x25,
  conservative x23`, or `—` when nothing was suppressed), the overall verdict, and tier.
- `MISSING-CELLS.md` — every stage MISSING/UNPRICED gap, every per-cell missing/excluded
  entry, every nonempty suppressed-verdict tally, and two standing protocol-wide gaps
  (the `clustersynth-ui` detector-less-cell shape and the sim-only power/phi-sweep runs)
  that don't reduce to any single card's stage scores.

`results/` is append-only: each run gets its own timestamped directory, and nothing already
written is ever edited or deleted by a later run.

### `CERT_RESULTS_DIR`

Set this environment variable to redirect where `run-<UTC>/` is created, overriding the
default `validation/certification/results/`. `test/report-consistency.test.mjs` uses this to
drive the CLI end-to-end against a temp directory, so the test suite never creates or edits
the real `results/` directory — the first official run against `results/` is a separate,
later step, not something a test run should produce as a side effect.

```
CERT_RESULTS_DIR=/tmp/cert-scratch node validation/certification/verdict.mjs
```

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
- **Scoring constants are frozen.** `INERTNESS_FLOOR`, `INERTNESS_SHIFT_SIGMA`, and the tier
  order live in `lib/constants.mjs` and are registered with the card freeze — see that file's
  own comment before moving them; a mechanical-verdict protocol's numbers can't drift between
  runs without becoming a different protocol.
- **The verdict is mechanical.** `verdict.mjs` maps recorded per-cell `verdict` fields through
  an explicit vocabulary table; it never re-derives a verdict from raw wealth/e-value data.
  Anything the scorer can't map to a known token is named in `missing[]`/`excluded[]` and
  surfaced in `MISSING-CELLS.md`, never silently dropped.

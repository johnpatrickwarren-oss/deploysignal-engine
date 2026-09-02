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

**Current: `results/run-20260810T064520Z`.** Run directories are named `run-<UTC basic>`, so
lexicographic order is chronological and the greatest name is the current run — there is no
pointer file, because a pointer would be the one file in an append-only tree that every run
rewrote.

**The line above used to name `run-20260808T014809Z`, and by the time this batch touched it that
was stale by NINE runs**, not by one: `064214Z`, `091718Z`, `122216Z`, `133943Z`, `180653Z`,
`201836Z`, `20260809T040659Z`, `080049Z` and this batch's own. The staleness is named rather than
quietly overwritten, because the rule two sentences up — greatest name wins — means this line is
redundant with the directory listing and therefore drifts silently; that it drifted nine times is
the argument for reading the listing, not this sentence. Reconstructing which of those nine moved
what is archaeology outside this batch's scope; each is described in the golden table's own
chronological notes (`test/golden-verdicts.test.mjs`).

`run-20260810T064520Z` is the **C38.5/C38.4 re-score**, consuming
`validation/h0-battery/results/live/inc-20260810T064226Z` — the class-instrument arm h0-battery
`PREREGISTRATION.md` **Amendment A3** registered. **One row moves:**
`family_C_safe_hotelling` NOT_EXECUTABLE → **REFUSE**, S2 MISSING → REFUTED, with S1 MISSING,
S3 PASS and S4 UNPRICED unchanged. Its S2 had been empty in all three of `perCell`/`excluded`/
`missing` — the card's 36 pooled P1 endpoint rows carry none of `isValidityCell`'s five instrument
fields (Amendment A1.3's second gap), and it was the only h0-battery detector with no
`increment_estimator` cells from `detector-audit-sequential`. A3 measured that instrument instead
of widening the vocabulary: seven of twelve nulls refute on the card's own frozen 1.0005 falsifier,
N1/N7 clear at 0.996229, and three are named-not-scored. S3 grew 1 → 13 power cells because the
arm's second half emits a per-null 3σ arm, which also keeps this card's `pairing` empty — the
corpus-wide unpaired count stays 11, all `sequential_ui_e_process`. No other card and no
`COVERAGE.md` class answer moves. **No card was re-frozen for this run and none needed to be**: no
card pins any `validation/h0-battery/` file, and `lib/score.mjs`, `verdict.mjs`, `lib/collect.mjs`,
`lib/constants.mjs`, `lib/guards.mjs` and every detector source are untouched — `cert:expiry`
prints `all cards current`, which is why the freeze table below gains no row.

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

### Card pins, and why the sha keeps moving

The cards have been frozen at least nine times. **The rows below record eight, and the gap between
`597a97c` and `4a48450` is named in the table rather than papered over.** The nine original claim
cards ran through the first six; the two 2026-08-08 candidates (`group_average_e_value`,
`family_E_conformal_heldout`) joined at the fifth. Each freeze restamps `engine_pin.sha` and
recomputes every `source_files[].sha256`:

| freeze | pin | what changed in the cards |
|---|---|---|
| `959d622` | `7dc473b` | the original freeze of the nine claim cards |
| `095dd81` | `017599f` | corrected detector **aliases**, so evidence keyed under a detector's other names could be matched; no endpoint moved |
| `6eef189` | `45ce230` | added `detectors/validity-envelope.ts`, `lib/score.mjs` and `verdict.mjs` to every card's expiry surface, and `regime.phi_known: true` to safe-t (the machine form of its own frozen guarantee sentence) |
| `7b1e9be` | `77067e6` | `lib/score.mjs`'s pinned sha256 moved: the mean-rule strongest-signal fix and the `FAIL` → `REFUTED` vocabulary fix (see "Which run is current" above). `verdict.mjs`'s sha256 is unchanged — it wasn't touched. No card content changed; only the pin. |
| `6b01274` | `4c16092` | the two new candidate cards land and every card is restamped to the same pin (identity/freeze only) |
| `c59ea9a` | `597a97c` | `verdict.mjs`'s pinned sha256 moved on the nine cards that pin it: COVERAGE.md now names, per YES row, any card that measured the class COVERED but is barred by its own non-USE verdict (I4), and `bestBlocked`'s detector_id tiebreak is now in the code rather than only in its comment (M1). No detector source sha moved, no card content changed, and no verdict moved — the eleven card JSONs of `run-20260808T014809Z` are byte-identical to `run-20260808T011035Z`'s outside the two pin fields. |
| (not recorded) | … → `4a48450` | **NO ROW WAS EVER ADDED FOR THESE.** The table's last recorded pin is `597a97c`; the cards stood at `4a48450` immediately before the freeze below. **Four merges touched `cards/` in between** (`4d9380c`, `80edc86`, `b852059`, `5b95e2a` on first-parent history) and this table gained a row for none of them. The `0522faf` → `4a48450` movement is recorded in coverage `PREREGISTRATION.md`, at the correction append to v2.K6A.7 (F5 and its addendum). The gap is named by the batch that noticed it; reconstructing the individual rows is archaeology outside that batch's scope. |
| `3f55f55` (this freeze) | `3f55f55` | **Pins only, and the diff is stated.** One `source_files[].sha256` moved on one card: `shape_ecdf_accumulator`'s pin of `validation/coverage/harness/run-battery.mjs`, `e7d4735…` → `26f3e07…`, because Amendments v2.C38.1 / v2.C39 / v2.C47.2 changed that harness. The other fourteen cards changed **only `engine_pin.sha`** (`4a48450` → `3f55f55`), the acceptable collateral of a whole-directory freeze route (`tools/freeze-cards.mjs` has no per-card mode) — the `f487800` precedent, and disclosed there in the same terms. **No `guarantee`, `regime`, `falsifier`, `shipped_path`, `budget`, `prior_evidence`, `class`, `aliases` or `detector_id` field of any card changed, and no DETECTOR source sha moved anywhere:** exactly one `source_files` sha moved across all 15 cards, and it is the harness pin above. `engine_pin.version` is unchanged (`0.6.6-pre`) on all 15. **A dedicated commit carrying nothing else — the K6A.5.3 lesson.** |
| `f3503ce` | `3f55f55` | **CORRECTS THE ROW ABOVE, which put a PIN in the freeze column.** The freeze above was carried by commit **`f3503ce`**; `3f55f55` is the sha the cards were pinned TO, not the commit that pinned them. Both cells said `3f55f55`. The wrong row is left standing because this table is the provenance record and a silently-edited provenance record is worth less than a corrected one. **The trap is structural, not careless:** `freeze-cards.mjs` stamps `git rev-parse HEAD`, so a freeze commit cannot name its own sha — which is why every earlier row wrote `(this freeze)` in that column and why the rows below do too. |
| (this freeze) | `3952ea0` | **Pins only, and stated in the commit that does it.** One `source_files[].sha256` moved, on one card: `shape_ecdf_accumulator`'s pin of `validation/coverage/harness/run-battery.mjs`, `26f3e078…` → `6d3ccb16…`, because the review round made the `mean_e_lower_95` identity structural (coverage `PREREGISTRATION.md`, the correction append to v2.C45/v2.C38.1, item (d)). The other fourteen changed **only `engine_pin.sha`** (`3f55f55` → `3952ea0`). No detector source sha moved anywhere; no `guarantee`, `regime`, `falsifier`, `shipped_path`, `budget`, `prior_evidence`, `class`, `aliases` or `detector_id` field of any card changed; `engine_pin.version` is `0.6.6-pre` on all fifteen. **A dedicated commit carrying nothing else**, and the column above is `(this freeze)` for the reason the corrected row gives. |
| (this freeze) | `431894a` | **Pins only, and stated in the commit that does it.** One `source_files[].sha256` moved, on one card: `shape_ecdf_accumulator`'s pin of `validation/coverage/harness/run-battery.mjs`, `6d3ccb16…` → `ad483326…`, because coverage **Amendment v2.C43.1** made that harness's `null_id` per-detector (WORKLIST `C43`: `N1` asserted an `opts.ar1Phi` threading `safe_t`, `group_average_e_value` and `universal_inference` never receive, and `phi_source` — the field `lib/score.mjs`'s regime check reads — is derived from it). The other fourteen changed **only `engine_pin.sha`** (`3952ea0` → `431894a`). No detector source sha moved anywhere; no `guarantee`, `regime`, `falsifier`, `shipped_path`, `budget`, `prior_evidence`, `class`, `aliases` or `detector_id` field of any card changed — audited field by field before the commit; `engine_pin.version` is `0.6.6-pre` on all fifteen. **A dedicated commit carrying nothing else** — the K6A.5.3 lesson. The relabel moves no verdict: coverage Amendment v2.C43.1 §C43.1.3 re-ran the real `scoreS2`/`scoreS3`/`coverageFor`/`pairingGaps` over the committed cells with the new ids and every stage status, class answer and pairing list is unchanged. |
| (this freeze) | `d8e60eb` | **Pins only, and stated in the commit that does it.** `validation/certification/lib/score.mjs`'s pinned sha256 moved on the **nine** cards that pin it, `f9d2d57c…` → `91553b0b…`, for a **one-character** change: the literal NUL byte at `:265` became the `\0` escape (same U+0000, byte-identical Map key, verified directly and by `test:cert` 181/0, which exercises the `offShift` map that uses it). The reason it is worth a freeze: a literal NUL makes `grep` classify the file as binary and print **nothing** for a matching pattern, and coverage Erratum v1.5 §C43.3's central claim about this file is an argument from absence a reader would re-check with `grep`. Registered as F4 of the review correction append in coverage `PREREGISTRATION.md`. The other six cards changed **only `engine_pin.sha`** (`431894a` → `d8e60eb`). No detector source sha moved anywhere; no `guarantee`, `regime`, `falsifier`, `shipped_path`, `budget`, `prior_evidence`, `class`, `aliases` or `detector_id` field of any card changed — audited field by field before the commit; `engine_pin.version` is `0.6.6-pre` on all fifteen. **A dedicated commit carrying nothing else** — the K6A.5.3 lesson. **No verdict moves:** the change is lexical, no scoring rule is touched, and no run is re-scored. |
| (this freeze) | `46eb7ab` | **NOT pins only — pins plus ONE card text field, disclosed in advance and named here rather than found later.** One `source_files[].sha256` moved, on one card: `shape_ecdf_accumulator`'s pin of `validation/coverage/harness/run-battery.mjs`, `ad483326…` → `8e914508…`, because coverage **Amendment v2.C51.1** made that harness emit `crossing_time` on the accumulator's six rows (WORKLIST `C51` item 1: K6A.1.12 registered a median-time-to-cross prediction, band and falsifier against a quantity the adapter was discarding). The other fourteen changed **only `engine_pin.sha`** (`d8e60eb` → `46eb7ab`). **AND, disclosed at coverage Amendment v2.C47.1 C47.1.6(a) before it was made:** `point_tail_bet_e_value`'s `guarantee.regime.exchangeability_note` gains the **measured** size of its self-fit exchangeability gap (`≈ 1e-6` to `5e-6` on a `~2.7e-3` per-point exceedance at `n = 10,000`, registered outcome (a), WORKLIST `C47` item 1 closed as quantified). That field previously said the departure was `O(1/n)`-approximate and anti-conservative **with no size**; it now carries the number, the probe that produced it, the MAD-inertness correction to K4.1.10, and what the measurement does not bound. **It rides here, in one card commit, rather than in a commit of its own — which is a departure from "pins only" and is why this row says so in its first sentence.** `cert:expiry` reads only `source_files[].sha256`, so a note edit expires nothing and could have been made anywhere; it is here so the branch has ONE card commit. **Left deliberately unchanged and named: `guarantee.sentence` still reads "self-fit median/MAD held-out calibration".** It describes the CONSTRUCTION, which does self-fit both statistics, not the attribution of the departure — so it is accurate as written, and editing a second field was out of scope. No detector source sha moved anywhere; no `falsifier`, `shipped_path`, `budget`, `prior_evidence`, `class`, `aliases`, `detector_id`, `protocol_version` or `family` field of any card changed, and no other `guarantee` or `regime` field on any card changed — audited field by field before the commit; `engine_pin.version` is `0.6.6-pre` on all fifteen. **No verdict moves:** `crossing_time` carries no verdict authority by registration (C51.1.4), the note is documentation, and no run is re-scored. |
| (this freeze) | `ab918b2` | **ONE card text field plus pins, and it CORRECTS the field the row above added.** `point_tail_bet_e_value`'s `guarantee.regime.exchangeability_note`: the self-fit excess is corrected from the `2.6e-6`–`4.5e-6` range the row above recorded to **`~1.1e-6`** — pooled-median estimator `1.095594e-6 ± 4.68e-9` across three PRNGs, agreeing to `1.4%` with the closed form `2*phi(T)/(2*n*phi(0)) = 1.110875e-6` at `T = 3.0000074` — with the outcome-(a) margin at **`4,404x`**, the direction at **`z = +234`**, and the `O(1/n)` rate now **MEASURED** (`n × excess` flat at `0.0098`/`0.0110`/`0.0113` across `n = 2,500`/`10,000`/`40,000`, constant `4.06`). **Why the row above was wrong:** an independent review derived the estimand in closed form and measured it at ~100x the probe's precision, and the true value sits **inside** the range coverage `PREREGISTRATION.md`'s results append labelled *disclosed post-measurement* and **outside** the one it labelled *the registered reading* — because a defective generator-agreement rule (it compared two independent arm means against ONE arm's standard error and fired at `z = 0.92`) promoted the under-replicated pair to the headline. Registered at the **correcting append to Amendment v2.C47.1's results append**, where the original figures stand rather than being edited away. **NO `source_files[].sha256` moved on any card** — `run-battery.mjs` is unchanged since the freeze above — so all fifteen changed **only `engine_pin.sha`** (`46eb7ab` → `ab918b2`) besides that one note field. No detector source sha moved anywhere; no `falsifier`, `shipped_path`, `budget`, `prior_evidence`, `class`, `aliases`, `detector_id`, `protocol_version` or `family` field of any card changed, and no other `guarantee` or `regime` field on any card — audited field by field before the commit; `engine_pin.version` is `0.6.6-pre` on all fifteen. **`guarantee.sentence` still reads "self-fit median/MAD held-out calibration"**, still left deliberately, for the reason the row above gives. **No verdict moves:** the note is documentation, no scoring rule is touched, and no run is re-scored. |

| (this freeze) | `849618d` | **NOT pins only — the first freeze in this table where DETECTOR source shas move, and the reason is stated here before the row is read as a defect.** ADR 0027 (`decisions/0027-evidence-surface-and-live-validity-metrics.md`) adds the optional `evidence` surface to the five per-tick wealth detectors, so their `source_files[].sha256` move on five cards: `family_A_betting_e_process` (`detectors/betting-e-process.ts`), `family_A_mixture_supermartingale` (`detectors/_page-cusum-mixture.ts` AND `detectors/family-a-mixture-supermartingale.ts`), `family_C_safe_hotelling` (`detectors/_hotelling-safe.ts`), `family_D_spectral_e_detector` (`detectors/spectral.ts`), `sequential_mmd_betting_e_process` (`detectors/family-c-betting-e-process.ts`). **No verdict, statistic, threshold, fire tick, α accounting or wealth book changes** — asserted in-test against the pre-0027 arithmetic (`test/adr-0027-evidence-surface.test.ts` AC-8) — and **`cert:verdict` output is byte-identical before and after the freeze** (diffed, `IDENTICAL`; the re-score run is `results/run-20260902T195344Z`). The other ten cards changed only `engine_pin` (sha → `849618d`; `version` `0.6.6-pre` → `0.6.7-pre` on all fifteen, the package version since 2026-08-22 — the cards had not been restamped since). No `guarantee`, `regime`, `falsifier`, `shipped_path`, `budget`, `prior_evidence`, `class`, `aliases` or `detector_id` field of any card changed — audited field by field before the commit. **A dedicated commit carrying nothing else.** |

| (this freeze) | `a08cd6e` | **One detector source sha moves, on one card: `family_C_safe_hotelling`'s pin of `detectors/_hotelling-safe.ts`**, for a HEADER-ONLY change (C61): the comment that claimed "anytime-valid under Ville's inequality: fire at 1/α" now states that the shipped threshold is a bootstrap quantile and licenses no e-value claim. No executable line changed (diff is comment lines only); `cert:verdict` byte-identical before and after. The other fourteen cards changed only `engine_pin.sha`. `engine_pin.version` stays `0.6.8-pre`. **A dedicated commit carrying nothing else.** |

| (this freeze) | `8192b47` | **One detector source sha moves, on the two cards that pin `detectors/conformal.ts` (`family_E_conformal`, `family_E_conformal_heldout`)**, for C65: a zero `per_family.E` now evaluates at the nominal level and spends nothing (`asAdvisory`) instead of tripping the `1/α` sample guard into permanent suppression; budgeted profiles are byte-identical. `cert:verdict` byte-identical before and after (Family E's cards were NOT_EXECUTABLE / REFUSE on other grounds and remain so). The other thirteen cards changed only `engine_pin.sha`; `engine_pin.version` stays `0.6.8-pre`. **A dedicated commit carrying nothing else.** |

**Correction to the sentence below, 2026-09-02:** it was true for every freeze through `ab918b2`.
The `849618d` freeze above is the first where detector source shas move; the row says which five
and why. The sentence is left as written because it is the provenance record for the pins it
names; the shasum loop below still holds for those pins.

**Every detector source file is byte-identical across every pin above, including this freeze:** the
only `source_files` sha to move in it is a HARNESS pin, not a detector's. The restamp records
when a card was frozen, not a change in the detector it describes. Verifiable directly:

```
for sha in 7dc473b 017599f 45ce230 4a48450 3f55f55; do
  git show $sha:detectors/safe-t-e-value.ts | shasum -a 256
done
```

which prints `8a5103401ab0…` five times — the three original pins plus the two most recent, so the
claim above covers the freezes this table gained rows for last. It matches the `sha256` in
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

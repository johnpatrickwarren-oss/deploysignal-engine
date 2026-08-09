# Pre-registration — H₀ battery: do the detectors produce e-values?

- **Study id:** `2026-07-h0-battery`
- **Engine pin:** `v0.6.6-pre` (`8b611aa`). Re-recorded per run; a mismatch is not-executable.
- **Pre-registered:** filled in by the approving commit. This file carries no result.
- **Discipline:** `knowledge/methodology/pre-registration-discipline`. Rules 1–8 apply verbatim.
- **Template:** `../../../ballast/studies/2026-07-trace-validation/PREREGISTRATION.md`.

Committed **before any run**. Endpoints and thresholds freeze at that commit. A failed endpoint is a
publishable result.

---

## 1. The question

**Does each detector satisfy `E[e|H₀] ≤ 1` — and therefore Ville's bound at its shipped threshold —
under the nulls it will actually meet?**

`tessera/lean` proves `FDR ≤ q` under arbitrary dependence *given that the coordinates are e-values*.
Nothing checks the given. Every failure found in the 2026-07-31 review sits upstream of where the
proof begins: correct theorems, unmet hypotheses.

## 2. What this study can and cannot establish

*Stated first, because it determines every design choice below.*

**Simulation cannot establish that a detector is an e-value.** The nuisance-robust BF passed a K=600
Monte Carlo and was wrong by 15.5%, because the excess mass sat in a tail those samples never
reached (`knowledge/stats/invalid-nuisance-robust-bf-e-value`). Nine such instances are catalogued in
`knowledge/stats/simulation-validates-instances-not-statements`.

**Simulation can refute one cheaply, and that asymmetry is the whole design.** Family D's ~900×
inflation was visible in minutes.

So: **this is a refutation battery.** Its output for a detector that survives is
**"not refuted at these nulls"**, never "valid". The report must use that phrasing. A reviewer who
reads a pass as a validity claim has been misled by the report, and that is a defect in the report.

## 3. The battery

Every cell is a **null**: no change is injected, so every fire is a false alarm.

| id | Null | Why it is adversarial |
|---|---|---|
| N1 | iid Gaussian, **oracle** μ/σ | The friendliest possible input. A failure here is a construction defect, not estimation error. |
| N2 | iid Gaussian, μ̂/σ̂ from a finite calibration window, m ∈ {30, 100, 500} | The deployed regime. `validity-envelope.ts` records `E[e\|H₀] → ~1e8` and `~3e9` here for two Family A paths. |
| N3 | AR(1), φ ∈ {0.3, 0.6, 0.9}, oracle parameters | The calibrator states the betting wealth is not a martingale here. |
| N4 | AR(1) as N3, estimated φ | Compounds N2 and N3. Short baselines move φ̂ by 0.03–0.58. |
| N5 | Right-skewed (lognormal, moment-matched) | `z = r·u − ½r²` is an exact increment only for `u ~ N(0,1)`. |
| N6 | Heavy-tailed (t₃, moment-matched) | The regime the BF's MC missed. |
| N7 | Rolling vs disjoint evaluation windows | Family D's dominant failure. Applies to any detector reading a windowed statistic. |

**N1 runs on disjoint windows, deliberately, and this is not a detail.** Family D's shipped
configuration is rolling, so N1-with-rolling would confound two failures that differ by three orders
of magnitude: the wrong null family (`peak|ACF|` is right-skewed and bounded where `z = r·u − ½r²`
needs `u ~ N(0,1)`), measured at ~1.0023 per independent draw, and the broken martingale-difference
condition from ~97% window overlap. N1 isolates the first; N7 contrasts the two directly and
attributes the gap. A battery that ran only the shipped configuration would report "Family D fails"
without saying which of the two to fix.

**Per-detector additions**, registered now so they cannot be chosen after seeing results:

- **Family C MMD** — a null drawn from a *non-Gaussian* healthy law. The shipped reference pool is
  `L·w`, `w ~ N(0,I)`; a non-Gaussian healthy baseline is a null the detector should not fire on and
  its reference cannot represent.
- **Family E** — run only the `weighted_e_value` kind, forced. The default path emits `unweighted`,
  which has no wealth process and makes no anytime claim, so a sup-crossing endpoint is undefined
  for it. **Report that fact rather than scoring it.**
- **Family A mixture** — `bounded_probability` signals, which take the beta-binomial branch whose
  priors are not the ρ-indexed member of Howard's family.

## 4. Primary endpoint — P1

For each (detector × null × α):

```
fire_rate = (# trajectories where sup_t M_t ≥ threshold) / N
```

using the **shipped** threshold resolution, including any `sliding_buffer_threshold` substitution,
so the study measures what deploys rather than what the theory says.

**P1 FAILS for a cell iff the exact one-sided 95% binomial lower bound on `fire_rate` exceeds α.**

Failing only on evidence of exceedance, rather than on a point estimate, means Monte Carlo noise
cannot manufacture a failure. It also means a marginal detector passes — that is deliberate, and it
is why a pass is worded "not refuted".

**α levels: {0.05, 0.01}.** N = 2,000 trajectories per cell, 300 ticks each.

*Why not the shipped α.* At α = 1e-4, N = 2,000 yields 0.2 expected fires — the design would have no
power and every detector would pass vacuously. At α = 0.05 it yields 100, which separates a 2×
inflation comfortably. The shipped α is **reported descriptively** per cell and scored by no
endpoint. This is the study's largest compromise and §9.1 records it as such.

## 5. Co-primary endpoint — P2, the vacuous-pass guard

A detector that never fires passes every null trivially. That is the failure mode that let 17.14 — the
score for detecting nothing — be published as a transfer result.

For each detector, on the **same harness, same parameters**, inject a step of 3σ at tick 100.

```
detection_rate = (# trajectories firing within 200 ticks of onset) / N
```

**P2 FAILS for a detector iff `detection_rate < 0.50` at 3σ.**

**A detector passing P1 while failing P2 is reported as "not refuted, and not useful" — never as
passing.** The verdict line carries both.

3σ and 0.50 are chosen to be generous: this is a floor for "responds to a large change at all", not
a power measurement.

## 6. Secondary endpoints — subordinate, no verdict

- **S1** — `E[e_τ|H₀]` at the stopping time, and `E[M_T]` at T = 300. These are the quantities the
  theory bounds, and they are heavy-tailed, so they are **descriptive only**. Encoding the BF lesson:
  a small measured mean is not evidence of validity.
- **S2** — realised fire rate at the shipped α, with its exact interval.
- **S3** — for the two families whose threshold is substituted, the ratio
  `shipped_threshold ÷ (1/α)` per cell. Measured 2026-07-31 at median 2.4×10⁴ and 3.6×10⁷⁶; this
  tracks whether that conservatism persists.
- **S4** — integrated autocorrelation time τ of each detector's per-tick increment under each null.
  The mechanism behind Family D's failure; a τ far from 1 predicts trouble.

## 7. Registered expectations

*Written before the run so a confirmed prediction is informative and a surprise is visible. Being
wrong here costs nothing; not having written it down would cost the study its interpretability.*

| Detector | Predicted | Basis |
|---|---|---|
| Family D spectral e-detector | **FAILS N7 (rolling)** by orders of magnitude | Measured 3085× at α=1e-4, T=300, on shipped code |
| Family D spectral e-detector | **FAILS N1 (disjoint) narrowly, ~2×** | The skew effect alone is 1.0023/draw, compounding to `E[M_300] ≈ 1.99`. At α=0.05 that implies ~200/2000 fires; the 95% lower bound is 0.089, which clears 0.05. Registered as a *prediction with an arithmetic basis*, not a measurement — the disjoint cell has never been run. |
| Family A betting | **FAILS N3, N4** | The calibrator records 11.55% FPR under AR(1) |
| Family C safe-Hotelling | **FAILS N3, N4** | The calibrator names it the same architectural pattern |
| Family A mixture SM | FAILS N2 at m=30 | `E[e\|H₀] → ~3e9` under an estimated baseline |
| safe-t | passes N1–N3; **FAILS N4 at m<100** | Estimated φ is the recorded calibration floor |
| Family C MMD | FAILS the non-Gaussian null | Reference pool is Gaussian by construction |

**If Family D passes N7, the harness is wrong, not the detector.** That is a not-executable
condition, not a result. N1-disjoint is a genuine prediction and may go either way; the two cells are
not interchangeable, and conflating them is the error this section was corrected for on 2026-08-01,
before the freeze.

### What was already known at registration

*Disclosed here so the report cannot present it as a discovery of this battery. Same device as
`gate-value-study/studies/2026-07-gate-value-v2/PREREGISTRATION.md` §14.*

Before this file was committed, the executability probe of §8.3 was run against the shipped
`evaluateSpectralEDetector` and the engine's own `peakACF`, at oracle moments, iid Gaussian, rolling
windows, T = 300, N = 2000 — i.e. N1 **and** N7 combined:

| α | fires | rate | ratio |
|---|---|---|---|
| 0.05 | 1137/2000 | 0.5685 | 11× |
| 0.01 | 1015/2000 | 0.5075 | 51× |
| 1e-4 | 617/2000 | 0.3085 | 3085× |

This confirmed the §7 expectation rather than forming it: the expectation was written from an
independent reimplementation measured earlier the same day and already published in
`knowledge/stats/ville-guarantee-is-empirical`. It also settled the open design question in §9.1 —
at α = 0.05 the effect is large enough that the inflated levels have ample power.

**No endpoint or threshold in this file was chosen after seeing it**, and the disjoint-window N1 cell
that isolates the two mechanisms has not been run at all.

## 8. Not-executable conditions

`setup/verify_executable.mjs` prints `battery is EXECUTABLE` or the study does not run.

1. Engine version matches the §0 pin.
2. Every detector can be driven from a synthetic config without a compiled artifact, or is listed as
   out of scope with a reason.
3. **The harness can produce a known failure.** Family D under N1 must fail before any other cell is
   scored — the analogue of checking that an acceptance suite can fail.
4. A detector with no wealth process is excluded by name, not scored and quietly passed.

## 9. Judgement calls the owner should overrule if he disagrees

Frozen at the approving commit.

1. **α ∈ {0.05, 0.01} rather than the shipped 1e-4.** The compromise that buys power. Alternative:
   raise N to ~10⁶ and score at the shipped α, at roughly 500× the compute.
2. **The 95% lower bound rather than a tolerance ratio.** Fails only on evidence. A ratio test would
   fail more detectors and be easier to argue with.
3. **N = 2,000, T = 300.** Budget.
4. **P2's 3σ / 0.50 floor.** Generous by intent.
5. **Shipped thresholds rather than `1/α`.** Measures what deploys. Using `1/α` would measure the
   theory and would fail the two substituted families by construction.
6. **Family E's default kind reported rather than scored.**

## 10. One analysis path

- One script `analysis/run_endpoints.mjs`, results root a constant in the file.
- One output `results/live/run-<UTC>/endpoints.json`; one `REPORT.md` generated from it.
- One consistency test written **before** the analysis script, asserting every printed number against
  the JSON and that every registered endpoint appears in the report.
- `results/sim/` git-ignored; every record carries `mode` and the analysis refuses non-`live`.
- Append-only run directories; reruns only for a code defect, prior run preserved.

## 11. What this does not reach

- **H-EX.** That the probe scheduler delivers exchangeability is a claim about a system.
  `tessera/lean` leaves it unformalised for that reason and no battery tests it. It needs the
  scheduler contract written down, which has been owed since July.
- **Real telemetry.** Every null here is synthetic. ADR 0012 measured per-shard null means of 24/9/9
  on real GWDG data; this battery would not have found that, because it does not use real data.
- **Validity.** Restated because it is the thing most likely to be forgotten by the time anyone reads
  the report: surviving this battery is not evidence that a detector is an e-value.

## 12. Approval

- [x] Endpoints P1 and P2, and the verdict rule in §5
- [x] The battery in §3 and the α compromise in §9.1
- [x] The registered expectations in §7
- [x] **Approved by the operator 2026-08-01, pre-approved before drafting completed.** The commit
      carrying this file is the registration act; its SHA is the registration SHA. Endpoints and
      thresholds are frozen from here.

## Amendment A1 — 2026-08-08, honouring the 2026-08-01 supersession declarations, plus two undeclared defects

This study's first amendment. Registered **before** the supersession registry file it authorizes,
before the collector change that reads it, and before the certification re-score that follows.
Sections 1–12 above stay intact; nothing in them is renumbered and no endpoint, threshold, α, N, T,
registered expectation or verdict rule moves. What moves is which of this study's four live runs the
**certification** scorer is allowed to pool. Authorized by the operator 2026-08-08 (WORKLIST C44).

**Lead with the correction.** `validation/coverage/PREREGISTRATION.md` Amendment v2.C1.1 (C1.1.4)
named this as owed work: "the certification protocol had no supersession mechanism, and one existed
in its data that it ignored", and "the h0-battery amendment that honours the 2026-08-01
declarations, and the re-score that follows it, are named-not-done work." This amendment is that
authorization. It also corrects one word in v2.C1.1's own framing (A1.3) and adds two defects that
no manifest in this study ever declared (A1.2).

### A1.1 Lineage census of the four live runs

Measured this session by loading `validation/h0-battery/results/live/` through
`validation/certification/lib/collect.mjs` `loadEvidence` and by byte-comparing `endpoints.json`
cell objects keyed on `(detector, null_id, alpha)`.

The grid is **4 detectors × 12 nulls × 3 α values = 144 endpoint rows** per run. The 12 nulls are
`N1 N2-m30 N2-m100 N2-m500 N3-p03 N3-p06 N3-p09 N4-p06-m100 N4-p09-m100 N5 N6 N7`; the three α are
`{0.05, 0.01, 1e-4}`, the last being §6's descriptive S2 level. So the 48 `(detector × null)` combos
each appear three times. Where a count below is given per combo it is stated as such.

| run | `git_sha` | pooled cells | endpoint rows | `cells/` extras | state |
|---|---|---|---|---|---|
| `run-20260801T062612Z` | `17cc3f8` | 144 | 144 | 0 (144 files, every one a duplicate of an `endpoints.json` row) | **nothing declares it superseded** |
| `run-20260801T062824Z` | `17cc3f8` | 148 | 144 | 4 (`P2__<detector>.json`) | declared superseded by both later runs, legacy `{priorRun, defect}` shape |
| `run-20260801T064237Z` | `ff65feb` | 148 | 144 | 4 (`P2__<detector>.json`) | φ fixed for one detector; mixture adapter still broken |
| `run-20260801T064627Z` | `ff65feb` | 148 | 144 | 4 (`P2__<detector>.json`) | **canonical** — `validation/h0-battery/REPORT.md` names it in its header line |

The two declarations, verbatim. From
`validation/h0-battery/results/live/run-20260801T064237Z/manifest.json`:

> `"supersedes": {"priorRun": "run-20260801T062824Z", "defect": "oracle phi was never threaded into
> the detector config, so N3/N4 ran with AR(1) pre-whitening disabled; the prior run measures a
> detector unaware of phi, not the registered oracle-parameter cell"}`

From `validation/h0-battery/results/live/run-20260801T064627Z/manifest.json`:

> `"supersedes": {"priorRun": "run-20260801T062824Z", "defect": "oracle phi was never threaded into
> the detector config, so N3/N4 ran with AR(1) pre-whitening disabled; and the mixture adapter
> passed ar1_phi under params where that detector reads it off input, so it never received phi at
> all. The prior runs measure detectors unaware of phi, not the registered oracle-parameter cell"}`

**Both declarations name `run-20260801T062824Z` and only it.** Neither names
`run-20260801T062612Z`. That omission is A1.2's first finding.

### A1.2 Two defects this study never declared — registered here as this amendment's own findings

**Finding 1 — `run-20260801T062612Z` carries the same defects and no artifact says so.** It shares
`git_sha` `17cc3f8` and `seed` `20260801` with `run-20260801T062824Z`, and **all 144 of its
`endpoints.json` rows are byte-identical to that run's**, including the per-cell `git_sha` field, so
`JSON.stringify` of the two 144-row sets agrees row for row. Same code, same seed, same numbers: it
carries both defects `run-20260801T064627Z`'s manifest names, and nothing declares it superseded.
It differs from `run-20260801T062824Z` in one respect only — its `endpoints.json` has no `P2` block
and its `cells/` directory holds no `P2__<detector>.json` files, so it contributes 144 pooled cells
where the other three contribute 148.

**Finding 2 — `run-20260801T064237Z` is 24 defective rows and 124 duplicates.** Against
`run-20260801T064627Z`, byte-comparing on `(detector, null_id, alpha)`:

- **24 rows differ**, all `family_A_mixture_supermartingale`, at the 8 nulls
  `N2-m30 N2-m100 N2-m500 N3-p03 N3-p06 N3-p09 N4-p06-m100 N4-p09-m100` × 3 α. These are the rows
  the mixture-adapter defect produced — the defect `run-20260801T064627Z`'s manifest names in the
  clause quoted verbatim in A1.1: "the mixture adapter passed ar1_phi under params where that
  detector reads it off input, so it never received phi at all". Its 12 remaining mixture rows
  (`N1 N5 N6 N7` × 3 α) are byte-identical to the canonical run's, as expected for nulls that carry
  no φ.
- **120 endpoint rows are byte-identical** to `run-20260801T064627Z`'s, and so are **all 4 `P2`
  cells** (same `detection_rate`, same `verdict`, same `git_sha`). Those 124 cells are the same draw
  counted twice.

**A third measurement, recorded because it does not fit the declared defect's stated blast radius
and this amendment does not resolve it.** Between `run-20260801T062824Z` (`17cc3f8`) and
`run-20260801T064627Z` (`ff65feb`), normalising away the per-cell `git_sha`, exactly 48 rows
differ: 24 `family_A_betting_e_process` and 24 `family_A_mixture_supermartingale`. **All 36
`family_C_safe_hotelling` rows and all 36 `family_D_spectral_e_detector` rows are byte-identical
across all four runs.** The declared defect is stated as "N3/N4 ran with AR(1) pre-whitening
disabled", and §7 registers `family_C_safe_hotelling` as expected to fail N3/N4 for "the same
architectural pattern" as `family_A_betting_e_process` — yet the φ fix moved family A's numbers and
left family C's untouched. Either family C never read the threaded φ, or it does not pre-whiten at
all. Recorded with both measurements and left open: it is a question about the harness's φ
threading, not about supersession, and resolving it here would be scope creep. It does not affect
this amendment's action, because family C's rows are byte-identical in the run that survives.

### A1.3 Correction to coverage Amendment v2.C1.1 and v2.C1.2: "scored" is the wrong word for 144 of those 148 cells

**Quote, coverage `PREREGISTRATION.md` C1.1.1, as corrected by C1.2.3:**

> **148 cells scored, 37 per detector** across the four cards — of which 144 (**36 per detector**)
> come from `endpoints.json` and 4 (**one per detector**) are merged from `cells/` by
> `scanCellsDirExtras`.

**The 148 and the 37/36/1 split are correct. "Scored" is not.** 148 cells enter the evidence
**pool** (`loadEvidence`'s returned `cells`), and 4 of them reach a scoring stage. The other 144
reach none. Read off the code, not the prose: `validation/certification/lib/score.mjs:11-12` defines

```
const isValidityCell = (c) =>
  'increment_estimator' in c || 'stopped_mean' in c || 'exceedance' in c || 'crossing_rate' in c || 'mean_e' in c;
```

and line 16 defines `const isPowerCell = (c) => 'detection_rate' in c || 'rate_e_ge_20' in c;`.
`scoreS2` filters on the first (line 124), `scoreS3` on the second (line 244). An h0-battery
endpoint row carries the fields
`detector family null_id null_label alpha n ticks fires fire_rate lower_95 verdict mean_logM mode
engine_version git_sha scored` — none of the five validity instruments and no `detection_rate`. So
every endpoint row is filtered out of both stages. The four `P2__<detector>.json` cells carry
`detection_rate` and are the only cells of these runs that any stage reads.

Measured, on the real corpus, for `family_A_betting_e_process`: `scoreS2`'s `perCell` holds 11
entries and every one comes from `detector-audit-sequential/seq-20260805T025650Z`; its `excluded`
array is empty, because a filtered-out cell is never a candidate and so is never an exclusion
either. The same holds for the other three cards. **The S2 REFUTED that carries three of these four
cards' REFUSE verdicts is not h0-battery evidence at all.**

This makes the gap C1.1.1 disclosed **narrower in effect and worse in kind** than it was recorded
as: not 148 defective cells feeding four verdicts, but 4 defective power cells per run reaching a
stage while 144 measured endpoint rows per run reach none — this study's primary endpoint P1 is
carried by a field (`fire_rate`/`lower_95`) that the certification scorer's validity vocabulary does
not recognise. That is a separate gap, it is named here, and **it is out of scope for this
amendment** (A1.8).

### A1.4 Registered action: a per-study supersession registry

`validation/h0-battery/results/live/SUPERSESSIONS.json` — a **new** file beside the run
directories, not inside one, so `results/` stays append-only and no run directory is edited. Its
shape is C1.6's manifest array shape plus one field:

```
[ { "study": ..., "run": ..., "detectors": [...], "reason": ..., "declared_by": ... } ]
```

`declared_by` is `"h0-battery PREREGISTRATION.md Amendment A1"` on every entry, because no new run
declares these — the amendment does. `study` is the value the target runs' manifests carry,
`"2026-07-h0-battery"`, not the directory name `h0-battery`, because that is the locator
`supersessionIndex` builds from `manifest.study`.

**Three whole-run entries, each naming all four detectors** —
`family_A_betting_e_process`, `family_A_mixture_supermartingale`, `family_C_safe_hotelling`,
`family_D_spectral_e_detector`:

1. `run-20260801T062612Z` — reason states A1.2 Finding 1 (byte-identical to
   `run-20260801T062824Z`, same sha and seed, undeclared) and quotes
   `run-20260801T064627Z`'s defect text verbatim.
2. `run-20260801T062824Z` — reason quotes `run-20260801T064627Z`'s defect text verbatim and records
   that both later runs declared it in the legacy shape.
3. `run-20260801T064237Z` — reason quotes the mixture-adapter clause verbatim and states A1.2
   Finding 2's counts (24 defective mixture rows, 124 duplicate cells).

**`run-20260801T064627Z` becomes the sole scored h0-battery run.** No entry names it.

### A1.5 Why whole-run, and why that removes no evidence

Per-detector granularity exists (C1.1.3) because a coverage run mixed defective and sound rows.
This study's four runs do not have that property, for two reasons measured in A1.1 and A1.2:

- **The grids are identical.** Every one of the 144 endpoint rows dropped from each run has a
  replacement at the same `(detector, null_id, alpha)` key in `run-20260801T064627Z`, and each of
  the 4 dropped `P2` cells has a replacement at the same `(detector, shift_sigma)` key. Nothing is
  dropped without a canonical counterpart.
- **For `run-20260801T064237Z`, 124 of its 148 cells are byte-identical duplicates** of the
  canonical run's. Dropping them removes double-counting of one draw, not a second draw. Its other
  24 cells are the defect.

So the choice is between per-detector entries that would preserve rows byte-identical to the ones
that replace them, and whole-run entries that state the lineage plainly. Whole-run, registered as
the simpler artifact that a reader can check against a single `diff`.

### A1.6 Disclosed derivation probe, run before this amendment's expectations were written

**House disclosed-probe rule, as applied in §7's "What was already known at registration" and in
`gate-value-study/studies/2026-07-gate-value-v2/PREREGISTRATION.md` §14.** Computed by the
implementer of C44 **before** this amendment was written, so the expectation below is a derivation
and not a prediction, and saying otherwise would be the failure §7's disclosure exists to prevent.

**Correction to the C44 brief's stated method.** The brief said to drive
`validation/certification/verdict.mjs` "with its root override". `verdict.mjs` has **no validation
root override**: line 31 reads `loadEvidence(join(repoRoot, 'validation'))` with `repoRoot` derived
from `import.meta.url` (lines 24–25). Its only override, `CERT_RESULTS_DIR` (line 27, documented
lines 9–12), redirects **where the run directory is written**, not what evidence is read.

**Method actually used.** A script imported `loadEvidence` and `cellsFor` from
`validation/certification/lib/collect.mjs`, `scoreS1`/`scoreS2`/`scoreS3`/`scoreS4`/`overallVerdict`
from `lib/score.mjs`, and `envelopeKeys` from `lib/envelope.mjs`, then reproduced `verdict.mjs`'s
per-card call sequence (lines 46–51) over the same `cards/` directory, with `loadEvidence` pointed
at a validation root copied into a scratch directory with run directories deleted. **The real tree
was not modified.** Four variants: drop `062612Z`; drop `062824Z`; drop `064237Z`; drop all three.

**The probe validated itself against a committed artifact before any variant was read.** Pointed at
the real tree it reproduces all fourteen rows of
`validation/certification/results/run-20260808T133943Z/REPORT.md` — `detector_id`, S1, S2, S3, S4,
verdict and tier — column for column. A probe that could not reproduce the current run is not
evidence about a hypothetical one.

**Result: no verdict, tier, or stage status moves, in any of the four variants.** The four cards'
tuples are identical before and after, and so are the other ten cards'.

**Registered expectation, which the C44 re-score must match.** `(S1, S2, S3, S4) → verdict / tier`:

| card | S1 | S2 | S3 | S4 | verdict | tier | matched cells | S3 `perCell` |
|---|---|---|---|---|---|---|---|---|
| `family_A_betting_e_process` | MISSING | REFUTED | INERT | UNPRICED | **REFUSE** | — | 255 → 145 | 51 → 49 |
| `family_A_mixture_supermartingale` | MISSING | REFUTED | PASS | PASS | **REFUSE** | — | 255 → 145 | 47 → 45 |
| `family_C_safe_hotelling` | MISSING | MISSING | PASS | UNPRICED | **NOT_EXECUTABLE** | — | 147 → 37 | 3 → 1 |
| `family_D_spectral_e_detector` | MISSING | REFUTED | INERT | PASS | **REFUSE** | — | 259 → 149 | 51 → 49 |

And these, also registered as predictions:

- **Corpus total 2108 → 1668 pooled cells.** 440 dropped = 144 + 148 + 148.
- **Every S3 `perCell` count falls by exactly 2 per card, except `family_C_safe_hotelling`'s
  3 → 1.** The dropped S3 cells are the `P2` duplicates from `062824Z` and `064237Z`;
  `062612Z` has none. Every one is byte-identical in value to the surviving canonical `P2` cell,
  which is why the statuses hold.
- **Suppressed-verdict tallies unchanged**: `family_A_betting_e_process` `CLEARED x1`,
  `family_A_mixture_supermartingale` `NOT-EXECUTABLE x4, inconclusive x3`, the other two `—`.
- **The other ten cards' rows are unchanged**, verdict, tier and all four stage statuses.

**One registered deviation between the probe and the implementation, stated so the re-score is not
misread.** The probe deleted run **directories**, so it could not read the deleted runs' manifests
and reported one legacy declaration instead of two. The registry drops **cells**, and pass 1 still
reads every manifest, so the re-score will report **both** 2026-08-01 legacy declarations, each
annotated `covered_by_registry: true`. Cells are what score, so no verdict differs; the report's
disclosure section differs, by design (A1.7).

### A1.7 Scope of the collector change

- `loadEvidence` reads `SUPERSESSIONS.json` from each study's `results/live/` directory during pass
  1, alongside the manifests, so a registry applies regardless of directory order.
- Registry entries are validated by the **same** `supersessionIndex`, extended rather than
  duplicated: array shape, `{study, run, detectors, reason}` completeness, target present in the
  evidence corpus. Malformed or unresolvable is a **crash**, never a silently ignored file.
- Two rules the registry adds, because a registry has no declaring run to be checked against.
  `supersessionIndex`'s self-supersession check compares a declaration's target against the
  declaring run's own locator, which is vacuous for a file that is not a run; these two are what is
  registered in its place, each fail-closed:
  1. **Own-study only.** An entry's `study` must be one that a run under this registry's own
     `results/live/` declares. A registry cannot reach into another study — its authority is this
     pre-registration, and this pre-registration governs this study.
  2. **No self-erasure.** For every `(study, detector)` a registry names, at least one run of that
     study must survive un-superseded for that detector. A registry that drops the replacement
     along with the defect is the failure the field exists to prevent, and it fails closed. This is
     the mechanical form of A1.5.
- Drops carry their provenance (`source: registry` vs `source: manifest`) onto the run entry, and
  `REPORT.md` reports registry-driven drops in their own section, so no reader can mistake an
  amendment-authorized drop for one a later run declared.
- A legacy `{priorRun, defect}` declaration whose target a registry covers **keeps its report
  line** and gains `covered_by_registry: true`. It does not disappear. `REPORT.md`'s existing
  section heading "Declared superseded but STILL SCORED" stays, verbatim, for any legacy
  declaration a registry does **not** cover — it is still true of those — and covered ones move to
  a new section that says so. `report_format` goes `4 → 5`.
- `collect.mjs`'s supersession comment block is corrected in place, quote-and-correct: the
  paragraph that reads "REPORTED here rather than closed" names this amendment as what closed it,
  and keeps the history of why it was open.

### A1.8 Explicitly out of scope

- **Any re-run of this battery.** No harness code, no null, no seed, no α, no N, no T is touched. No
  new h0-battery run directory is created.
- **Any card content change.** No `validation/certification/cards/*.json` file is edited or
  re-frozen.
- **`validation/h0-battery/REPORT.md`.** Append-only and already written from the canonical run;
  this amendment changes nothing it reports.
- **The coverage study.** Its runs, its registry-free manifest declarations, and Amendment v2.C1's
  reruns are untouched.
- **A1.3's second gap** — that P1's `fire_rate`/`lower_95` rows are invisible to the certification
  scorer's S2 vocabulary. Named, measured, and left open. Closing it would change what evidence
  four cards are scored on, which is a bigger act than withdrawing duplicate rows and needs its own
  registration.
- **A1.2's third measurement** — family C's rows not moving under the φ fix. Recorded, not resolved.

### Amendment summary

Honours the two 2026-08-01 legacy `supersedes` declarations that
`validation/coverage/PREREGISTRATION.md` Amendment v2.C1.1 disclosed and deliberately did not act
on, and adds two defects no manifest in this study declared. `run-20260801T062612Z` shares
`git_sha 17cc3f8` and `seed 20260801` with `run-20260801T062824Z` and all 144 of its endpoint rows
are byte-identical to it, so it carries the same two defects and nothing ever said so;
`run-20260801T064237Z` holds 24 defective `family_A_mixture_supermartingale` rows (8 nulls × 3 α)
and 124 cells byte-identical to `run-20260801T064627Z`, so scoring it double-counts one draw.
Registers `validation/h0-battery/results/live/SUPERSESSIONS.json`, a new file beside the run
directories in C1.6's array shape plus `declared_by`, with three whole-run entries — `062612Z`,
`062824Z`, `064237Z`, all four detectors each — leaving `run-20260801T064627Z` the sole scored
h0-battery run. Whole-run is safe because the four grids are identical (4 detectors × 12 nulls × 3 α
= 144 rows, plus 4 `P2` cells in three of the four runs), so every dropped cell has a canonical
replacement at the same key. Corrects C1.1.1/C1.2.3's word "scored": 148 cells were **pooled** and
4 reached a stage, because `score.mjs:11-16`'s `isValidityCell`/`isPowerCell` recognise none of the
fields an h0-battery endpoint row carries — so the S2 REFUTED behind three of these four cards'
REFUSE verdicts comes from `detector-audit-sequential/seq-20260805T025650Z`, not from this study.
Records without resolving that all 36 `family_C_safe_hotelling` and all 36
`family_D_spectral_e_detector` rows are byte-identical across all four runs, so the φ fix moved only
family A's numbers. **Registers, from a probe disclosed with its method and validated by
reproducing all fourteen rows of committed `run-20260808T133943Z` before any variant was read, that
no verdict, tier or stage status moves**: the four cards stay REFUSE / REFUSE / NOT_EXECUTABLE /
REFUSE with unchanged stage tuples, the corpus falls 2108 → 1668 pooled cells, each card's S3
`perCell` falls by exactly 2 (`family_C_safe_hotelling` 3 → 1), suppressed tallies are unchanged,
and the other ten cards are untouched. The collector learns to read per-study registries under the
same fail-closed validation as manifest arrays, plus two rules a registry needs because it has no
declaring run — own-study-only reach, and no self-erasure — reports registry drops with their
provenance, and keeps every legacy declaration's report line, annotated `covered_by_registry: true`
rather than removed; `report_format` `4 → 5`. **No endpoint, threshold, α, N, T, null, seed,
registered expectation or verdict rule in §1–12 moves, and no h0-battery run is re-run.**

## Erratum A1.1 — 2026-08-08, A1.8's "no card is re-frozen" is wrong, and the reason is a gap in the expiry mechanism

Registered before the card re-freeze it authorizes and before the C44 re-score. Corrects one line
of A1.8 by quote-and-correct; A1.1–A1.7 and the registered expectation in A1.6 stand exactly as
written, and no verdict, endpoint, threshold, α, N, T, null, seed or registered expectation moves.

**Quote, A1.8:**

> - **Any card content change.** No `validation/certification/cards/*.json` file is edited or
>   re-frozen.

**The first sentence stands; the second is wrong.** No card's *content* changes — no claim, regime,
guarantee, alias, prior_evidence or endpoint is touched. But nine of the fourteen cards pin
`validation/certification/verdict.mjs` by sha256 in their `source_files`, and A1.7's report-provenance
change edits that file, so `npm run cert:expiry` reports those nine `EXPIRED ... (changed)` and exits
1 until they are re-stamped. Measured: `validation/certification/expiry-check.mjs:19,35`. The nine are
`family_A_betting_e_process`, `family_A_mixture_supermartingale`, `family_C_safe_hotelling`,
`family_D_spectral_e_detector`, `family_E_conformal`, `safe_t_e_value`,
`sequential_mmd_betting_e_process`, `sequential_ui_e_process`, `universal_inference_e_value`.

**Registered action: run `validation/certification/tools/freeze-cards.mjs` in its own commit after
the code commit.** `lib/freeze.mjs`'s `stampPins` rewrites exactly two fields — `engine_pin`
(`{version, sha}`) and each `source_files[].sha256` — and nothing else; verified by stamping all
fourteen cards in memory against a dummy sha and diffing every top-level key, which reports
`engine_pin, source_files` and no other field, with `validation/certification/verdict.mjs` the only
`source_files` entry whose hash moves. This is the same two-step the repo already uses: `7ab3b4d`
changed the scorer and `77deeb1` re-froze afterwards.

**And the finding that makes this erratum worth more than a bookkeeping note.**
`validation/certification/lib/collect.mjs` is pinned by **no card**. Tallied across all fourteen
`source_files` lists: `verdict.mjs` 9, `lib/score.mjs` 9, `detectors/validity-envelope.ts` 9, and
`lib/collect.mjs` **0**. The collector is what decides which evidence a card is scored on — it is
the file this whole amendment changes — so **A1.7's substantive change would have expired nothing**.
Had A1.7 not also touched the report writer, every card would have read "current" while the evidence
under it changed by 440 cells. Five cards
(`family_E_conformal_heldout`, `group_average_e_value`, `point_tail_bet_e_value`,
`shape_block_conformal_bet`, `spectral_bet_e_process`) pin neither `verdict.mjs` nor `score.mjs` and
so are outside the scorer's expiry set entirely.

**Named, not fixed.** Adding `lib/collect.mjs` to fourteen cards' `source_files` *is* a card content
change, it would expire every card on every collector edit, and it is a decision about the expiry
protocol rather than about this study's evidence. It needs the certification protocol's own
registration, not h0-battery's. Recorded here and owed.

### Erratum summary

A1.8's claim that no card is re-frozen is wrong: nine of fourteen cards pin
`validation/certification/verdict.mjs` by sha256, A1.7 edits that file, so `cert:expiry` exits 1
until the cards are re-stamped. Authorizes one `freeze-cards.mjs` commit after the code commit,
which `stampPins` confines to `engine_pin` and `source_files[].sha256` — verified by stamping all
fourteen cards against a dummy sha and diffing every key — the same two-step as `7ab3b4d` then
`77deeb1`. **No card content, claim, regime or endpoint changes and no verdict moves.** Records the
finding behind it: `lib/collect.mjs` is pinned by **no card**, so the change that actually alters
which evidence is scored would have expired nothing, and five cards pin neither the scorer nor the
report writer. Naming that gap, not closing it — it belongs to the certification protocol's own
pre-registration.

## Amendment A2 — 2026-08-08, two of A1's supersession rules could be satisfied by evidence that does not exist, and the collector is still pinned by no card

Registered **before** the collector change it authorizes and before the card re-freeze it
authorizes. Sections 1–12 stay intact; A1.1–A1.8 and Erratum A1.1 stand as written except for the
three clauses corrected below by quote-and-correct. No endpoint, threshold, α, N, T, null, seed,
registered expectation or verdict rule moves, and no run of this battery is re-run. Authorized by
the operator 2026-08-08 (WORKLIST C48, the follow-on validation gaps C44's review named).

**Lead with the correction, and it is a correction to this amendment's own authority.** Erratum A1.1
closed with: "Naming that gap, not closing it — it belongs to the certification protocol's own
pre-registration." A2 closes it here instead. The reason is not that A1.1 was wrong about where the
rule belongs; it is that there is no separate certification pre-registration document to put it in.
The certification protocol's registered rules live in the study pre-registrations that change it —
A1.7 registered the collector's supersession contract, Erratum A1.1 authorized the re-freeze route —
and the operator assigned C48 to this study. Recorded as a deviation from A1.1's stated preference,
not as agreement with it: if a certification-protocol pre-registration is ever written, A2.5 is one
of the sections it should absorb.

**One count in Erratum A1.1 is stale, and its finding is not.** A1.1 tallied "all fourteen
`source_files` lists". There are now **fifteen** cards: `shape_ecdf_accumulator` was frozen
afterwards (C49 task 5). The tally A1.1 reports — `verdict.mjs` 9, `lib/score.mjs` 9,
`detectors/validity-envelope.ts` 9, `lib/collect.mjs` **0** — is unchanged by the fifteenth card,
which pins `detectors/shape-ecdf-accumulator.ts` and `validation/coverage/harness/run-battery.mjs`
and neither the scorer nor the collector. Measured 2026-08-08 across
`validation/certification/cards/*.json`.

### A2.1 What C44's review found — three gaps, each measured

Measured this session by reading `validation/certification/lib/collect.mjs`
`supersessionIndex`/`assertEntryShape` at `main` `b852059` and by exercising each path against
temporary-directory fixtures.

1. **An unknown detector name in a supersedes entry validates silently, on BOTH paths.**
   `assertEntryShape` checks that an entry carries `study`, `run`, a non-empty `detectors` array and
   a `reason`; each path then checks self-supersession (manifest), own-study reach (registry) and
   target-in-corpus (both). Nothing checks that a **named detector exists in the target run**. Pass
   2 resolves a drop by exact string match on `cell.detector`, so a typo, a rename, or an alias the
   cells do not carry drops nothing, reports nothing, and reads as an honoured declaration. Today's
   only mitigation is arithmetic: `collect.test.mjs`'s exact-count censuses would move if a real
   entry stopped matching. That catches a regression in the corpus; it does not catch a
   never-correct entry.
2. **The no-self-erasure rule can be satisfied by a run that never measured the detector.** A1.7
   registered the clause as quoted in A2.3, and the implementation is faithful to it:
   `runsOfStudy.some((m) => !dropped.get(key)?.has(det))`. A run that carries no cell of `det` is
   not in `dropped` for `det`, so the predicate is trivially true of it and it counts as the
   surviving run. A study whose only measurement of `det` is in the superseded run therefore passes
   the rule while leaving `det` with no evidence — the outcome the rule exists to forbid. Safe on
   the current corpus (A2.4), vacuous as a guarantee.
3. **`lib/collect.mjs` is pinned by no card**, restated from Erratum A1.1 and quoted in A2.5.

### A2.2 Registered rule change 1 — a named detector must be one the target run carries

**Both paths, one shared check, fail-closed.** For every supersedes entry, manifest array or
registry alike, every name in `detectors` must appear in at least one cell of the target run. An
unmatched name throws, and the error names three things: the entry's source (the declaring run's
locator, or the registry's path), the target locator, and the unmatched detector, together with the
detector names the target does carry.

- **The target run, not the corpus.** A drop resolves per `(run, detector)`, so a name carried by
  some other run of the same study is not a match.
- **Detector names come from the wide-format adapter's output**, not from the raw `detector` field.
  `clustersynth-ui`'s cells fold two detectors into one row with no top-level `detector`, so reading
  the raw field would refuse an entry naming a detector the run genuinely measures. Registered as
  the direction this rule must not fail in.
- **Checked after each path's own target checks**, so an entry naming a run outside the corpus, or
  itself, or another study, keeps the error that names that fault instead of being reported as an
  unknown detector.
- **A run whose layout `loadRunCells` cannot read carries no detector names**, so a supersedes entry
  naming it now throws where it previously passed. Fail-closed and intended: a declaration against
  an unreadable run supersedes nothing. No such entry exists in the corpus.

### A2.3 Registered rule change 2 — surviving means carrying cells for the detector

**Quote, A1.7 rule 2** (and its restatement in the Amendment summary):

> 2. **No self-erasure.** For every `(study, detector)` a registry names, at least one run of that
>    study must survive un-superseded for that detector.

**Corrected clause**: at least one run of that study must survive un-superseded for that detector
**and carry at least one cell for it**. Everything else about the rule — registry-only scope, the
check running after every drop is in, the failure being a crash — stands.

The reviewer's fixture, registered as the positive control the change must fail without: a study
with `run-old` carrying detector `d` and `run-empty` carrying only some other detector, and a
registry dropping `run-old` for `d`. Under A1.7's clause this passed. It now throws.

### A2.4 Registered expectation: nothing moves on the current corpus

A2.2 and A2.3 are strengthenings, so the committed
`validation/h0-battery/results/live/SUPERSESSIONS.json` and every committed manifest must still
validate. Measured by `loadEvidence('validation')` before and after the change, disclosed as a
probe run before this amendment was written:

- **Pooled corpus 2266 cells, 46 runs, both before and after**, with the same per-study
  breakdown, including `2026-07-h0-battery` 148 — `run-20260801T064627Z` alone, at its full 148
  cells, exactly as A1.6 registered.
- **The same six runs carry drops, at the same counts**: `coverage/run-20260808T010208Z` 64,
  `coverage/run-20260808T064039Z` 12, `coverage/run-20260808T121548Z` 6 (manifest-declared), and
  `2026-07-h0-battery` `run-20260801T062612Z` 144, `run-20260801T062824Z` 148,
  `run-20260801T064237Z` 148 (registry).
- **Both 2026-08-01 legacy declarations are still reported**, still annotated
  `covered_by_registry: true`.
- **Every named detector resolves.** The three registry entries each name all four h0-battery
  detectors and each target run carries all four. The coverage manifests name
  `shape_block_conformal_bet` on `run-20260808T121548Z`; `family_E_conformal_heldout` and
  `point_tail_bet_e_value` on `run-20260808T064039Z`; and `family_E_conformal_heldout`, `safe_t`,
  `universal_inference` and `group_average_e_value` on `run-20260808T010208Z` — every one present in
  that run's own cells. Note that `safe_t` and `universal_inference` are the strings the **cells**
  carry, not the card `detector_id`s `safe_t_e_value` and `universal_inference_e_value`; the rule
  matches cell strings, and an entry written in card-id spelling would now throw.
- **No card verdict, tier or stage status moves**, because no cell is added to or removed from the
  pool. This is the registered expectation, and a moved verdict falsifies it.

### A2.5 Registered action: `lib/collect.mjs` joins all fifteen cards' `source_files`

**Quote, Erratum A1.1, the finding this closes:**

> **And the finding that makes this erratum worth more than a bookkeeping note.**
> `validation/certification/lib/collect.mjs` is pinned by **no card**. Tallied across all fourteen
> `source_files` lists: `verdict.mjs` 9, `lib/score.mjs` 9, `detectors/validity-envelope.ts` 9, and
> `lib/collect.mjs` **0**. The collector is what decides which evidence a card is scored on — it is
> the file this whole amendment changes — so **A1.7's substantive change would have expired
> nothing**.

**Registered action.** `{"path": "validation/certification/lib/collect.mjs"}` is appended to the
`source_files` list of **all fifteen** cards, and every card is re-stamped by
`validation/certification/tools/freeze-cards.mjs` in its own commit after the code commit. The list
entry and the two pin fields are the only changes: no claim, regime, guarantee, alias,
`prior_evidence`, endpoint, notes or errata text is touched.

**Why all fifteen and not the nine already inside the scorer's expiry set.** The collector decides
which evidence every card is scored on, including the five cards A1.1 measured as outside the
scorer's expiry set entirely and the fifteenth card frozen since. A card whose evidence selection
can change without its expiry firing is the gap, and it is the same gap on all fifteen.

**The route, and its verification.** `lib/freeze.mjs` `stampPins` rewrites exactly two fields,
`engine_pin` and each `source_files[].sha256`. Re-verified this session at fifteen cards: stamping
every card in memory against a dummy sha and diffing every top-level key reports `engine_pin` on all
fifteen and **no other key**, and no `source_files[].sha256` moves, which also confirms every
currently pinned file is at its recorded hash. Same two-step as `7ab3b4d` then `77deeb1`, and as
Erratum A1.1's own authorization.

**The cost, accepted and registered.** After this, **any** edit to `lib/collect.mjs` expires **all
fifteen** cards — including an edit to a comment. That is the intended behaviour: the alternative is
the state A1.1 measured, in which a 440-cell change to what the cards are scored on left every card
reading "current". Registered as the verification of the action itself: mutating
`lib/collect.mjs` must make `npm run cert:expiry` exit 1 and report **fifteen** `EXPIRED` lines, one
per card.

### A2.6 Explicitly out of scope

- **Any re-run of this battery**, any harness, null, seed, α, N or T. No new run directory.
- **Any card content beyond the one `source_files` list entry and the two pin fields.**
- **`shape_ecdf_accumulator`'s notes sentence, which this amendment makes stale.** It reads:
  "`lib/collect.mjs` — how evidence is COLLECTED — is still pinned by no card, and that remains open
  as a protocol amendment rather than something this card can close." A2.5 is that protocol
  amendment, so from this commit the sentence is false about the very card it sits on. Corrected
  **here** and deliberately not on the card: editing that prose is a card content change, and the
  re-freeze A2.5 authorizes is confined to pins and the list entry. A later card-content commit
  should correct the sentence; until then this paragraph is the correction of record.
- **`validation/certification/README.md`'s freeze table.** Its heading still reads "why the sha
  moved six times" and it has not recorded a freeze since `597a97c`, four freezes ago. A2 does not
  extend a table that is already behind; catching it up is its own commit.
- **Widening the no-self-erasure rule to manifest declarations.** A1.7 registered it as a
  registry-only rule because a manifest declaration is checked against its declaring run, and A2
  changes the rule's content, not its scope.
- **A1.3's second gap and A1.2's third measurement.** Both still named-not-done, unchanged.

### Amendment summary

Closes the three gaps C44's review found in what A1 registered. **(1)** Every detector a supersedes
entry names — manifest array or registry — must appear in at least one cell of the **target run**,
resolved through the wide-format adapter so a genuinely-measured detector is never refused, checked
after each path's own target checks, and throwing an error that names the entry, the target and the
unmatched detector. Until now an unknown name dropped nothing and reported nothing, and read as
honoured. **(2)** A1.7's no-self-erasure clause is corrected by quote-and-correct: a surviving run
must carry **at least one cell** for the detector, not merely escape being dropped for it, because a
run that never measured the detector satisfied the old predicate trivially and left the detector with
no evidence. **(3)** Erratum A1.1's `lib/collect.mjs` **0** finding is closed rather than restated:
the collector is appended to all **fifteen** cards' `source_files` and every card is re-stamped by
`freeze-cards.mjs` in its own commit, `stampPins`-confined to `engine_pin` and
`source_files[].sha256` — re-verified at fifteen cards by dummy-sha diff of every top-level key — so
any collector edit now expires every card, and a mutation to `lib/collect.mjs` must make
`cert:expiry` exit 1 with fifteen `EXPIRED` lines. Both rule changes are **strengthenings**: measured
before and after, the pooled corpus is **2266 cells across 46 runs** either way, the same six runs
carry drops at the same counts (64/12/6 manifest, 144/148/148 registry), both legacy declarations
stay reported and `covered_by_registry`, and **no card verdict, tier or stage status moves** — a
moved verdict falsifies this amendment. Also records that Erratum A1.1's card count is stale at
fourteen (fifteen since C49 task 5) while its tally stands, that closing the collector-pin gap here
deviates from A1.1's own view that it belongs to a certification-protocol pre-registration that does
not exist, and that `shape_ecdf_accumulator`'s notes sentence calling the gap open becomes false at
this commit and is corrected in A2.6 rather than on the card.

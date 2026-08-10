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

## Amendment A3 — 2026-08-09, the class-instrument arm for `family_C_safe_hotelling`: closing A1.3's second gap for the one card it leaves with no scoreable validity evidence anywhere

Registered **before** the harness file it authorizes, before the run, and before the certification
re-score that follows. Sections 1–12 stay intact; A1.1–A1.8, Erratum A1.1 and A2.1–A2.6 stand as
written. **No endpoint, threshold, α, N, T, null, seed, registered expectation or verdict rule of
§1–12 moves, no existing run of this battery is re-run, and no run directory already under
`results/live/` is edited.** Authorized by the operator 2026-08-09 (WORKLIST `C38`, item 5).

**Lead with the correction, and it is a correction to the WORKLIST row that commissioned this work.**
`C38` item 5 reads, verbatim: "`family_C_safe_hotelling` has zero S2 audit cells: no scoreable
in-regime validity evidence exists for that card at all." **The verdict consequence is true and the
stated reason is incomplete in a way that changes what closing it requires.** Measured this session
by running the real scorer (`node validation/certification/verdict.mjs` with `CERT_RESULTS_DIR`
pointed at a scratch root, engine `3f556c1`):

- `family_C_safe_hotelling.card.json`'s `s2` reads `status: MISSING` with `perCell: []`,
  `excluded: []`, `missing: []` — **all three arrays empty**, and overall
  `NOT_EXECUTABLE` on reasons `["S1 reachability not run-backed (v1 floor)", "S2 or S3 has no
  scoreable evidence"]`. So the card really has no scoreable validity evidence.
- But **36 h0-battery validity cells for this detector do exist and are pooled**, in the canonical
  `run-20260801T064627Z` (12 nulls × 3 α). They are not *excluded* — they are never *candidates*.
  `lib/score.mjs:11-12`'s `isValidityCell` tests for `increment_estimator`, `stopped_mean`,
  `exceedance`, `crossing_rate` or `mean_e`, and a P1 endpoint row carries
  `fires fire_rate lower_95 verdict mean_logM` and none of those five. This is exactly the gap
  **A1.3** measured and **A1.8** left open by name.
- The reason it bites **this card and no other of the four**: the three other h0-battery detectors
  get their `increment_estimator` cells from `detector-audit-sequential`
  (`seq-20260805T025650Z` — 11, 9 and 12 `s2.perCell` entries respectively, verified per card in
  the same scorer run). `family_C_safe_hotelling` is absent from that study, because
  `validation/detector-audit/harness/run-sequential.mjs:31-35` defines
  `SEQUENTIAL = {family_A_betting_e_process, family_A_mixture_supermartingale,
  family_D_spectral_e_detector}` and no more; that set follows detector-audit §2, whose scope table
  is derived from `fleet/e-bh-guarded.ts`'s `DETECTOR_ENVELOPES`, and safe-Hotelling is **absent
  from that map** (`fleet/e-bh-guarded.ts:35-49` — six keys, none of them a Hotelling variant),
  which is the same fact the card's S4 reports as "no envelope wiring".

So the gap is not missing measurement opportunity — the adapter has existed and run since
2026-08-01 — it is a **missing instrument**: nothing has ever measured this detector on the
instrument its own class carries. That is what this arm registers.

### A3.1 Premises verified at HEAD, before anything was registered

Each of these was read off code or off a committed artifact, not off prose, at `3f556c1`.

1. **The card's class is `test_martingale` and that class's instrument is `increment_estimator`**
   (`cards/family_C_safe_hotelling.json:9`; `lib/constants.mjs:9-13` `CLASS_INSTRUMENTS`). The
   card's own frozen falsifier is written in that instrument's vocabulary: "increment lower95 >
   1.0005 on the compiled-oracle null".
2. **Every registered null is IN REGIME for this card, mechanically.** The card's
   `guarantee.regime` is `{phi_max: null, m_min: null, baseline: "oracle-compiled", nulls:
   "multivariate gaussian"}`. `lib/score.mjs:61-76` `regimeCheck` tests `regime.phi_max`,
   `regime.phi_known` and `regime.m_min`; the first and third are `null` and the second is absent,
   so no branch can fire and every cell returns `{in: true, refused: false}`. `baseline` and
   `nulls` are free text the scorer never reads. **This arm therefore registers all 12 nulls as
   in-regime validity cells, and that is a decision with precedent rather than a convenience**:
   `safe_t_e_value` carries `regime.phi_known: true` precisely so its claim narrows mechanically
   (README freeze row `45ce230`), and `universal_inference_e_value`'s N4 cells are asserted
   **in regime** by a standing test on the ground that "its claim quantifies over any phi"
   (`test/golden-verdicts.test.mjs:383-390`). A card that wants a narrower regime carries the
   field. This one does not, so its AR(1) and estimated-baseline cells score.
3. **The detector has no φ input at all**, which resolves A1.2's third measurement.
   A1.2 recorded that all 36 `family_C_safe_hotelling` rows are byte-identical across all four
   2026-08-01 runs while the φ fix moved family A's, and left open: "Either family C never read the
   threaded φ, or it does not pre-whiten at all." **It is the second, and it is structural:**
   `detectors/_hotelling-safe.ts` contains no identifier matching `phi`, `ar1`, `prewhiten` or
   `pre-whiten` anywhere in its 143 lines, and `evaluateSafeHotelling` (`:54-143`) reads only
   `cell.covariance`, `cell.safe_hotelling_params.{tau_squared, precompiled_log_det_shrink,
   sliding_buffer_threshold}`, `alpha` and `x`. The harness adapter cannot thread what the function
   does not accept (`validation/h0-battery/harness/detectors.mjs:113-140` builds `cell` from
   `cfg.mu`/`cfg.sigma` only; `cfg.phi` is never read on this branch). Recorded as A1.2's third
   measurement now RESOLVED, at the file and line, and it is not a defect in the 2026-08-01 runs.
4. **`evaluateSafeHotelling` never reads `cell.mean` either.** The quadratic forms at `:104-109`
   are taken on the raw `x`, not on `x − mean`. Harmless in this battery, whose nulls are all
   mean-zero, and recorded because it means the N2/N4 `μ̂` estimate reaches the detector through
   nothing: **only `σ̂` matters at those nulls**, which A3.4's derivation depends on.
5. **The pairing state the WORKLIST also commissioned is stale, and its stale figure is not this
   card's.** `C38` item 4 says "29 in-regime validity cells have no paired per-null power arm".
   The real scorer at `3f556c1` reports **11**, every one `sequential_ui_e_process`
   (`pairingGaps`, `lib/score.mjs:475-489`; `MISSING-CELLS.md` of the scratch run). The 29 → 11
   movement is already recorded in `validation/certification/README.md`, at the
   `run-20260807T202419Z` paragraph, and predates this batch. What this amendment owes item 4 is
   therefore **not** those 11 (A3.7) but the 12 gaps item 5's own fix would otherwise **open**:
   this card's only power cell is the P2 record, which carries `detection_rate` and **no
   `null_id`** (`harness/run.mjs:118-133`), so `pairingGaps` keys it `family_C_safe_hotelling::`
   and it pairs no null at all. Registering validity cells without power arms at the same nulls
   would trade one named gap for twelve. **Both arms are registered here, together, for that
   reason.**

### A3.2 Registered scope: one detector, two arms, 24 cells, one run directory

- **Detector set: `family_C_safe_hotelling` alone.** The other three h0-battery detectors already
  carry `increment_estimator` evidence from `detector-audit-sequential` (A3.1 and the census in
  A1.3); measuring them again here would double-count one draw across two studies for no gap.
- **Nulls: all 12 of §3, unchanged and un-reordered** — `N1 N2-m30 N2-m100 N2-m500 N3-p03 N3-p06
  N3-p09 N4-p06-m100 N4-p09-m100 N5 N6 N7` — imported from `harness/nulls.mjs`, which
  `lib/nulls.mjs` already names as the grammar's source of truth, so the ids the certification
  scorer derives φ from are the same objects that generated the data.
- **Arm A3-V, validity.** One cell per null: the increment estimator `E[exp(Δ log M_t)]` over
  `T = 300` ticks × `N = 2000` trajectories, summarised as
  `{n, mean, sd, se, lower95_one_sided, upper95_one_sided}` — the `summarise` definition of
  `validation/detector-audit/harness/run-sequential.mjs:37-44`, reproduced with that citation
  rather than imported, because a cross-study import would make this arm's numbers move if that
  file were ever amended.
- **Arm A3-W, power and pairing.** One cell per null: §5's registered P2 construction — a 3σ step
  at tick 100, detection counted iff the detector fires in ticks 100–300 — applied **at each of
  the 12 nulls** rather than at N1 only, and emitted with `null_id` and `shift_sigma: 3` so
  `pairingGaps` can pair it. This is §5's construction at §3's nulls; **no new fault construction
  is invented**, and 3σ is `INERTNESS_SHIFT_SIGMA` (`lib/constants.mjs:21`), the shift the
  certification protocol's inertness floor is defined at.
- **α = 0.05 on both arms**, one level, not §4's three. The increment estimator is
  α-independent by construction (`z_t` in `_hotelling-safe.ts:110-112` contains no α; the harness
  steps all `T` ticks regardless of firing), so replicating it across α would emit three copies of
  one measurement. α enters only the companion crossing rate and the P2 detection rate, and 0.05
  is the level detector-audit's sequential arm used and the level §5's P2 already uses.
- **Total: 24 cells** — 12 + 12 — in **one** new run directory.
- **Directory name `inc-<UTC basic>Z`, not `run-<UTC>Z`, and the reason is a trap this amendment
  refuses to lay.** `analysis/run_endpoints.mjs:6` selects the lexicographically greatest
  directory matching `startsWith('run-')` and **rewrites that directory's `endpoints.json` and the
  study's `REPORT.md`**. A `run-`-prefixed arm directory would become §10's analysis target and
  crash on a missing `cells/`. `inc-` is invisible to that filter and fully visible to the
  certification collector, which reads every directory under `results/live/`
  (`lib/collect.mjs:377-398`). Same convention as `seq-`/`sui-`/`power-` in `detector-audit`.
- **Study id `2026-08-h0-battery-class-instrument-arm`**, not `2026-07-h0-battery`. The arm sits in
  this study's directory and under this study's pre-registration, but it is a different instrument
  from §4's P1, and A1.6/A2.4's registered censuses fix `2026-07-h0-battery` at **148 pooled
  cells** — a count `test/collect.test.mjs:494` asserts exactly. A distinct study id keeps both
  registered expectations literally true. `tierOfStudy` (`lib/constants.mjs:34-43`) returns **T1**
  for it, correctly: house synthetic.
- **Cells are emitted in `summary.json` only, with no `cells/` directory.** Both layouts are
  supported (`lib/collect.mjs:107-133`); `summary.json` is what `detector-audit` writes, and it
  keeps this arm out of `tests/test_report_consistency.mjs`'s per-file `cells/` sweep, which is
  written against P1's record shape. Every cell still carries `mode: 'live'` and
  `engine_version`.

### A3.3 Seeds, in the house pattern

`SEED = 20260809`, recorded in the manifest. Per (null, trajectory) the stream is
`rng(SEED + 7919*i + spec.id.length*104729 + det.id.length)` — the formula at
`detector-audit/harness/run-sequential.mjs:72`, cited rather than re-derived. The estimated-parameter
path (N2, N4) draws its calibration window from an independent stream,
`rng(SEED + 31*i + spec.id.length)`, per the same file's `:76`.

**Arm A3-W reuses arm A3-V's seeds per (null, trajectory), with the 3σ step applied.** That is §5's
own P2 pattern (`harness/run.mjs:118-125` reuses P1's `SEED + i*7919`), and it pairs each shifted
trajectory with its own null trajectory, which is the variance-reducing direction.

### A3.4 The instrument's threshold rule, and a contradiction this amendment records rather than resolves

`verdict` — the field `lib/score.mjs:39-43` reads and `VERDICT_MAP` maps — is set from **the card's
own frozen falsifier**, on one threshold:

```
verdict = lower95_one_sided > 1.0005 ? 'REFUTED'
        : upper95_one_sided < 1.0005 ? 'CLEARED'
        : 'inconclusive'
```

**Why the card's threshold and not detector-audit's.** `cards/family_C_safe_hotelling.json:62`
froze this card's falsifier as "increment lower95 > **1.0005** on the compiled-oracle null".
detector-audit §3 registered the same instrument with a different split: REFUTED iff
`lower95 > **1**`, CLEARED iff `upper95 < 1.0005`. **The two disagree on the interval
`1 < lower95 ≤ 1.0005`**, and the three other cards' cells were scored under detector-audit's.
The card is the frozen claim under test, and a mechanical protocol that tests a threshold other
than the one the card froze is testing a different claim — so the card's threshold governs the
scored token. `confidence: contested` is the right reading of the pair and **this amendment does
not adjudicate which threshold the protocol should standardise on**; that is a certification-protocol
question, named and owed.

**Both readings are recorded on every cell.** `house_rule_verdict` carries the detector-audit
reading verbatim. It has **no verdict authority by registration** — the K3.1.3/K6.7 REPORTED-field
pattern — and it is deliberately not named `verdict`, `supermartingale_verdict` or
`increment_verdict`, the three fields the scorer can read (`lib/score.mjs:39-43,182-190`), so the
recording cannot become a second scoring path. Either reading is recomputable from the recorded
`increment_estimator` bounds.

`'inconclusive'` is outside `VERDICT_MAP` (`lib/score.mjs:31`) and lands the cell in `missing[]`
with `suppressed_verdict: 'inconclusive'`, exactly as `family_A_mixture_supermartingale`'s three
such cells already do. That is registered as an expected, non-defective outcome, and A3.6 maps it.

### A3.5 Stop conditions, registered before the run

The arm is **not executable**, and no cell of it is scored, if any of these holds:

1. `git rev-parse HEAD` at run time is not `3f556c1`, or `package.json`'s version is not
   `0.6.6-pre` (§8.1's pin rule, applied to this arm).
2. `--mode live` is not passed. A sim run writes under `results/sim/` and is git-ignored (§10).
3. The target directory already exists. The harness refuses rather than reusing it, mirroring
   `harness/run.mjs:90-92`.
4. **The N1/N7 identity check fails.** This detector is not windowed (`detectors.mjs:116`
   `windowed: false`, no `calibrate`), so N1 and N7 differ only in a `windows` flag it never reads:
   their two `increment_estimator.mean` values must agree to `< 1e-12`. All four committed 2026-08-01
   runs already show N1 and N7 byte-identical on every P1 field, so a disagreement means the arm is
   not driving the detector the P1 rows drove. **This is the analogue of §8.3's known-failure check
   and it is a not-executable condition, not a result.**
5. `increment_estimator.n < 1900` on any cell (more than 5% of trajectories lost to a `continue`
   path), which would mean the arm is measuring a filtered subpopulation.

A stop condition that fires is reported, in these words, and the run directory is not written.

### A3.6 Registered predictions, derived in closed form from the detector's own update rule

**Disclosure, in §7's terms and in A1.6's.** These are **derivations, not measurements**: no probe
of this arm was run before this amendment was written, no `results/sim/` directory of it exists,
and the only prior measurement of this detector on any instrument is the committed P1 record, which
is quoted below where it is used. The derivations are checkable from `_hotelling-safe.ts` alone,
which is why they are stated as arithmetic rather than as expectations.

**The estimand, exactly.** At an oracle null the adapter (`detectors.mjs:118-131`) gives `p = 2`,
`Σ = I₂`, `τ² = 1`, `precompiled_log_det_shrink = ½·2·log 2 = log 2`. Substituting into
`_hotelling-safe.ts:110-112`:

```
z_t = −log 2 + ½ xᵀΣ⁻¹x − ½ xᵀ(Σ+τ²I)⁻¹x = −log 2 + ½|x|² − ¼|x|² = −log 2 + ¼|x|²
```

Under H₀, `|x|² ~ χ²₂ = 2·Exp(1)`, so with `Y ~ Exp(1)`, `z_t = −log 2 + Y/2` and

```
E[exp(z_t)] = ½ · E[exp(Y/2)] = ½ · (1 − ½)⁻¹ = 1     EXACTLY
```

`E[z_t] = −log 2 + ½ = −0.193147`, so `E[log M_300] = −57.944`. **The committed P1 record reads
`mean_logM = −57.887` at N1, α = 1e-4** (the cell where no trajectory fires, so all 300 ticks
accumulate) — 0.1% agreement, which is what makes the derivation an audit of the adapter and not
just algebra.

**The estimand is exactly 1 at every null whose marginal is N(0, I₂).** `z_t` is a fixed quadratic
form of `x_t` alone, so `E[exp(z_t)]` depends on nothing but the marginal law. AR(1) with unit
marginal variance (`nulls.mjs:23-28`) has exactly that marginal. Therefore **N1, N7, N3-p03,
N3-p06 and N3-p09 all have estimand exactly 1**, and the instrument is blind to the AR(1) failure
P1 measures at those same nulls (fire rates 0.0165 / 0.0625 / 0.3160 at α = 0.01, all `FAIL`).
**Registered as the prediction most likely to be misread**: it is detector-audit §8's "the
increment estimator bounds the marginal; the conditional implies it but is not implied by it",
realised as a number. A reader who takes an inconclusive N3 cell as agreement with P1, or as
evidence the detector is sound under AR(1), has been misled.

**The estimand is +∞ at every estimated-parameter null.** At N2/N4 the harness estimates `σ̂`
(`harness/run.mjs:44-52`, dividing by `cal.length`, so `σ̂²` is biased low) and the adapter sets
`Σ = σ̂²I`, `τ² = σ̂²`, with the shrink term unchanged at `log 2` — correct, since
`½(log det 4σ̂⁴ − log det σ̂⁴) = log 2` for any `σ̂`. So `z_t = −log 2 + ¼|x|²/σ̂²` and,
conditionally on `σ̂²`,

```
E[exp(z_t) | σ̂²] = ½ · (1 − 1/(2σ̂²))⁻¹   for σ̂² > ½,   +∞ otherwise
```

`P(σ̂² ≤ ½) > 0` for every finite `m`, so the unconditional estimand is **+∞ at N2-m30, N2-m100,
N2-m500, N4-p06-m100 and N4-p09-m100** — a genuine anti-conservatism of the shipped construction
under an estimated baseline, not an artefact. To first order away from the divergence the excess is
`≈ 1 + 1/m + 2·Var(σ̂²)`, i.e. worse as `m` falls, and worse again at N4-p09 where φ = 0.9 cuts the
calibration window's effective size to `m(1−φ)/(1+φ) ≈ 5`. The committed P1 record agrees in sign
and ordering (fire rate at α = 0.01: m=30 0.2080, m=100 0.0660, m=500 0.0095; N4-p09-m100 0.6280).

**The estimand is +∞ at N5 and N6.** `E[exp(¼|x|²)]` is finite only for sub-exponential `|x|²`;
moment-matched lognormal (`nulls.mjs:31-37`) and `t₃` (`:41-48`) both have polynomial tails on
`|x|²`. At N6, `exp(z_t)` overflows to `Infinity` once `|x| > 53.3`, i.e. `|t₃| > 92.3`, which has
probability `≈ 2.8e-6` per coordinate-draw against `1.2e6` draws — so **`increment_estimator.mean`
is expected to be non-finite at N6 with probability ≈ 0.97**, and `applyGuards`
(`lib/guards.mjs:25-30`) then returns `NON_FINITE` and the cell is **excluded and named, not
scored**. At N5 the same overflow needs `g > 5.52` (`≈ 1.7e-8` per draw, `≈ 0.02` expected), so N5
is expected finite, enormous and erratic — its value is set by its largest draw.

**The bands, and why they are wide where they are wide.** No prior measurement of this detector on
this instrument exists, so nothing empirical narrows these; what narrows the first row is that its
estimand is known exactly.

| null | estimand | registered band on `increment_estimator.mean` | predicted `verdict` |
|---|---|---|---|
| N1, N7 | exactly 1 | [0.95, 1.10] | inconclusive |
| N3-p03, N3-p06, N3-p09 | exactly 1 | [0.90, 1.30] | inconclusive |
| N2-m500 | +∞ (weakly) | [0.99, 1.30] | inconclusive |
| N2-m100 | +∞ | [1.00, 1e2] | REFUTED |
| N2-m30 | +∞ | [1.02, 1e6] | REFUTED |
| N4-p06-m100 | +∞ | [1.00, 1e6] | REFUTED |
| N4-p09-m100 | +∞ | [1.00, 1e12] | REFUTED |
| N5 | +∞ | [1.00, 1e9] | REFUTED |
| N6 | +∞ | non-finite expected | NON_FINITE exclusion |
| every null, arm A3-W | — | detection_rate ∈ [0.90, 1.00] | pass |

Arm A3-W's band is derived too: under a 3σ step on both coordinates, `|x|² ≈ 2·9 + 2 = 20`, so
`z_t ≈ +4.3` per tick against a bar of `log(1/0.05) = 3.0` — one post-onset tick suffices, at every
null, which is why the band is high and narrow and why **no inertness risk is predicted**
(`INERTNESS_FLOOR = 0.10`). The existing P2 cell reads 0.9725 at N1.

**A caveat on the instrument itself, derived and registered because it cuts against this
amendment's own result.** `P(exp(z_t) > u) = P(Y > 2 log 2u) = 1/(4u²)`: the per-tick increment has
tail index **exactly 2**, so its **variance is infinite** (logarithmically divergent), and so is the
per-trajectory mean's. `summarise`'s `se = sd/√n` and its `mean ± 1.645·se` bound therefore do not
attain their nominal one-sided level at this detector — sums of index-2 variables need `√(n log n)`
normalisation, so the interval is **too narrow** and the false-REFUTED rate at the five nulls whose
estimand is exactly 1 is **above** 5%, not below. **Consequence, registered in advance: a REFUTED
at N1, N7 or any N3 cell is an instrument artefact and not a detector failure — and the mechanical
protocol will score it as a refutation anyway**, because `lib/score.mjs:227-232` reads tokens and
does not re-derive. If that happens, the verdict stands as scored, the artefact is reported in
these words, and the cell is **not** re-run (one registered attempt per new cell). The card's
frozen 1.0005 threshold, rather than detector-audit's 1, is what makes this risk small instead of
routine — an unregistered benefit of A3.4's choice, disclosed here so it cannot be presented later
as the reason for it.

### A3.7 Outcome mapping: every S2 status this arm can produce, and the verdict it maps to

Registered so the run decides and nothing is chosen after seeing it. Read off
`lib/score.mjs:226-232` (S2 status) and `:505-587` (`overallVerdict`), with this card's fixed
`s1 = MISSING` and `s4 = UNPRICED`.

| S2 outcome | how it arises | overall verdict | tier |
|---|---|---|---|
| **REFUTED** | any in-regime cell maps REFUTED | **REFUSE** | — |
| **PASS** | ≥1 in-regime CLEARED, none REFUTED | **ADVISORY** | T1 |
| **MISSING** | every cell inconclusive, excluded or NON_FINITE | **NOT_EXECUTABLE** (unchanged) | — |
| **VOID** | every in-regime candidate sits in a voided run | **NOT_EXECUTABLE** (unchanged) | — |

**The predicted outcome is REFUTED → REFUSE**, on N2/N4/N5 (and N6 if it stays finite), per A3.6's
derivation. That is a verdict move on a certified card and it is this arm's registered purpose.

**Two corrections to the brief that commissioned this work, both read off the code.** (a) **USE is
unreachable for this card whatever S2 does.** `scoreS4` returns `UNPRICED` for it — bootstrap
threshold substitution with no measured c-bound cited (`lib/score.mjs:455-463`; `C38` item 6 is
that gap) — and `overallVerdict:581-584` caps an UNPRICED card at **ADVISORY**. So the reachable
set is {REFUSE, ADVISORY, NOT_EXECUTABLE}, not {USE, ADVISORY, REFUSE}. (b) A REFUTED N3 cell would
be scored as an **in-regime** refutation, per A3.1(2), even though the guarantee *sentence* says
"given the compiled (μ, Σ) as truth" and a reader may take that as iid-only. **The sentence and the
machine-readable regime disagree, the scorer reads the machine-readable regime, and this amendment
does not change the card to reconcile them** — that is a card content change and it needs its own
registration. Named, owed, and recorded as contested.

**S3 and the pairing endpoint.** Arm A3-W adds 12 power cells at the 12 nulls. Predicted S3
**PASS** (unchanged), with `perCell` 1 → 13. Predicted `pairingGaps` for this card: **0** — every
in-regime CLEARED or inconclusive-to-CLEARED null has an arm at the same `null_id`. The corpus-wide
unpaired count is predicted to stay **11**, all `sequential_ui_e_process`, unchanged.

**No other card is predicted to move, on any stage, and a move falsifies this amendment.**
`cellsFor` (`lib/collect.mjs:435-438`) matches on `detector_id` and aliases, and no other card's
id or alias set contains `family_C_safe_hotelling`. Class answers in `COVERAGE.md` are predicted
unchanged: this arm emits **no `fault_class` field**, and `coverageFor`
(`lib/score.mjs:358-405`) filters on it, so the arm is invisible to every class row by
construction. Tagging a 3σ step as K1 evidence would be a coverage-battery registration, not this
study's.

**One committed test census moves, and it is arithmetic, not a scoring change.**
`test/collect.test.mjs:657` asserts the pooled corpus at exactly **2266** cells, on A2.4's
registered expectation that A2 added and dropped nothing. This arm appends 24 cells, so that
assertion becomes **2290**, and the update is registered here with its arithmetic rather than
discovered as a failure. `:494`'s `2026-07-h0-battery` census stays at **148** — the reason A3.2
gives the arm its own study id. No other committed count is predicted to move.

### A3.8 Explicitly out of scope

- **`C38` item 4's 11 real unpaired cells, all `sequential_ui_e_process`. Named, not filled, and
  the reason is the instruction not to invent a fault construction.** That detector has no shift
  arm in any study: `harness/run-sequential-ui.mjs:52-92` runs nulls only and injects nothing;
  h0-battery lists it OUT_OF_SCOPE for want of an adapter shape (`detectors.mjs:149-150`);
  detector-audit §6 registers no power arm for it; and its card's own S3 route is the
  `clustersynth-ui` study (`cards/sequential_ui_e_process.json` `prior_evidence[1]`, stage
  `S2+S3`), which is blocked on the wide-format adapter `C38` item 3 tracks. Its S3 is
  **MISSING** — not pooled-but-unpaired — so a power arm for it would move its verdict off
  NOT_EXECUTABLE, which is a new registration and not a pairing fix. Owed, at `C38` item 4.
- **A1.3's second gap for the other three cards.** Their 36 P1 rows each remain invisible to the
  scorer's S2 vocabulary. All three are already REFUSE on `detector-audit-sequential` evidence, so
  the gap costs no verdict today; closing it means changing `isValidityCell` or `CLASS_INSTRUMENTS`,
  which is a certification-protocol change. Unchanged from A1.8.
- **Any change to `lib/score.mjs`, `lib/collect.mjs`, `verdict.mjs`, `lib/constants.mjs`,
  `lib/guards.mjs` or any detector source.** No scoring rule, instrument table, vocabulary,
  threshold or constant is touched, so **no card expires and no re-freeze is authorized**: no card
  pins any `validation/h0-battery/` file (audited across all fifteen `source_files` lists).
  `npm run cert:expiry` must still print `all cards current` after this work, and if it does not,
  something outside this registration was touched.
- **Any card content change**, including the `prior_evidence[stage=S2].runs` glob
  `h0-battery/results/live/run-*`, which does **not** match this arm's `inc-` directory. The glob
  is documentation — `cellsFor` matches on detector id, not on the glob — so the arm scores
  regardless; but the card's citation is now incomplete and that is named here, owed, not fixed.
- **Any re-run, re-scoring or edit of the four 2026-08-01 P1 runs, of `SUPERSESSIONS.json`, or of
  `REPORT.md`.** §1–12's endpoints are untouched and this arm supersedes nothing.
- **A second attempt at any cell of this arm.** One registered attempt per cell. A stop condition
  is reported; a surprising number is reported as measured.

### Amendment summary

Registers a class-instrument arm for `family_C_safe_hotelling`, the one h0-battery detector with no
`increment_estimator` measurement in any study — because `detector-audit`'s `SEQUENTIAL` set
(`run-sequential.mjs:31-35`) omits it, following that study's registry-derived scope, from which
safe-Hotelling is absent because `fleet/e-bh-guarded.ts`'s `DETECTOR_ENVELOPES` does not carry it.
Corrects `C38` item 5's stated reason: 36 validity cells for this detector are **pooled**, not
missing, and reach no stage because `isValidityCell` (`lib/score.mjs:11-12`) recognises none of the
fields a P1 endpoint row carries — A1.3's second gap, closed here for one card by measuring the
instrument rather than by widening the vocabulary. Resolves A1.2's third measurement at the file
and line: `_hotelling-safe.ts` has no φ input at all, so the adapter could not thread it and the
byte-identical rows are structural, not defective. Registers 24 cells in one `inc-`-prefixed
directory under study id `2026-08-h0-battery-class-instrument-arm` — arm A3-V, the increment
estimator at all 12 nulls of §3, and arm A3-W, §5's own 3σ P2 construction applied per null so
every validity cell has a paired power arm, which is what stops item 5's fix from opening twelve of
item 4's gaps. Sets the scored token from the **card's** frozen falsifier (`lower95 > 1.0005`) and
records detector-audit §3's (`lower95 > 1`) as an authority-free `house_rule_verdict`, with the
disagreement registered **contested** and not adjudicated. Derives, in closed form from
`_hotelling-safe.ts:110-112` and audited against the committed `mean_logM = −57.887`, that the
estimand is **exactly 1** at N1/N7/N3 — so the instrument is blind to the AR(1) failure P1 measures
there — and **+∞** at every estimated-baseline null and at N5/N6, predicting REFUTED at
N2-m30/m100, N4-p06/p09, N5, a NON_FINITE exclusion at N6, and therefore **S2 REFUTED → overall
REFUSE**, a verdict move on a certified card and this arm's registered purpose. Registers against
itself that the increment's tail index is exactly 2, so the interval is too narrow and a REFUTED at
N1/N7/N3 would be an instrument artefact the mechanical protocol would still score as a refutation,
un-re-run. Corrects the commissioning brief twice: **USE is unreachable** for this card while S4 is
UNPRICED (`score.mjs:581-584`), so the reachable set is {REFUSE, ADVISORY, NOT_EXECUTABLE}; and the
card's guarantee *sentence* and its machine-readable `regime` disagree about whether AR(1) is in
scope, with the scorer reading the regime and this amendment changing neither. Predicts no other
card moves on any stage, no `COVERAGE.md` class answer moves (the arm emits no `fault_class`), the
corpus-wide unpaired count stays **11**, and exactly one committed census moves by arithmetic —
`collect.test.mjs:657` 2266 → **2290** — while `:494`'s 148 holds. Leaves item 4's 11 real gaps
**named and unfilled**, because `sequential_ui_e_process` has no registered fault construction in
any study and inventing one would move its verdict rather than pair its cells.

### Correction append to A3.5, 2026-08-09 — stop condition 1 as registered is structurally unsatisfiable, and the replacement is stronger

Registered **before** the harness that implements it and before the run. Everything else in A3 —
scope, arms, nulls, seeds, threshold rule, predictions, bands, outcome mapping, out-of-scope list —
stands exactly as written, and no endpoint, threshold, α, N, T, null or seed moves.

**Quote, A3.5:**

> 1. `git rev-parse HEAD` at run time is not `3f556c1`, or `package.json`'s version is not
>    `0.6.6-pre` (§8.1's pin rule, applied to this arm).

**The version half stands; the sha half cannot be satisfied by any run of this arm.** A3's own
registration act is a commit, so HEAD is `754787e` the moment the amendment exists, and it can never
again equal `3f556c1`. Measured: the first invocation of the harness printed
`NOT EXECUTABLE — A3.5(1): HEAD is 754787e…, not the registered pin 3f556c1…`. **This is the same
structural trap `validation/certification/README.md`'s freeze table names** — `freeze-cards.mjs`
stamps `git rev-parse HEAD`, so a freeze commit cannot name its own sha — and it is recorded rather
than silently patched because a stop condition edited without a registration is not a stop condition.

**It also misread §8.1, which this study's own runs demonstrate.** §8.1 is "Engine version matches
the §0 pin". The four committed 2026-08-01 runs carry `registration_sha: '17cc3f8'` while running at
`git_sha` `17cc3f8`/`ff65feb` — so the study's convention is that the registration sha is **recorded**
and the engine **version** is **required**.

**Registered replacement, three checks, all fail-closed, and the second is stronger than what it
replaces:**

1. `package.json`'s version is `0.6.6-pre` (§8.1, unchanged).
2. **`detectors/_hotelling-safe.ts` hashes to the sha256 the card pins**, i.e.
   `c5cc555982e09fce449f06cc96e5cda57bf017ea6c7f48f2cc4f450ff964185e`
   (`cards/family_C_safe_hotelling.json` `source_files[0].sha256`). This binds the arm to the exact
   detector source the frozen claim is about, which a HEAD comparison only implies — the
   certification protocol's own expiry surface, used as an executability gate. Verified equal at the
   registration commit before this append was written.
3. **A3's registration commit `754787e` is an ancestor of HEAD** (`git merge-base --is-ancestor`),
   so the arm cannot run against a tree that predates its own registration, and the working tree
   carries no modification to `detectors/_hotelling-safe.ts`, `harness/nulls.mjs` or
   `harness/detectors.mjs`.

The run manifest records `git_sha` (HEAD at run time), `registration_sha: 3f556c1` (A3's base) and
`registration_commit: 754787e`, so the lineage is readable from the artifact. Stop conditions
A3.5(2)–(5) are unchanged.

### Results append to A3, 2026-08-09 — what the one registered run measured, and three corrections it forces on A3.6

Written after the run, against `results/live/inc-20260810T064226Z` (`git_sha` `bc6a4f7`, seed
20260809, N = 2000, T = 300, α = 0.05, 24 cells). **All five A3.5 stop conditions cleared**,
including A3.5(4): N1's and N7's increment means are bit-identical, gap **0**. One attempt, no
rerun, and the numbers below stand as measured.

**Arm A3-V, in the registered table's order.** `verdict` is on the card's frozen 1.0005 falsifier
(A3.4); `house_rule_verdict` agreed with it on every one of the 12 cells, so A3.4's contested pair
did not separate on this data and stays contested on the argument, not on a number.

| null | mean | one-sided [lower, upper] | verdict | in A3.6's band? | token predicted? |
|---|---|---|---|---|---|
| N1 | 0.996229 | [0.993155, 0.999304] | CLEARED | yes | no (predicted inconclusive) |
| N7 | 0.996229 | [0.993155, 0.999304] | CLEARED | yes | no (predicted inconclusive) |
| N2-m500 | 1.009998 | [1.005816, 1.014181] | REFUTED | yes | no (predicted inconclusive) |
| N2-m100 | 1.088833 | [1.042489, 1.135178] | REFUTED | yes | **yes** |
| N2-m30 | 1.380324 | [1.218159, 1.542489] | REFUTED | yes | **yes** |
| N3-p03 | 1.042966 | [1.035568, 1.050364] | REFUTED | yes | no (predicted inconclusive) |
| N3-p06 | 1.223540 | [1.194093, 1.252988] | REFUTED | yes | no (predicted inconclusive) |
| N3-p09 | 1.602687 | [1.521725, 1.683648] | REFUTED | **no** (band [0.90, 1.30]) | no |
| N4-p06-m100 | 1.776661 | [1.642059, 1.911262] | REFUTED | yes | **yes** |
| N4-p09-m100 | 2.233611e+5 | [−1.384e+5, 5.851e+5] | inconclusive | yes | no (predicted REFUTED) |
| N5 | 1.062039e+143 | [−6.850e+142, 2.809e+143] | inconclusive | **no** (band [1.00, 1e9]) | no |
| N6 | non-finite | — | NON_FINITE exclusion | — | **yes** |

**Arm A3-W, detection rate at 3σ:** N1 0.9725, N2-m30 0.7940, N2-m100 0.9035, N2-m500 0.9735,
N3-p03 0.9515, N3-p06 0.8655, N3-p09 0.6545, N4-p06-m100 0.7280, N4-p09-m100 0.4190, N5 0.6625,
N6 0.7400, N7 0.9725. **A3.6's band [0.90, 1.00] holds at 3 of 12 nulls and fails at 9.**

**Scored outcome, from the real scorer (`run-20260810T064520Z`).** S2 **MISSING → REFUTED** on seven
in-regime refutations; N1/N7 CLEARED; N4-p09-m100 and N5 in `missing[]` as unmapped `inconclusive`;
N6 excluded NON_FINITE; suppressed tally `inconclusive x3`. Overall **NOT_EXECUTABLE → REFUSE**,
tier null. S3 **PASS**, `perCell` 1 → 13. This card's `pairing` is **[]**. **A3.7's registered
outcome — REFUTED → REFUSE — is what happened**, and every corpus-level prediction held: no other
card's verdict, tier or stage status moved, no `COVERAGE.md` class answer moved, the corpus-wide
unpaired count is unchanged at **11** (all `sequential_ui_e_process`), and the pooled corpus is
**2290**, i.e. 2266 + 24, with `2026-07-h0-battery` still at 148.

#### Correction 1 to A3.6 — the AR(1) estimand is `1/√(1−φ²)`, not 1, and the reason is a covariance the harness withholds

**Quote, A3.6:** "**The estimand is exactly 1 at every null whose marginal is N(0, I₂).** … Therefore
**N1, N7, N3-p03, N3-p06 and N3-p09 all have estimand exactly 1**".

**Wrong for N3, and the error is in the words "N(0, I₂)".** `family_C_safe_hotelling` is a **vector**
detector (`detectors.mjs:117` `vector: 2`) and the harness fills its two coordinates from
**consecutive draws of one scalar stream** (`run.mjs:35`
`Array.from({length: det.vector}, src)`). Under an AR(1) null those two draws are correlated at φ,
so `x_t ~ N(0, [[1, φ], [φ, 1]])` — while the adapter configures the detector with `Σ = σ²I₂`
(`detectors.mjs:121-122`). For a Gaussian quadratic form,
`E[exp(½xᵀAx)] = det(I − ΣA)^{−1/2}` with `A = ½I`, so

```
E[exp(z_t)] = ½ · det(I − ½Σ)^{−1/2} = ½ · ((1−φ²)/4)^{−1/2} = 1/√(1−φ²)
```

which is 1 at φ = 0 and **1.0483 / 1.2500 / 2.2942** at φ = 0.3 / 0.6 / 0.9. The measured
1.0430 / 1.2235 / 1.6027 track it (correction 2 explains the shortfall). **So the N3 refutations
are real, and they are a Σ-misspecification finding rather than an AR(1)-pre-whitening one**: this
detector has no φ input at all (A3.1(3)), but it does have a covariance input, and at N3/N4 the
harness does not supply the oracle covariance the null actually has.

**That makes A3's own N3/N4 cells not oracle-parameter cells, by this study's own standard, and it
is recorded rather than fixed.** §3's N3 is "AR(1) … **oracle parameters**", and the defect that
superseded `run-20260801T062824Z` and `run-20260801T064237Z` was stated as measuring "detectors
unaware of phi, not the registered oracle-parameter cell". Withholding the oracle *covariance* from
a vector detector is the same class of defect on a different input, and it affects **every**
`family_C_safe_hotelling` N3/N4 row in this study, this arm's and the four committed P1 runs' alike.
Registered consequences, in order:

- **The cells stand as scored.** They are in regime under the card's machine-readable regime
  (A3.1(2)), the run is not re-run, and nothing is retro-superseded on the strength of a finding
  made after seeing the numbers.
- **The verdict does not depend on them.** Dropping all five N3/N4 cells leaves N2-m30, N2-m100 and
  N2-m500 REFUTED — nulls that are iid, where the induced cross-coordinate correlation is exactly 0
  and the only error is `σ̂` — so S2 is REFUTED and the card is REFUSE on the estimated-moments
  nulls alone. **Stated because a reader must be able to see that the correction does not rescue the
  detector.**
- **A vector-aware oracle covariance for N3/N4 is owed, and it is not this arm's to register**: it
  changes what §3's N3 means for every vector detector, which is §3's business.

#### Correction 2 to A3.6 — the instrument under-reads its own estimand, and cannot refute a catastrophic failure at all

A3.6 registered that the increment's tail index is exactly 2, that the interval is therefore too
narrow, and that the risk was a **spurious REFUTED**. Both halves of that need correcting.

**The point estimate is biased low at feasible N, not just noisy.** The sample mean of an index-2
variable is unbiased in expectation but its distribution is right-skewed with a median below the
mean, so a single realisation typically under-reads. Measured three ways at once, all consistent:
N1 reads **0.996229** with an upper bound of 0.999304 against a **derived exact 1** — the derived
value sits *outside* the interval on the high side; the N3 cells read 0.5% / 2.1% / 30% below
`1/√(1−φ²)`; and an independent 4,000,000-draw Monte Carlo of the estimand alone under-reads the
closed form by 0.3% / 1.7% / 15.7% at the same three φ. **So the true anti-conservatism of this
detector is worse than this arm measured, everywhere.**

**The registered risk was the wrong sign.** A3.6 warned that a REFUTED at N1/N7/N3 would be an
instrument artefact. What actually happened is the mirror image: **N1 and N7 CLEARED, on an interval
whose upper bound excludes the estimand the same derivation gives**. That CLEARED is the reading in
this arm not to trust, and it is the reading that keeps S2 at REFUTED rather than at REFUTED-with-no-
cleared-cells. The asymmetry A3.6 asserted — that the artefact risk runs toward false refutation —
is corrected: at an exactly-calibrated null this instrument's normal-approximation interval fails on
the **low** side, so it manufactures clearances, not refusals.

**And the three worst cells refute nothing.** N4-p09-m100 (2.23e5), N5 (1.06e143) and N6
(non-finite) are the arm's three most extreme anti-conservatisms and all three are unscored: the
one-sided lower bound goes **negative** once the sample sd outgrows the mean, so `inconclusive` is
what a catastrophic failure produces. **Registered as a structural limit of the registered
instrument, not of this detector**: `mean − 1.645·sd/√n` cannot refute a mean it cannot bound, so
the increment estimator refutes only *mildly* invalid detectors and goes quiet on the badly invalid
ones. That is the opposite of the property a validity instrument should have, it applies to every
`increment_estimator` cell in the corpus, and closing it needs a heavy-tail-appropriate bound
(median-of-means, or a bound on `log` increments), registered where the instrument is —
detector-audit §3, not here.

#### Correction 3 to A3.6 — A3-W's band was wrong because first-fire censoring removes pre-onset firers

A3.6 derived `z_t ≈ +4.3` per tick under a 3σ step against a bar of 3.0 and registered
`detection_rate ∈ [0.90, 1.00]` at every null. The arithmetic is right and the band is wrong at 9 of
12 nulls, lowest **0.4190** at N4-p09-m100. **The cause is not power**: §5's construction counts a
trajectory as detected only if its **first** fire lands in ticks 100–300 (`run.mjs:118-125`, which
this arm reproduces), and at the nulls where the detector already fires *under H₀* — crossing rate
0.652 at N4-p09-m100, 0.380 at N3-p09, 0.376 at N5 — a large share of trajectories have already
fired before onset and are therefore counted as **not** detected. Measured, the two series are
near-complementary: `detection_rate ≈ 1 − crossing_rate` across the 12 nulls.

**So arm A3-W measures §5's construction faithfully and §5's construction conflates "did not
respond to the shift" with "was already firing at the null".** Registered as a finding about the P2
endpoint, which the certification protocol reads as power: the one cell below §5's own 0.50 bar
carries `verdict: 'FAIL'`, and that token means "already invalid" here, not "inert". No stage status
turns on it — every rate clears `INERTNESS_FLOOR` 0.10, S3 is PASS — and this arm does not
re-register §5.

#### What this run does not establish

Restated because A3's headline is a REFUSE. **This is a refutation battery** (§2): seven refuted
nulls are seven refutations, and the two cleared cells are "not refuted at these nulls" with
correction 2's caveat on top — not evidence the construction is sound at N1/N7. The increment
estimator bounds the **marginal**; the card's guarantee sentence is **conditional**
(`E[e_t|F_{t-1}] ≤ 1`), which the marginal does not imply. Nothing here is real telemetry, and
ADR 0012's `E[e|H₀] = 24/9/9` still attaches. And S4 stays **UNPRICED**: this card's c-bound is
still unmeasured (`C38` item 6), so its shipped bootstrap threshold remains unpriced whatever S2
says.

### Review corrections append to A3, 2026-08-10 — five corrections an independent review found, each quote-and-correct

The review reproduced the verdict movement, both instrument findings and the C38.4 premise
independently, and registered A3's mapping as having fired exactly. It also found five things wrong
in what A3 and its results append asserted. No endpoint, threshold, α, N, T, null or seed moves, no
cell is re-run, no run directory is edited, and no verdict moves: **every correction below is to a
claim about the evidence, never to the evidence.**

#### C1 — the pairing counterfactual is wrong by 6×: dropping arm A3-W yields **2** gaps, not 12

**Quotes. A3.1(5):**

> What this amendment owes item 4 is therefore **not** those 11 (A3.7) but the 12 gaps item 5's own
> fix would otherwise **open** … Registering validity cells without power arms at the same nulls
> would trade one named gap for twelve.

**And A3.2:** "registering A3-V without A3-W would trade one named gap for twelve." **And the
Amendment summary:** "which is what stops item 5's fix from opening twelve of item 4's gaps."

**All three are wrong, and the arithmetic that refutes them is in `pairingGaps` itself.**
`lib/score.mjs:479` reads `if (c.out_of_regime || c.mapped !== 'CLEARED') continue;` — a gap is
generated **only** for an in-regime **CLEARED** validity cell. A REFUTED, inconclusive or excluded
cell can never produce one. So the ceiling on the counterfactual is the number of CLEARED cells, not
the number of nulls.

Measured, by re-scoring the committed corpus with every arm A3-W cell filtered out: **2** gaps,
`N1` and `N7`, with S3 `perCell` falling 13 → 1. Those are exactly the two cells that mapped CLEARED.

**The pre-run version of the claim was self-contradictory when written**, which is what makes it
worth an append rather than a footnote: A3.6 predicted `inconclusive` at every null and CLEARED at
none, so on A3's **own** registered predictions the counterfactual was **0** gaps, not 12. The
post-run instance in `test/golden-verdicts.test.mjs` is sharper still — it says "nine newly-mapped
validity cells with no per-null arm would have added twelve unpaired lines" while naming, two
sentences earlier, that only two of those nine mapped CLEARED. Corrected in that file's comment in
the same commit as this append.

**Arm A3-W remains independently justified and is not retro-rationalised.** Two real gaps is more
than zero, and the arm's twelve cells are S3 evidence in their own right: `perCell` 13 → 1 without
them, and the per-null spread (0.4190 to 0.9735) is what exposed correction 3's first-fire censoring,
which a single pooled cell could not have shown. What is withdrawn is the *magnitude* of the pairing
argument, not the arm.

#### C2 — stop-condition labels collided three ways, and sim-mode acceptance is a deviation A3.5 did not register

**Two label collisions, both in the harness's refusal strings.** `A3.5(2)` labelled both the
detector-source sha256 check and the `--mode` check; `A3.5(3)` labelled the ancestor check, the
clean-working-tree check **and** the directory-reuse check. A stop condition whose label names two
different tests cannot be cited. Registered numbering, applied to the harness in the same commit:

| label | check |
|---|---|
| A3.5(1a) | `package.json` version is `0.6.6-pre` |
| A3.5(1b) | `detectors/_hotelling-safe.ts` hashes to the card's pinned sha256 |
| A3.5(1c) | A3's registration commit is an ancestor of HEAD |
| A3.5(1d) | no guarded source modified in the working tree |
| A3.5(2) | mode |
| A3.5(3) | the target run directory does not already exist |
| A3.5(4) | the N1/N7 identity check |
| A3.5(5) | `increment_estimator.n >= 1900` |

(1a)–(1d) are the four checks the A3.5 correction append registered as the replacement for the
original condition 1; it stated them as three and the clean-tree check was folded into the ancestor
sentence, which is why the harness had two strings under one label.

**And the deviation A3.5(2) needs.** As registered it says the arm "is **not executable** … if
`--mode live` is not passed". The harness accepts `--mode sim`, writing under the git-ignored
`results/sim/` per §10. **That is a deviation, and it was used: a sim invocation at `--n 20 --t 30`
was run before the live run to verify the harness's mechanics.** Disclosed rather than left to be
found: those are **not** the registered parameters, so the smoke run produced none of the registered
cells and could not preview the registered endpoint — at `T = 30` no tick reaches §5's onset at 100,
so its power arm read 0.0000 at every null by construction. It also exercised the A3.5(5) refusal
path. The registered reading of A3.5(2) is therefore: **`--mode live` is required for a scored run,
`--mode sim` is permitted for mechanics and writes only where §10 sends it.**

#### C3 — Correction 2 over-read its own percentages: only φ = 0.9 is signal

**Quote, Correction 2:** "the N3 cells read 0.5% / 2.1% / 30% below closed form".

The percentages are right and **treating the first two as measurements of a systematic bias is
not.** Against each cell's own recorded `se`:

| null | measured | closed form | deviation | z |
|---|---|---|---|---|
| N1 / N7 | 0.996229 | 1 | −0.377% | **−2.02** |
| N3-p03 | 1.042966 | 1.048285 | −0.507% | **−1.18** |
| N3-p06 | 1.223540 | 1.250000 | −2.117% | **−1.48** |
| N3-p09 | 1.602687 | 2.294157 | −30.141% | **−14.05** |

φ = 0.3 and φ = 0.6 are within noise. **Only φ = 0.9 is signal**, and N1/N7 at −2.02 σ is
suggestive at best — and it is **one** observation, not two: the two cells are bit-identical by
A3.5(4), which is the check that guarantees it.

**The systematic component, measured rather than asserted.** 400 replicates of the arm-size
estimator at φ = 0, where the estimand is exactly 1: median **0.999601**, i.e. a median bias of
**−0.040%**, with 57.0% of replicates below 1. That is an order of magnitude smaller than N1's
observed −0.377%, so the median-below-mean effect is real, directional and **small** — it does not
account for what N1 read.

**What survives, and it is the part that matters.** At an exactly-calibrated null the registered
instrument returns **CLEARED 13.5%** of the time, **REFUTED 2.0%**, inconclusive 84.5% (same 400
replicates, same rule: REFUTED iff `lower95 > 1.0005`, CLEARED iff `upper95 < 1.0005`). So the
interval fails toward **clearance** about seven times as often as toward refutation, against a
nominal 5% each way. **Correction 2's direction stands and its magnitude does not**: N1/N7's CLEARED
is a 1-in-7 draw at a perfectly calibrated null, not proof of a large downward bias — and either way
it is a clearance this arm cannot stand behind.

The 4,000,000-draw Monte Carlo Correction 2 also cites (under-reading closed form by
0.3% / 1.7% / 15.7% at φ = 0.3/0.6/0.9) carries no interval in that append and none is claimed here:
it agrees in **direction** at all three and is decisive only at φ = 0.9, exactly as the table above.

#### C4 — N6's exclusion and the negative-bound failure are two mechanisms, and Correction 2 bundled them

**Quote, Correction 2:** "the three worst cells refute nothing: N4-p09-m100 (2.23e5), N5 (1.06e143)
and N6 (non-finite) are the arm's three most extreme anti-conservatisms and all three are unscored:
the one-sided lower bound goes **negative** once the sample sd outgrows the mean".

**True of two cells, not three.** N4-p09-m100 and N5 fail by the negative-bound mechanism: their
bounds are finite, `lower95` is below 1.0005, the recorded token is `inconclusive`, and the scorer
files them in `missing[]` as an unmapped token. **N6 fails earlier and elsewhere:** `exp(z_t)`
overflowed, so `increment_estimator.mean`/`sd`/`se` are non-finite, and `applyGuards`
(`lib/guards.mjs:25-30`) returns `NON_FINITE` and the cell is **excluded** before any token is read —
its `inconclusive` survives only as a `suppressed_verdict` annotation on the exclusion. Two
mechanisms, two different scorer paths (`missing[]` vs `excluded[]`), one shared consequence: neither
refutes. The generalisation Correction 2 draws — that this instrument goes quiet on badly invalid
detectors — holds under both, and needs both stated to be checkable.

#### C5 — "pooled, not missing" is the wrong contrast

**Quote, the Amendment summary:** "36 validity cells for this detector are **pooled**, not missing,
and reach no stage".

"Not missing" is loose in a document where `missing[]` is a scorer field: the cells **are** missing
from every stage, which is the whole problem. The precise contrast, and the wording that should be
cited: they are **pooled but never recognised as candidates** — present in `loadEvidence`'s returned
`cells`, filtered out by `isValidityCell` before `scoreS2` can exclude them, which is why all three
of `perCell`, `excluded` and `missing` were empty rather than just the first. A1.3 made this same
distinction for the word "scored"; this append makes it for "missing".

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

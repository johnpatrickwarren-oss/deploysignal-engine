# Pre-registration — is the bootstrap threshold over-corrected?

- **Study id:** `2026-08-bootstrap-overshoot`
- **Engine pin:** `v0.6.6-pre`.
- **Discipline:** `knowledge/methodology/pre-registration-discipline`.

Committed before any run.

## 1. The question

Family A betting and Family C safe-Hotelling replace the analytical `1/α` with a bootstrap `(1−α)`
quantile of max wealth. Measured across compiled configs, those shipped thresholds sit at median
**2.4×10⁴** and **3.6×10⁷⁶** times `1/α` (`knowledge/stats/ville-guarantee-is-empirical`).

Family D's directly measured inflation is **c ≈ 1.06**.

**Is the bootstrap calibrated for the worst regime and then applied in every regime, including those
where the detector is already valid?** If so it is buying nothing there and costing power.

## 2. Primary endpoint — B1

`E[M_T | H₀]` at T = 300, N = 4000, for each detector under:

| null | regime |
|---|---|
| N1 | iid Gaussian, **oracle** parameters — both detectors hold here (H₀ battery: 0.031, 0.028) |
| N3-p09 | AR(1) φ=0.9, **oracle** φ — betting holds (0.022), safe-Hotelling fails (0.380) |
| N4-p09 | AR(1) φ=0.9, **estimated** φ — both fail (0.397, 0.656) |

**B1 reports the implied `c` per cell.** No pass/fail: this is a measurement of how much correction
each regime actually needs, against how much the shipped threshold applies.

## 3. The comparison — B2

`overshoot = shipped_threshold_ratio / measured_c` per cell, where `shipped_threshold_ratio` is the
median 2.4×10⁴ (betting) and 3.6×10⁷⁶ (safe-Hotelling) already measured.

## 4. Registered expectation

At **N1 and N3-oracle**, where the H₀ battery measured nominal crossing rates, I expect `c` near 1 —
so an overshoot of roughly the full 2.4×10⁴ and 3.6×10⁷⁶. At **N4**, where both fail, I expect `c`
large enough to justify real correction, though not necessarily that much.

*If that holds, the bootstrap is worst-case calibration applied uniformly, and the power cost in the
common regime is the full overshoot.*

## 5. Control

The rolling Family D path must reproduce `E[M] ≫ 1` as in the companion study, or the harness is
wrong.

---

## Amendment A1 — 2026-08-10, before the harness exists: the two `c` instruments, the horizon grid, and the divergence criterion

`knowledge/WORKLIST` C38 item (6). Sections 1–5 stay intact and every endpoint in them is scored
unchanged. This amendment **adds** the instrument definitions §1 left implicit, two horizons, an
across-batch replicate structure, and the criterion that decides in advance when a measured `c`
does not exist. Registered **before** the harness it authorizes; no prior run is re-run, because
this study has never been run.

### A1.1 What is true at HEAD, before any registration

The C38 item (6) row reads:

> `c`-bounds are unmeasured behind two bootstrap-substituted thresholds (family_A_betting,
> family_C_safe_hotelling), so S4's UNPRICED status on those cards has no measured artifact to
> resolve it with.

**Verified true at HEAD, and three details of it are sharper than the row.**

1. **The trigger is the card text, not a judgement.** `scoreS4`
   (`validation/certification/lib/score.mjs:455-463`) tests `card.shipped_path.kind` against
   `/bootstrap[\s-]+(?:threshold[\s-]+)?substitut/i` with a `/\bno\s+bootstrap/i` negation guard.
   `family_A_betting_e_process.json` reads `bootstrap threshold substitution ~2.4e4x over 1/alpha`
   and `family_C_safe_hotelling.json` reads `bootstrap threshold substitution ~3.6e76x over 1/alpha`.
   Both match; neither is negated.
2. **The two cards fail the gate differently, and the row treats them as one case.**
   `score.mjs:458` clears the gate only on `prior_evidence.some(e => e.stage === 'S4' && e.runs != null)`.
   `family_C_safe_hotelling` has an `S4` entry — `study: bootstrap-overshoot`, `runs: null`,
   `wiki: stats/ville-guarantee-is-empirical` — which is a *declared* question.
   **`family_A_betting_e_process` has no `S4` `prior_evidence` entry at all.** So one card cites this
   study and has no run; the other cites nothing.
3. **There is no `PRICED-at-c` outcome, and I correct that premise before using it.** `scoreS4`
   returns exactly `PASS`, `REFUSE` or `UNPRICED` (`score.mjs:423-465`, and the implementation plan's
   own signature line, `docs/superpowers/plans/2026-08-06-detector-certification-v1.md:704`). A
   measured `c` cited as `prior_evidence[stage=S4]` with `runs != null` resolves the stage to
   **`PASS`**, carrying no `c` value anywhere in the scorer. The number lives in the run and the card
   citation, never in the status token.

**`validation/bootstrap-overshoot/` contains this pre-registration and nothing else** — no harness,
no `results/`. The study has never been executed.

### A1.2 What the measurement is FOR, since it cannot move either verdict

**Both cards are already `REFUSE`, and S4 is not why.**
`validation/certification/results/run-20260810T064520Z/REPORT.md:7,9`:

| card | S1 | S2 | S3 | **S4** | verdict |
|---|---|---|---|---|---|
| `family_A_betting_e_process` | MISSING | **REFUTED** | INERT | UNPRICED | **REFUSE** |
| `family_C_safe_hotelling` | MISSING | **REFUTED** | PASS | UNPRICED | **REFUSE** |

`overallVerdict` reaches `REFUSE` on in-regime S2 refutation before S4's cap is consulted, so
**resolving UNPRICED on either card changes no verdict.** S4 does still compute on a `REFUSE` card:
`verdict.mjs:50` calls `scoreS4(card, ...)` unconditionally, and both rows above carry an S4 token
beside a `REFUSE` verdict.

**So this measurement is for the record, not for the verdict, and it is registered as such.** What it
answers is the question §1 of this pre-registration asks — whether the bootstrap is calibrated for
the worst regime and applied everywhere — and what it supplies is the artifact S4.3 of
`knowledge/methodology/detector-certification-protocol` names: *"a measured c-bound with its horizon
dependence stated."*

### A1.3 The two `c` instruments, defined exactly, because they are different objects

§2 says "B1 reports the implied `c` per cell" without writing the identity down. Two are registered,
both reported on every cell, because the shipped threshold and the Ville price answer different
questions and `stats/ville-guarantee-is-empirical` already records them being conflated.

**`c_markov` — the terminal price.** For a nonnegative process with `M_0 = 1`, Markov at a fixed
horizon gives `P(M_T >= x) <= E[M_T] / x`, so firing at `x = c/alpha` restores `P <= alpha` with

```
c_markov(T) = max(1, E[M_T | H0])
```

This is the quantity §2's B1 names, and the quantity `e_value_inflation_bound` prices for Family D
(`types/families/d.ts:107`, `detectors/spectral.ts:345`: `threshold = c / alpha`). The `max(1, ·)`
is registered because a bound below 1 prices nothing — `absent is not the same as c = 1`, per that
type's own doc comment, and a *measured* value below 1 licenses no threshold reduction here either.

**`c_ville_emp` — the sup price the bootstrap actually targets.** The shipped threshold is an
empirical `(1-alpha)` quantile of **max wealth**, not a bound on `E[M]`. Its own implied factor is

```
c_ville_emp(T, alpha) = alpha * q_{1-alpha}( sup_{t <= T} M_t )
```

so that firing at `c_ville_emp / alpha` reproduces exactly an `alpha` crossing rate on this null.
`alpha = 0.05`, the study's scored level. **This is measurable where `c_markov` may not be**, because
a high quantile of a heavy-tailed variable is estimable where its mean is not, and registering both
is the harder-to-pass reading: it removes the escape of reporting only whichever instrument behaves.

**Both are computed in the log domain.** `E[M_T]` reaches `2.6e300` in the published readings, and
`exp()` overflows to `Infinity` above `logM ~ 709.78`. Every accumulation is
`log-sum-exp`: `logEM = max_i L_i + log( sum_i exp(L_i - max_i L_i) ) - log(N)`, where
`L_i = log M_T` for trajectory `i`, read from the detector's own exact `state.log_M` (ADR 0026) and
never from the saturating `M` view. All readings are reported as **`log10`** with the linear value
beside them only where it is finite.

**`B2`, unchanged in form.** `overshoot = shipped_threshold_ratio / c`, reported in `log10` for each
instrument. The two `shipped_threshold_ratio` constants are the medians
`stats/ville-guarantee-is-empirical` measured over `../deploysignal/runs/compiled-configs/`:
**`2.41e4`** for Family A betting (82,888 cells) and **`3.6e76`** for Family C safe-Hotelling
(34,481 cells). They are inputs quoted from a prior measurement, not re-measured here, and this
harness has no access to that tree.

### A1.4 The grid: cells, horizons, replicates, seeds

**Detectors.** `family_A_betting_e_process` and `family_C_safe_hotelling`, driven through
`validation/h0-battery/harness/detectors.mjs` — the adapters the H0 battery already uses, unmodified,
so this study measures the same instrument that study did.

**Nulls, with the id mapping §2's table leaves implicit.** §2 names N1, N3-p09, N4-p09; the
generators are `validation/h0-battery/harness/nulls.mjs`'s `N1` (iid Gaussian, oracle),
`N3-p09` (AR(1) phi=0.9, **oracle** phi) and `N4-p09-m100` (AR(1) phi=0.9, **estimated** from
m=100). Oracle cells receive `phi`; estimated cells estimate `mu`, `sigma` and `phi` from the same
`m=100` calibration window, exactly as `h0-battery/harness/run.mjs:40-53` does.

**Horizons.** `T in {300, 900, 2000}`. §2 registers `T = 300`; the two longer horizons are added
because S4.3 requires the horizon dependence **stated**, and one point cannot state it. `T = 900`
and `T = 2000` are the horizons `stats/ville-guarantee-is-empirical`'s own retraction box already
reads, so its numbers are comparable rather than merely adjacent.

**The three horizons are SNAPSHOTS OF ONE TRAJECTORY, not three runs.** Each trajectory advances to
`T = 2000` once and `log M_t` is recorded at `t = 300`, `900`, `2000`, with the running
`sup_{t<=T} log M_t` snapshotted at the same three points. So the horizon readings are **nested and
positively dependent**, which is why the horizon comparison is registered as a within-trajectory
monotonicity claim (P-C8) and never as a difference with an independent-sample band.

**`N = 4000` per replicate, as §2 registers, and `B = 5` independent replicates.** The replicate
structure is the uncertainty instrument. `stats/ville-guarantee-is-empirical` records the same cell
reading `0.718` and `1.165` under two seeds at this `N`, so a within-sample interval on `E[M]` is
known to understate; the across-replicate spread is the honest one.

**Seeds, fixed and listed.** `BASE_SEED = 20260801` (the H0 battery's). Replicate `b in 0..4` uses
`BATCH_BASE(b) = 20260801 + b * 40000000`; trajectory `i in 0..3999` uses
`BATCH_BASE(b) + 7919 * i`. `40000000 > 3999 * 7919 = 31667081`, so no two replicates share a
trajectory seed. Replicate `b = 0` is the registered primary and is the one comparable to §2's
`T = 300` endpoint; the other four exist to measure spread. Every cell at a given `(b, i)` uses the
same seed across detectors and horizons — a paired design, matching `run.mjs:73`.

**The control, per §5, and it is a real check rather than a gesture.**
`family_D_spectral_e_detector` on `N1` (**disjoint** windows) and `N7` (**rolling**, the shipped
cadence), same horizons, same replicates. The disjoint arm has a committed target:
`types/families/d.ts:85-107` and `test/spectral-inflation-bound.test.ts` record
`E[M_300] = 1.0636` and `E[M_900] = 1.1076`, measured with `(mu_0, sigma_0)` estimated from **400**
windows where this harness's `calibrate()` uses 3,000 samples = **100** windows of `W = 30`. So the
band is widened for the calibration difference rather than quoted tight; see P-C9. §5's own demand —
that the rolling path read `E[M] >> 1` — is the `N7` arm.

### A1.5 The divergence criterion, registered BEFORE the run, because "unmeasurable" must not be a post-hoc reading

A sample mean of a heavy-tailed variable can be reported to any number of digits while estimating
nothing. `knowledge/stats/terminal-mean-is-not-measurable` records a process with `E[M] = 1` exactly
reading `0.0288` at `N = 4000`. Three tests, any one of which marks a cell's `c_markov`
**NOT MEASURABLE**:

- **D1 — one draw carries the mean.** `top1_share = exp(max_i L_i - logsumexp_i L_i) >= 0.5`. At that
  point the reported mean is a reading of a single trajectory.
- **D2 — the replicates disagree by an order of magnitude.**
  `max_b log10 E[M_T] - min_b log10 E[M_T] >= 1`.
- **D3 — the replicates straddle the only threshold that matters.**
  `min_b E[M_T] < 1 <= max_b E[M_T]`. A cell that cannot be placed on the correct side of 1 prices
  nothing, whatever its point estimate.

`c_ville_emp` gets its own, stated separately because a quantile fails differently:

- **D4 — the quantile sits on too few order statistics.** With `N = 4000` and `alpha = 0.05` the
  `q_{0.95}` estimate rests on the top 200 draws; it is marked NOT MEASURABLE only if
  `max_b log10 c_ville_emp - min_b log10 c_ville_emp >= 1`.

**Dispositions, fixed now.**

1. **A cell passing D1–D3 is a MEASURED `c_markov` at that horizon**, reported with its
   across-replicate range, and — per `SpectralInflationBound`'s own rule that a bound must be
   measured for the longest horizon the detector runs over — the route's quotable `c` is the
   **maximum over the three horizons**, not the `T = 300` reading.
2. **A route failing any test at any horizon is UNPRICED-AND-UNMEASURABLE, and that is the finding**,
   not a failure of the run. It says the S4.3 alternative — "or the claim is demoted to empirical
   tier" — is the only branch available to that route.
3. **No card is edited under this amendment on either branch, and no card is re-frozen.** Resolving
   S4 `UNPRICED -> PASS` requires adding `prior_evidence[stage=S4].runs` to a card, which flips the
   S4 token that `validation/certification/test/golden-verdicts.test.mjs:372,374` freezes for both
   cards. Moving a frozen golden table is a protocol-version action and not a measurement's to take.
   No card's `source_files` names any file this amendment touches, so nothing expires:
   `npm run cert:expiry` must still read `all cards current` afterwards, and `npm run test:cert` must
   still read 181 pass.

### A1.6 Registered predictions

Bands are the spread of the already-published readings, not intervals from this run. Where two
published readings of one cell disagree, the band spans both, and the disagreement is the reason the
band is wide.

- **P-C1 — betting, N1 (phi=0 oracle).** `E[M_300] < 1`, in `[0.09, 0.40]`. Published: `0.221`
  (overshoot study), `0.322` (retraction box, `T=300`). Decreasing in `T`: `E[M_2000] < E[M_900] <
  E[M_300]`, the published `0.322 / 0.139 / 0.092` shape. **This is the one cell the wiki says
  survives**, so it is also the cell where a failure is most informative.
- **P-C2 — betting, N3-p09 (phi=0.9 ORACLE), the cell the wiki retracted.** The point estimate lands
  in `[0.5, 1.6]` (published `0.718` and `1.165`, 95% upper `1.456`). **The operative prediction is
  D3: the five replicates will straddle 1**, so `c_markov` is NOT MEASURABLE here. If instead all
  five land on one side, the wiki's partial retraction is itself refuted and that is the result.
- **P-C3 — betting, N4-p09-m100 (phi estimated).** `log10 E[M_300]` in `[8, 25]` (published
  `1.6e17`, `log10 = 17.2`), and D1 fires: `top1_share >= 0.5`.
- **P-C4 — safe-Hotelling, N1.** `E[M_300] < 1` (published `~0`), and `log10 E[M_300] < -5`.
- **P-C5 — safe-Hotelling, N3-p09 (oracle).** `log10 E[M_300]` in `[8, 25]` (published `1.7e14`,
  `log10 = 14.2`), and D1 fires.
- **P-C6 — safe-Hotelling, N4-p09-m100.** `log10 E[M_300]` in `[150, 500]` (published `2.6e300`,
  `log10 = 300.4`), and D1 fires.
- **P-C7 — the outcome prediction.** **Every cell whose `log10 E[M_T] > 0` fails D1.** If that holds,
  the measured artifact this study delivers is not a price; it is the demonstration that no price is
  estimable by simulation for four of the six cells, and `c_ville_emp` is the only instrument that
  returns a number on them.
- **P-C8 — horizon monotonicity, within trajectory.** `sup_{t<=T} M_t` is nondecreasing in `T` by
  construction, so `c_ville_emp` is nondecreasing in `T` in every cell — a check on the harness, not
  a finding. `E[M_T]` **increases** with `T` on all three estimated-phi and oracle-AR(1) cells and
  **decreases** on both `N1` cells.
- **P-C9 — the control (a stop condition, not a finding).** `family_D_spectral_e_detector` on `N1`
  disjoint reads `E[M_300]` in `[1.02, 1.12]` and `E[M_900] > E[M_300]`, bracketing the committed
  `1.0636` and `1.1076` at the 100-window calibration. On `N7` rolling it reads `E[M_300] >> 1`
  (`>= 2`), per §5. **If the disjoint arm falls outside `[1.02, 1.12]` the instrument disagrees with
  a committed number and NO `c` is reported from this run for any detector** — the run is recorded
  as a failed control and the reason investigated before any re-registration.
- **P-C10 — B2, the overshoot.** On every cell where `c_markov` is measurable and below 1,
  `log10 overshoot_markov` equals `log10` of the shipped ratio: **`4.38`** for betting and
  **`76.56`** for safe-Hotelling. On the N4 cells it is **negative** for both (the threshold is
  *below* the inflation), reproducing the wiki's "`10^13` too low" and "`10^224` too low" in sign.

### A1.7 What this amendment does not do

1. **It does not re-measure the shipped threshold ratios.** `2.41e4` and `3.6e76` are quoted from
   `stats/ville-guarantee-is-empirical`, measured over a compiled-config tree this harness cannot
   see. If those medians are wrong, every `overshoot` here is wrong by the same factor.
2. **It does not change any card, any status, or the golden verdict table.** A1.5 disposition 3.
3. **It does not touch `results/` of any other study**, and it supersedes no run.
4. **It does not price the shipped path.** `c_ville_emp` reproduces an `alpha` crossing rate **on
   these three nulls at `T <= 2000`**. It is not an anytime bound and it is not a bound on any null
   outside the three, and no reading of it may be quoted as one.
5. **It does not measure the 2,584 Family A and 82 Family C compiled cells that ship a threshold
   BELOW `1/alpha`** — the residue `stats/ville-guarantee-is-empirical` names as not conservative.
   Those need the compiled-config tree.
6. **It does not repair `family_A_betting_e_process`'s missing `S4` `prior_evidence` entry** (A1.1
   detail 2), which is a card edit.
7. **One fault shape: none.** These are null-only cells; nothing here measures power, and the power
   cost of an overshoot — the wiki's `0.949 -> 0.459` at half-sigma — is not re-measured.
8. **Synthetic nulls only, T1.**

### A1.8 House rules, mapped

(1) Committed before the harness exists and before any run. (2) No endpoint or threshold in §§1–5
moves; two horizons and four replicates are added, and every added quantity has its criterion fixed
above. (3) The published readings quoted in A1.6 are prior measurements used as bands, not analyses
of this run's data. (4) §5's control is strengthened into a stop condition (P-C9) rather than
relaxed. (5) No new substrate: the H0 battery's own generators and adapters, unmodified. (6) One
registered attempt; `results/` is created and appended to, never overwritten. (7) No rerun of any
study. (8) Binding on this run's report: every cell reports both instruments, all five replicates,
the `top1_share`, and each of D1–D4 as fired or not — including where nothing fired.

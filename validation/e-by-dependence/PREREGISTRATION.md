# Pre-registration — e-BY false-coverage control on the mixture confidence sequence under DEPENDENT signals (`2026-09-e-by-dependence`)

- **Study id:** `2026-09-e-by-dependence`
- **Register:** `knowledge/WORKLIST.md` C71; `knowledge/stats/pages/e-by-fcr-2026-09-03.md` (the
  study this extends; its Boundary names the dependent-signal arm as not measured);
  `knowledge/stats/pages/ramdas-wang-2025.md` §7 (Theorem 13.7 and its one-line Markov proof).
- **Discipline:** `knowledge/methodology/pre-registration-discipline`;
  `knowledge/methodology/harness-discipline`.
- **Status: REGISTERED, NOT RUN.** A new study, not an amendment of `validation/e-by-fcr`: new
  cells, new harness. No `.ts` file changes; the harness drives the shipped `dist/` as
  `e-by-fcr` does. This file is committed first so that no endpoint, bar, grid, law or seed
  below can be chosen after a number is seen. Later commits must not edit it; a change is an
  amendment, appended and dated.

## 1. The claim under test

Ramdas–Wang 2025 Theorem 13.7 (p. 202): for a level-free family of e-CIs per signal, e-BY at
`α_i = δ|S|/K` has `FCR ≤ δ` under **any dependence** between the signals and any selection rule.
The proof is one Markov step on `Σ_i E_i(θ_i)·1{i ∈ S}·|S|δ/K`, which uses only that each
`E_i(θ_i)` has expectation at most 1 marginally; the joint law never enters. The engine's
mixture CS (`detectors/mixture-confidence-sequence.ts`) is level-free by Proposition 13.4, and
`fleet/e-by.ts` re-inverts it. Study `2026-09-e-by-fcr` measured this on independent signals
only. This study puts dependence into the joint law of the innovations while keeping every
signal's **marginal** law inside the mixture's premise (iid Gaussian innovations with the
variance the detector is told), so that a FAIL can only be a contradiction with the theorem or
a harness defect, never a premise failure.

## 2. The study

Substrate: the shipped `evaluatePageCusumMixtureSupermartingale` (`dist/`) per signal, oracle
baseline mean 0, oracle `σ²` equal to the cell's true marginal innovation variance, no AR(1);
mixture prior `ρ ∈ {1, 38}`; detector `α = 1e-3` for its fire rule (irrelevant to the CS
family; recorded). `K = 20` signals, `T = 300` ticks, `x_{i,t} = θ_i + e_{i,t}` with
`θ_i = δ_shift` on the first `L = 5` signals and 0 on the rest, `δ_shift ∈ {0, 0.75, 1.5}`.
The estimand for signal `i` is `θ_i`; a miss is `θ_i ∉ C_i`.

### 2.1 Dependence laws (the joint law of `e_{·,t}` across signals; iid across ticks in every law)

Per tick the generator draws `z_t ~ N(0,1)` and `ε_{i,t} ~ N(0,1)`, `i = 0..K−1`, in that order,
in every law, so the laws differ only in how the same draws are mixed (common random numbers).

| law | `e_{i,t}` | marginal var (oracle `σ²`) | pairwise corr |
|---|---|---|---|
| (a) `equi-0.5` | `sqrt(r)·z_t + sqrt(1−r)·ε_{i,t}`, `r = 0.5` | 1 | 0.5 |
| (a) `equi-0.9` | same, `r = 0.9` | 1 | 0.9 |
| (b) `common-mode` | `f_t + ε_{i,t}`, `f_t = sqrt(3)·z_t` | 4 | 0.75 |
| (c) `coupled` | `s_i·z_t`, `s_i = −1` for `i ∈ {3, 7, 11, 15, 19}`, `+1` otherwise | 1 | ±1 |
| (d) `independent` | `ε_{i,t}` | 1 | 0 |

(b) is the DeploySignal/Tessera shape: one per-tick fleet-wide shift with loading 1 on every
signal plus idiosyncratic unit noise, **unstripped**. Both consumers strip a robust common mode
(`fleet/common-mode.ts` `robustLocation`) before the detector sees residuals, so the shipped
path carries less dependence than this cell; (b) is the most dependent case of that shape. The
oracle `σ² = 4` is the marginal variance, so the premise holds; telling the detector `σ² = 1`
here would be a variance misspecification, not a dependence test, and is out of scope.
(c) is the adversarial coupling the brief asks for: every null signal's partial sum is
`±Z_T`, identical up to sign, so the selection is as dependent as it can be. The 15/5 sign
split is chosen so the cross-sectional mean is not identically 0 under the null (a 10/10 split
makes rule C's statistic vanish). (d) is the `e-by-fcr` control, re-measured under this
harness's seeds rather than copied.

### 2.2 Selection rules

All applied at the report tick `τ = T`; rule A also at each selected signal's own first-fire
tick `τ_i` (both stopping times).

- **Rule A — fired set (DeploySignal's rule):** `S` = the signals whose mixture has fired by `T`.
- **Rule B — extremeness:** the 3 signals with the largest `|S_T|`; ties broken by index
  ascending (ties are exact under (c)).
- **Rule C — selects on the dependence:** the `K/2 = 10` signals with the largest common-mode
  projection `p_i = Σ_t x_{i,t}·x̄_t`, `x̄_t = (1/K)·Σ_j x_{j,t}` (the consumer's observable
  estimate of the common mode, computed on the raw `x` as a consumer would); ties by index.

### 2.3 Cells and replications

Each (law, ρ, δ_shift) triple simulates `N = 2,000` replications once; the four selection
cells (A@T, A@fire, B@T, C@T) read the same replications. 5 × 2 × 3 = 30 triples, 120 cells,
× 3 FCR levels `δ ∈ {0.05, 0.10, 0.20}` = 360 bars. Seeds
`20260911 + 7919·i + 10⁶·j`, `i` the replication, `j` the (ρ, δ_shift) index in loop order
(ρ outer, δ_shift inner, `j = 0..5`), **shared across laws** so that laws are paired by common
random numbers. Generator: the LCG + Box–Muller of `e-by-fcr`.

Every cell records `n`, mean `|S|`, `p_empty`, per-replication FCP → `fcr`, `fcr_se`, the
naive comparator (`α_i = δ` for every selected signal) likewise, the e-BY/naive half-width
ratio at `τ = T`, the count of re-inversion deviations, and the exception count (which is
structurally 0: there is no catch, so an exception aborts the run).

## 3. Endpoints (HELD/FAILED on their own bars)

- **P1 — e-BY controls FCR under every law (validity, the ship gate).** In every cell at every
  δ: `fcr_eBY ≤ δ + 3·fcr_se`. Registered prediction: HELD in all 360 bars. The largest
  `fcr/δ` will again be the fired-set-at-fire cells with no shift, where the FCR is the false-fire
  rate of the fired set. Under (c) the FCP is 0 or 1 for the whole selected null set at once, so
  `fcr_se` is larger there than under (d); the bar accounts for it.
- **P2 — the naive intervals at level δ under (c) with rule C (reported, no ship
  consequence).** Law (c), rule C, `δ_shift = 0`: bar `fcr_naive(δ = 0.05) > 0.05` for at least
  one ρ. **Registered prediction: FAILED**, with `fcr_naive ≤ 0.005` at δ = 0.05. Why: under (c)
  every null signal has the same `|S_T| = |Z_T|`, and rule C's statistic under the null is
  `s_i·(Σ_j s_j/K)·Σ_t z_t²`, which ranks by sign and then by index, never by the tail of `Z_T`;
  so the selection has no grip on the miss event. The miss is one shared event with the CS's
  marginal fixed-T miss probability, which in units of `sd(S_T/T)` is `P(|N(0,1)| >
  sqrt(log(v/(δ²ρ)))·sqrt(v)/sqrt(T))`, `v = T + ρ`: about 3.4 sd (≈ 0.0006) at ρ = 1 and 3.0 sd
  (≈ 0.0024) at ρ = 38. The engine's P2 failed on independent signals because a time-uniform
  interval read at a fixed T has that slack; dependence does not remove the slack, and this
  coupling removes the selection's leverage on the tail. The naive FCR is reported in every
  other cell without a bar.
- **P3 — the e-BY price is the closed form (reported).** Half-width ratio e-BY/naive at `τ = T`
  equals `sqrt(log(v/(α_i²ρ)) / log(v/(δ²ρ)))` to 1e-9 on every interval; the mean ratio per
  cell is reported.
- **P4 — the re-inversion is the closed form.** Every e-BY interval's half-width equals
  `sqrt(v·log(v/(α_i²ρ)))/t`, `v = σ²t + ρ`, to 1e-12; the deviation count is 0.

**Registered observation O1 (no bar, no verdict): did dependence move the FCR?** For each
(ρ, δ_shift, rule/τ, δ) the e-BY FCR in each dependent law is tabulated against law (d),
paired by common random numbers. Prediction: under rule B the FCR falls as dependence rises
(co-movement makes the largest `|S_T|` less extreme relative to a shared interval, and under
(c) it is exactly the marginal); under rule A at τ = fire it is the false-fire rate of the
fired set, which under (c) is the fire rate of one stream; under rule C no prediction on the
sign. O1 is what the wiki page must state explicitly either way.

## 4. NOT-EXECUTABLE conditions and vacuous cells

- The shipped evaluator does not attach `confidence_sequence` on the Gaussian path, or any
  replication throws: the run aborts, is preserved unscored, and the study is reported
  not-executable at that harness sha.
- A cell whose fired set is empty in every replication (`p_empty = 1`) has FCR 0 by
  construction; it is listed as **vacuous**, excluded from P1's count, and named on the wiki
  page. (`e-by-fcr` saw mean `|S|` 0.01 under no shift, so no cell is expected to be vacuous.)

## 5. Ship rule

P1 HELD in every non-vacuous bar: nothing new ships (no `.ts` changes are planned), and the
wiki records that Theorem 13.7's dependence clause is now exercised on this composition. P1
FAILED in any bar: the cell is filed on the wiki as a contradiction between the measurement
and Theorem 13.7 (which, given §1, can only mean the harness broke the marginal premise or is
otherwise wrong), `confidence: contested`, and the study stops there.

## 6. What this study does not measure

Temporal dependence within a signal (AR(1), a slowly varying common mode); the estimation
premise (mixture-cs P3/P4); heavy tails; the consumers' common-mode stripping; FDR of the
selection (e-BH's business); horizons other than T = 300; more than 20 signals.

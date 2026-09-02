# Pre-registration — the confidence sequence inverted from the Family A mixture supermartingale

- **Study id:** `2026-09-mixture-cs`
- **Register:** `knowledge/stats/pages/e-betting-metrics-2026-09-02.md` option 4 (operator
  authorization 2026-09-02: "follow your recommendations and proceed until complete"); ADR 0027.
- **Discipline:** `knowledge/methodology/pre-registration-discipline`; harness rules per
  `knowledge/methodology/harness-discipline`; the C39 rule that a reported instrument carries no
  verdict authority until scored.
- **Engine:** branch `feat/betting-metrics-surface` at the sha in the run manifest. The system
  under study is `detectors/family-a-mixture-supermartingale.ts` (`computeGaussianMixtureLogSupermartingale`,
  ADR 0027) and the inversion `detectors/mixture-confidence-sequence.ts`, which does not exist at
  this commit.

Committed before the inversion module and the harness exist. Every prediction below is frozen
with its band before any simulation.

## 1. The system, from code and from the source

Per tick the mixture detector accumulates the (whitened) centered partial sum
`S_t = Σ_{i≤t} x_i` with `x_i = live_i − μ̂_baseline` and evaluates

```
log M_t(S_t) = S_t² / (2(σ²t + ρ)) + ½ log(ρ / (σ²t + ρ))
```

(`family-a-mixture-supermartingale.ts`, `computeGaussianMixtureLogSupermartingale`), where `σ²` is
the compiled per-tick variance and `ρ = gaussian_sigma_squared_prior`. This is Howard et al.
2021's two-sided normal mixture with mixing variance `ρ` [raw/howard-2021 §3.2, eq. 14,
`l₀ = 1`]. It fires when `M_t ≥ 1/α`.

**The inversion.** For a candidate shift `m`, the same mixture applied to `x_i − m` has partial
sum `S_t − t·m`. The set of `m` whose game has not made money, `{m : log M_t(S_t − tm) < log(1/α)}`,
is the interval

```
C_t = X̄_t ± w_t,     w_t = sqrt((σ²t + ρ) · log((σ²t + ρ) / (α² ρ))) / t,     X̄_t = S_t / t
```

— Howard eq. 14 with intrinsic time `v = σ²t`, and Ramdas 2023 eq. (22) in the survey's
parameterization [raw/ramdas-2023 §5.1]. By Ville, `P(∃t : δ ∉ C_t) ≤ α` when `x_i − δ` is
conditionally sub-Gaussian with parameter `σ` under the reference law — the same premise the
detector's own anytime claim rests on (`knowledge/stats/validity-premise-chain`).

`C_t` is a statement about the shift **from the compiled baseline mean**, because `S_t` is built
from `x_centered`. That is the estimation premise made concrete: with `μ̂ = μ + ε`, the estimand
the CS covers is `δ − ε`, and the operationally wanted `δ` is missed by exactly `ε`.

## 2. Registered predictions

Common: iid Gaussian observations, `σ = 1`, `α = 0.05`, `N = 4,000` trajectories per cell,
horizon `T = 900`, seeds by the splitmix64 scheme (family-d-emean A1.5.4 lesson — no overlapping
substreams). Two mixing variances: `ρ = 1` (`= σ²`) and `ρ = 38` — the latter is where Howard
Proposition 3 puts the boundary's tightest intrinsic time near `m ≈ 300` at `α = 0.05`
(`m/ρ = −W₋₁(−α²/e) − 1 ≈ 7.9`). Every cell runs with both unless stated.

**P1 — time-uniform coverage at oracle parameters (validity).** `x_i ~ N(δ, 1)` with
`δ ∈ {0, 0.75}` (0.75σ is the portfolio's `δ*`), oracle `μ̂ = μ`, oracle `σ² = 1`. Endpoint:
the fraction of trajectories with `∃t ≤ T : δ ∉ C_t`. Ville gives `≤ α`; the discrete-time
overshoot and the mixture's tuning leave slack (Howard §3.6: unimprovable over the sub-Gaussian
class, not exact for any one law). **Registered band: miscoverage ∈ [0.005, 0.060]** in every
P1 cell (upper: `α + 3·se`, `se = sqrt(0.05·0.95/4000) = 0.0034`; lower: a reading below 0.005
would mean the boundary is grossly loose and the inversion mis-specified). **Verdict authority:
HELD/FAILED.**

**P2 — duality with the detector (structural).** Under `δ = 0.75`, oracle parameters, for each
trajectory the first tick at which `0 ∉ C_t` must equal the first tick at which the detector's
own `M_t ≥ 1/α` (Howard §6: rejecting when the mixture CS excludes `μ*` *is* the mixture SPRT).
Both are computed from the same `S_t`, so this is exact up to floating rounding at a boundary
tie. **Registered: equality on ≥ 3,996 of 4,000 trajectories per ρ** (the 4-trajectory allowance
is for ties at the last ulp; any larger discrepancy is an implementation defect). **Verdict
authority: HELD/FAILED, and a FAIL is a harness stop** — the other endpoints are not scored
until it is fixed and the fix is recorded here as an amendment.

**P3 — the estimation-premise law at a fixed horizon (derived).** `μ̂` is the mean of `m`
calibration draws from `N(0, 1)`, `m ∈ {30, 100, 500}`; `σ²` oracle; `δ = 0`. At fixed `T = 300`
the miscoverage of `δ` is exactly

```
P(δ ∉ C_T) = 2 · Φ̄( w_T / sqrt(1/T + 1/m) )
```

since `X̄_T − μ̂ − δ ~ N(0, 1/T + 1/m)` independent of `w_T` (deterministic at oracle σ).
Registered numbers (`ρ = 1`; `w_300 = sqrt(301 · log(301/0.0025))/300 = 0.1958`):

| m | sd | z | predicted |
|---|---|---|---|
| 30 | 0.1917 | 1.021 | 0.307 |
| 100 | 0.1155 | 1.696 | 0.090 |
| 500 | 0.0730 | 2.681 | 0.0073 |

and for `ρ = 38` (`w_300 = sqrt(338 · log(338/0.095))/300 = 0.1753`): 0.361 / 0.129 / 0.0164.
**Registered: measured within `3·se_binomial(predicted, 4000)` of the prediction in all six
cells.** **Verdict authority: HELD/FAILED.** This is the CS analogue of C23's `κ/m` law for the
tests: the estimation premise priced in closed form.

**P4 — as deployed: μ̂ and σ̂ both from the calibration window (reported, with two registered
inequalities).** Same `m` grid; `σ̂²` is the sample variance of the same `m` draws and enters
`w_t`. Endpoint: time-uniform miscoverage of `δ = 0` over `t ≤ 900`. The fixed-`T` law at
`T = 900, m = 30` already gives `2Φ̄(0.1193/0.1856) = 0.52` at oracle σ, and the uniform rate is
larger. **Registered: (a) miscoverage at `m = 30` ≥ 0.50; (b) miscoverage at `m = 500` ≤ 0.20;
(c) monotone non-increasing in `m`**, for both ρ. **Verdict authority: HELD/FAILED on (a)–(c);
the magnitudes are reported.** The gap between P4 and the oracle-σ uniform rate is attributed
to `σ̂` descriptively; it is not decomposed here.

**P5 — width law (structural, cheap).** At every `t`, the emitted half-width equals the closed
form above to `1e−9` relative, computed independently in the harness (not by calling the
module). **Registered: max relative deviation over all ticks and cells < 1e−9.** Harness gate,
like P2.

## 3. What ships on each outcome (registered before the run)

- P1, P2, P5 all HELD → `mixtureConfidenceSequence` is attached to
  `PageCusumMixtureSupermartingaleResult.confidence_sequence` as a REPORTED field with no
  verdict authority; its docstring carries P3/P4's numbers as the estimation-premise price.
- P2 or P5 FAILED → implementation defect; fix, amend here, re-run. No wiring.
- P1 FAILED → the inversion does not hold at oracle parameters; the module stays exported with
  the refutation in its header and nothing is wired. The wiki page gets the number.
- P3 or P4 FAILED → the derived law is wrong; the module ships (validity is P1) but the
  docstring states the measured price instead of the derived one, and the discrepancy is filed.

## 4. Stop conditions and boundaries

- Any non-finite half-width or partial sum in any cell: stop, record, fix test-first.
- The study is iid Gaussian only; no AR(1), no heavy tails, no drift. It prices the estimation
  premise for the CS in the one regime where the detector is CLEARED at oracle parameters
  (`knowledge/stats/detector-audit-sequential-2026-08-05`), and says nothing beyond it.
- Nothing here bears on the betting e-process or on the bootstrap threshold; the mixture uses
  the analytical `1/α` on the shipped path.

## Amendment A1 — 2026-09-02, before the live run (harness smoke at N = 400)

The P3 table's hand-computed `w_300` for `ρ = 1` was wrong: `sqrt(301 · log(301/0.0025))/300 =
0.1978`, not `0.1958` (`log(120,400) = 11.699`, not the value I carried). The registered claim is
the **formula** `2·Φ̄(w_T / sqrt(1/T + 1/m))`, which the harness evaluates itself; the table was
illustrative and is corrected here rather than edited in place: `ρ = 1` → **0.302 / 0.087 /
0.0068** (was 0.307 / 0.090 / 0.0073); `ρ = 38` → 0.360 / 0.129 / 0.0164 (unchanged to three
places). No band moves: the band is `predicted ± 3·se` with `predicted` computed at run time. The
quick run's endpoints file was discarded; only the full-N run is scored.

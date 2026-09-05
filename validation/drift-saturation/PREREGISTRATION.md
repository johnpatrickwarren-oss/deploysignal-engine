# Pre-registration — an incident-shaped drift class: slow growth then saturation, time-to-alert for the survivors (`2026-09-drift-saturation`, C78)

- **Study id:** `2026-09-drift-saturation`
- **Register:** `~/concord/knowledge/WORKLIST.md` row C78; brief in `knowledge/PROMPTS.md` §C78.
- **What it serves:** a fault CLASS the coverage matrix
  (`knowledge/methodology/pages/fault-class-coverage-matrix.md`) does not carry: one principal's
  rate on a shared service grows monotonically from a stable baseline over a long horizon, then
  saturates at the service's capacity, and the service's latency steps (K1) at the saturation tick.
  The class is prompted by the July 2026 registry outage's public timeline (write load grew for
  two months and took the registry down; no telemetry released). **This is a class, not a replay:**
  the timeline is counts, not data, and `knowledge/stats/pages/simulation-validates-instances-not-statements.md`
  is the house rule. K5 (slow drift, `knowledge/stats/pages/k5-drift-2026-08-08.md`) is the nearest
  registered class; its canonical is a linear ramp integrating to 1.99σ over 200 ticks scored by a
  single terminal window. This class differs in three ways that are the point: the horizon is
  long (500 and 2,000 ticks), the growth ends in a saturation with a K1 step on a second signal,
  and the endpoint is *when* the alert comes relative to that saturation, not whether a window
  scores.
- **Tier:** T1 (house synthetic nulls at oracle parameters). Nothing here is a real-trace claim;
  nothing here has verdict authority over a certification card (protocol Amendment v1.C66).
- **Engine:** at this commit (`57fd0f3` on main); no detector, monitor or calibration change.
  **No `.ts` file is touched**; the harness drives the committed `dist/`.
- **Status: REGISTERED, NOT RUN.** Committed before any harness code so that the generator, the
  grid, the arms, the bars, the seeds and the predictions are fixed before a number is seen. A
  later change is an amendment, appended and dated.

## 1. The generator (the class, registered)

Per replication two signals of length `T` are drawn from one seeded generator (the h0-battery's
LCG + Box–Muller, `validation/h0-battery/harness/nulls.mjs`, imported; ticks outer, signals inner:
rate then latency), each a null with unit marginal variance:

| null | generator | φ (oracle) |
|---|---|---|
| `N1` | iid Gaussian | 0 |
| `N3-p06` | AR(1), unit marginal variance | 0.6 |

Serial dependence is in the grid because a rate is autocorrelated and the whitened view of a
ramp is smaller by `sqrt((1 − φ)/(1 + φ))` (the C69 effect: 0.5 at φ = 0.6).

**Timeline** (0-indexed ticks): calibration head `[0, m)`, `m = 100`; monitoring from `m`;
pre-onset baseline `[m, ν)`, `ν = 500` (400 quiet ticks); growth `[ν, S)`, `S = ν + H`,
horizon `H ∈ {500, 2000}`; saturation at `S`; post-saturation phase `[S, T)`, `T = S + 500`
(so `T ∈ {1500, 3000}`).

**The rate signal** is `x_t = z_t + g(t)` with `z_t` the null draw and, for `u = (t − ν)/H`:

| shape | `g(t)` on `[ν, S)` | per-tick increment at the canonical `H = 2000` |
|---|---|---|
| `linear` | `C·u` | `0.002σ` every tick |
| `exponential` | `C·(e^{κu} − 1)/(e^{κ} − 1)`, `κ = 4` | `0.00015σ` at onset, `0.0078σ` at the last tick; 12% of `C` at mid-horizon |
| `staircase` | `C·floor(5u)/5` | five steps of `0.8σ` at `u = 0.2, 0.4, 0.6, 0.8, 1.0`; flat between |

and `g(t) = C` for `t ≥ S`. **Capacity `C = 4σ`** (the terminal size, in units of the rate's
baseline marginal σ). At `H = 500` the linear per-tick increment is `0.008σ`, below K5's
canonical `0.01σ`; at `H = 2000` it is `0.002σ`, five times below it. Every per-tick increment is
far below any level threshold (K1's smallest registered step is `0.75σ`); the cumulative
displacement is twice K5's canonical terminal. Both facts are what the class means.

**The latency signal** is `y_t = z'_t + δ_L·1[t ≥ S]`, `δ_L = 1.5σ` (K1's canonical), on an
independent null draw of the same family. It carries no information before `S` by construction:
it is the alarm an operator watching the service, not the principal, would get.

**Grid:** shape (3) × `H` (2) × null (2) = **12 cells**, `N = 500` replications per cell.
Seeds `20260904 + 7919·i + 10⁶·j`, `i` the replication, `j` the cell index in loop order (shape
outer in the table's order, then `H` ascending, then null in the table's order). The canonical
cell for the class is **`linear`, `H = 2000`, `N1`** (cell `j = 2`).

## 2. Arms: the constructions and their alert rules

Every construction runs once on the rate signal and once on the latency signal, from `m`, with
**oracle parameters** `(μ = 0, σ = 1, φ)` for the plug-in constructions and the head `[0, m)`
for the fitted ones. (Estimation is C23's and C76's question, measured there; not here.) The
alert is the **first raw crossing**, no reset, no cooldown, no smoothing. A construction that
has alerted on the baseline has alerted; it does not get a second alarm.

| construction | driven as | levels | contract |
|---|---|---|---|
| universal inference (C76 survivor at every head) | `universalInferenceMeanShiftEValue(x, cal = {0, m}, test = {s, L})` on consecutive windows `s = m + kL`, `L = 100`, while `s + L ≤ T`; a window alerts iff `e ≥ 1/α`. **The alert tick is the window's last tick `s + L − 1`** — the evidence exists only when the window closes. (C76 classed by the window's start; that was a `pre/in` question, this is a lead-time question, and the end is the harder reading.) | α ∈ {0.05, 10⁻⁴} per window | `P(e ≥ 1/α) ≤ α` per window |
| sequential UI (C76 survivor at the 0.15 head) | `sequentialUiMeanShiftEProcess(x, {changeFrom: m})`; `logE[i]` is tick `i + 1`; alert at the first tick `≥ m` with `E ≥ 1/α`. Note the construction's alternative allows one post-change mean from `changeFrom` on, so the quiet stretch `[m, ν)` dilutes it; that is how the shipped construction reads a stream with no onset knowledge, and how C76 ran it. | α ∈ {0.05, 10⁻⁴} per run | `P(ever E ≥ 1/α) ≤ α` |
| e-SR mean shift, Gaussian increment (C76 survivor on its ARL reading) | `standardizeAr1Residual(x_t, x_{t−1}, 0, 1, φ)` → `evaluateESrMeanShift`, default λ grid; `x_prev` at `m` is `x_{m−1}` | α_ARL ∈ {10⁻³ (shipped default), 10⁻⁴} | `E∞[N] ≥ 1/α_ARL` |
| bounded-bet e-SR (**conditional**, C77) | as the e-SR with `increment: 'bounded'` | the same | conditionally mean-zero residual |
| Family A mixture (the comparator that fails its null at T3) | h0-battery adapter `family_A_mixture_supermartingale`, `cfg = {μ, σ, φ, α}`, raw values, internal whitening | α ∈ {0.05, 10⁻⁴ (the shipped α, `knowledge/stats/pages/arl-delay-2026-09-03.md`)} per run | `P(ever M ≥ 1/α) ≤ α` |

The bounded-bet e-SR is C77's module, **not merged at this registration** (engine PR #89 open;
`dist/detectors/e-sr-mean-shift.js` on main `57fd0f3` has no token `bounded`). As in C76: **the
arm runs iff, at run time, that file contains the token `bounded`**; otherwise the manifest records
`bounded_esr: absent` and the report and wiki page name the gap. Nothing else changes either way.

**The gate (arm c).** On each replication the rate signal's oracle residual `r_t` (the e-SR's
input) feeds `freshCalibrationMonitor({alpha: 0.01, incrementKind: 'bounded'})`
(`fleet/calibration-monitor.ts`) from `m`. **The revocation tick is the first tick at which
`passing` becomes false**, sticky. Every alert on the rate signal is read twice: **raw**, and
**behind the gate**, where an alert at `t*` is *abstained* iff the monitor revoked at or before
`t*` and *counted* otherwise. The gate's own revocation tick relative to `S` is reported per cell
(the monitor is itself a detector of the class; whether it revokes before or after the survivors
alert is the architectural reading).

**The K5 instrument (arm d, for P4 only).** The coverage matrix's K5 canonical machinery is
`safe_t_e_value` on a single terminal window
(`validation/coverage/PREREGISTRATION.md` Amendment v2.K5R: `cal = [0, 100)`, `TEST = {start: onset,
len: 200}`, decision `e ≥ 20`). Per replication: `safeTwoSampleTEValue(x, {0, m}, {ν, 200},
{ar1Phi: φ})` on the rate signal, `e ≥ 20`. No time-to-alert; a fraction per cell.

## 3. Endpoints, with bars

All T1. Per (construction, level, cell) on the rate signal unless stated. `t*` is the first alert
tick, `∞` if none.

- **P1 — alerting before saturation.** `P1 = #{t* ∈ [ν, S)} / N` — the fraction of ALL
  replications whose first alert lands after onset and strictly before the saturation tick.
  A replication whose first alert is on the baseline `[m, ν)` counts against P1 (it has spent
  its alarm). Also reported: `P1c`, the same fraction among replications with no baseline alert;
  and `P1g`, P1 with abstained alerts removed (behind the gate). **Bar: a construction *sees the
  growth before the step* in a cell iff `P1 ≥ 0.50`** (the coverage matrix's powered floor,
  read on the unconditional fraction). No ship consequence.
- **P2 — lead time.** On the replications counted in P1: `lead = S − t*` in ticks; the median,
  and the **censored mean** over all replications with no baseline alert, with `lead = 0` for
  `t* ≥ S` or `t* = ∞` (an alert at or after saturation leads by nothing). Also `lead/H`. And two
  comparator readings on the latency signal: the median delay `t*_y − S` among replications where
  the latency construction alerts in `[S, T)` with no earlier alert, and the median
  **lead over the latency alarm** `t*_y − t*_x` over replications where both alerted. No bar.
- **P3 — false alerts on the baseline against the contract.** Per (construction, level, null),
  pooled over the six cells of that null (the baseline is identical in law across shapes and
  horizons): alerting replications (per-run cards, e-SR) or alerting windows (universal inference,
  `W = 4N_pool` windows) on `[m, ν)`, the rate per 1,000 baseline ticks, and the bar:
  - per-run cards at α: HELD iff alerting ≤ `floor(N_pool·α + 3·sqrt(N_pool·α·(1 − α)))`;
  - universal inference at α: HELD iff alerting windows ≤ `floor(W·α + 3·sqrt(W·α·(1 − α)))`;
  - the e-SR at α_ARL: geometric-hazard reference `E = N_pool·(1 − exp(−α_ARL·400))`; HELD iff
    alerting ≤ `floor(E + 3·sqrt(E))`.
  At oracle parameters on N1 and N3-p06 these are the constructions' certified regime, so a
  FAILED here is a **validity** finding at T1, unlike C76's corpus reading.
- **P4 — the K5 answer and this class.** Per cell: the fraction of replications on which the K5
  instrument (arm d) reads `e ≥ 20`. The reading is whether the matrix's K5 YES (`safe_t`,
  0.9995 at a 1.99σ-in-200-ticks ramp) carries to this class's shapes and horizons, and whether
  K5's "universal inference is anti-powered against ramps" carries to consecutive windows. No
  bar; the number and its agreement with §5's prediction are the deliverable.

## 4. Instrument check and NOT-EXECUTABLE

Before the grid, on seed `20260904` under N1 (`T = 3000`, `ν = 500`), the harness runs every
construction on (i) a `3σ` step at `ν` and (ii) clean data, and requires: (i) every construction
at its 0.05 level (e-SR at 10⁻³) alerts at some `t* ∈ [ν, T)`; (ii) on clean data the mixture,
universal inference and the sequential UI at 10⁻⁴ do not alert by `T`. A failure is
NOT-EXECUTABLE. Also NOT-EXECUTABLE: any exception (the harness has no catch; a throw aborts
and the partial directory is kept unscored); a non-finite e-value that is NaN or negative
(`+Infinity` is a legitimate alert, C76's lesson). No shape, horizon, level, seed, window length
or bar moves after the run.

## 5. Predictions (no authority; a wrong prediction is reported as such)

From the smoke check of 2026-09-04 on one non-registered seed (one trajectory per shape, not a
measurement) and the constructions' known delays (`knowledge/stats/pages/arl-delay-2026-09-03.md`,
`e-sr-delay-2026-09-03.md`, `k5-drift-2026-08-08.md`):

| construction (level) | P1 at the canonical cell | lead/H, linear | lead/H, exponential | lead/H, staircase | P1 at N3-p06 relative to N1 |
|---|---|---|---|---|---|
| e-SR (10⁻³) | 0.75 — the pre-onset ARL alarms (≈ 20% of runs on 400 ticks at ARL ≈ 1,800) are the whole loss | ≈ 0.9 | ≈ 0.45 | ≈ 0.75 | lower, lead ≈ 0.7H |
| mixture (0.05) | ≥ 0.90 | ≈ 0.8 | ≈ 0.4 | ≈ 0.7 | lower, lead ≈ 0.6H |
| mixture (10⁻⁴) | ≥ 0.85 | ≈ 0.7 | ≈ 0.35 | ≈ 0.6 | lower |
| universal inference (0.05) | ≈ 0.80 — per-window false alerts on four baseline windows take ≈ 18% | ≈ 0.8 | ≈ 0.4 | ≈ 0.75 | ≈ 0.7 |
| universal inference (10⁻⁴) | ≥ 0.90 | ≈ 0.7 | ≈ 0.35 | ≈ 0.7 | lower |
| sequential UI (both) | **< 0.50 in every cell**, plausibly ≈ 0 at H = 500: its one post-change mean from `m` is diluted by the 400 quiet ticks and lags the ramp; on the smoke it alerted 1,500 ticks after a 3σ step and never on a 4σ/2,000-tick ramp | — | — | — | — |

**P1 bar per detector at the canonical cell:** e-SR, mixture and universal inference HELD at
every level; the sequential UI FAILED everywhere. **Ordering of lead time:** e-SR ≥ universal
inference ≈ mixture ≫ sequential UI. **Exponential is the incident's shape and the hard one:**
lead ≈ 0.4–0.5H for every survivor, since the growth is 12% of `C` at mid-horizon.

**The gate:** the bounded monitor at α_cal 0.01 revokes on the rate signal before saturation on
≥ 0.9 of replications in every cell (it is a center test and the center moves by `g(t)`), at
about the mixture's alert tick (smoke: 911 vs 907 on the linear 2,000-tick ramp; 677 for the
e-SR). Behind the gate: the e-SR keeps ≥ 0.9 of its pre-saturation alerts, universal inference
and the mixture about half, the sequential UI none. *The architectural reading I expect:* the
'bounded' monitor used as a gate abstains the slower survivors on exactly the class whose growth
it is itself detecting.

**Latency comparator:** the K1 delay after `S` is the arl-delay/e-sr-delay floor (mixture ≈ 35
ticks at 0.05, e-SR ≈ 7 at 10⁻³, universal inference the next window end ≤ 100), so the lead
over the latency alarm is the P2 lead plus those delays.

**P3:** HELD for every construction at both nulls (certified regime, oracle parameters).

**P4, said before the run:** the K5 canonical machinery sees the linear shape at `H = 500` (a
200-tick window integrates `1.6σ` terminal, between K5R's 1σ cell at 0.59 and 2σ at 0.9995:
predicted ≈ 0.9 at N1, ≈ 0.5 at N3-p06) and **does not see it at `H = 2000`** (`0.4σ` terminal
in 200 ticks, below K5R's 0.5σ cell at 0.0525: predicted ≤ 0.05). Exponential: ≤ 0.05 at both
horizons (0.29σ and 0.04σ in the window). Staircase: ≈ 0.15 at `H = 500` (one 0.8σ step at
`ν + 100`, mean 0.4σ over the window), ≈ null rate at `H = 2000` (first step at `ν + 400`).
**So the matrix's K5 YES does not carry to the canonical cell of this class**, and the
class's answer has to come from run-length constructions, not a window. Universal inference on
consecutive windows is predicted powered (P1 ≥ 0.8 linear) where K5R measured it anti-powered
on one window: the anti-power is the fixed split's undershoot of a *within-window* ramp, and here
the between-window level dominates.

## 6. Ship rule and the amendment

**Nothing ships.** The class joins the coverage matrix only by a further numbered amendment
(`validation/coverage/PREREGISTRATION.md`, v2.K7), which this study **drafts and does not
execute**: the draft is `validation/drift-saturation/COVERAGE-AMENDMENT-DRAFT.md`, written after
the run, carrying the measured canonical and no authority. Executing it is a later registered
item.

## 7. Harness rules

Deterministic (seeded LCG; nothing reads the clock into a tracked artifact except the run
directory's name); `results/live/run-<UTC>/` refuses an existing directory; the manifest records
the engine sha and version, node, the harness, registration and report hashes, the null module's
hash, `bounded_esr` presence, the instrument check, and `exceptions: 0` (structural: no catch);
`analysis/check_report.mjs` re-renders `REPORT.md` and requires byte equality, and takes
`--expect` in C76's form so the wiki page's numbers pin to the run. The h0-battery's `nulls.mjs`
and `detectors.mjs` are imported (they do not execute on import); nothing from another study is
imported.

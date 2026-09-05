# Pre-registration — which null survives real telemetry: false alerts on NAB's labelled-quiet stretches (`2026-09-nab-null-survival`, C76)

- **Study id:** `2026-09-nab-null-survival`
- **Register:** `~/concord/knowledge/WORKLIST.md` row C76; brief in `knowledge/PROMPTS.md` §C76.
- **What it serves:** claim (1) and falsifier 1 of
  `knowledge/methodology/pages/threshold-free-observability.md` ("a useful null from complex
  metrics"), and WORKLIST C23 (the estimation boundary and its three routes), at tier T3. C75
  (`knowledge/stats/pages/nab-time-to-alert-2026-09-04.md`) found the probationary-fitted null
  fails on NAB's quiet stretches: the e-SR alerted on 20 of 23, the mixture on 14 of 23 at
  α = 0.05, and "the standardized AR(1) residual under a 15% probationary fit is not the null it
  was certified on". This study asks which construction, at which calibration length, holds its
  contract on those same stretches, whether the calibration monitor abstains where the null
  fails, and what the survivors detect.
- **Tier:** T3 on every number (real telemetry). Per protocol Amendment v1.C66 nothing here has
  verdict authority over a certification card; P1's bars are the constructions' own contracts,
  read on unlabelled real data.
- **Engine:** at this commit (`4ce20f8` on main); no detector, monitor or calibration change.
  No `.ts` file is touched.
- **Corpus:** `../NAB` at `ea702d75cc2258d9d7dd35ca8e5e2539d71f3140`; the harness refuses to
  run at any other commit.
- **Status: REGISTERED, NOT RUN.** Committed before any harness code so that the arms, bars,
  window length, predictions and the instrument check are fixed before a number is seen. A
  later change is an amendment, appended and dated.

## 1. Traces and stretches (C75's, copied not imported)

The 23 scored traces are C75's, derived by C75's rule (`validation/nab/time-to-alert/PREREGISTRATION.md`
§2: `realKnownCause` + `realAWSCloudwatch`, first labelled window whose start is at or after
the tool's probationary cut `floor(0.15·n)`), by the same code copied into this harness; the
harness refuses to run if the derived set differs from C75's 23. Per trace, `start` is the
scored window's start, `end` its end, and **the pre-window stretch is `[0, start)`**.

**Arm (a), the calibration head.** Four cuts per trace:

| arm | cut | head `[0, cut)` | quiet stretch `[cut, start)` |
|---|---|---|---|
| `tool` | `max(2, floor(0.15·n))` — C75's | the tool's probationary head | C75's labelled-quiet stretch, exactly |
| `0.15` | `max(2, floor(0.15·start))` | 15% of the pre-window stretch | the remaining 85% |
| `0.30` | `max(2, floor(0.30·start))` | 30% | 70% |
| `0.50` | `max(2, floor(0.50·start))` | 50% | 50% |

The brief's "0.15 (C75's)" is read as two things, because the tool's cut is a fraction of the
whole trace and not of the pre-window stretch, and the two differ by trace (on
`machine_temperature_system_failure` the tool's head is 3,404 ticks and 0.50 of the stretch is
1,851): the `tool` arm reproduces C75 and is the **instrument check** (§5), and the three
fraction arms give a head length that is ordered within every trace, which P4 needs. The
smallest head is 32 ticks (`iio_us-east-1_i-a2eb1cd9_NetworkIn`, start 218, at 0.15).

Calibration per (trace, arm) is the tool's: `buildPerDatasetConfig(values, 'p99_latency', p)`
with `p = (cut + 0.5)/n` so that its `n_probationary_ticks` equals `cut` (asserted); it yields
`mu`, the innovation `sigma2 = marginal·(1 − φ̂²)`, `φ̂` clamped to ±0.95, from the head alone.

## 2. Arm (b): constructions and their alert rules

Every construction starts fresh at `cut` and sees nothing before it except through the
calibration; `x_prev` for whitening is `values[cut − 1]`. **A false alert is an alert on the
quiet stretch `[cut, start)`; one per stretch for a sequential construction (the first
crossing), one per window for a terminal one.** Detection (P3) reads the same processes on
into the labelled window with C75's classes (`pre`, `in`, `late`, `none`).

| construction | driven as | level(s) | premise it carries into real data |
|---|---|---|---|
| Family A mixture | h0-battery adapter `family_A_mixture_supermartingale`, `cfg = {mu, sigma, phi, alpha}`, raw values, internal whitening | α ∈ {0.05, 0.01} per run | Gaussian sub-Gaussian(σ) innovations at the compiled `(mu, σ, φ)` |
| Family A betting | adapter `family_A_betting_e_process`, same `cfg`, once-whitened (C75's registered departure from the tool's doubly whitened path, kept) | α ∈ {0.05, 0.01} | the same, plus its clip |
| e-SR mean shift | `standardizeAr1Residual` → `evaluateESrMeanShift`, default λ grid | α_ARL = 10⁻³ | sub-Gaussian(1) standardized residual |
| safe-t | `safeTwoSampleTEValue(values, cal = {0, cut}, test = {cut + kL, L}, {ar1Phi: φ̂})` on consecutive non-overlapping windows `k = 0, 1, …`, `L = 100` (the canary length of `stats/valid-path-power-2026-09-03`) while `cut + (k+1)L ≤ n`; a window alerts iff `e ≥ 1/α` | α ∈ {0.05, 0.01} per window | AR(1) at the fitted φ̂ with unknown mean and variance (integrated out) |
| universal inference | `universalInferenceMeanShiftEValue(values, cal, test)`, the same windows | α ∈ {0.05, 0.01} per window | AR(1) with unknown mean, variance and φ (fit on the train halves) |
| sequential UI | `sequentialUiMeanShiftEProcess(values, {changeFrom: cut})` on the whole trace prefix; `logE[i]` is tick `i + 1`; alert at the first tick `≥ cut` with `E ≥ 1/α` | α ∈ {0.05, 0.01} per run | composite AR(1), one common mean under the null, predictable plug-ins |
| bounded-bet e-SR (**conditional**) | as the e-SR with `increment: 'bounded'` | α_ARL = 10⁻³ | conditionally mean-zero residual, no sub-Gaussian premise |

The bounded-bet e-SR is C77's module, not merged at this registration (engine main `4ce20f8`
has no `'bounded'` in `detectors/e-sr-mean-shift.ts`). **The arm runs iff, at run time,
`dist/detectors/e-sr-mean-shift.js` contains the token `bounded`**; otherwise the manifest
records `bounded_esr: absent` and the report and wiki page name the gap. Nothing else about
the study changes either way.

The three terminal or prefix constructions are the ones `validation/h0-battery/harness/detectors.mjs`
lists as `OUT_OF_SCOPE` (terminal e-values; an O(T²) prefix interface); this harness drives
them through their own exported functions with the windows above rather than through a
battery adapter. The window rule for the two terminal constructions is the registered
sequentialisation: a terminal e-value has `E[e] ≤ 1` per window, so `P(e ≥ 1/α) ≤ α` per
window, and the false-alert contract is per window, not per stretch.

## 3. Arm (c): the calibration monitor as a gate

On each (trace, arm) the standardized residual `r_t = standardizeAr1Residual(values[t],
values[t−1], mu, sigma, φ̂)` (the e-SR's input, the same fit) is fed from `cut` to two
monitors, `freshCalibrationMonitor({alpha: 0.01, incrementKind: 'gaussian'})` and
`{…, incrementKind: 'bounded'}` (`fleet/calibration-monitor.ts`; α_cal = 0.01 is its default;
'gaussian' tests the sub-Gaussian(1) premise the mixture, betting and e-SR carry, 'bounded'
the clipped linear bets' weaker one). **The revocation tick is the first quiet tick at which
the monitor's `passing` becomes false**; a monitor still passing at `start` has not revoked.
For every false alert at `t*` the gate reading is: **abstained** iff the monitor of that kind
revoked at or before `t*`; **counted** otherwise. The gate is read for every construction,
and named as the architectural answer only for the three whose premise the 'gaussian' kind
tests.

## 4. Endpoints

All T3. `Q_i` is trace i's quiet ticks in an arm, `W` the number of quiet windows (terminal
constructions) in an arm.

- **P1 — false alerts against the contract, per (construction, level, arm).** Reported:
  the count of alerting stretches (or windows), the rate per 1,000 quiet ticks, and the same
  after the gate (counted only). **Bars, registered:**
  - per-run Ville cards (mixture, betting, sequential UI) at α: the contract is
    `P(alert on a null stretch) ≤ α`; **HELD iff alerting stretches ≤ floor(23α + 3·√(23α(1−α)))**,
    i.e. ≤ 4 at α = 0.05 and ≤ 1 at α = 0.01;
  - terminal cards (safe-t, universal inference) at α: **HELD iff alerting windows
    ≤ floor(Wα + 3·√(Wα(1−α)))**;
  - the e-SR (and the bounded e-SR): the contract `E∞[N] ≥ 1/α_ARL` bounds no stretch count
    exactly; the registered reference is the geometric-hazard reading at rate α_ARL,
    `E = Σ_i (1 − exp(−α_ARL·Q_i))`, **HELD iff alerting stretches ≤ floor(E + 3·√E)**.
  **A construction clears P1 in an arm iff it is HELD at every one of its levels in that arm.**
  The bars are read on unlabelled real data; a FAILED is "the contract does not describe this
  corpus at this calibration", not a certification verdict.
- **P2 — the monitor as a gate.** Per (kind, arm): the revocation rate (revoked stretches of
  23) and the median revocation tick after the cut. Per (construction, level, arm) among the
  stretches with a false alert: the fraction on which the 'gaussian' monitor revoked at or
  before the alert, and the same for 'bounded'. **The architectural question is whether that
  fraction is ≥ 0.5 for the three Gaussian-premise constructions**; no bar, the number is
  the deliverable.
- **P3 — detection retained.** For every construction and level, in every arm: C75's
  `pre / in / late / none` and the by-end count (`pre ∪ in`), where for a terminal
  construction the alert is the first alerting window's start and `pre` means that window
  lies inside the quiet stretch. **The survivors' power is P3 for the constructions that clear
  P1 in at least one arm**, reported at each arm they clear.
- **P4 — the estimation price.** Per (construction, level): the P1 rate at arms 0.15, 0.30,
  0.50, and whether it is monotone non-increasing in the head length. Reported; no bar.

## 5. Instrument check and NOT-EXECUTABLE

- **Reproduction of C75 (the `tool` arm):** the mixture at α = 0.05 must alert on exactly 14
  quiet stretches, the betting card at α = 0.05 on exactly 11, and the e-SR on exactly 20, as
  C75's `cells.json` records (`n_pre`). A mismatch is NOT-EXECUTABLE.
- `../NAB` not at the registered commit; the derived trace set differs from C75's 23; any
  exception (the harness has no catch; a throw aborts and the partial directory is kept
  unscored).
- No arm, bar, window length, level or trace moves after the run.

## 6. Predictions (no authority)

- **Survivors at 0.50:** safe-t, universal inference and the sequential UI clear P1 at both
  levels. **At 0.15:** safe-t and universal inference clear; the sequential UI probably
  clears (its plug-ins are refit on the whole prefix and the head only seeds the null mean).
  **The mixture, the betting card and the e-SR clear P1 in no arm**: C75's counts (14, 11 and
  20 of 23 at the tool's cut) are far above the bars (4 and 1; the e-SR's reference `E` is
  about 12 at the tool's cut), and the synthetic estimation price is 1.002 at m = 500
  (`stats/detector-audit-sequential-2026-08-05`), so what fails on these stretches is the
  stationarity of the reference law, which a longer head does not buy. P4: their rates fall
  from 0.15 to 0.50 by less than half and stay above the contract. If the bounded e-SR is
  present it fails too: its increment survives tails and scale error, not level drift.
- **The gate:** the 'gaussian' monitor revokes on 15–20 of 23 stretches at 0.15 and precedes
  the mixture's and the e-SR's false alert on ≥ 70% of the stretches where one happens; the
  'bounded' kind revokes on half as many. So the architectural answer is predicted yes for the
  Gaussian-premise cards: the gate abstains where their null fails, at the cost of abstaining
  on most of the corpus.
- **The survivors' power (P3):** low. The events are 0.47 marginal σ at the median and mostly
  not level shifts (C75): safe-t by-end on 5–10 of 23 at α = 0.05, universal inference on 3–6,
  the sequential UI on 4–8; strict in-window fewer.

## 7. Ship rule

Nothing ships. The deliverable is the survivor set and its power, written into the thesis
page's claim (1) and falsifier 1 state and into C23. **If no construction clears P1 in any
arm while detecting anything (P3 by-end ≥ 1 at a level that clears), the thesis page says so
and its confidence is set from that**; the claim is not softened.

## 8. Harness rules

Deterministic (no randomness; nothing reads the clock into a tracked artifact except the run
directory's name); `results/live/run-<UTC>/` refuses an existing directory; the manifest
records the engine sha, the NAB sha, sha256 of the label files and every scored CSV, the
harness and registration hashes, the `bounded_esr` presence, and the per-(trace, arm)
calibration; `analysis/check_report.mjs` re-renders `REPORT.md` and requires byte equality,
and takes `--expect` in C75's form so the wiki page's numbers pin to the run. Copy, do not
import, C75's enumeration and scoring: its harness executes on import.

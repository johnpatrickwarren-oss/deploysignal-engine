# Pre-registration — time-to-alert against a labelled event on a real trace: the NAB corpus (`2026-09-nab-time-to-alert`, C75)

- **Study id:** `2026-09-nab-time-to-alert`
- **Register:** `~/concord/knowledge/WORKLIST.md` row C75; brief in `knowledge/PROMPTS.md` §C75.
- **What it serves:** claim 6 and falsifier 2 of `knowledge/methodology/pages/threshold-free-observability.md`
  ("time-to-alert is not earlier than impact"). The two endpoints and their T-censored
  definitions are those of `knowledge/stats/pages/arl-delay-2026-09-03.md` (protocol Amendment
  v1.C66: ARL₀ and delay are REPORTED endpoints with no verdict authority). The synthetic
  floors it is read against: mixture 35.5 ticks and e-SR 7.0 ticks after a +1.5σ onset on
  iid oracle data (`stats/arl-delay-2026-09-03`, `stats/e-sr-delay-2026-09-03`).
- **What it does not touch:** the 2026-07-17 and 2026-08-18 NAB-score runs in
  `validation/nab/README.md` (the families fail NAB's own floors; that finding stands). This
  study scores time-to-alert against the labelled windows, not the Lavin–Ahmad score.
- **Tier:** T3 for every number — real telemetry, the traces that score. The write-up carries
  the tier label on every number.
- **Engine:** at this commit (`eb60e63` on main); no detector or calibration change.
- **Corpus:** `../NAB` at `ea702d7` (github.com/numenta/NAB), verified present at that commit
  before this file was written; the harness refuses to run at any other commit.
- **Status: REGISTERED, NOT RUN.** Committed before any harness code so that the scoring rule,
  the trace set, the alert definition and the falsifier reading are fixed before a number is
  seen. A later change is an amendment, appended and dated.

## 1. The system, from code

The tool `tools/run-nab-per-dataset.ts` calibrates each trace on its probationary head:
`nProbationary = max(2, floor(0.15·n))`, `mu = mean(head)`, `iidSigma2 = sampleVariance(head)`,
`phi = ar1Phi(head)` clamped to ±0.95, and under the default flags (`usePrewhitening = true`,
`useHacInflation = false`, no AR(p), no seasonal) the stamped variance is the innovation
variance `sigma2 = iidSigma2·(1 − phi²)` (`tools/nab-per-dataset/_nab-per-dataset-config.ts`,
`computeCalibrationStats`; the flags in `resolveBuildFlags`). The compiled per-signal params
carry `baseline_mean = mu`, `baseline_sigma_squared = sigma2`, `ar1_phi = phi`, and the mixture
params `{ gaussian, gaussian_sigma_squared_prior: sigma2 }` (`buildFamilyAPerSignal`).

How the tool drives the two Family A cards differs, and it matters for a delay measurement:

- the mixture path feeds raw values with `sigma_squared = sigma2` and `ar1_phi = phi`, and the
  detector whitens internally (`tools/_nab-validation-dispatch.ts`,
  `runMixtureSupermartingaleOverDataset`);
- the betting path pre-whitens the series externally (`prewhitenFamilyAInput` →
  `prewhitenSeries(values, phi, mean)`) **and** stamps `ar1_phi = phi`, which
  `updateBettingState` applies again (`detectors/betting-e-process.ts:180`,
  `xWhitened = xCentered − ar1Phi·prevCentered`). On that path the betting card sees a doubly
  whitened input. This is recorded as an observation about the tool, not measured here.

Both paths then apply a fire cooldown of 1,000 ticks and anomaly-likelihood smoothing
(`family_a_cooldown_ticks`, `smoothing`) before NAB scoring. Those are post-processing for the
NAB score, not calibration.

The e-SR (`detectors/e-sr-mean-shift.ts`, ADR 0029) consumes a standardized AR(1) residual
`standardizeAr1Residual(x, x_prev, mu, sigma, phi)` and alarms when its SR statistic reaches
`1/alpha_arl` (default `E_SR_DEFAULT_ALPHA_ARL = 1e-3`); `onset_estimate` is the reset tick of
the winning λ.

## 2. The scoring rule for windows as onsets

NAB labels are anomaly **windows** (`labels/combined_windows.json`), each centred on a point
label (`labels/combined_labels.json`), and its anomalies are not all level shifts. The rule:

1. **Sub-benchmarks:** `realKnownCause` and `realAWSCloudwatch` only.
2. **Probationary period** per trace: `nProbationary` as the tool computes it. Detectors
   are fed nothing before it: each starts from a fresh state at tick `nProbationary` with its
   calibration frozen from `[0, nProbationary)`, and `x_prev` for the whitening is
   `values[nProbationary − 1]`. So "the first crossing after the probationary period" is the
   first crossing of a process that begins there.
3. **A trace scores iff** it has at least one labelled window whose start index is
   `≥ nProbationary`. **The onset is the start of the first such window; the customer-visible
   event is that window `[start, end]`** (indices from `annotationsFromLabels`). Later windows
   are not scored: every detector here alarms once and is not reset.
4. **The point label** inside the scored window is the reference for the secondary delay
   (P2b); it is where NAB's annotator put the anomaly, and the window starts before it by
   construction (NAB windows are centred on the label).
5. **The labelled-quiet stretch** is `[nProbationary, start)`; it is not a certified null — it
   is unlabelled real data — and P3 says so.
6. **An alert** is the first tick `t* ≥ nProbationary` at which the detector fires (per
   detector, per α). `D = t* − start` in ticks; the trace's cadence converts it to hours.
7. **Classes** per (trace, detector, α): `pre` (`t* < start`), `in` (`start ≤ t* ≤ end`),
   `late` (`t* > end`), `none` (no alert by the trace's last tick).

**The scored traces, enumerated from the labels at `ea702d7` so the rule is checkable**
(index of window start / end / point label; `nProbationary`):

| trace | n | cadence | nProb | scored window | point |
|---|---|---|---|---|---|
| realKnownCause/ambient_temperature_system_failure | 7,267 | 60 min | 1,090 | 3,540–3,902 | 3,721 |
| realKnownCause/cpu_utilization_asg_misconfiguration | 18,050 | 5 min | 2,707 | 16,551–18,049 | 17,002 |
| realKnownCause/ec2_request_latency_system_failure | 4,032 | 5 min | 604 | 2,014–2,148 | 2,081 |
| realKnownCause/machine_temperature_system_failure | 22,695 | 5 min | 3,404 | 3,703–4,269 (its first window, 2,126–2,692, starts inside probation) | 3,986 |
| realKnownCause/nyc_taxi | 10,320 | 30 min | 1,548 | 5,839–6,045 | 5,942 |
| realKnownCause/rogue_agent_key_hold | 1,882 | 5 min | 282 | 669–763 | 716 |
| realKnownCause/rogue_agent_key_updown | 5,315 | 5 min | 797 | 2,243–2,507 | 2,375 |
| realAWSCloudwatch/ec2_cpu_utilization_24ae8d | 4,032 | 5 min | 604 | 3,447–3,647 | 3,547 |
| realAWSCloudwatch/ec2_cpu_utilization_53ea38 | 4,032 | 5 min | 604 | 1,396–1,596 | 1,496 |
| realAWSCloudwatch/ec2_cpu_utilization_5f5533 | 4,032 | 5 min | 604 | 1,171–1,371 | 1,271 |
| realAWSCloudwatch/ec2_cpu_utilization_77c1ca | 4,032 | 5 min | 604 | 1,765–2,167 | 1,966 |
| realAWSCloudwatch/ec2_cpu_utilization_825cc2 | 4,032 | 5 min | 604 | 1,526–1,868 | 1,626 |
| realAWSCloudwatch/ec2_cpu_utilization_ac20cd | 4,032 | 5 min | 604 | 3,374–3,776 | 3,575 |
| realAWSCloudwatch/ec2_cpu_utilization_fe7f93 | 4,032 | 5 min | 604 | 698–832 | 765 |
| realAWSCloudwatch/ec2_disk_write_bytes_1ef3de | 4,730 | 5 min | 709 | 2,399–2,871 | 2,635 |
| realAWSCloudwatch/ec2_disk_write_bytes_c0d644 | 4,032 | 5 min | 604 | 1,794–1,928 | 1,861 |
| realAWSCloudwatch/ec2_network_in_257a54 | 4,032 | 5 min | 604 | 1,437–1,839 | 1,638 |
| realAWSCloudwatch/ec2_network_in_5abac7 | 4,730 | 5 min | 709 | 2,490–2,726 | 2,608 |
| realAWSCloudwatch/elb_request_count_8c0756 | 4,032 | 5 min | 604 | 683–883 | 783 |
| realAWSCloudwatch/grok_asg_anomaly | 4,621 | 5 min | 693 | 1,177–1,331 | 1,254 |
| realAWSCloudwatch/iio_us-east-1_i-a2eb1cd9_NetworkIn | 1,243 | 5 min | 186 | 218–280 | 206 (before the window start; NAB's own label) |
| realAWSCloudwatch/rds_cpu_utilization_cc0c53 | 4,032 | 5 min | 604 | 2,980–3,180 | 3,080 |
| realAWSCloudwatch/rds_cpu_utilization_e47b3b | 4,032 | 5 min | 604 | 846–1,046 | 946 |

**N = 23 scored traces.** Excluded: `realAWSCloudwatch/ec2_cpu_utilization_c6585a` (no window).
The harness derives this set from the label file by rule 3 and refuses to run if the derived
set differs from this table (NOT-EXECUTABLE).

## 3. Detectors, calibration, α

Per trace, `buildPerDatasetConfig(values, 'p99_latency', 0.15)` with no options gives
`(mu, sigma2, phi)`; `sigma = √sigma2`. No tuning. Three detectors:

- **Family A mixture** — the h0-battery adapter (`validation/h0-battery/harness/detectors.mjs`,
  `family_A_mixture_supermartingale`) with `cfg = { mu, sigma, phi, alpha }`: raw values,
  internal whitening, `sigma_squared = sigma2` — the same inputs the tool's mixture path
  stamps.
- **Family A betting** — the same adapter family (`family_A_betting_e_process`) with the same
  `cfg`: raw values, internal whitening once. This departs from the tool's own betting path,
  which whitens twice (§1); the study drives the card the way `2026-09-arl-delay` did, so the
  synthetic floor is comparable. The departure is registered here, not discovered after.
- **e-SR mean shift** — `standardizeAr1Residual(x, x_prev, mu, sigma, phi)` into
  `evaluateESrMeanShift(r, { alpha_arl: 1e-3 }, state)` on the default λ grid, as
  `validation/e-sr-mean-shift/harness/run.mjs` drives it.

α for the two Ville cards: **0.05 and 0.01 scored**; the compiled config's own level
`alpha_budget.per_family.A / bonferroni_factor = 0.0004 / 6 ≈ 6.7e-5` (the tool's mixture
level) run as descriptive. The e-SR runs at `alpha_arl = 1e-3` only (a run-length level, not a
per-run level; read its P3 beside its P2, as `stats/e-sr-delay-2026-09-03` does).

No smoothing, no cooldown: the first raw crossing is the alert.

## 4. Endpoints

All numbers are T3 and, per Amendment v1.C66, carry no verdict authority. The one thing with a
registered reading is the falsifier.

- **P1 — detection, per detector and α.** Two readings, both reported:
  `P1_strict = #in / N` and `P1_by_end = #(pre ∪ in) / N` (first alert at or before the
  window's end). **The falsifier reading, exactly:** falsifier 2 of the thesis page **fires for
  a detector at α iff `#(late ∪ none) > N/2`**, that is, the first alert falls after the
  labelled window's end (or never comes) on a majority of the 23 scored traces. It is evaluated
  for each of the three detectors at each scored level (mixture and betting at 0.05 and 0.01;
  e-SR at α_ARL = 10⁻³); the thesis page's falsifier-2 state records the result per detector.
- **P2 — delay from the window start, per detector and α (reported).** Over traces with
  `t* ≥ start`: the median of `D` on `in` traces and the mean of `D` censored at
  `end − start` over `in ∪ late ∪ none`; in ticks and in hours. Read against the synthetic
  floor (mixture 35.5 ticks, betting 41.8, e-SR 7.0 at +1.5σ on iid data): the floor is
  what a 1.5σ step costs on a clean null; a real event that is far larger than 1.5σ can be
  faster and a real event that is not a level shift can be slower, so no bar is registered.
  **P2b (reported):** the same on `t* − point`, signed, so an alert before NAB's own label
  reads negative.
- **P3 — false alerts on the labelled-quiet stretch, per detector and α (reported).**
  `#pre / N` and `1,000·#pre / Σ quiet ticks`. Reference lines: `1,000·α_ARL = 1` per 1,000
  ticks for the e-SR (its ARL contract), and α for the Ville cards' per-trace `#pre / N`
  (Ville on a true null). The quiet stretch is unlabelled real data, not a null, so a value
  above the line is not a validity failure; it is the false-alert cost on this corpus.
- **P4 — the e-SR's onset estimate (reported).** At its first alert on each scored trace:
  `onset_estimate − start` in ticks, its median and median absolute value, and the fraction of
  estimates inside the window.

Reported alongside: per-trace `phi`, `sigma`, the whitened scale of the window's mean shift
`(mean(values[start..end]) − mu)·(1 − phi)/sigma` (how large the event is to a whitened
detector, the C69 effect), and the per-trace table of `t*` and class for every detector and α.

## 5. Predictions (no authority) and what voids the instrument

- The falsifier does not fire for the mixture or betting at α = 0.05 (a majority of the 23
  alert by the window's end), but a large share of those alerts are `pre`: φ̂ ≈ 0.95 on most
  of these traces whitens a level shift to a twentieth of its size while unlabelled structure
  on the quiet stretch keeps its full size to a wealth process. e-SR at α_ARL = 10⁻³: fires on
  the quiet stretch on most traces (ARL 1,000 against quiet stretches of 500–13,000 ticks).
- **NOT-EXECUTABLE:** `../NAB` not at `ea702d7`; the derived trace set differs from §2's
  table; fewer than 20 traces score; any exception (the harness has no catch; a throw aborts
  and the partial directory is kept unscored).
- No rule, class, α, floor or trace moves after the run.

## 6. Harness rules

Deterministic (no randomness anywhere; nothing reads the clock into a tracked artifact except
the run directory's name); `results/live/run-<UTC>/` refuses an existing directory; the
manifest records the engine sha, the NAB sha, sha256 of both label files and of every scored
CSV, the harness and registration hashes, and the compiled-config numbers per trace;
`analysis/check_report.mjs` re-renders `REPORT.md` and requires byte equality, and takes an
`--expect` file in the `arl-delay` form so the wiki page's numbers pin to the run.

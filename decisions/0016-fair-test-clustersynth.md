# ADR 0016 — the FAIR test: detection & localization on the realistic clustersynth substrate

- **Date:** 2026-06-25
- **Status:** **Validation findings.** The decisive experiment the thesis verdict was gated on, run against the
  realistic clustersynth harness driving the actual engine pipeline. Corrects the buggy intermediate runs
  (see "Methodological correction"). No engine code change; identifies one new engine gap (item 6).
- **Builds on:** ADR 0008/0014 (common-mode + rank), ADR 0010 (UI e-value), ADR 0012 (the real-telemetry
  wall), ADR 0015 (flat vs partitioned e-BH). Resolves the localization branch left open in
  `THESIS-VERDICT-2026-06-25.md`.

## Setup

clustersynth (commit 89da1a7) is now a full adversarial harness: per-GPU time-series (5 counters),
**heterogeneous ±40% loadings**, **nonstationary** AR(1) common-mode (φ=0.7 + thermal ramp / diurnal /
regime step), **iid** idiosyncratic noise, constant per-shard baseline, topology-anchored factors
(CDU/feed/fabric/job), 4 fault types × 3 levels (gpu/cdu/pod) with full ground-truth labels. Driven through
the real engine: `multiFactorRobustResiduals` → `universalInferenceMeanShiftEValue` → `eBenjaminiHochberg`
(+ `distributionalSignature`). 1 pod = 720 GPU; scaled to 14,400 (20 pods).

## Substrate caveat (load-bearing for interpretation)

clustersynth's nonstationarity lives **entirely in the shared AR(1) factors**; idiosyncratic noise is **iid**
and the per-shard baseline is **constant**. So its within-window nonstationarity is **removable common-mode**
— there is **no irreducible per-shard nonstationarity** like real GWDG (ADR 0012). Consequence: clustersynth
is **benign on the per-shard-validity axis** (validity holds here, see finding 1) and therefore tests
**detection / localization / common-mode estimation / scale** — it does **not** and **cannot** re-test the
real-telemetry validity wall (ADR 0012 already settled that: per-shard `E[e|H0] ≤ 1` fails on real data).

## Methodological correction (honesty — a bug was caught and fixed)

Initial runs reported ~0% detection for *all* methods. A keystone test exposed the cause: a clean +4σ step
against *white noise* (φ=0) gave UI e ≈ 1e-65 — implausible. The UI requires the shift **aligned to the
cal/test boundary** (cal = before, test = *uniformly* after); it estimates the test mean from the test-window
*train half*. The faults onset in the *middle* of the test window, so the train half was mostly pre-shift, μ_t
≈ 0, and scoring the shifted eval half against μ_t≈0 made the alternative fit *worse* than the null → e→0. All
detection numbers were re-run with **aligned windows** (cal = early healthy, test = late, fault active in
test). The corrected results below are internally consistent (oracle → 100%, monotone behavior).

## Findings (corrected)

**1. Per-shard validity HOLDS on clustersynth** (H0 UI e-mean 0.1–0.3 ≤ 1) — as predicted, because its
nonstationarity is removable common-mode. (Trivial corollary, and a reminder this substrate does not test the
real-data wall.)

**2. UI power vs background autocorrelation (aligned, +4σ step):** 100% fire at φ≤0.3, 75% at φ=0.6, 53% at
φ=0.8, **8% at φ=0.9**, ~5% at φ=0.99 — H0 e stays ≤1 throughout. Quantifies ADR 0010's documented limit:
*valid for any φ, but power collapses against high-φ (nonstationary) backgrounds.* The validity↔power tradeoff
is real and steep above φ≈0.8.

**3. Detection & localization are ACHIEVABLE in principle.** With an **oracle** common-mode (subtract the
*true* factor×loading), residuals are clean iid (residφ=0.00), the fault is perfectly preserved, and the
pipeline gives **99–100% detection at 0% FPR even for a 3°C (small) fault** (per-rack e-BH, 6 seeds). The UI +
e-BH + topology-partitioning machinery *works*. Localization is not fundamentally dead.

**4. The binding constraint is common-mode ESTIMATION — and the engine's current estimator is wrong for
detection.** Same fault, aligned windows, per-rack e-BH, δ=6°C, 6 seeds:

| common-mode | residual shift (absorption) | detection | FPR |
|---|---|---|---|
| **mf-full** (ADR 0008, full-series loading) | **~0.5 (absorbed)** | **0%** | 0% |
| mf-calLoad (cal-only loading) | ~6 (preserved) | 16% | 8.3% |
| **oracle** (true common-mode) | =δ (preserved) | **99%** | 0% |

The ADR 0008 multi-factor common-mode fits loadings on the **full series**, so a persistent single-shard fault
is **absorbed into that shard's loading** (worse for larger faults — δ=48°C still ~10%, median victim e → 1e-6).
It was designed for **FDP control**, and for that the absorption is an acceptable "power cost"; for
**detection/localization it is catastrophic (0%)**. Cal-only loading preserves the fault but leaves
heterogeneous-loading *leakage* of the nonstationary factor → only ~16–20% detection and degraded FDP (8% FPR).
The gap from 16% to 99% is **entirely common-mode estimation leakage**.

**5. Scale & partitioning.** The UI e-value is bounded (~800, ADR 0010), so flat e-BH at fleet scale needs
`e ≥ N/q` — unreachable at N=720 (threshold 7200) for sparse faults. **Topology partitioning** (per-rack e-BH,
threshold n/q=720) restores firing — and works perfectly under the oracle — but gives only **per-group FDP, no
global guarantee** (consistent with ADR 0015 v2; the two-level *guarantee* remains broken).

## Verdict

- **Detection & localization are achievable** given good common-mode estimation (oracle: 99–100% at 0% FPR,
  small faults). The detector, e-BH, and topology-partitioning are sound. **Localization is NOT dead.**
- **The bottleneck is common-mode estimation, and the engine lacks a detection-oriented estimator.** ADR 0008
  full-loading **absorbs** single-shard faults (0% localization). This is a concrete, new engine gap →
  **frontier item 6: a detection-oriented common-mode** (cal-only / fault-robust loading, or better factor
  estimation toward the oracle). The FDP-oriented and detection-oriented common-modes are *different objects*.
- **Two ceilings remain:** (a) **on real telemetry**, ADR 0012's irreducible per-shard nonstationarity caps
  what *any* common-mode estimator can recover — clustersynth (removable nonstationarity) cannot measure this
  ceiling, so the oracle's 100% is an upper bound that real data will not reach; (b) **high-φ backgrounds**
  collapse UI power (finding 2) regardless of estimation.

## Carry-forward

- **Item 6 (new, highest-value for localization):** a detection-oriented common-mode that does not absorb
  single-shard faults. Target the oracle gap (16% → toward 99%). Needs its own cold-eye + a real-telemetry
  check (the oracle is unavailable there).
- The honest thesis position is updated in `THESIS-VERDICT-2026-06-25.md`: detection/ranking ALIVE and, with a
  proper common-mode, *strong* on coherent fleets; localization achievable-in-principle but bottlenecked by
  common-mode estimation and capped on real data by ADR 0012; the *provable* guarantee still open.
- Harnesses: `scratchpad/fair{1..12}.mjs` (fair9b = aligned keystone; fair10/11/12 = corrected core; fair11 =
  oracle ceiling). Note fair1–8 used the misaligned window and are superseded by the aligned re-runs.

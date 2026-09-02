# ADR 0027 — The log-domain evidence surface, e-BH margins, and a live validity metric

- **Date:** 2026-09-02
- **Status:** implemented (`types/verdict-extensions/evidence-surface.ts`, `types/verdict.ts`,
  `detectors/_evidence.ts`, `detectors/betting-e-process.ts`, `detectors/_hotelling-safe.ts`,
  `detectors/spectral.ts`, `detectors/family-c-betting-e-process.ts`,
  `detectors/family-a-mixture-supermartingale.ts`, `detectors/_page-cusum-mixture.ts`,
  `types/families/{a,c,d}.ts`, `fleet/e-bh.ts`, `fleet/calibration-monitor.ts`,
  `detectors/mixture-confidence-sequence.ts`; study `validation/mixture-cs/`)
- **Builds on:** ADR 0026 (log-domain wealth is the single source of truth; this ADR only reads
  it), Tessera ADR 0019 follow-up #2 and ADR 0027 (the runtime calibration monitor, ported here).
- **Driven by:** the operator's question of 2026-09-01 — how testing-by-betting can provide
  metrics insight across the engine and its consumers — answered from code and checked against
  seven papers in `knowledge/stats/raw/`: `knowledge/stats/pages/e-betting-metrics-2026-09-02.md`.
  Every literature claim below is cited there by section and page; this ADR does not repeat the
  argument, it records the decision.

## Problem

The engine keeps every multiplicative detector's wealth in the log domain (ADR 0026) and never
emits it. A consumer sees linear `statistic` and `threshold`, and DeploySignal renders their
ratio as "progress" — which, against a shipped Family A threshold sitting at a median 2.4×10⁴
times `1/α` (`knowledge/stats/ville-guarantee-is-empirical`), reads near zero until the tick it
fires. The fleet layer returns `{selected, K}` from e-BH and nothing about how far any shard sat
from selection. The wiki's derived quantities — growth rate, fire-time arithmetic, the anytime
p-value `1/max M` — exist only on pages. And the one live validity instrument in `~/concord`,
Tessera's calibration monitor, is Tessera-local, so no other consumer can ask "is this increment
still an e-value right now".

## Decision

Four additive changes, none of which alters a verdict, a statistic, a threshold, or any wealth
book. All are read from state the detectors already hold.

1. **`DetectorVerdict.evidence?: EvidenceSurface`** (amendment 8 of the vendored type). Emitted by
   the five per-tick wealth detectors: Family A betting, Family A mixture, safe-Hotelling, the
   Family D spectral e-detector, and the Family C betting e-process. Fields: `log_wealth`,
   `log_increment` (realized, `null` when the tick did not advance the wealth), `bet` (`null` for
   mixtures and likelihood ratios), `n`, `log_threshold`, `threshold_kind`
   (`ville | bootstrap | priced`), `nats_to_threshold`, `growth_rate_hat` (`log_wealth / n`,
   `null` at n = 0), `log_peak_wealth`, `anytime_p = min(1, exp(−log_peak_wealth))`. Detector
   states gain an optional running-max field (`log_peak_M` / `log_peak_S_t`), healed on read like
   ADR 0026's `log_M`. The mixture additionally records its UNCAPPED log (`log_M_t`): the linear
   `M_t` view is capped at 120 nats for exp safety and stays byte-identical; the exact log now
   survives past the cap. The single-shot e-values (safe-t, universal inference) and the batch
   wealth modules (spectral-bet, shape-block, shape-ecdf) are out of scope: the former return a
   bare number and have no wealth, bet or tick; the latter already expose their full log
   trajectory.

2. **`EBenjaminiHochbergOutput.log_threshold_e` and `log_margin`** on both e-BH variants. The
   threshold `log(N/(q·max(K,1)))` separates the selected set exactly (proof in the field's
   docstring; test `e-bh-margin.test.ts` checks the sign reproduces the selection on 200 random
   snapshots). A zero e-value's margin is floored at `−LOG_MAX_WEALTH`, never `−Infinity`.

3. **`fleet/calibration-monitor.ts`** — Tessera's runtime calibration monitor, ported with its
   constants and its own tests (increment kinds `bounded` and `gaussian`, the per-λ capital
   average for the bounded kind, sticky revocation at `1/α_cal`), made contract-agnostic; plus the
   **increment estimator** (`E[exp(Δ log M)]` with a normal-theory interval) as a REPORTED
   instrument with no verdict authority — the C39 pattern. `refutedAboveOne` is the only claim it
   makes; a reading at or below 1 establishes nothing.

4. **A confidence-sequence inversion of the mixture** (`detectors/mixture-confidence-sequence.ts`)
   under a pre-registered study (`validation/mixture-cs/`). Not wired into any verdict until the
   study's registered endpoints are scored — see that directory.

## The validity boundary, restated where the fields are

A wealth process is evidence only where its increment satisfies `E[e_t | F_{t−1}] ≤ 1` under the
reference law it was compiled against (`knowledge/stats/validity-premise-chain`). In the shipped
estimated-baseline regime the Family A plug-in detectors are recorded at `E[e|H₀] → ~1e8`
(`detectors/validity-envelope.ts`). On those paths the surface is the detector's bookkeeping, not
evidence against the null. The consumer owns the envelope check (`fleet/e-bh-guarded.ts`), and
`threshold_kind` exists so a nats reading is never mistaken for a distance to Ville's `1/α`.

Two readings are certified regardless of threshold, given a valid increment: `anytime_p` is an
anytime-valid p-value (Ramdas 2023 §2.7; the running max is NOT an e-value, §2.4, and is never
merged as one here), and `growth_rate_hat` estimates `μ = E[log e_t]`, with fire time
`≈ log(1/α)/μ` under the alternative (Grünwald 2024 §6).

## What changes numerically, and what does not

- No verdict, statistic, threshold, fire tick, α accounting, or wealth book changes. The betting
  and safe-Hotelling books are asserted byte-identical to the pre-0027 arithmetic in-test; the
  mixture's linear `M_t` is asserted equal to the capped closed form.
- State objects gain optional fields (`log_peak_M`, `log_peak_S_t`, `log_M_t`). A fresh state
  carries them; a persisted pre-0027 snapshot heals on its next update. A NaN tick that mutates
  nothing still mutates nothing (the ADR 0026 test is unchanged and passes).
- The audit projection in DeploySignal (`DetectorTripV2`) selects fields explicitly, so nothing
  reaches the JSONL until that consumer opts in. The surface is JSON-safe by construction:
  saturation is finite, the only nulls are the documented nullable fields.

## Out of scope, with reasons

- **Wiring the increment estimator or the monitor onto a shipping path.** Both need a stream of
  believed-null residuals; choosing one is the consumer's decision (a control cohort in Tessera
  Mode B; nothing equivalent exists in DeploySignal). The engine ships the instruments.
- **A betting confidence sequence.** Waudby-Smith–Ramdas's hedged capital CS (Theorem 3) needs
  a bounded observation family; the engine's residual is bounded only by ±3σ truncation, so the
  interval would cover the truncated mean. The mixture inversion is closed form and needs no new
  bet; it is the registered route.
- **Closed / donation e-BH** (post-hoc subset FDP bounds, Theorem 44 of arXiv:2509.02517). A
  different procedure, not a field on this one.

## Acceptance criteria

- AC-1 the surface is a function of the existing books; fire ⇔ `nats_to_threshold ≤ 0`.
- AC-2 `anytime_p` is non-increasing and ≤ 1.
- AC-3 `threshold_kind` names the shipped substitution; `null` without a threshold.
- AC-4 a held (NaN) tick reports `log_increment: null` and mutates nothing.
- AC-5 the mixture's exact log survives the 120-nat cap; the linear view is unchanged.
- AC-6 JSON-safe on a fresh state and at saturation.
- AC-7 pre-0027 snapshots heal.
- AC-8 wealth books byte-identical to the pre-0027 arithmetic.
- e-BH: margin sign reproduces the selection; zero e-value floored; log and linear variants agree.
- Monitor: the ported Tessera tests pass unchanged in substance; the estimator refutes a 5%
  inflated increment and does not claim validity from a reading at 1.

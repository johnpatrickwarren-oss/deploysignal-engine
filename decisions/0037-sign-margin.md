# ADR 0037 — A margin in the twin's `sign` kind: the smallest persistent direction that counts as worse

- **Date:** 2026-09-29
- **Status:** PROPOSED. Library only; no consumer authority. Study `2026-10-twin-sign-margin` (T1)
  registered at `validation/twin-sign-margin/PREREGISTRATION.md`, not run.
- **Register:** ADR 0036 (the randomized twin); DeploySignal study `2026-10-twin-aa-real`
  (`studies/twin-aa-real/REPORT.md`, AA cell, 2026-09-29); DeploySignal study
  `2026-09-mini-twin-aa`; knowledge `stats/twin-aa-real-2026-09-29`, `stats/mini-twin-aa-2026-09-29`.

## The gap, measured

ADR 0036's `sign` kind scores a tick as "canary worse" whenever the canary's value is on the worse
side of the control's, by any amount (`detectors/twin-contrast.ts`, `x: worse ? 1 : 0`, rollback
null ½). Its rollback validity rests on exchangeable arms: no arm-level effect on any tick.

On a real ALB service (DeploySignal `2026-10-twin-aa-real`, 44 executable A/A runs, two Fargate
tasks per arm on one image and task definition, per-request weighted routing) that premise held
for the 5xx `rate` metric (no fire in 44 runs, both arms' rates 0.0050 to four decimals) and
failed for CloudWatch p99 latency: 12 of 44 runs rolled back (0.2727 against a bar of 0.1062), all
on `twin_sign_p99_latency`, at a median of 14 ticks. Fresh task pairs differ by 0.01–2 ms at a p99
of about 1 ms, in a direction fixed for the length of a run; in 10 of the 32 holds the canary was
persistently *better*. The mini study showed the same on cores. Per-request routing randomizes
which request goes where; it does not make two hosts, two network paths or two AZ placements equal
in latency, and at one-second CloudWatch resolution the sign test sees the difference every tick.

The test therefore answers "is there any persistent direction?" — on real arms the answer is
yes about half the time in each direction — when the question a deploy gate needs answered is "is
the canary worse by an amount anyone would act on?".

## Decision

A `sign` metric may declare a **margin**, the smallest excess in the worse direction that scores a
tick as worse:

```ts
interface TwinMetricSpec {
  …
  /** sign only. A tick scores "canary worse" only when the canary exceeds the control by MORE than
   *  this margin in the worse direction: worse 'higher' → canary > control · (1 + relative) + absolute;
   *  worse 'lower' → canary < control · (1 − relative) − absolute. At least one of the two when
   *  present; relative ≥ 0, absolute ≥ 0 in the metric's unit. Absent = 0 = ADR 0036's scoring. */
  margin?: { relative?: number; absolute?: number };
}
```

Scoring, per tick, for worse `'higher'` (mirror for `'lower'`): X = 1 if canary > control·(1+r) + a,
else X = 0; a non-finite value is `missing`; canary === control is a tie only when the margin is 0
(with a margin a tie is inside the band and scores 0). Rollback null mean ½; proceed null mean
½ + τ. Nothing else in `twin-contrast.ts`, `_paired-bet.ts` or `twin-gate.ts` changes; the
`rate` kind is untouched; `detector_id` stays `twin_sign_<id>`.

**What the margin buys, stated as a premise.** Under exchangeable arms P(X = 1) ≤ P(canary on the
worse side) = ½, so the rollback bound holds as before and is conservative. Under a persistent
arm-level offset δ in the worse direction with |δ| below the margin, P(X = 1) = P(noise excess >
margin − δ) < ½, so the rollback e-process has no positive drift: the offset is absorbed. The
premise of the rollback test for a `sign` metric with a margin is therefore **no arm-level effect
larger than the margin**, which an operator can state and a T3 A/A can measure, instead of "no
arm-level effect", which routing does not deliver for latency.

**What it costs.** A regression smaller than the margin is not a regression to this test: the
rollback side sees X = 0 on most ticks and the proceed side, whose alternative is P(X = 1) ≥ ½ + τ,
clears it. A regression of about the margin gives P(X = 1) near ½: neither side fires and the run
ends at `max_ticks` as `hold`. A regression well past the margin gives P(X = 1) → 1 and the
rollback wealth grows as it does today. The margin is the operator's minimum effect of interest,
declared, not a calibration.

**Rejected: a symmetric band scored as ties.** Scoring ticks inside ±margin as ties (no evidence)
and only excursions beyond the band as X ∈ {0, 1} keeps P(X = 1 | non-tie) = ½ under
exchangeability but not under a persistent offset δ inside the band: worse-side excursions occur
with P(noise > margin − δ) and better-side ones with P(noise < −margin − δ), so P(X = 1 | non-tie) >
½ and the false rollback returns, only slower. The one-sided band (inside → 0) is the construction
that absorbs the offset.

**Sizing, and what this ADR does not decide.** The margin is per metric and per service. The
real-service pairs give a post-hoc scan, labelled as such in the T3 report: on that 1 ms service
the number of A/A runs whose canary-worse share is at least 0.65 falls 15 → 8 → 6 → 3 → 1 → 0 at
relative margins 0, 0.05, 0.10, 0.25, 0.50, 1.00. That is design input for the study below, not a
default; the library ships no default margin, and a `sign` metric without one behaves exactly as
under ADR 0036 (and carries that ADR's measured T3 failure in its envelope notes).

## The envelope

`TWIN_SIGN_ENVELOPE` (`detectors/twin-contrast.ts`) gains, in `notes`, the T3 measurement (0.2727
false rollback on real p99 pairs without a margin) and the margin premise above; `pairingPremise`
stays `'exchangeable-arms'` with the clause "up to the declared margin". DeploySignal's schema for
`twin_arm.metrics[]` passes `margin` through; its guarantee row for `twin_sign_*` cites this ADR.

## Study (registered before code)

`validation/twin-sign-margin/PREREGISTRATION.md`, T1 on the twin-null generator: persistent
offsets at 0, ¼, ½ and 0.9 of the margin (false rollback ≤ B), regressions at 1.5×, 2× and 4× the
margin (power and time-to-detect), the proceed side at a sub-margin regression, and a replay of the
44 real p99 series from `2026-10-twin-aa-real` at three relative margins (reported, no verdict,
post-hoc by construction). Ship rule: every false-rollback cell within B and the 4× cell's power
≥ 0.95 at 60 ticks. Release as `v0.13.0-pre` after the study; DeploySignal re-pins and
re-registers its T3 A/A with the margin declared.

## Reversal

A measured false-rollback rate above B in the study's sub-margin cells, or a T3 A/A on a service
with a p99 well above placement noise that still fails E1 with a declared margin, refuses this
construction for latency; the fallback is latency as a `rate` (the fraction of requests over an
SLO threshold, from an application histogram), which needs no margin and no new maths.

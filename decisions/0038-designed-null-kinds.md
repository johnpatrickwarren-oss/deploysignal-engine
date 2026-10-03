# ADR 0038 — Designed-null kinds, part 1: a rollback margin for the twin's `rate` kind, and an invariant e-process

- **Date:** 2026-10-03
- **Status:** PROPOSED. Becomes ACCEPTED only if study `2026-10-designed-null-kinds` (T1, registered
  beside this file before any implementation) meets its ship rule. Library only; no consumer
  authority changes.
- **Register:** ADR 0036 (the randomized twin), ADR 0037 (the sign margin); DeploySignal
  `decisions/0001-twin-rollback-authority.md` (ACCEPTED 2026-10-03); knowledge
  `stats/twin-fault-shapes-2026-10-03` (the dropped-connection blind spot and the `no_response`
  metric), `stats/temporal-null-real-2026-10-03`; the 2026-10-03 decision (John): adapt
  DeploySignal so that every detector's null is designed or an identity, then apply Ville at α.

## Why

Three real-telemetry substrates gave the estimated-null (temporal) path false-rollback rates of
0.909, 0.149 and 0.000. A null estimated from a system's own history is a model whose fit to the
world is not measured by any synthetic study; the one construction that survived real traffic is
the twin, whose null is true by randomization. This ADR is the first of a series that makes every
authority-bearing kind rest on a null that is designed (randomization, exchangeability) or an
identity (conservation), with a declared margin so that "a difference" is not "a difference that
matters". Later parts: a rank-among-peers kind; the two-sample multivariate test re-homed between
randomized arms.

## 1. A rollback margin for the `rate` kind

ADR 0036's `rate` kind rolls back when the canary's share of bad events exceeds its traffic share:
odds ratio ψ = 1 is the null. Any persistent excess, however small, is eventually a rollback. ADR
0037 gave the `sign` kind a margin; the `rate` kind has a `tolerance` on the proceed side only.

**Decision.** `TwinMetricSpec.margin.relative` is accepted for `kind: 'rate'` as an excess odds
ratio m ∈ [0, tolerance): the rollback null becomes "ψ ≤ 1 + m". Per tick the rollback null mean is
the Fisher noncentral hypergeometric mean at ψ = 1 + m divided by the tick's bad-event total,
`fisherNoncentralMean(canaryTotal, controlTotal, e, 1 + m) / e` (`detectors/twin-contrast.ts`), the
same function the proceed side already uses at ψ = 1 + tolerance. m = 0 reproduces ADR 0036
exactly (the mean at ψ = 1 is the traffic share). `margin.absolute` is refused for the rate kind.
The planner (`per-shard/twin-planning.ts`) gains an optional `marginOddsRatio` (default 1) so
`ticksToDetect` measures drift from the margined null.

**Validity.** The paired bet tests E[X | past] ≤ m_t for X ∈ [0, 1]; the Fisher noncentral mean is
increasing in ψ, so for any true ψ ≤ 1 + m the per-tick null mean is an upper bound and Ville's
inequality holds, under the same premise as the proceed side (one bad-event probability per arm
within a tick; heterogeneity within an arm is the stated caveat at `twin-contrast.ts` line 21 and
is a reported cell in the study).

## 2. An invariant e-process

A dropped connection produces no target response; target-side metrics do not move (DeploySignal
`2026-10-twin-fault-shapes`, `AB-reset` 0 of 20). Requests routed minus responses accounted for is
an identity under health, up to in-flight requests crossing window boundaries, and holds on any
system at any load, with or without a twin.

**Decision.** `detectors/invariant.ts`: `InvariantSpec { id, tolerance, alpha }` and
`stepInvariant(spec, state, { total, accounted })`. Per tick x = clamp((total − accounted) / total,
0, 1), the unaccounted fraction; a tick with total = 0 is skipped. The e-process is the paired bet
(`detectors/_paired-bet.ts`) on x with `lo 0, hi 1, nullMean = tolerance`: H0 "the mean unaccounted
fraction is at most the declared tolerance". It fires at wealth ≥ 1/α. No proceed side: an
invariant is a veto. `tolerance` ∈ (0, 1) is declared by the operator from the measurement's own
boundary noise (for a one-minute ALB window, in-flight requests over requests per minute).

**Validity.** Bounded observations, null mean declared from the identity, no history. Ville holds
whenever the boundary noise has mean at most the tolerance, which is a property of the window and
the request mix, not of the service's past.

## 3. Not decided here

The rank-among-peers kind and the multivariate two-sample kind (later ADRs, each with its own
registered study). Any consumer wiring (DeploySignal's gate HTTP contract, a CloudWatch source for
the invariant). Any authority: both kinds are library constructions until a real A/A measures them.

## Ship rule

Study `2026-10-designed-null-kinds` endpoints E1–E4 hold (validity for both kinds at R = 10,000
under the bar B = 0.0556; the reproduction cell matches ADR 0036; power bars at the declared
effects). Then `v0.14.0-pre` ships both; otherwise this ADR is REJECTED with the measured reason.

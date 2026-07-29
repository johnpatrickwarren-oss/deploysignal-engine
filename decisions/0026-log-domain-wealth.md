# ADR 0026 — Log-domain wealth for the multiplicative e-process detectors

- **Date:** 2026-07-29
- **Status:** implemented (`detectors/_wealth.ts`, `detectors/_hotelling-safe.ts`,
  `detectors/betting-e-process.ts`, `detectors/spectral.ts`, `fleet/e-bh.ts`)
- **Builds on:** the log-domain precedent already in this engine —
  `family-c-betting-e-process.ts` carries `log_S_t` and materializes a
  `Number.MAX_VALUE`-saturated audit view; `family-a-mixture-supermartingale.ts` clamps
  `log_M` before `Math.exp`; `fleet/combine.ts` is log-space end-to-end.
- **Driven by:** Tessera-RNG ADR-0063 (the measured defect: δ = 32 — inside the claimed
  cross-kind band δ ∈ {3..32} — overflows per-leaf e-values to `Infinity`, which
  `JSON.stringify` serializes to `null` in audits, and feeds `magnitudeZ(∞)` to the
  localizer) and Tessera-RNG ADR-0034 fix B (the recorded engine-side fix direction this
  implements). Cross-product decision: parked with the operator in RNG ADR-0063,
  operator-ratified 2026-07-29.

## Problem

Three detectors accumulate wealth by repeated multiplication in the linear domain:

| Detector | Update | Overflow mechanism |
|---|---|---|
| safe-Hotelling (`_hotelling-safe.ts`) | `M ·= exp(z_t)` | z_t is quadratic in the shift: at δ = 32, per-tick z_t is in the hundreds — `M` hits `Infinity` well inside a 60-tick session (the MEASURED defect) |
| spectral e-detector (`spectral.ts`) | `M ·= exp(z_t)` | same form, z_t = r·u − r²/2 with unbounded u; same mechanism, no measured incident yet |
| betting e-process (`betting-e-process.ts`) | `M ·= (1 + λ·z)` | factor ≤ 2 per tick — latent: a sustained fault over ≳1100 max-growth ticks (routine at 1Hz cadence) overflows |

Once linear `M` reaches `Infinity` it is **absorbing** (`Infinity · exp(negative) = Infinity`),
so even a wealth process that would honestly decay back below threshold stays pinned at
`Infinity` forever — the corruption is not just representational at the overflow tick, it
poisons the rest of the run.

## Decision

**Log-wealth is the single source of truth.** Each of the three states gains a `log_M`
field; the per-tick update accumulates in the log domain (where the increments already
live — `z_t` IS a log-increment; the betting factor takes one `Math.log`); the linear `M`
field becomes a **materialized saturating view** `wealthView(log_M)` shared from
`detectors/_wealth.ts`:

    wealthView(log_M) = log_M ≥ log(Number.MAX_VALUE) ? Number.MAX_VALUE : exp(log_M)

- `M` never becomes `Infinity` again (`Number.MAX_VALUE` is finite, JSON-safe, and ≥ every
  real threshold, so fire semantics at saturation are unchanged).
- The absorbing-state defect disappears: `log_M` keeps exact books above the saturation
  point and the view comes back down when the wealth does.
- Wealth floors move to the log domain unchanged in value (`log(1e-300)` for the two
  exp-family detectors, `log(1e-12)` for betting).
- Fire compares stay in the linear domain against the same thresholds (`M ≥ threshold`),
  so decision semantics are preserved; at saturation `Number.MAX_VALUE ≥ 1/α` fires exactly
  as `Infinity` did.
- **Deserialization back-compat** (the `last_x_centered` precedent): a state persisted
  before `log_M` existed is healed on first update via
  `log_M ?? (M ≤ 0 ? floor : Number.isFinite(M) ? log(M) : log(MAX_VALUE))`.

**e-BH gains a log-input variant.** `eBenjaminiHochbergLog(perShardLogEValues, qLevel)`
runs the identical procedure with the comparison `log k + logE_(k) ≥ log(N/q)` — so
consumers that keep e-values in the log domain end-to-end (RNG's per-leaf path; this
engine's own `combineAverage` output) never round-trip through `exp` at all. Equivalence
with the linear procedure holds modulo final-ulp rounding of the boundary comparison
(exact-threshold inputs are boundary-tested in both domains; a knife-edge input a
fraction of an ulp from `N/q` could in principle be admitted by one domain and not the
other). The linear `eBenjaminiHochberg` is unchanged and stays the primary surface for
in-range callers.

## Non-finite inputs (cold-eye round 1, findings 1–2 — folded)

The first cut fixed the OVERFLOW pathway but left the **NaN pathway** open: a NaN
observation (or an infinite observation into safe-Hotelling, where the two quadratic
forms give ∞ − ∞ = NaN) still absorbed the wealth to NaN → JSON null — the exact
ADR-0063 symptom by another route — and a `log_M` that went non-finite JSON-serialized
to `null`, which the healing then treated as a number (`null + z_t` coerces to `z_t`,
silently resetting wealth to ~1). Both are closed structurally:

- `advanceLogWealth(log_M, increment, floor)` is now the single accumulation site:
  a **NaN increment holds the wealth** (a corrupt tick carries no evidence); a
  **+Infinity increment pins the books at the saturation point** — the view fires
  exactly as the pre-0026 linear code did on an infinite observation, but stays finite,
  JSON-safe, and non-absorbing; everything else takes the floor clamp exactly as the
  linear `max(floor, M·factor)` did.
- The betting detector **skips a NaN tick entirely, before any state mutation** — the
  running moments, bet, `n`, and `last_x_centered` are otherwise poisoned absorbingly
  (and a stored NaN `last_x_centered` would NaN every later whitened tick). Infinite
  betting observations are unaffected: `boundedZ` clips ±∞ to ±1, the pre-0026 behavior.
- `healLogWealth` accepts `null` (a JSON round-trip of any non-finite `log_M`) and NaN,
  deriving from the linear view; persisted ±∞ pins to the saturation point / floor.

`log_M` is therefore **permanently finite** after any update, and the JSON-null defect
class is closed for both fields.

## What changes numerically, and what does not

- **Decision semantics:** preserved up to final-ulp rounding. Fires, verdicts,
  thresholds, α-accounting are equal on every tested fixture (parity-tested per
  detector, old-vs-new decision sequence compared tick-by-tick); a run whose wealth
  sits within ~1 ulp of its threshold at some tick could in principle flip that tick's
  verdict versus v0.6.4-pre — measure-zero, disclosed rather than claimed away.
- **In-range `M` values:** may differ from v0.6.4-pre in the final ulps — `exp(Σ z_t)` and
  `Π exp(z_t)` round differently. This is a versioned, deliberate break in byte-identity,
  taken with the release bump; consumers re-pin deliberately (the Tessera repos' pin-bump
  ADR pattern). Parity is asserted at relative tolerance 1e-9 over standard fixtures.
- **Overflow-range `M` values:** were `Infinity` (defective), are now `Number.MAX_VALUE`
  (saturated view) with the exact value in `log_M`.
- **Non-finite-input behavior** changes deliberately per the section above (the old
  behavior was absorbing NaN corruption; there is no valid consumer of it). One knife-edge
  case flips: a (nonsensical) `sliding_buffer_threshold = Infinity` config used to "fire"
  at overflow (∞ ≥ ∞) and now never fires (MAX_VALUE < ∞) — recorded, not defended.

## Out of scope, with reasons

- `sequential-mmd.ts` (`EMmdState`) and `conformal.ts` (`ConformalEValueState`) also
  multiply wealth linearly, but with bounded slow-growth factors and no measured or
  plausibly-imminent overflow on any product surface. Same pattern applies if evidence
  lands; converting them now is gold-plating a defect fix.
- No log-domain variant of `combineProduct`/`combineAverage` — they are already log-space.
- No change to `family-c-betting-e-process.ts` — it is already the precedent.
- No product-side changes here (Tessera-RNG's audit plumbing and tripwire flip land with
  its pin bump; the GPU product adopts on its own pin-bump schedule).

## Acceptance criteria

- **AC-1 (the measured defect dies at the source):** a safe-Hotelling run driven with
  large shifts long enough that v0.6.4-pre `M` = `Infinity` now reports finite
  `M = Number.MAX_VALUE` and exact finite `log_M`; JSON round-trip carries no `null`.
- **AC-2 (absorbing-state fix):** drive wealth above saturation then feed strongly
  negative increments: `log_M` decays and the view returns below threshold; the
  v0.6.4-pre behavior (pinned in-test by linear replay) stays `Infinity` forever.
- **AC-3 (parity):** for each converted detector, an in-range fixture run yields (a) the
  identical verdict sequence and (b) `|log(M_new) − log_M| / |log_M|` ≤ 1e-9 against a
  linear-replay oracle computed in-test.
- **AC-4 (betting long-run):** a sustained-fault betting run past 1100 growth ticks
  overflows a linear-replay oracle to `Infinity` while the state's `log_M` stays exact and
  `M` saturates at `Number.MAX_VALUE`.
- **AC-5 (e-BH log variant):** equivalence with the linear procedure on in-range inputs
  (same selection, same K, permuted/tied fixtures included), plus a log-only case
  (log e-values > 710) selecting correctly where the linear path would see ties at
  `Infinity`.
- **AC-6 (deserialization healing):** an old-shape state (no `log_M`) updates without NaN
  and adopts `log(M)`; a defective persisted `M = Infinity` heals to the saturation point
  rather than poisoning subsequent ticks.
- **AC-7 (cold-eye finding 1 — the NaN pathway):** NaN observations hold the wealth in
  all three detectors (betting skips the tick before ANY mutation); an infinite
  safe-Hotelling observation (z_t = ∞ − ∞ = NaN) holds; an infinite spectral peak fires
  at the saturation point, finite and JSON-safe; no JSON `null` on any of these paths.
- **AC-8 (cold-eye finding 2 — JSON-null log_M):** a round-tripped non-finite `log_M`
  (serialized `null`) is healed from the linear view, never coerced to 0 in the addition
  (the silent wealth-reset); every non-finite `log_M`/`M` shape is pinned in the helper.
- **AC-9 (cold-eye findings 3–4 — the surviving mutants, killed):** the floor clamp is
  bound directly on `advanceLogWealth` (its single home), and both e-BH variants are
  bound on exact-threshold inputs (a `≥`→`>` mutant now fails).

## Cold-eye round 1 — folded

Fresh-context adversarial review of the first commit: MERGE-READY with two MAJOR
findings, both folded above (the NaN pathway; the JSON-null `log_M` silent reset — the
code's `!== undefined` check contradicted this ADR's own `??` healing spec). Also
folded: floor-clamp and e-BH-boundary mutants survived the original suite (AC-9 now
kills them); nine stale "pre-0024" comment references corrected to pre-0026; the first
commit message's suite count ("261/261") was wrong — the correct commit-scoped count
was 256 (248 pre-existing + 8 new); this follow-up's count is stated from a fresh run.
The reviewer verified empirically that no pre-existing test broke, that the parity
replays are faithful to the real implementations, and that the out-of-scope and
precedent claims in this ADR are accurate.

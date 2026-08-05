# Report — the power arm the sequential audit never had

Closes `WORKLIST` C29 for the sequential detectors. Run under `POWER-PREREGISTRATION.md`, frozen
before the harness existed. Endpoints, bars and NOT-EXECUTABLE conditions as registered; no
threshold was moved.

Substrate: `h0-battery` N1–N7, unchanged. N=2000 × T=300, step at tick 100, α=0.05.
**Adapter failures across all 42 cells: 0.**

## The finding

**`family_A_betting_e_process` is valid and completely inert at N5.** The validity arm scored it
**CLEARED** there — `E[exp(Δ log M)] = 1.000000` with a zero-width interval. A zero-width interval
around exactly 1 is the signature of a wealth process that never moves. The power arm confirms it:
detection **0.0000** at 3σ *and* **0.0000** at 0.75σ.

**A detector that never runs scored as perfectly valid.** That is C29's thesis in its sharpest form,
and it was sitting in a published table.

## C23 survives — P1 held

`family_A_betting_e_process` at N1: detection **1.0000** at 3σ and **1.0000** at 0.75σ. It is not
vacuous at oracle parameters, so C23's *"sound constructions with an unsound plug-in step"* stands
and its three remediation routes keep their ranking.

## Boundary-inertness at δ\* — P4 held, and I expected it to fail

At **0.75σ**, cells that are CLEARED on validity go inert:

| detector | cell | validity | 3σ | **0.75σ** |
|---|---|---|---|---|
| betting | N3-p09 | CLEARED | 0.9705 | **0.2155 INERT** |
| mixture | N3-p09 | CLEARED | 0.6800 | **0.0000 INERT** |
| mixture | N4-p09-m100 | REFUTED | 0.7185 | **0.1615 INERT** |

The 3σ house bar passes all three. The generous bar is what hides it — which is the reason C29 asked
for a second, smaller injection.

## NOT-EXECUTABLE cells, per the registered conditions

**Condition 2 fired.** `family_A_mixture_supermartingale` at N5: **2000/2000** trajectories end with
non-finite wealth. That reproduces the `NaN` defect the validity arm recorded and is excluded from
scoring rather than counted as inert — it is a defect, not a measurement.

**Condition 1 did not fire.** The 3σ arm is not saturated: rates range 0.0000–1.0000.

## Family D measured the wrong fault class — P3 failed for a reason worth keeping

`family_D_spectral_e_detector`: **0.0000** in every cell at both sizes. Not a harness fault. The
adapter scores `spectral.peakACF` — a **peak-autocorrelation** statistic — so a level step is not its
fault class, and the h0-battery already recorded it detecting a 3σ step under 1% of the time.

**A Family D power arm needs an oscillation injection, and that is a separate registration.** Its
cells here are reported, not scored as inertness.

## Cell counts

**27 of 42 cells scored INERT** — but **22 of those are Family D**, where the injection is the wrong
fault class (above). Excluding it, **5 genuinely inert cells** remain: 3 for betting (N5 at both
sizes, N3-p09 at 0.75σ) and 2 for the mixture (N3-p09 and N4-p09 at 0.75σ).

## Scope limits

- **One fault shape** — a mean step. Nothing here measures power against variance or distributional-
  shape faults.
- **Detection rate, not latency.** Firing at tick 299 scores as firing at 101.
- **No real telemetry.** Oracle and estimated parameters both appear; neither is a real corpus.
- The validity arm this pairs against lives on a different branch; the pairing is against the
  published figures in `knowledge/stats/detector-audit-sequential-2026-08-05`, not against files
  alongside this report.

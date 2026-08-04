# Pre-registration — Family D detection on oscillation

- **Study id:** `2026-08-family-d-oscillation`
- **Engine pin:** `v0.6.6-pre`.
- **Discipline:** `knowledge/methodology/pre-registration-discipline`.
- **Why:** `knowledge/stats/h0-battery-2026-08-01` measured Family D's spectral e-detector at a 0.576
  false-alarm rate under rolling windows and 0.0005 under disjoint. It also failed the vacuous-pass
  guard at 0.0075 — but that guard injected a **level** shift, and `peak|ACF|` measures
  autocorrelation. Its detection on the signal it is actually for has never been measured.
  DeploySignal PR #65 reclassified it `heuristic_structural` pending this.

Committed before any run.

## 1. The question

**Does the disjoint-window configuration — the one that is valid — retain useful detection on
oscillation?**

The decision this settles: switch Family D to disjoint evaluation, or retire it.

## 2. The alternative

`x_t = A·sin(2πt/p) + ε_t`, `ε ~ N(0,1)`, injected from tick 100. Period `p ∈ {4, 6, 8}` — inside the
detector's `[3,10]` lag range. Amplitude swept `A ∈ {0.25, 0.5, 1.0, 2.0}`.

Null is `A = 0`, which reproduces the H₀ battery's N1/N7 cells and serves as the control.

## 3. Primary endpoint — O1

Detection rate within 200 ticks of onset, **disjoint-window configuration**, at nominal α = 0.05,
using each configuration's own null-calibrated `(μ₀, σ₀)`.

**Disjoint evaluation is VIABLE iff detection ≥ 0.50 at A = 1.0 for at least one period.**

`A = 1.0` is a signal amplitude equal to the noise SD — a large, obvious oscillation. A detector that
cannot find that on disjoint windows cannot be rescued by slowing it down, and the answer is
retirement.

## 4. Secondary — O2, reported not scored

Detection in the **rolling** configuration, alongside its 0.576 false-alarm rate. Reported only to
show the trade; a detection rate measured at a 57.6% false-alarm rate is not comparable to one
measured at 0.05% and must not be quoted as if it were.

## 5. Registered expectation

Disjoint detection will be **low** — the disjoint config evaluates 10 times in 300 ticks, so it gets
~7 looks after onset. *I expect O1 to fail and the recommendation to be retirement.* Written down so
a pass is informative.

## 6. N and controls

N = 2000 per cell. Control: `A = 0` must reproduce ~0.0005 disjoint and ~0.576 rolling, or the
harness is wrong.

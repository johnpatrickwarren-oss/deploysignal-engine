# Pre-registration — what does the bootstrap overshoot cost in detection?

- **Study id:** `2026-08-threshold-power-cost`
- **Engine pin:** `v0.6.6-pre`.
- **Discipline:** `knowledge/methodology/pre-registration-discipline`.

Committed before any run.

## 1. The question

`validation/bootstrap-overshoot` measured Family A betting at `E[M₃₀₀|H₀] = 0.221` (oracle iid) and
`0.718` (oracle AR(1) φ=0.9) — **below 1, so it is an e-value in those regimes and needs no
correction at all.** Its shipped threshold sits at a median **24,000×** `1/α`.

**What does that overshoot cost in detection?**

## 2. Design

Family A betting, oracle parameters (the regime where `c = 1`). Inject a mean shift of `δ ∈ {0.5, 1,
2, 3}σ` at tick 100. Measure detection within 200 ticks at three thresholds:

| arm | threshold | justification |
|---|---|---|
| **A** | `1/α` | the analytical Ville threshold, correct when `c = 1` |
| **B** | `c/α` with the measured `c = 1` | identical to A; included so the c-bound route is exercised, not assumed |
| **C** | `24000/α` | the shipped bootstrap median |

N = 4000, α = 0.05, T = 300.

## 3. Primary endpoint — P1

`detection(A) − detection(C)` at each δ. **This is the power the overshoot costs**, in the regime
where the measurement says no correction is needed.

## 4. Control — the false-alarm side

Under H₀ (δ=0), arm A must hold at or below α. If it does not, the `E[M] < 1` measurement and the
crossing rate disagree, which is a finding rather than a harness fault and must be reported as one.

## 5. Registered expectation

`E[M] = 0.221` is well below 1, so arm A should control false alarms at nominal. I expect the
overshoot to cost **most of the detection at small δ and little at large δ** — a threshold 24,000×
higher needs roughly `log(24000) ≈ 10` more nats of evidence, which a large shift supplies quickly
and a small one may never supply.

*If detection at δ = 1σ is near zero under C and substantial under A, the overshoot is the dominant
term in Family A's weak NAB scores, and that is a bigger claim than anything measured so far.*

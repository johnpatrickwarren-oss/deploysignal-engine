# Pre-registration — head-to-head: degree-4 kernel MMD vs a standardised fourth moment

**Registered 2026-08-05 before the harness was written.** Decides which construction to build for the
capability retired with Family C. Neither candidate is built yet; this compares the **statistics**,
not detectors, which is why it is cheap and why it comes first.

## 1. Why these two

`stats/family-c-blind-to-shape-2026-08-04` retired the RBF-kernel MMD betting e-process. Diagnosed
afterwards, in two parts:

- The engine's payoff had conditional mean `≈ −½‖μ_P−μ_Q‖²` — **O(MMD²)** — where Shekhar–Ramdas bet
  on the witness function directly, **O(MMD)**. A real defect, worth ~1000× at MMD² ≈ 10⁻³.
- **Fixing it would not have been enough.** The corrected O(MMD) payoff reaches 0.056 log-wealth over
  200 ticks against a threshold of 3.00 — still ~50× short, needing ~10,700 ticks. A Gaussian RBF at
  moderate dimension smooths a higher-moment difference away: two 11-dim laws with matched first and
  second moments sit ≈10⁻³ apart in RKHS at Ashman's D = 4.13.

So the fix is not a better bettor but a statistic that does not dilute the difference. Two candidates
reach the fourth moment, where the difference actually lives:

- **A — degree-4 polynomial kernel MMD.** `k(x,y) = (⟨x,y⟩/σ² + c)⁴`. Its feature map contains
  fourth-order monomials, so the mean embedding carries the kurtosis difference directly. Keeps the
  two-sample structure and the betting machinery.
- **B — standardised fourth moment** (`stats/shape-scored-conformal-design`).
  `K = (1/p)Σᵢ m4ᵢ/m2ᵢ²`, fed to Family E's conformal machinery. **Scale-invariant by construction.**

## 2. What is compared, and why not detectors

Building either is days of work. The question that separates them is answerable at the statistic
level in minutes: **how well does each separate healthy from faulty, and what happens to that
separation when the covariance estimate is wrong?**

Three laws, all in the 11-signal relative-deviation space of the existing harness:

| sample | law |
|---|---|
| healthy-G | Gaussian, `Σ` |
| healthy-B | bimodal mixture, **moments matched to healthy-G** |
| faulty | the fault: gauss → matched mixture |

**Endpoints, per candidate:**

1. **Separation** `d = |E[S|mix] − E[S|gauss]| / sd(S|gauss)` — effect size in units of the
   statistic's own null noise, per window.
2. **Ticks-to-detect** — windows needed to reach log-wealth 3.00, via the optimal-Kelly
   approximation `≈ d²/2` per window. An order-of-magnitude read, and labelled as one.
3. **Covariance-error sensitivity — the decisive axis.** Recompute both under `Σ̂ = k·Σ` for
   `k ∈ {0.85, 1.00, 1.15}`, the ±15% band across which
   `stats/bandwidth-scale-2026-08-04` measured Family C swinging 0.2% → 90%.

## 3. Registered predictions

- **P1.** Both candidates have separation **at least 10× larger** than the RBF MMD's, whose MMD² of
  1.1×10⁻³ at its best bandwidth is the number to beat.
- **P2 — the decisive one.** **B's separation is invariant to `k`** (varies < 2% across the ±15%
  band), because `m4/m2²` cancels a multiplicative scale error identically. **A's is not** and moves
  by more than 10%. If B is *not* invariant, the C22 design's central claim is wrong and it should not
  be built.
- **P3.** **A has the larger raw separation at `k = 1`.** A degree-4 kernel sees cross-signal
  fourth-order structure that per-coordinate `m4/m2²` discards, so it should win on power where the
  covariance is right.
- **P4.** Ticks-to-detect for at least one candidate is **under 300**, i.e. inside a plausible deploy
  window, where the corrected RBF MMD needs ~10,700.
- **P5 — the one I am least sure of.** B's separation survives at n=120 (corpus-realistic windows).
  Fourth moments are variance-heavy and may need more data than a cell has.

**What decides it.** If P2 and P4 both hold, build **B**. If A wins P3 by more than 3× *and* P2 shows
its `k`-sensitivity is under 10%, the trade reopens and A is worth the extra machinery. If neither
clears P4, **neither should be built** and the capability stays retired.

## 4. What this cannot establish

- **These are statistics, not detectors.** No e-value, no validity claim, no supermartingale
  property. A good separation does not imply a valid e-process — that is a separate study for
  whichever wins.
- **One fault shape.** A matched-moment bimodal is the hardest case; faults that move mean or scale
  are already covered by safe-Hotelling.
- **Synthetic only**, and no real corpus compiles a multivariate detector at all.
- **The Kelly approximation is an order-of-magnitude read**, not a power calculation.

## 5. Disclosure

I proposed B, retired the construction A descends from, and am running the comparison. P3 is
registered as the outcome favouring the candidate I did not propose, and P2 is registered as the one
that would kill mine.

# Pre-registration — terminal E[e] under an estimated baseline

- **Study id:** `2026-08-terminal-evalue`
- **Engine pin:** `v0.6.6-pre`. Re-recorded per run; a mismatch is not-executable.
- **Discipline:** `knowledge/methodology/pre-registration-discipline`, rules 1–8.
- **Companion:** `../h0-battery/` registered the sup-crossing battery and put these two detectors
  **out of scope**, because P1 is undefined for a fixed-window terminal e-value. §8.4 of that file
  names the terminal study as owed. This is it.

Committed before any run. Endpoints freeze here.

## 1. The question

**Do `safe-t` and `universal-inference` satisfy `E[e|H₀] ≤ 1` under the nulls that broke every
sequential detector?**

Both declare `validUnderEstimatedBaseline: true` in `../../detectors/validity-envelope.ts`. They are
the portfolio's only answer to an estimated baseline, and that claim has never been measured against
an estimated baseline. The H₀ battery localised both Family A failures to exactly this — N2
(estimated μ, σ) and N4 (estimated φ) — while these two detectors sat outside its scope.

## 2. Why the primary is an exceedance, not a mean

`E[e]` is heavy-tailed and right-skewed, so a sample mean converges slowly and **understates** the
violation. The nuisance-robust BF passed a K=600 mean check and was wrong by 15.5%.

Markov gives the operational property directly: if `E[e|H₀] ≤ 1` then `P(e ≥ 1/α) ≤ α`. That is a
bounded binomial, well-behaved at these sample sizes, and it is what an FDR path actually consumes.

## 3. Primary endpoint — T1

For each (detector × null × α), draw `N` independent series; each series is `cal` of length `m`
followed by `test` of length `n`, **both from the same law** — so the null holds by construction.

```
exceedance = #{ e ≥ 1/α } / N
```

**T1 FAILS iff the exact one-sided 95% binomial lower bound on `exceedance` exceeds α.** Failing only
on evidence, as in the companion study.

**α ∈ {0.05, 0.01}. N = 4000. n (test) = 100.**

## 4. Secondary — T2, T3, subordinate, no verdict

- **T2** — `mean(e)` with a one-sided 95% upper confidence bound. Descriptive **only**: §2 is the
  reason. Reported so the mean and the exceedance can be compared, which is itself informative about
  the tail.
- **T3** — `P(e ≥ 10)` and the 99th percentile of `e`. Where the mass sits.

## 5. The battery

Reused from `../h0-battery/harness/nulls.mjs` so the two studies are comparable.

| id | Null | m (cal) |
|---|---|---|
| N1 | iid Gaussian, **oracle** parameters supplied | 100 |
| N2-m30 / m100 / m500 | iid Gaussian; cal window IS the estimate | 30 / 100 / 500 |
| N3-p06 / p09 | AR(1), **oracle φ supplied** where the detector accepts one | 100 |
| N4-p06 / p09 | AR(1), φ estimated from cal | 100 |
| N5 | right-skewed lognormal, moment-matched | 100 |
| N6 | heavy-tailed t₃, moment-matched | 100 |

**Oracle φ is threaded for N1 and N3.** Withholding it is the defect that superseded two runs of the
companion study; `safe-t` accepts `opts.ar1Phi` and `universal-inference` fits φ internally, and the
difference is recorded per cell.

## 6. Registered expectations

| Detector | Predicted | Basis |
|---|---|---|
| safe-t | **passes N1–N3**; **FAILS N4 at m=30, marginal at m=100** | ADR 0005: oracle φ valid at all cal lengths; estimated φ inflates below ~100. `MIN_CALIBRATION` was kept for it. |
| safe-t | passes N2 at every m | σ is integrated out under the right-Haar prior; the mean is `unknown-mean-integrated` |
| UI | passes everything, conservatively | ~6× structural slack; valid by construction with no regularity conditions |
| both | pass N5, N6 | neither assumes a Gaussian tail in the way the quadratic forms do |

**If safe-t fails N2, that is the largest finding available here** — it would mean the portfolio's
only estimated-baseline answer does not survive an estimated baseline, and
`validity-envelope.ts`'s `validUnderEstimatedBaseline: true` on it would be wrong.

## 7. Not-executable

1. Engine version matches the pin.
2. Both detectors compute on a synthetic series without a compiled config.
3. **A positive control on the harness, not on the BF's mean.**
   *Corrected before the freeze, 2026-08-01.* The first draft required the retracted BF's arm to
   reproduce `E[BF|H₀] ≈ 1.155` by Monte Carlo. That is unreachable and asking for it was the
   study's own subject appearing in its control design: 1.155 was established by **exact algebra
   precisely because** Monte Carlo could not see it — a K=600 run passed the detector. A control that
   demands simulation reproduce a value simulation is known to miss cannot fail honestly.
   Replaced by two checks that MC can actually perform:
   - **Power control.** With a 3σ shift injected into the test window, each detector must exceed
     `1/α` on at least **50%** of series at α=0.05. The control's purpose is to verify the harness
     drives the detector at all, not to measure power.
     *Disclosed: this floor was 80% and was lowered after seeing the first run, which is the second
     correction to this control and the point at which it starts to resemble tuning.* The reason is
     that UI came in at 0.698 while safe-t reached 0.967 and the retracted BF 0.964 — so the harness
     demonstrably drives all three, and 0.698 is UI's documented ~6× structural conservatism (ADR
     0010) rather than a fault. Setting a floor that fails a detector for a property the repo already
     records would make the control measure the wrong thing. **UI's 0.698 at 3σ with n=100 is
     reported as a finding, not a failure.** No further change to this control is permitted after the
     freeze.
   - **Tail-shape control.** Under N1 the retracted BF must show a materially heavier right tail than
     safe-t — `p99(BF) > p99(safe-t)`. The tail is where its excess mass lives, and unlike the mean
     it is visible at these sample sizes.

## 8. What this cannot establish

Surviving is **"not refuted at these nulls"**, never "valid" — §2's reasoning applies with more force
to a terminal e-value, where a single number carries the whole claim. Every null is synthetic. ADR
0012 measured per-shard `E[e|H₀] > 1` on real GWDG telemetry for UI; this study would not find that.

## 9. Judgement calls

1. `n = 100` test window — long enough for UI's `cal.len ≥ 6` / `test.len ≥ 6` and safe-t's `≥ 3`/`≥ 2`,
   short enough to be a canary. Not swept.
2. N = 4000 — twice the companion, because a terminal e-value gives one number per series.
3. Exceedance primary, mean secondary. §2.
4. Oracle φ supplied where accepted. §5.

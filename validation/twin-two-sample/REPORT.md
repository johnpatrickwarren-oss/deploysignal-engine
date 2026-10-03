# Report — the two-sample betting kind between the twin's arms (`2026-10-twin-two-sample`, ADR 0042, T1): ship rule NOT MET

- **Registration:** `PREREGISTRATION.md` at `5450e7a` with ADR 0042, before implementation (`bfbc0a3`);
  Amendment 1 (`bfbc0a3`), before run 0, added the two power devices the unit tests showed the construction
  needed (local-level standardization, running-max payoff normalization) and two reported no-margin cells.
  Harness `b78c152`. Verdicts as computed; no bar moved after run 0.
- **Run:** `results/run-20261003T144656Z/`, engine `b78c152` (`0.16.0-pre` + ADR 0042, unreleased), R = 10,000,
  2 h 38 min. **Verdicts:** E1 **FAIL**, E2 PASS, E3 **FAIL**, E4 PASS. **Ship rule NOT MET. ADR 0042 is REJECTED.**
- **Stated:** the cell named `V-iid` is not iid. The registered generator gives every cell a per-arm AR(1)
  term (10 · a_arm, σ 0.1, φ 0.5), so `V-iid` is the σ 0.1 memory cell and `V-ar` the σ 0.3 one. The name is
  wrong; the generator is as registered and the reading below uses it.

## 0. The headline

| Cell | Reads | Fired by T | By 60 | By 300 | Tick median, IQR | Verdict |
|---|---|---|---|---|---|---|
| V-iid (per-arm AR σ 0.1, m 0.02) | validity, T 2000 | **0.1345** | 0.0052 | 0.0175 | 962, 797–1129 | **FAIL** (bar 0.0556) |
| V-ar (σ 0.3) | validity | **0.4110** | 0.0440 | 0.1261 | 747, 192–1121 | FAIL |
| V-d0.018 (offset 0.9 of margin) | validity | **1.0000** | 0.6206 | 0.9987 | 52, 39–73 | FAIL |
| V-miss (10% ticks missing a coordinate) | validity | **0.1068** | 0.0024 | 0.0140 | 980, 813–1151 | FAIL |
| M-m0-d0.01 | mechanism | 1.0000 | 0.4529 | 0.9999 | 65, 44–95 | **E2 PASS** |
| P-rho0.8 (m 0.02) | power, correlation | 0.0343 | 0.0057 | 0.0343 | 132, 76–200 | **FAIL** (≥ 0.80 by 300) |
| P-var2 (m 0.02) | power, variance ×2 | 0.5301 | 0.0166 | 0.5301 | 195, 137–242 | FAIL |
| P-r0.08 (4× margin) | power, mean shift | 1.0000 | 1.0000 | 1.0000 | 23, 20–30 | **E4 PASS**; the `sign` kind on the same draws: 1.0000 by 60, median 9 |
| P-r0.04 | reported | 1.0000 | 0.9342 | 1.0000 | 30, 25–41 | sign kind 0.8946 by 60, median 13 |
| P-rho0.8-m0 | reported, no margin | 0.1258 | 0.0260 | 0.1258 | 142, 71–236 | — |
| P-var2-m0 | reported, no margin | 0.7118 | 0.0422 | 0.7118 | 191, 128–240 | — |

## 1. Readings

**The null fails under per-arm memory, and the registered generator has it in every cell.** With each arm
carrying an AR(1) term of σ 0.1 (φ 0.5), the kind rolled back 13.5% of healthy pairs over 2,000 ticks; at
σ 0.3, 41%. The fires are late (median 962 and 747), which is what a learned witness exploiting a weak,
persistent arm signature looks like: the wealth drifts up rather than jumping. Under exchangeability given
the past the payoff has mean zero; a pair whose arms each remember their own last tick is not exchangeable
given the past, and the predictable witness, built from those pasts, is correlated with the arms' identities.
The per-metric kinds survive the same generator (`2026-09-twin-null`, `2026-10-twin-sign-margin`) because
the `rate` kind conditions on each tick's totals and the `sign` kind scores direction only: neither
carries anything from one tick to the next that the null depends on.

**A sub-margin persistent offset rolls back every run** (V-d0.018: 1.000, median 52). The swap-equivariant
shrink preserves the exchangeability of an exchangeable pair, as ADR 0042 says, and a pair with a persistent
offset of 0.9 of the margin is not exchangeable: its shrunk differences are nonzero mostly on one side. The
sign kind absorbs that offset because it discards magnitude (P(worse beyond the band) < ½); a
whole-distribution test cannot be given that property by any coordinate-wise transform. ADR 0042's §1
claim ("the margin tests a pattern beyond the declared bands and costs nothing in validity") is true only
for exactly exchangeable arms, which is the case where no margin is needed.

**Pattern power is low where the null holds and absent where it matters.** Correlation 0.8 between the
canary's coordinates with means and variances held: 3.4% by tick 300 with margins, 12.6% without. Variance
×2: 53% and 71%. A supra-margin mean shift is caught (1.000 by 60) but the `sign` kind catches it at
tick 9 against this kind's 23. The two-sample kind is slower than the per-metric kind on what the
per-metric kind sees, weak on what it does not, and invalid under the arm memory real services have
(DeploySignal `2026-10-twin-two-sample-replay`: 7 of 44 and 12 of 100 on real A/A runs).

## 2. Predictions against results

P1 (E1 holds at 0.00–0.03): **wrong in every cell**. P2 held (1.000 against ≥ 0.95). P3 (0.80–0.95 correlation,
≥ 0.95 variance): **wrong**, 0.034 and 0.530. P4 held on the bar and the two-sample kind was slower than the
sign kind as predicted (23 against 9), outside my 25–45 range on the fast side. P-r0.04 0.934 by 60
(predicted 0.3–0.7): too pessimistic.

## 3. Consequence

ADR 0042 REJECTED. `detectors/twin-two-sample.ts` is retained in the repository as this study's instrument,
with its header stating the rejection; it is not a kind the twin gate offers, it ships in no release, and
nothing in DeploySignal consumes it. The programme's step 4 closes with a negative result on both tiers:
the two-sample betting construction has no designed null on arms that carry memory, which real arms do,
and the pattern-finding claim of May 2026 ends without real-data support. A two-sample construction that
conditions on each tick (a paired-permutation or rank test over the joint vector) would inherit the
`sign` kind's robustness and is the only path left for patterns; it is not designed here.

## 4. Not measured

Truly iid arms (every cell carried arm memory by registration); the conditioning-on-ticks alternative;
more than two coordinates; shape changes with mean and variance held.

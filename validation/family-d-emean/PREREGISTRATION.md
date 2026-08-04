# Pre-registration — is the fixed Family D path an e-process?

- **Study id:** `2026-08-family-d-emean`
- **Engine pin:** `v0.6.6-pre` at `d3d6d06` (disjoint-window evaluation).
- **Discipline:** `knowledge/methodology/pre-registration-discipline`.

Committed before any run.

## 1. The question

`d3d6d06` moved Family D's measured **crossing rate** from 0.5760 to 0.0005. It did **not** establish
`E[M_T | H₀] ≤ 1`, which is the property that makes the wealth an e-process and the hypothesis e-BH
requires.

`knowledge/stats/terminal-evalue-2026-08-02` measured safe-t at a **0.016 crossing rate with
`E[e] = 9,710`** on the same cell. The two quantities disagreed by four orders of magnitude. Markov
links them one way only: `P(M ≥ 1/α) ≤ α·E[M]`, so a clean crossing rate does not license the mean.

**Restoring Family D's α on the crossing-rate measurement alone would repeat the error that study
documented.** This measures the property directly.

## 2. Primary endpoint — E1

Under H₀ (iid Gaussian, oracle `μ₀`/`σ₀`, disjoint evaluation), for `T ∈ {300, 900}` ticks:

```
E[M_T]   over N = 4000 independent trajectories
```

**E1 FAILS iff the one-sided 95% lower confidence bound on `E[M_T]` exceeds 1.** Failing only on
evidence, as in both companion studies.

*The mean is the primary here, deliberately and against the companion battery's choice.* `E[M] ≤ 1`
is the definition of the object; the crossing rate is a consequence. The terminal study registered
the consequence and could not see the failure. That error is not repeated.

## 3. Secondary — E2, E3, reported not scored

- **E2** — p99 and max of `M_T`. Where the mass sits; a mean near 1 with a p99 in the thousands is a
  different object from a mean near 1 with a p99 near 1.
- **E3** — the same quantities on the **rolling** path, as the known-bad control.

## 4. Not-executable

The rolling path must show `E[M_T] ≫ 1` at both horizons. It measured a 0.576 crossing rate, so its
mean cannot be ≤ 1. If the control comes back clean, the harness is wrong and no cell is scored.

## 5. Registered expectation

The wealth increments are `z_t = r·u − ½r²` with `u` right-skewed and bounded rather than `N(0,1)`,
worth **~1.0023 per independent draw** (measured 2026-08-01). Disjoint evaluation gives 10 updates in
300 ticks and 30 in 900, so I expect `E[M_300] ≈ 1.023` and `E[M_900] ≈ 1.071` — **above 1, and E1 to
FAIL at both horizons**, marginally.

*If that is what happens, the honest conclusion is that Family D is not an e-process even on disjoint
windows, its α should stay at zero, and the remaining question is whether the ~2.3%-per-window
inflation is worth pricing as a `c`-bound rather than fixing.*

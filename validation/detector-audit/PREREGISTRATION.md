# Pre-registration — the detector audit: what each detector would need to produce a reliable e-value

**Registered 2026-08-04, before any arm was run.** Engine `v0.6.6-pre`. A programme, not a single
run; arms are added by addendum and each is registered before it executes.

## 1. Why

Validity evidence is currently scattered across three studies with **different instruments, different
nulls, and — the reason this exists — different configurations**. `stats/shipped-path-2026-08-04` and
`stats/family-c-shipped-2026-08-04` showed the entire Family C/E record was taken under
`covariance_method_override: 'mcd'`, a configuration **no compiled cell takes**. Nothing rules out the
same error elsewhere.

This audit re-measures every detector that can reach the FDR path, on **one instrument per detector
class**, against **one null set**, in the **shipped configuration**.

## 2. Scope, from the registry rather than memory

`fleet/e-bh-guarded.ts:36-45` is the authority on what may feed e-BH:

| detector | class | status entering the audit |
|---|---|---|
| `betting_e_process` | sequential | 0.9991–0.9999 on increments at **oracle φ**; never measured at estimated φ on this instrument |
| `page_cusum_mixture_supermartingale` | sequential | least characterised of the registry |
| `sequential_ui_e_process` | sequential | least characterised of the registry |
| `safe_t_e_value` | **terminal** | exceedance 0.0005–0.0015 under N2; one named exception at near-unit-root AR(1) |
| `universal_inference_e_value` | **terminal** | refuted nowhere; exceedance ≤ 0.0005 everywhere |
| `nuisance_robust_bf_e_value` | retracted | in the registry only to produce a *named* refusal |

Plus two outside the registry that still matter:

- **Family E conformal** — draws α, and `shipped-path` measured it **anti-conservative** on the
  shipped `mrcd` path (2.1× nominal) after the record said it was 240× silent.
- **Family D spectral** — already reclassified non-participating; included to confirm the
  reclassification holds on the shipped path rather than assume it.

Family C MMD is **excluded**: retired 2026-08-04, disabled at the stamp.

## 3. Two instrument classes, because one instrument would be wrong

**This is the design decision most likely to be got wrong, so it is stated first.**

- **Sequential detectors are wealth processes.** Instrument: the increment estimator
  `E[exp(Δ log M_t)]`, per `stats/terminal-mean-is-not-measurable` — the terminal mean is
  unmeasurable at feasible N, since a process with `E[M_T] = 1` **by construction** reads 0.0288.
  **REFUTED** iff the one-sided 95% lower bound exceeds 1; **CLEARED** iff the upper bound is below
  1.0005.
- **Terminal detectors emit one number per window.** There is no increment to take, and `E[e] ≤ 1`
  *is* the definition. Instrument: the **exceedance rate** `P(e ≥ 1/α)`, which Markov bounds by
  `α·E[e]` and which does not suffer the heavy-tail problem. The sample mean is reported and
  **scored by nothing** — the same status `../terminal-evalue/` gave it.

Applying the increment estimator to a terminal e-value, or the terminal mean to a wealth process,
would each produce a confident wrong answer. Both mistakes have already been made in this repo.

## 4. Nulls — reused verbatim, not reinvented

`../h0-battery/PREREGISTRATION.md` §N1–N7, unchanged, so results compose with that study rather than
forming a fourth incompatible record. N1 iid Gaussian oracle; N2 estimated μ̂/σ̂ at m ∈ {30,100,500};
N3 AR(1) oracle φ; N4 AR(1) estimated φ; N5 right-skewed; N6 heavy-tailed; N7 rolling vs disjoint.

## 5. Configuration — the correction this audit exists to make

**No overrides.** Default routing, and where a cell size selects the estimator
(`chooseCovarianceMethod` needs `n ≥ max(5p,200)` for `mcd`), both **n = 120** (corpus-realistic,
routes to `mrcd`) and **n = 600** are run. Any arm that cannot be reached without an override is
recorded as **UNREACHABLE and not scored** — reachability is a finding, not an obstacle to work
around, which is the error the whole Family C record made.

## 6. Per-detector output

For each: the verdict per null; **the regime boundary** — the null at which it stops holding; and
**what it would take**, drawn from the measurement rather than asserted. Only three shapes count as
an answer: a *construction* change, a *routing* restriction that keeps it inside its envelope, or
*retirement*.

## 7. Registered predictions

- **P1.** At least one registry detector is **refuted in the shipped configuration** despite a clean
  record — the C18 pattern repeating. I expect this and would be surprised by a clean sweep.
- **P2.** `betting_e_process` is **refuted at N4** (AR(1), estimated φ) on the increment estimator.
  Its clean 0.9991–0.9999 was measured at **oracle** φ, and the calibrator itself states the wealth is
  not a martingale under AR(1).
- **P3.** `safe_t_e_value` **holds** at N2 at every m — reproducing `../terminal-evalue/` — and
  **fails at N4**, the exception that study already named.
- **P4.** `universal_inference_e_value` holds **everywhere**, remaining the only detector refuted
  nowhere. It is a split-LRT Chernoff bound with `a` fixed at 1, so it is conservative by
  construction.
- **P5.** Family E is **anti-conservative at n=120** under default routing, reproducing
  `shipped-path` — and this is the arm most likely to show the record was configuration-dependent.
- **P6 — the one I expect to fail.** At least one detector is **CLEARED** (upper bound below 1.0005)
  somewhere. The bar is tight and no detector has met it in any study so far.

## 8. What this cannot establish

- **Nothing on real data.** Every null is synthetic; no corpus here carries enough signals to compile
  a multivariate detector at all. ADR 0012 measured `E[e|H₀]` of 24/9/9 on real telemetry and no
  synthetic battery here would find that.
- **Not refuted is not valid.** The increment estimator bounds the marginal; the conditional implies
  it but is not implied by it. Exceedance bounds via Markov; it does not establish `E[e] ≤ 1`.
- **It does not test the combination step.** That is proved in Lean and is not in question here.
- **It audits detectors against their own envelopes, never the envelope against the goal.** If the
  per-family-guarantee architecture is itself wrong, this programme cannot surface that.

## 9. Disclosure

I wrote or corrected most of the studies being superseded, and I produced several of the
configuration-dependent numbers this audit exists to re-check. P1 and P6 are registered as the
outcomes that would show the current record is worse than it looks.

---

# Amendment A1 — 2026-08-18. The detector-class taxonomy binds every future arm (WORKLIST C26, C24)

Appended, not edited; §§1–9 stand. This amendment registers forward — it changes no completed
arm's scoring and re-runs nothing. It exists because §3's two-class instrument rule was incomplete
in a way that produced two confident wrong answers on the record, and because the correction was
living in a WORKLIST row (`C26`) rather than in the registration future arms actually read.

## A1.1 — Three classes, not two, and the class determines the instrument

`stats/detector-audit-arm3-2026-08-05` established that §3's dichotomy omits a class and that the
omission is not benign. The registered taxonomy, binding on every arm run after this date:

| class | membership test | instruments that carry verdicts | instruments that are INVALID for it |
|---|---|---|---|
| **Test martingale** (Family A betting, Family A mixture, Family D e-detector) | per-tick multiplicative wealth, supermartingale claimed at every tick | the increment estimator `E[exp(Δ log M)]` (REFUTED iff lower 95% > 1; CLEARED iff upper < 1.0005) | the terminal mean (unmeasurable at feasible N — reads 0.0288 on a process with `E[M_T] = 1` by construction) |
| **Terminal e-value** (safe-t, universal inference) | one number per fixed window; no per-tick wealth exists | **both, always**: the exceedance rate `P(e ≥ 1/α)` AND the sample mean — the two are informative in opposite directions (the mean is uninformative below 1 and strong evidence above it; exceedance carries information only when `E[e]` is near 1) | either one alone. Exceedance alone passed a cell whose `E[e]` was 9,710 (N4-p09, `stats/detector-audit-terminal-2026-08-05`); Markov is vacuous there (0.05 × 9,710 ≈ 485) |
| **e-process** (sequential UI) | wealth exists, but the guarantee is `E[E_τ] ≤ 1` at stopping times — strictly weaker than a per-tick supermartingale | the stopped mean and the crossing rate | the increment estimator — it once "refuted" an e-process at 1.1×10⁸, caught only because the number was internally impossible (`stats/detector-audit-arm3-2026-08-05`) |

Class membership is decided from the construction, not the detector's name or its registry label —
the incidents above are what happens otherwise, and both mistakes were made in this repo within
one day.

## A1.2 — The both-instruments rule for the terminal class (closes WORKLIST C24's registration gap)

§3 scored the terminal sample mean "by nothing". That stance is RETIRED for future arms: every
terminal-class cell reports **both** exceedance and the sample mean, and a verdict that either
instrument contradicts is flagged rather than passed — the pattern the certification layer already
adopted when it registered the increment estimator as the terminal-class REPORTED instrument with
the across-draw caveat (coverage prereg Amendment v2.C39). Completed arms are not re-scored by
this amendment; their re-reading under the rule is already on the record
(`stats/terminal-mean-rule-contested`, coverage v2.C39.4).

## A1.3 — Scope

- No completed arm's verdict moves; nothing re-runs.
- The taxonomy governs this study's future arms and any successor audit citing this
  pre-registration. The certification protocol's own instrument rules are registered in its
  prereg and are not modified here.
- The e-process class's power arm and Family D's oscillation fault-class arm (C29 residual)
  remain named-not-done; when run, they are bound by this table.

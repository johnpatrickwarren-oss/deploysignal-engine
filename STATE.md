# Project state

**Last updated:** 2026-06-24 · **by:** John Warren (with Claude)

## What this is
`@johnpatrickwarren-oss/deploysignal-engine` — the statistical-detector engine (Family A/C/D/E
detectors, e-processes, hierarchical e-value combination, e-BH FDR, topology adapters), consumed by
DeploySignal and Tessera as a pinned git dependency.

## Done
- **Post-release research arc (ADRs 0005–0006) — read the actual e-betting literature, closed the gaps
  that have known solutions.** A verified deep-dive of the 2021–2026 e-value / anytime-valid literature,
  then primary-source reading (the summaries were ~40% wrong/misleading on guarantee-affecting points).
  - **ADR 0005 — safe-t (right-Haar / GROW) e-value** (`detectors/safe-t-e-value.ts`). The principled
    variance-nuisance fix: integrate σ out under the improper 1/σ prior (GROW-optimal; exactly
    σ-invariant, valid at all cal with known φ). KEY FINDING: this REATTRIBUTES the calibration floor —
    it is the AR(1) **φ plug-in**, not the variance (oracle φ is valid at all cal; estimated φ inflates
    below ~100). MIN_CALIBRATION kept; integrating φ out is now the sharpest open item.
  - **ADR 0006 — e-BH conditional-calibration boosting** (`fleet/e-bh-conditional-calibration.ts`).
    Reading Blier-Wong–Wang showed the threshold-sharpening gives NOTHING under arbitrary dependence
    (Prop 5) → DROPPED. Lee–Ren boosting ADOPTED via a self-contained CLOSED-FORM rule (our pivotal
    e-values ⇒ known null ⇒ `FIRE ⟺ thrObs·P(ẽ_j≥e_j) ≤ E[ẽ_j]`), provably valid (subset of the exact-φ
    firing ⇒ Lee-Ren Thm 1), deterministic superset (Thm 2), exact (no MC, no cliff). Doubles power
    (0.35→0.70) at FDR ≤ q. Full suite **181 pass / 0 fail**.
  - Process note: every guarantee-affecting step was taken from the primary theorem, not the survey;
    the safe-t + boosting were independently re-derived and cold-eyed.
- **ADR 0004 — the nuisance-robust evidence stack (PRs A–E), released v0.4.0-pre.** Promotes the
  Tessera-validated stack into the engine per the engine/consumer charter. The assembled pipeline
  `contaminationRobustResiduals → nuisanceRobustBFEValue → eBenjaminiHochberg` gives FP/FDR ≤ q
  BY CONSTRUCTION (conditional, enveloped); a distributional-signature detector covers the FD side; a
  baseline-lifecycle decides re-record timing. Full suite **168 pass / 0 fail**.
  - **PR A — valid per-shard BF e-value** (`detectors/nuisance-robust-bf-e-value.ts`, #21). The missing
    VALID e-value: a two-sample Bayes factor on AR(1)-whitened residuals, mean integrated out;
    E[BF|H0] ≤ 1 by construction (verified E[e]≈0.04, 100% detection, even under-powered where the
    plug-in blows up). Calibration floor `MIN_CALIBRATION_FOR_VALIDITY = 100` (cold-eye honesty fix:
    the plug-in innovation variance reintroduces invalidity below ~100).
  - **PR B — contamination-robust common-mode** (`fleet/common-mode.ts`, #22). `robustLocation`
    (redescending Tukey biweight) + per-shard demean make faults cross-sectional outliers; closes the
    ADR 0012 gap (FDP 0.72–0.77 → 0.02 ≤ q at 10% faults). Cold-eye decomposition: the DEMEAN is the
    load-bearing lever on this substrate (test does not claim Tukey > median).
  - **PR C — distributional-signature detectors** (`detectors/distributional-signature.ts`, #23). The
    FD-side complement to the BF (variance/trend/collapse). The trend t-stat runs on WHITENED
    innovations — whitened FP ~0.2% at every φ vs raw 15/33/50% at φ=.8/.9/.95 (~200–300× inflation).
  - **PR D — baseline-lifecycle drift-trigger** (`per-shard/baseline-lifecycle.ts`, #24). The decision
    machine ("when is the baseline stale"): triggers on sustained alarm RATE, not per-fire run-length.
    Clears-on-re-record verified byte-identical to the Tessera reference at cooldown≥window (200k-fuzz).
  - **PR E — validity envelopes + FDR-path gate** (`detectors/validity-envelope.ts`,
    `fleet/guarantee.ts`, #25). The honesty fix: plug-in betting/mixture e-values labelled INVALID under
    estimated baselines and gated out of the FDR path unless their regime is asserted; the BF retrofitted
    onto the shared type; `assembleFleetGuaranteeConditions` surfaces the by-construction conditions.
- Every PR independently cold-eyed (fresh-context audit) → SHIP; each surfaced a real honesty finding
  now documented rather than buried.
- **AR(1) pre-whitening on the betting e-process path** (earlier; `decisions/0001`). Betting detector
  consumes `ar1_phi`; mirrors the mixture-supermartingale pattern.

## In flight
- **Step 6 — Tessera migration** (in the Tessera repo): bump the engine pin `#v0.3.4-pre → #v0.4.0-pre`
  and migrate `tools/*` to thin validation harnesses over the promoted engine APIs.

## Next
- Tessera consumes `eBenjaminiHochberg` (drop `tools/fleet-fdr.ts:eBH`), the promoted BF
  (`nuisanceRobustBFEValue`), `contaminationRobustResiduals`/`robustLocation`, `distributionalSignature`,
  and the baseline-lifecycle; `tools/*` re-run as cross-checks (reports stay idempotent).
- (Future, ADR 0004-scoped) variance-robust BF (NIG/t mixture) to lift the calibration floor;
  multi-factor common-mode for heterogeneous loadings.

## Pointers
- Decisions: `decisions/` (ADR 0004 scopes the promotion; ADR 0001 betting-path)
- Added (ADR 0004): `detectors/nuisance-robust-bf-e-value.ts`, `detectors/distributional-signature.ts`,
  `detectors/validity-envelope.ts`, `fleet/common-mode.ts`, `fleet/guarantee.ts`,
  `per-shard/baseline-lifecycle.ts` (+ per-PR tests `test/adr-0004-pr-{a..e}-*.test.ts`)
- Source of truth (Tessera): `tools/{nuisance-robust-evalue,contamination-robust-fleet,fault-discriminator,
  lifecycle-monitor}.ts`; ADRs 0008/0014 (the plug-in invalidity PR E labels)

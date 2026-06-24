# Project state

**Last updated:** 2026-06-24 · **by:** John Warren (with Claude)

## What this is
`@johnpatrickwarren-oss/deploysignal-engine` — the statistical-detector engine (Family A/C/D/E
detectors, e-processes, hierarchical e-value combination, e-BH FDR, topology adapters), consumed by
DeploySignal and Tessera as a pinned git dependency.

## Done
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

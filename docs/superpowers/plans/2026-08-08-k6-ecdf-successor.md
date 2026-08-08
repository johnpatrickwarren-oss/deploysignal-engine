# K6 ECDF Successor Implementation Plan (C46) — draft, placed in repo at branch time

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and certify `shape_ecdf_conformal_bet`, the second registered K6 attempt, per the ratified design `~/concord/knowledge/methodology/pages/k6-ecdf-successor.md` — through the design gate, one registered attempt, to a coverage YES or a filed refutation.

**Architecture:** CvM distance to a fixed A-segment reference ECDF, block-conformal rank against B-segment blocks, κp^(κ−1) calibrator with κ from the design-time growth derivation, wealth producted over disjoint live windows. Reuses the coverage battery harness, the T2 clustersynth arm, and the certification scorer unchanged.

**Tech Stack:** TypeScript detector module + dist build; plain-mjs harness adapters; node:test.

## Global Constraints

- Branch off engine `main` AFTER the C44 PR merges; single worktree; PR-gated.
- One registered attempt; the design gate (E[log eAvg] at canonical d=1.5, W=30, m=200) decides build-vs-refute BEFORE the card freezes; gate outcome 2 ends the plan at Task 1 with the record filed.
- Registered constants (from the design page): W=30; A = held-out ticks 1–4000; B = ticks 4001–10000; m=200 blocks; CvM form frozen in the amendment; κ from the derivation; canonical cell = K6 mix-d1.5; grids/seeds/floors unchanged from the ratified matrix.
- Amendments (v2.K6E chain) committed BEFORE the artifacts they authorize; append-only results; stop conditions checked before any power reading; T1 + T2 both required for YES.
- Substrate: the corrected post-C1 continuous-stream heldoutRows ONLY; the serial-structure guard must remain in force on every run.
- Wiki read-only for implementers.

## Task 1: Design-gate derivation + Amendment v2.K6E
- Growth-criterion computation for the CvM-rank feature at canonical (non-registered seeds, disclosed probe with provenance): E[log eAvg] under null and alternative across κ grid; select κ*, record the three-outcome gate decision per the design page.
- Amendment v2.K6E: constants, κ* with derivation quoted, gate outcome, predictions for every endpoint the runs will read (healthy crossing bound, canonical detection expectation with its derivation, T2 expectation), stop conditions, T2 field registration (reuse the K6 registered supersession/field lists — name them, do not re-derive).
- If gate outcome 2 (anti-informative): file the refutation section in the amendment, STOP — remaining tasks do not run.

## Task 2: Detector module + tests (only if gate passes)
- `detectors/shape-ecdf-conformal-bet.ts`: `calibrateEcdfRef(rowsA)`, `ecdfBetWindow(window, calib, blocks)`, `ecdfBetWealth(...)` — signatures mirrored on the predecessor's module for harness reuse.
- TDD: exact CvM value on a hand-computed 4-point fixture; rank-p exactness against enumerable blocks; κ guard in (0,1); degenerate-reference guard (quantized/constant B-blocks); never-max fixture; NaN pathway; mutation-kill each.

## Task 3: Card S0 freeze + golden
- Card `shape_ecdf_conformal_bet.json`: class test_martingale, regime (stationary, clean-baseline, contamination boundary ε≥0.05 stated), quantifier tag proof on the rank identity (exact — reference fitted on A, ranked objects from B∪live only), falsifier, T2 requirement.
- Golden verdict registers expected pre-run tuple (S1 MISSING, S2 MISSING until runs exist — follow the predecessor's pre-run pattern).

## Task 4: Harness adapters + tests
- run-battery: K6 cells for the new detector (same 4-cell grid + arm-34 S2/S3); T2 arm: same runner, new detector, same shard census (600 pairs).
- Emission pins, cal_fingerprint, provenance fields — mirror the K6 rows' registered field set; positive controls for every guard; mutation-kill.

## Task 5: Registered runs + re-score
- T1 battery run; stop-condition check FIRST; then T2 arm; stop-condition FIRST; then cert re-score; golden delta (registered in v2.K6E); REPORT.md appends generated from committed JSON.
- Census + prediction table verified row by row; any deviation recorded not corrected.

## Task 6: PR + wiki write-back (controller)
- PR 'K6 successor: shape_ecdf_conformal_bet (C46)' with outcomes vs registered predictions, 'Merging is the operator's call.', Claude Code footer.
- Wiki: outcome appended to k6-ecdf-successor.md + fault-class-coverage-matrix.md + coverage source page lineage; WORKLIST C46 close-or-annotate; indexes + log; one scoped commit; artifact K6 panel update if the answer changes.

# SDD ledger — plan: open-items batch A (C51.1 + C47.1; operator ruled C52 option 1, open items authorized)
# worktree: ~/.sdd-worktrees/engine-batchA (branch open/batch-a from main@7529a63)
# task 1 (C51.1 + C47.1) — COMPLETE 2026-08-09. Report: task-1-report.md
# 6 commits: 8458033 5d35a72 00ad713 7353a52 46eb7ab 3e6ee9e
# C47.1 outcome (a) fired: self-fit excess 2.58e-6..4.55e-6 (registered R=4,000 range across two
#   generators) on a ~2.7e-3 per-point exceedance — 0.005%-0.009% of the distance to the alpha bar,
#   three orders inside the 0.004825 threshold. C47 item (1) closes as QUANTIFIED, no restructure.
# C51.1: crossing_time registered + emitted on six rows, FUTURE runs only; the registered run's
#   median falsifier stays UNEVALUATED (one-attempt rule) and no run that would read it is scheduled.
# suites at HEAD: test 351/0, test:cert 181/0, coverage-battery 151 (150 pass/1 skip/0 fail),
#   validate-cards 15 OK, cert:expiry all cards current.
# review corrections landed 2026-08-09: ab918b2 (prereg correcting append) + 6128ef0 (card re-freeze).
#   APPROVED with corrections. True excess ~1.0956e-6 (closed form 1.110875e-6, 1.39% agreement);
#   my registered headline [2.58e-6,4.55e-6] did NOT contain it, my post-measurement range did —
#   cause was my own C47.1.2 rule defect promoting the R=4,000 pair. Outcome (a) margin 4,404x;
#   direction z=+234. Concerns 3 (O(1/n) constant 4.06, measured) and 4 (family_E not in the
#   self-fit class, verified at stamp-heldout-family-e.mjs:73) both CLOSED. Mutation counts
#   corrected 2x -> 1/3/1/5. Concern 1 (falsifier evaluable-but-unread) still open by design.
# 5d19980: reviewer's family_E paragraph landed VERBATIM, superseding the relay block (which stands,
#   labelled). All four checkable claims verified from code: covariance is the literal [[1]] passed by
#   run-battery.mjs:648, cholesky([[1]])=[[1]] so s_t=|v| with no mean subtracted, and the indicator
#   rule #{s_cal>=s_t} < alpha*n gives 500/10001 = 0.0499950005 — conservative, opposite in sign to
#   the K4 excess. Concern 4 CLOSED. No card field or pinned file touched; expiry unaffected.

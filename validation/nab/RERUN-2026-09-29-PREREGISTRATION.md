# Pre-registration — the two NAB T3 harnesses re-run at the DeploySignal pin (`2026-09-nab-rerun-v0.12.2`, C85 part 3)

- **Study id:** `2026-09-nab-rerun-v0.12.2`
- **What it serves:** C85 part 3 (knowledge `WORKLIST.md`), the third of the three real-data runs
  John ordered on 2026-09-28. The two NAB studies that carry the thesis page's claim (1) and
  falsifiers 1 and 2 (`2026-09-nab-time-to-alert`, C75; `2026-09-nab-null-survival`, C76) ran on
  2026-09-05 at engine `eb60e63` and `4ce20f8` (v0.6.11-pre plus a few commits). DeploySignal now
  pins `v0.12.2-pre`, ten-plus releases later. This re-run executes both registered harnesses,
  unchanged, at the engine that ships, so the wiki's T3 numbers for the temporal path are at the
  pin rather than at an old commit.
- **Engine:** this commit, `d6a3946` on `main`, which is tag `v0.12.2-pre` (`0434afc`) plus PR #110
  (ADR 0036 text, CHANGELOG, and the `notes` string literals of the two twin envelopes in
  `detectors/twin-contrast.ts`; `git diff --stat v0.12.2-pre main -- detectors fleet per-shard tools
  types baseline guarantees.ts` shows that one file, 9 insertions and 2 deletions, all inside string
  literals the NAB harnesses never read).
  Nothing in `.ts` or `dist/` is touched by this registration.
- **Corpus:** `../NAB` at `ea702d75cc2258d9d7dd35ca8e5e2539d71f3140`, as both harnesses require.
- **Status: REGISTERED, NOT RUN.** Committed before either harness is invoked. A later change is
  an amendment, appended and dated.

## 1. What executes

1. `node validation/nab/time-to-alert/harness/run.mjs --mode live` (C75's harness, its registration
   `validation/nab/time-to-alert/PREREGISTRATION.md`, unchanged). Results land in
   `validation/nab/time-to-alert/results/live/run-<UTC>/`, beside the 2026-09-05 run.
2. `node validation/nab/null-survival/harness/run.mjs --mode live` (C76's harness, its registration
   `validation/nab/null-survival/PREREGISTRATION.md`, unchanged), **run only if step 1's `tool` arm
   reproduces C75's counts**: mixture 14, betting 11, e-SR 20 quiet-stretch alerts at the tool's
   cut. C76's harness aborts (`NOT-EXECUTABLE: C75 reproduction failed`, exit 3, no artifacts) on
   any other count, because its §5 pins the reproduction to C75's `cells.json`. At a new engine
   that pin may fail for the right reason, a detector arithmetic change since 2026-09-05, so:
   - if step 1 reproduces (14, 11, 20), step 2 runs and both studies have numbers at the pin;
   - if step 1 does not, step 2 is **NOT EXECUTABLE at this engine without a harness change**,
     which would be a new registration; this study then reports step 1 alone and names the
     engine delta as the finding. Step 2 is not run "to see", and the harness is not edited here.

Every bar, arm, trace, level and reading is the original registrations'; none moves. The bounded
e-SR arm of C76 (conditional on `bounded` in `dist/detectors/e-sr-mean-shift.js`) is present at
this commit and will run if step 2 runs.

## 2. Endpoints

The original registrations' endpoints, read by the original `analysis/report.mjs` and
`analysis/check_report.mjs` of each study on the new run directory. Added by this registration,
report only:

- **D1 — the engine delta, per (detector, level):** the 2026-09-05 count minus the pin's count,
  for C75's `n_pre`, `n_in`, `n_late`, `n_none` and the falsifier reading, and for C76's P1
  alerting counts and survivor set.

## 3. Predictions (no authority)

- P1: step 1 reproduces (14, 11, 20). The Family A mixture and betting cards and the Gaussian
  e-SR were not changed between `eb60e63` and `v0.12.2-pre` in a way that alters their alert
  ticks on a fixed series (ADRs 0031, 0034 and 0035 added constructions and gate premises beside
  them). Risk stated: any numerical change in the shared whitening or wealth bookkeeping would show
  as a delta and void step 2.
- P2: C75's falsifier reading is unchanged at the pin: it does not fire for the mixture or betting
  at α = 0.05 or 0.01 and fires at the tool's α ≈ 6.7×10⁻⁵.
- P3: if step 2 runs, the survivor set is unchanged: universal inference alone holds its contract
  at every head length; the mixture, betting, e-SR and bounded e-SR clear no arm.

## 4. NOT-EXECUTABLE

The harnesses' own conditions: `../NAB` not at the registered commit, a derived trace set other
than C75's 23, an exception (no catch; a throw aborts and the partial directory is kept unscored).
For step 2, the reproduction failure above. This registration adds none.

## 5. Not measured

Any detector or construction the two harnesses do not drive; any bar, α or window length other
than the registered ones; DeploySignal's gate (the harnesses drive engine detector cards on single
series); anything on a corpus other than NAB.

# Pre-registration — the Ville-only NAB re-run and the Q69.D retirement (WORKLIST C3, C8)

Committed before any code change or run. Engine `main` post-#69 at branch time; NAB corpus
unchanged at `github.com/numenta/NAB @ ea702d7` (verified against the local clone).

## 1. What executes, and on whose authority

1. **Q69.D — full retirement of the classical Page-CUSUM.** The decision is Q68's, registered in
   `detectors/_page-cusum-mixture.ts:12-19` ("full retirement at Q69 .D when NAB tooling
   re-derives for Ville-bounded variants") and carried as WORKLIST C8 with close condition
   `file_absent: detectors/_page-cusum-classical.ts`. The blocking condition is discharged: the
   NAB tool was the classical helper's only caller, retained so the replacement could be scored
   against it — and the replacement has since been scored on the better instrument
   (`stats/effect-size-sweep-2026-08-04`: the mixture dominates the retired classical at every
   δ < 2.5σ; "Q69 .D deadline pressure released"), while the NAB comparison itself was retracted
   as three-way-confounded and silence-floor-distorted (`stats/ville-validity-costs-nab-power`,
   C2 check 2026-07-31). Scope: delete `_page-cusum-classical.ts` (evaluateFamilyAShadow,
   evaluateCUSUM, lookupCellParams — the whole classical API), relocate the shared
   `FamilyAShadowCtx` type, remove the `family_A_page_cusum` arm from the NAB tooling
   (types, dispatch, per-dataset registration), update the one test that drives it.
2. **C3 — a third committed NAB report**, Ville-bounded detectors only
   (`family_A_betting`, `family_A_mixture_supermartingale`, `family_D_spectral`), both
   configurations of the committed reproduction recipe (default; `--ar-p-calibration
   --seasonal-decomposition`), same floors, same corpus pin.

## 2. Registered expectations and rules

- **Floors verdict as computed.** Q64.2 floors (A best-of ≥ 50; D ≥ 40) are expected to
  **still fail** — no Ville detector reached 30 on 2026-07-17 and nothing since was NAB-tuned.
  The standing instruction ("must not be cited as passed anywhere") remains in force unless
  `combined = true`, in which case it lifts and the wiki is updated instead.
- **No numeric bands are registered on the scores.** The engine detectors have changed since
  2026-07-17 (disjoint Family D cadence, AR(1) work, log-domain wealth), so scores may move in
  either direction; movement is reported, not scored. The **best-of-A definition changes
  mechanically**: with the classical arm deleted, best-of-A is over the two Ville A-detectors.
  For continuity the report README states the 2026-07-17 classical figures beside the new table
  as historical record.
- **The silence floor is stated in the artifact.** Six of 35 datasets carry zero annotation
  windows; never-firing scores 17.14 on the aggregate. The 2026-07-17 README omitted this
  (added later on the wiki); the new README section carries it so the artifact is
  self-qualifying.
- **Certification is untouched**: `validation/nab/` has no `results/live/` layout, so
  `collect.mjs` pools nothing from it; no card cites NAB. Verified after the run via the cert
  suite; a movement is stop-and-assess.
- **One attempt per configuration.** A tooling defect found mid-run: preserve, fix test-first,
  re-run under this unchanged registration.

## 3. Consumer note, registered so the re-pin cost is named

deploysignal pins engine `v0.6.6-pre` (untouched by this change) and carries its own Q64-era
copies: `tools/_run-nab-validation-dispatch.ts` imports `evaluateFamilyAShadow`, and two tests
import `evaluateCUSUM` / `lookupCellParams` from the package. **Any future re-pin to an engine
carrying Q69.D must retire those imports on the deploysignal side** — this is a named cost of
the re-pin (recorded also at `stats/family-d-e-detector-retirement`'s reversal gate), not a
reason to keep the classical API alive in the engine.

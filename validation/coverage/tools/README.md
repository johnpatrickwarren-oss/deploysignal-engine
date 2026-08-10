# `validation/coverage/tools/` — committed probe provenance

**These are PROBES, not harnesses.** Nothing here writes a run directory, emits a cell, or feeds
`validation/certification/lib/collect.mjs`. They exist so that figures quoted in
`../PREREGISTRATION.md` rest on committed code rather than on a scratch directory that no longer
exists — the C50 review's F6 finding.

The registered measurement harnesses are `../harness/run-battery.mjs`,
`../harness/run-clustersynth-arm.mjs` and `../harness/run-acrossdraw.mjs`. A probe here may be run
at any time; a harness may not, and its runs are append-only.

| script | figures it produces | registered in |
|---|---|---|
| `overlap-screen.mjs` | the A/B overlap's cost on an i.i.d. substrate, four reference layouts, paired | v2.K6A.7 K6A.7.3 + the correction append's F2 |
| `placement-probe.mjs` | the 12-fresh-seed placement bands and the B-placement DOF, on clustersynth | v2.K6A.7 K6A.7.4 / K6A.7.8 |
| `ks-decomposition.mjs` | the `p_uniformity` KS excess split into atom / shared-reference / residual, both shape constructions | v2.C45 C45.2 / C45.3 |
| `strict-phi-counterfactual.mjs` | what the rejected strict reading of `phi_known` would cost: the per-stage in-regime counts and surviving verdicts for `safe_t_e_value`, then **every card's verdict and every class answer**, portfolio-wide, through `overallVerdict` | Erratum v1.5 C43.5 + the review append's F1 |
| `relabel-rescore.mjs` | the per-detector `null_id` relabel's scoring consequence: the committed cells with the new ids, re-annotated as `collect.mjs` does and re-scored by the real `scoreS2`/`scoreS3`/`coverageFor`/`pairingGaps` | Amendment v2.C43.1 C43.1.3 |
| `self-fit-exchangeability.mjs` | the size of `point_tail_bet_e_value`'s self-fit exchangeability gap (K4.1.10): the healthy per-point exceedance and `E[e]` of the AS-BUILT self-fit reference against an OUT-OF-FOLD reference fitted on a disjoint split, paired, at the registered `n = 10,000`, both endpoints computed EXACTLY in closed form against the substrate CDF | Amendment v2.C47.1 C47.1.2 / C47.1.3 + its results append |

**Seed discipline, binding on anything added here.** Probe seed bases are `>= 6e8` and are disclosed
in the amendment that quotes their output; every registered seed in this study is `<= 1e8`. Bases in
use: `7.1e8` (`overlap-screen.mjs`), `8.4e8` / `8.5e8` (`ks-decomposition.mjs`, K6-slow / K6), `6.3e8`
(`self-fit-exchangeability.mjs`). A probe must never be run on a registered scenario seed in a layout
whose endpoint has not yet been read — that is peeking, and K6A.7.8 records the one place this rule
was load-bearing.

**One probe that imports the real detector.** `self-fit-exchangeability.mjs` scores BOTH of its arms
through the unmodified `dist/detectors/point-tail-bet-e-value.js` — the calibrator, `kappa`,
`countGte` and the `(1 + rank)/(n + 1)` form are shared code, so its comparison cannot be an artefact
of a second implementation of the construction under test. It reimplements exactly one thing, the
out-of-fold *assembly* of a `TailBetCalibration`, which is the construction that does not exist in the
module and is the point of the comparison. Its wiring checks assert `erfc` at RELATIVE accuracy
against published values, the registered firing rank `K = 26` derived from the module's own `kappa`,
the MAD-cancellation identity against the real module, and its exact endpoints against a
360,000-point deterministic quadrature of the real module — so a rank-algebra error surfaces as a
failed assertion rather than as a published number.

**Two probes that draw nothing.** `strict-phi-counterfactual.mjs` and `relabel-rescore.mjs` read only
committed JSON from an already-scored certification run: no generator, no seed, no substrate. The seed
discipline above is vacuous for both, and they are listed here for the same reason as the others — the
figures they produce are quoted in `../PREREGISTRATION.md` and must rest on committed code. **Both
import the real scorer** (`../../certification/lib/`) rather than re-implementing a rule, so a scorer
change cannot leave their published numbers silently stale; both are re-runnable against any scored run
directory, and both report per card when the committed `perCell` input is incomplete rather than
scoring a partial input as if it were whole.

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
| `strict-phi-counterfactual.mjs` | what the rejected strict reading of `phi_known` would cost `safe_t_e_value`: the per-stage in-regime counts, the surviving verdicts, and the class answers under a hypothetically regime-gated class layer | Erratum v1.5 C43.5 |

**Seed discipline, binding on anything added here.** Probe seed bases are `>= 6e8` and are disclosed
in the amendment that quotes their output; every registered seed in this study is `<= 1e8`. Bases in
use: `7.1e8` (`overlap-screen.mjs`), `8.4e8` / `8.5e8` (`ks-decomposition.mjs`, K6-slow / K6). A probe
must never be run on a registered scenario seed in a layout whose endpoint has not yet been read —
that is peeking, and K6A.7.8 records the one place this rule was load-bearing.

**A probe that draws nothing.** `strict-phi-counterfactual.mjs` reads only committed JSON from an
already-scored certification run: no generator, no seed, no substrate. The seed discipline above is
vacuous for it, and it is listed here for the same reason as the others — the figures it produces are
quoted in `../PREREGISTRATION.md` and must rest on committed code.

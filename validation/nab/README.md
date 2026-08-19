# NAB validation — first committed runs (2026-07-17)

First committed results of the NAB (Numenta Anomaly Benchmark) validation tooling
(`tools/run-nab-per-dataset.ts`). Until now the tooling existed but no result
artifacts were committed anywhere; the 2026-07-16 external review flagged that gap,
and the remediation disposition was to run it and commit whatever it shows.

## Headline result — honest negative

**The detector families do not clear the repo's own Q64.2 acceptance floors on NAB
as currently calibrated, under either configuration tried.**

| Detector | Standard (default cfg) | Standard (AR(p)+seasonal) | Q64.2 floor | Passes |
|---|---|---|---|---|
| family_A_betting | 27.06 | 27.78 | — (A best-of ≥ 50) | no |
| family_A_page_cusum | **35.50** | 26.52 | — (A best-of ≥ 50) | no |
| family_A_mixture_supermartingale | 23.45 | 23.66 | — | no |
| family_D_spectral | 29.79 | 29.79 | ≥ 40 | no |

Acceptance: `family_A_passes = false` (best-of A standard = 35.50 vs floor 50),
`family_D_passes = false` (29.79 vs 40), `combined = false` in both runs.

Notes for interpretation:

- The opt-in calibration paths (`--ar-p-calibration --seasonal-decomposition`) do
  **not** help — Page-CUSUM degrades materially (35.50 → 26.52); the defaults are
  the stronger configuration on this corpus.
- NAB's published leaderboard context: Numenta HTM ≈ 70, Twitter ADVec ≈ 47,
  Etsy Skyline ≈ 35, random ≈ 11 (standard profile). Family A Page-CUSUM sits at
  Skyline level; that is plausible for detectors designed for baseline-referenced
  canary gating rather than general streaming anomaly detection, but it is below
  the floor this repo's own Q64.2 spec set for the "NAB firewall" claim.
- Single calibration-signal class (`p99_latency`) per the tool default; four NAB
  sub-benchmarks (realKnownCause, realAWSCloudwatch, artificialNoAnomaly,
  artificialWithAnomaly); probationary fraction 0.15.
- Consequence for claims: the "NAB firewall for Families A/D structural-validity
  floor" (referenced in DeploySignal's CHEAT-SHEET as deferred follow-on) is now
  **run, and failing** — it must not be cited as passed anywhere. Downstream docs
  should reference this directory.

## Files

- `report-2026-07-17-default.json` — default configuration (SLICE 5 AR(1)
  pre-whitening + SLICE 6 anomaly-likelihood smoothing on).
- `report-2026-07-17-arp-seasonal.json` — `--ar-p-calibration
  --seasonal-decomposition` opt-ins.

## Reproduce

```bash
# NAB corpus at ../NAB (github.com/numenta/NAB @ ea702d7)
node dist/tools/run-nab-per-dataset.js --nab-repo ../NAB --out report.json
node dist/tools/run-nab-per-dataset.js --nab-repo ../NAB \
  --ar-p-calibration --seasonal-decomposition --out report-arp-seasonal.json
```

## Follow-on candidates (not started)

- Per-signal-class calibration sweep (the tool exposes `--calibration-signal`).
- Threshold/likelihood tuning against the NAB probationary period (would need a
  train/validation split to avoid tuning on the scored corpus).
- Re-scoring after the Q2.B calibration-coherence fixes land in DeploySignal.

## 2026-08-18 — the Ville-only re-run (C3) and the Q69.D retirement (C8)

Governed by `RERUN-2026-08-18-PREREGISTRATION.md`, committed before the code change and the run.

**The classical `family_A_page_cusum` arm is retired from this tooling with the classical
detector itself** (`detectors/_page-cusum-classical.ts` deleted at Q69.D; best-of-A is now over
the two Ville A-detectors). The 2026-07-17 reports above are the classical arm's last committed
record: Page-CUSUM standard 35.50 (default) / 26.52 (arp-seasonal).

| Detector | 2026-08-18 default | 2026-08-18 arp-seasonal | floor | passes |
|---|---|---|---|---|
| `family_A_betting` | 27.06 | 27.78 | A best-of ≥ 50 | no |
| `family_A_mixture_supermartingale` | 23.45 | 23.66 | — | no |
| `family_D_spectral` | 29.79 | 29.79 | ≥ 40 | no |

`family_A_passes = false` (best-of Ville-A 27.06 vs 50); `family_D_passes = false` (29.79 vs 40);
`combined = false` in both runs. **The standing instruction is unchanged: these floors must not
be cited as passed anywhere.** Per-dataset rows are bit-identical to 2026-07-17 for the three
retained detectors — the tool is deterministic and no engine change since then touches the code
paths it drives.

**The silence floor, stated here so the artifact is self-qualifying** (added to the wiki
2026-07-31, previously missing from this README): six of the 35 datasets carry zero annotation
windows and score 100 for silence, so a detector that never fires scores `100 × 6/35 = 17.14` on
the aggregate — the floor is 17.14, not 0, and not the leaderboard's "random ≈ 11". Above that
floor the 2026-08-18 readings are: betting 9.92, mixture 6.31, spectral 12.65.

- `report-2026-08-18-default.json` — Ville-only, default configuration.
- `report-2026-08-18-arp-seasonal.json` — Ville-only, `--ar-p-calibration
  --seasonal-decomposition`.

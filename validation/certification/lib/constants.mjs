export const CLASSES = ['test_martingale', 'terminal_e_value', 'e_process'];
// C1 vocabulary fix: the terminal instruments are `exceedance` and the MEAN. The mean's
// field name in the corpus is `mean_e` (validation/terminal-evalue/harness/run.mjs:95).
// This table said `mean_above_1` until 2026-08-07 -- a field that exists in no cell in
// any run, so mean-bearing cells were never recognized as carrying their class's second
// instrument and the protocol's mean rule had nothing to fire on. The protocol names the
// instrument "exceedance and mean above 1, scored jointly"; `mean_above_1` was that
// English read as a field name.
export const CLASS_INSTRUMENTS = {
  test_martingale: ['increment_estimator'],
  terminal_e_value: ['exceedance', 'mean_e'],
  e_process: ['stopped_mean', 'crossing_rate'],
};
// The registered bound a terminal e-value's mean is scored against: E[e|H0] <= 1.
// Registered 2026-08-07 with the third card freeze; a mechanical-verdict protocol's
// numbers cannot drift between runs. See stats/terminal-mean-is-not-measurable for why
// only readings ABOVE this bound carry evidence.
export const TERMINAL_MEAN_BOUND = 1;
// Registered 2026-08-06 with the claim-card freeze; do not move (protocol: mechanical verdict).
export const INERTNESS_FLOOR = 0.10;
export const INERTNESS_SHIFT_SIGMA = 3;
export const TIERS = ['T1', 'T2', 'T3'];

// Tier of the substrate a study ran on (protocol "Evidence tiers"): T1 house synthetic,
// T2 independent synthetic, T3 real telemetry. Mechanical rule, in precedence order:
//   1. an explicit `tier` on the run manifest wins (a study that knows its own substrate
//      says so; this is the only way a T3 run can declare itself today);
//   2. a study name whose tokens include `real` (real-telemetry, gwdg-real, ...) is T3;
//   3. `clustersynth` anywhere in the name is T2 -- the generator the detectors were not
//      tuned against;
//   4. otherwise T1.
// Token-bounded on purpose: a bare substring test would read 'realignment' as real telemetry.
const REAL_SUBSTRATE = /(^|[-_.\s])real([-_.\s]|$)/i;
export const tierOfStudy = (study, declaredTier = null) => {
  if (declaredTier != null) {
    if (!TIERS.includes(declaredTier)) throw new Error(`unregistered tier "${declaredTier}" (expected one of ${TIERS.join('|')})`);
    return declaredTier;
  }
  const name = String(study ?? '');
  if (REAL_SUBSTRATE.test(name)) return 'T3';
  if (/clustersynth/i.test(name)) return 'T2';
  return 'T1';
};

export const VERDICTS = ['USE', 'ADVISORY', 'REFUSE', 'NOT_EXECUTABLE', 'EXPIRED'];

/** Every verdict the scorer emits passes through here, so a token outside the registered
 *  vocabulary is a crash rather than a card nobody can interpret. */
export function assertVerdict(verdict) {
  if (!VERDICTS.includes(verdict)) {
    throw new Error(`unregistered verdict "${verdict}" (registered: ${VERDICTS.join('|')})`);
  }
  return verdict;
}

export const COVERAGE_FLOOR = 0.50;
export const FAULT_CLASSES = Object.freeze({
  K1: { name: 'per-metric step shift',      canonical: '1.5sigma',        grid: ['0.75sigma', '1.5sigma', '3sigma'] },
  K2: { name: 'group-in-unison',            canonical: 'K10-e0.5sigma',   grid: ['K5-e0.25sigma', 'K5-e0.5sigma', 'K10-e0.25sigma', 'K10-e0.5sigma', 'K10-e0.75sigma', 'K20-e0.25sigma', 'K20-e0.5sigma'] },
  K3: { name: 'sub-threshold oscillation',  canonical: 'A0.75sigma-f0.05', grid: ['A0.5sigma-f0.02', 'A0.5sigma-f0.05', 'A0.75sigma-f0.02', 'A0.75sigma-f0.05', 'A0.75sigma-f0.1'] },
  K4: { name: 'far-outside-norm point',     canonical: '5sigma-point',    grid: ['3sigma-point', '5sigma-point', '8sigma-point'] },
  K5: { name: 'slow drift',                 canonical: 'slope1e-4',       grid: ['slope5e-5', 'slope1e-4', 'slope5e-4'] },
  K6: { name: 'distributional shape change', canonical: 'mix-d1.5',       grid: ['mix-d1.0', 'mix-d1.5', 'mix-d2.0'] },
});

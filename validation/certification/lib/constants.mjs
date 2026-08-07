export const CLASSES = ['test_martingale', 'terminal_e_value', 'e_process'];
export const CLASS_INSTRUMENTS = {
  test_martingale: ['increment_estimator'],
  terminal_e_value: ['exceedance', 'mean_above_1'],
  e_process: ['stopped_mean', 'crossing_rate'],
};
// Registered 2026-08-06 with the claim-card freeze; do not move (protocol: mechanical verdict).
export const INERTNESS_FLOOR = 0.10;
export const INERTNESS_SHIFT_SIGMA = 3;
export const TIERS = ['T1', 'T2', 'T3'];
export const tierOfStudy = (study) => (/clustersynth/i.test(study) ? 'T2' : 'T1');
export const VERDICTS = ['USE', 'ADVISORY', 'REFUSE', 'NOT_EXECUTABLE', 'EXPIRED'];

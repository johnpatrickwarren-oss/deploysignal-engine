import { applyGuards } from './guards.mjs';
import { INERTNESS_FLOOR, INERTNESS_SHIFT_SIGMA, TIERS } from './constants.mjs';

const isValidityCell = (c) => 'increment_estimator' in c || 'stopped_mean' in c || 'exceedance' in c;
const isPowerCell = (c) => 'detection_rate' in c;

const inRegime = (cell, regime) =>
  (cell.phi == null || regime.phi_max == null || cell.phi <= regime.phi_max) &&
  (cell.m == null || regime.m_min == null || cell.m >= regime.m_min);

const minTier = (tiers) => {
  const present = tiers.filter((t) => t != null);
  if (present.length === 0) return null;
  return present.reduce((best, t) => (TIERS.indexOf(t) < TIERS.indexOf(best) ? t : best), present[0]);
};

export function scoreS2(card, cells) {
  const regime = card.guarantee.regime;
  const perCell = [];
  const excluded = [];
  const missing = [];
  let voided = false;

  for (const cell of cells) {
    if (!isValidityCell(cell)) continue;
    const guard = applyGuards(cell, card.class);
    if (guard.status === 'VOID') {
      voided = true;
      perCell.push({ ...cell, mapped: 'VOID', reason: guard.reason });
      continue;
    }
    if (guard.status === 'NON_FINITE') {
      excluded.push({ detector: cell.detector, null_id: cell.null_id, reason: guard.reason });
      continue;
    }
    const out_of_regime = !inRegime(cell, regime);
    if (guard.status === 'VACUOUS') {
      perCell.push({ ...cell, mapped: 'NOT_EXECUTABLE', reason: guard.reason, out_of_regime });
      continue;
    }
    perCell.push({ ...cell, mapped: cell.verdict, out_of_regime });
  }

  if (voided) {
    return { status: 'VOID', perCell, excluded, missing };
  }

  const inRegimeMapped = perCell.filter((c) => !c.out_of_regime && (c.mapped === 'CLEARED' || c.mapped === 'REFUTED'));

  let status;
  if (inRegimeMapped.some((c) => c.mapped === 'REFUTED')) {
    status = 'REFUTED';
  } else if (inRegimeMapped.length === 0) {
    status = 'MISSING';
  } else {
    status = 'PASS';
  }

  return { status, perCell, excluded, missing };
}

export function scoreS3(card, cells) {
  const regime = card.guarantee.regime;
  const perCell = [];
  const missing = [];

  for (const cell of cells) {
    if (!isPowerCell(cell)) continue;
    if (cell.shift_sigma !== INERTNESS_SHIFT_SIGMA) continue;
    if (!inRegime(cell, regime)) continue;
    perCell.push(cell);
  }

  let status;
  if (perCell.length === 0) {
    status = 'MISSING';
  } else if (perCell.some((c) => c.detection_rate < INERTNESS_FLOOR)) {
    status = 'INERT';
  } else {
    status = 'PASS';
  }

  return { status, perCell, missing };
}

export function scoreS4(card) {
  const kind = card.shipped_path.kind ?? '';
  const reasons = [];

  if (kind.includes('p-value') && card.budget.participating) {
    reasons.push('shipped path is a p-value combination and the budget is participating: unanswered combination question is a refusal, not a pass (C25)');
    return { status: 'REFUSE', reasons };
  }

  if (kind.includes('bootstrap threshold substitution')) {
    const hasCBound = (card.prior_evidence ?? []).some((e) => e.stage === 'S4');
    if (!hasCBound) {
      reasons.push('shipped path substitutes a bootstrap threshold and no measured c-bound artifact is cited in prior_evidence[stage=S4]');
      return { status: 'UNPRICED', reasons };
    }
  }

  return { status: 'PASS', reasons };
}

export function overallVerdict(card, s2, s3, s4) {
  const regime = card.guarantee.regime;
  const reasons = [];

  if (s2.status === 'VOID') {
    reasons.push('S2 is VOID');
    return { verdict: 'NOT_EXECUTABLE', tier: null, regime, reasons };
  }

  if (s2.status === 'REFUTED') {
    reasons.push('S2 in-regime refutation');
    return { verdict: 'REFUSE', tier: null, regime, reasons };
  }

  if (s2.status === 'MISSING' || s3.status === 'MISSING') {
    reasons.push('S2 or S3 has no scoreable evidence');
    return { verdict: 'NOT_EXECUTABLE', tier: null, regime, reasons };
  }

  if (s3.status === 'INERT') {
    reasons.push('S3 inert across all claimed cells: valid-but-inert fails USE');
    return { verdict: 'ADVISORY', tier: null, regime, reasons };
  }

  if (s4.status === 'REFUSE') {
    reasons.push(...s4.reasons, 'budget participation refused');
    return { verdict: 'ADVISORY', tier: null, regime, reasons };
  }

  const supportingTiers = [
    ...s2.perCell.filter((c) => !c.out_of_regime && c.mapped === 'CLEARED').map((c) => c.__tier),
    ...s3.perCell.map((c) => c.__tier),
  ];
  const tier = minTier(supportingTiers);

  if (s4.status === 'UNPRICED') {
    reasons.push(...s4.reasons, 'USE capped at ADVISORY until the c-bound is measured');
    return { verdict: 'ADVISORY', tier, regime, reasons };
  }

  return { verdict: 'USE', tier, regime, reasons };
}

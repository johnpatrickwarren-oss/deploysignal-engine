import { CLASSES } from './constants.mjs';

export function validateCard(card) {
  const errs = [];
  const req = (cond, msg) => { if (!cond) errs.push(msg); };
  req(card.protocol_version === 1, 'protocol_version must be 1');
  req(typeof card.detector_id === 'string' && card.detector_id.length > 0, 'detector_id required');
  req(Array.isArray(card.aliases), 'aliases must be an array');
  req(CLASSES.includes(card.class), `class must be one of ${CLASSES.join('|')}`);
  req(card.engine_pin && 'version' in card.engine_pin && 'sha' in card.engine_pin, 'engine_pin{version,sha} required');
  req(Array.isArray(card.source_files) && card.source_files.length > 0
      && card.source_files.every((f) => f.path && 'sha256' in f), 'source_files[{path,sha256}] required');
  const g = card.guarantee ?? {};
  req(typeof g.sentence === 'string' && g.sentence.length > 0, 'guarantee.sentence required');
  req(Array.isArray(g.quantifiers), 'guarantee.quantifiers must be an array');
  for (const q of g.quantifiers ?? []) {
    req(['proof', 'empirical'].includes(q.tag), `quantifier "${q.text}" tag must be proof|empirical`);
    if (q.tag === 'proof') req(!!q.proof_artifact, `quantifier "${q.text}": proof tag requires proof_artifact`);
  }
  req(g.regime && 'phi_max' in g.regime && 'm_min' in g.regime, 'guarantee.regime{phi_max,m_min,...} required');
  req(card.shipped_path && typeof card.shipped_path.kind === 'string', 'shipped_path.kind required');
  req(card.budget && typeof card.budget.participating === 'boolean', 'budget.participating required');
  req(typeof card.falsifier === 'string' && card.falsifier.length > 0, 'falsifier required');
  req(Array.isArray(card.prior_evidence), 'prior_evidence must be an array');
  return errs;
}

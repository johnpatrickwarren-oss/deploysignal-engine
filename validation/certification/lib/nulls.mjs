// validation/certification/lib/nulls.mjs
//
// C2 -- the mechanical null_id -> {phi, phi_source, params} derivation.
//
// WHY THIS EXISTS. The scorer's regime check needs each cell's phi. Almost no run
// records one: of the 1,700-odd corpus cells only detector-audit-sequential (36) and
// shape-battery (29) carry a `phi` field. Reading a missing phi as "in regime"
// (the pre-fix behaviour) admitted every cell into every claimed regime for free.
// Reading it as "unknown, refuse" without deriving first would throw away evidence
// whose phi is written on its face: the null ids ENCODE it.
//
// SOURCE OF TRUTH. `validation/h0-battery/harness/nulls.mjs`'s NULLS table. That table
// is the registered battery; `validation/terminal-evalue/harness/run.mjs` imports its
// generators (`rng`, `gaussFrom`) and its PREREGISTRATION section 5 says the battery is
// "Reused from ../h0-battery/harness/nulls.mjs so the two studies are comparable", with
// "Oracle phi is threaded for N1 and N3". So one grammar covers both studies, and any
// study that reuses the id vocabulary inherits it.
//
//   | id             | phi        | what the detector had to estimate            |
//   |----------------|------------|----------------------------------------------|
//   | N1             | 0          | nothing (oracle params, iid Gaussian)        |
//   | N2-m{30,100,500} | 0        | the baseline moments mu, sigma (cal IS the estimate) |
//   | N3-p{03,06,09} | 0.03/06/09 | nothing -- ORACLE phi supplied (opts.ar1Phi) |
//   | N4-p{06,09}[-m100] | 0.6/0.9 | phi ITSELF, fitted on the cal window        |
//   | N5, N6         | 0          | nothing; iid lognormal / t3, moments matched |
//   | N7             | 0          | nothing (oracle params, ROLLING windows)     |
//
// PHI IS KNOWN vs PHI IS ESTIMATED. `phi_source` splits the ids on the axis safe-t's
// frozen guarantee sentence turns on ("given known phi <= 0.95"). ADR 0005 and
// `detectors/safe-t-e-value.ts`'s header put the residual calibration floor on the phi
// plug-in specifically, not on the variance and not on the mean: with `opts.ar1Phi`
// supplied the e-value is valid at cal >= 3, without it short-window phi-hat error keeps
// E[e|H0] > 1 below cal ~ 100. So:
//
//   - 'oracle'              -- phi was supplied to the detector (N1, N3, N7).
//   - 'iid-by-construction' -- the null has no AR(1) term, so phi is 0 and known
//                              even though the detector still ran its estimator on the
//                              cal window (N2, N5, N6).
//   - 'estimated'           -- the null IS autocorrelated and the detector had to fit
//                              phi from a finite cal window (N4). This is the only
//                              class of cell a "known phi" regime does not cover.
//
// A stricter reading is available and NOT taken here: PREREGISTRATION section 5 threads
// `opts.ar1Phi` only for N1 and N3, so under "phi is known iff the caller passed it"
// N2/N5/N6 would also fall outside a known-phi regime. That reading was rejected because
// a regime bounds DATA-GENERATING conditions, not API call shapes -- phi is 0 and known
// to the operator on an iid null whatever the detector does internally -- and because it
// changes no verdict: safe-t's N2/N5/N6 cells clear either way (mean_e 0.08-0.44).
// The boundary is recorded in the run report.

// N<k> optionally followed by -p<digits> (phi, leading zero then the decimals: p06 is 0.6,
// p03 is 0.3, p095 is 0.95 -- the form used in every registered null id and in the
// phi-sweep) and/or -m<digits> (calibration length).
const NULL_ID = /^N([1-7])(?:-p(\d{2,3}))?(?:-m(\d+))?$/;
const phiOf = (p) => Number(`0.${p.replace(/^0+/, '')}`);

/** Mechanical derivation from the registered null-id grammar. Returns null for any id
 *  outside it -- an unrecognized id means phi is genuinely unmeasured, which the scorer
 *  treats as out of regime (fail-closed), never as "phi is fine". */
export function derivePhiParams(nullId) {
  if (typeof nullId !== 'string') return null;
  const m = NULL_ID.exec(nullId);
  if (!m) return null;
  const [, n, p, mm] = m;
  const phi = p === undefined ? 0 : phiOf(p);
  switch (n) {
    case '1':
    case '7':
      // Oracle parameters, no AR(1) term, no -p/-m suffix in the registered table.
      return p === undefined && mm === undefined ? { phi: 0, phi_source: 'oracle', params: 'oracle' } : null;
    case '2':
      // The cal window IS the estimate of mu/sigma, so the id must carry its length.
      return p === undefined && mm !== undefined
        ? { phi: 0, phi_source: 'iid-by-construction', params: 'estimated-moments' } : null;
    case '3':
      return p !== undefined ? { phi, phi_source: 'oracle', params: 'oracle-phi' } : null;
    case '4':
      return p !== undefined ? { phi, phi_source: 'estimated', params: 'estimated-phi' } : null;
    case '5':
    case '6':
      return p === undefined && mm === undefined
        ? { phi: 0, phi_source: 'iid-by-construction', params: 'moment-matched' } : null;
    default:
      return null;
  }
}

/** True when this cell's phi came out of a finite calibration window rather than being
 *  supplied or fixed by construction. Reads the derived tag first, then the two forms a
 *  run may already record: `phi_source` (annotated by lib/collect.mjs) and the
 *  `params: 'estimated-phi'` tag. A bare `params: 'estimated'` is deliberately NOT read
 *  as estimated-phi: detector-audit-sequential uses it for N2's estimated MOMENTS too,
 *  so it does not identify the axis. */
export function phiIsEstimated(cell) {
  if (cell.phi_source !== undefined) return cell.phi_source === 'estimated';
  if (cell.params === 'estimated-phi') return true;
  return derivePhiParams(cell.null_id)?.phi_source === 'estimated';
}

/** The cell's phi: recorded if it has one, derived from the id otherwise, `null` when
 *  neither is available (the fail-closed case). */
export function effectivePhi(cell) {
  if (cell.phi != null) return cell.phi;
  const d = derivePhiParams(cell.null_id);
  return d ? d.phi : null;
}

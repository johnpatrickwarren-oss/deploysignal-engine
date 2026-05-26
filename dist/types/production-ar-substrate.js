"use strict";
// types/production-ar-substrate.ts — Phase E SLICE 10 substrate schema.
//
// Per coordination/PHASE-E-SLICE-10-SPEC.md. Decouples the calibration
// concern (fitting AR(1) / AR(p) / seasonal-decomp / spectral params
// against a representative production window) from the runtime
// detection concern. Production consumers (Anvil, future Tessera
// integrations) fit the substrate offline once per calibration cycle;
// the engine and the NAB tool load it at dispatch time.
//
// Schema version policy: `version: 'phase-e-slice10-v1'` literal
// discriminator. Future schema evolutions add new version literals;
// loaders may accept multiple versions but never silently migrate.
Object.defineProperty(exports, "__esModule", { value: true });
exports.isProductionArSubstrate = isProductionArSubstrate;
/** Type guard / validation. Returns true if the input is a valid
 *  ProductionArSubstrate at the current schema version. */
function isProductionArSubstrate(x) {
    if (typeof x !== 'object' || x === null)
        return false;
    const candidate = x;
    if (candidate.version !== 'phase-e-slice10-v1')
        return false;
    if (typeof candidate.source !== 'object' || candidate.source === null)
        return false;
    if (typeof candidate.source.signal_name !== 'string')
        return false;
    if (typeof candidate.source.n_observations !== 'number')
        return false;
    if (typeof candidate.baseline !== 'object' || candidate.baseline === null)
        return false;
    if (typeof candidate.baseline.mean !== 'number')
        return false;
    if (typeof candidate.baseline.sigma_squared_marginal !== 'number')
        return false;
    if (typeof candidate.ar1 !== 'object' || candidate.ar1 === null)
        return false;
    if (typeof candidate.ar1.phi !== 'number')
        return false;
    if (typeof candidate.ar1.sigma_squared_innovation !== 'number')
        return false;
    if (typeof candidate.generated_at !== 'string')
        return false;
    return true;
}
//# sourceMappingURL=production-ar-substrate.js.map
"use strict";
// test/betting-eprocess-ar1-prewhitening.test.ts
//
// AR(1) pre-whitening on the betting e-process path (decisions/0001).
// Mirrors the family-a-mixture-supermartingale pre-whitening contract:
//   - ar1_phi=0 (default/absent) => byte-identical to pre-whitening behavior.
//   - ar1_phi=rho on AR(1) H0 => restores the Ville bound (FPR collapses from
//     grossly-inflated back to ~alpha), while detection power is retained.
// The engine already pre-whitens its other Family A detectors; this closes the
// betting path that was left out.
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const betting_e_process_js_1 = require("../detectors/betting-e-process.js");
// Deterministic PRNG + Gaussian (engine tests use seeded LCGs; no external dep).
function lcg(seed) {
    let s = seed >>> 0;
    return () => { s = ((s * 1664525) + 1013904223) >>> 0; return s / 0x100000000; };
}
function gaussian(rng) {
    const u1 = Math.max(rng(), 1e-12), u2 = rng();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}
function ar1Step(rng, rho) {
    const innov = Math.sqrt(1 - rho * rho);
    let prev = gaussian(rng);
    return () => { prev = rho * prev + innov * gaussian(rng); return prev; };
}
// (ar1Step samples are time-homogeneous; the window index is not needed.)
const ALPHA = 0.01;
const WINDOW = 150;
// Sticky-fire indicator for one stream. baselineMean=0, sigma^2=1 (AR(1) marginal).
function fires(rho, ar1Phi, seed, drift) {
    const step = ar1Step(lcg(seed), rho);
    const st = (0, betting_e_process_js_1.freshBettingState)();
    const threshold = 1 / ALPHA;
    for (let w = 0; w < WINDOW; w++) {
        let x = step();
        if (drift)
            x += drift * (w + 1);
        (0, betting_e_process_js_1.updateBettingState)(st, x, 0, 1, ALPHA, ar1Phi);
        if (st.M >= threshold)
            return true;
    }
    return false;
}
function fireRate(rho, ar1Phi, seed0, drift, trials) {
    let f = 0;
    for (let t = 0; t < trials; t++)
        if (fires(rho, ar1Phi, seed0 + t * 7919, drift))
            f++;
    return f / trials;
}
(0, node_test_1.test)('ar1_phi=0 is byte-identical to the omitted-argument (pre-whitening) path', () => {
    // Same observation sequence; ar1_phi omitted vs explicit 0 must yield identical wealth.
    const rng = lcg(424242);
    const a = (0, betting_e_process_js_1.freshBettingState)();
    const b = (0, betting_e_process_js_1.freshBettingState)();
    for (let i = 0; i < 200; i++) {
        const x = gaussian(rng);
        const mA = (0, betting_e_process_js_1.updateBettingState)(a, x, 0, 1, ALPHA); // omitted -> default 0
        const mB = (0, betting_e_process_js_1.updateBettingState)(b, x, 0, 1, ALPHA, 0); // explicit 0
        strict_1.default.equal(mA, mB);
    }
    strict_1.default.equal(a.M, b.M);
});
(0, node_test_1.test)('updateBettingState stores the raw centered observation in last_x_centered', () => {
    const st = (0, betting_e_process_js_1.freshBettingState)();
    (0, betting_e_process_js_1.updateBettingState)(st, 5, 2, 1, ALPHA, 0.5); // x=5, baselineMean=2 -> centered=3
    strict_1.default.equal(st.last_x_centered, 3);
});
(0, node_test_1.test)('last_x_centered stores the RAW centered value, not the whitened one (no compounding)', () => {
    // Two ticks, phi=0.5, baselineMean=0. Tick 2 must store the RAW centered value
    // (10), NOT the whitened value (10 - 0.5*4 = 8). Storing the whitened value
    // would compound the AR(1) correction across ticks. A single-tick test cannot
    // catch this (tick 1 whitened == raw because the prior is 0).
    const st = (0, betting_e_process_js_1.freshBettingState)();
    (0, betting_e_process_js_1.updateBettingState)(st, 4, 0, 1, ALPHA, 0.5); // tick 1: centered 4, store raw 4
    strict_1.default.equal(st.last_x_centered, 4);
    (0, betting_e_process_js_1.updateBettingState)(st, 10, 0, 1, ALPHA, 0.5); // tick 2: whitened = 10 - 0.5*4 = 8
    strict_1.default.equal(st.last_x_centered, 10, 'must store raw centered (10), not whitened (8)');
});
(0, node_test_1.test)('AR(1) H0: ar1_phi pre-whitening restores the Ville bound (FPR collapse)', () => {
    const rho = 0.9;
    const raw = fireRate(rho, 0, 1000, 0, 1500); // no whitening
    const whitened = fireRate(rho, rho, 2000, 0, 1500); // phi = true rho (calibrator stamps ~rho)
    strict_1.default.ok(raw > 0.3, `raw AR(0.9) FPR should be grossly inflated, got ${raw}`);
    // Pinned tight to ~alpha=0.01 (not a loose 0.05) so the assertion fails if
    // whitening were weakened to a partial correction.
    strict_1.default.ok(whitened < 0.03, `whitened FPR should be near alpha=${ALPHA}, got ${whitened}`);
});
(0, node_test_1.test)('AR(1) drift is still detected after pre-whitening (power not destroyed)', () => {
    // Honest scope: this is a STRONG ramp (0.15/window over 800 windows). Whitening
    // attenuates a ramp by ~(1-phi), so this confirms whitening does not ZERO OUT
    // power — it does NOT characterize sensitivity near the detection floor (that
    // is the job of the detection-envelope sweep, not this unit test).
    const rho = 0.9;
    const power = fireRate(rho, rho, 3000, 0.15, 800);
    strict_1.default.ok(power > 0.9, `whitened detection power on a strong ramp should stay high, got ${power}`);
});
(0, node_test_1.test)('iid stream with ar1_phi=0 controls type-I (sanity baseline)', () => {
    const fpr = fireRate(0, 0, 4000, 0, 1500);
    strict_1.default.ok(fpr <= 0.03, `iid FPR should be at/below ~alpha, got ${fpr}`);
});
//# sourceMappingURL=betting-eprocess-ar1-prewhitening.test.js.map
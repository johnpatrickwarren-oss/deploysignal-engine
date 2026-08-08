"use strict";
// detectors/spectral-bet-e-process.ts — K3: periodogram betting e-process.
//
// knowledge/methodology/coverage-gap-detectors.md § K3 (`spectral_bet_e_process`).
// Closes the coverage matrix's K3 NO row: control-loop hunting, thermal
// cycling, periodic retry storms — oscillation that never crosses a level
// threshold but marks instability worth investigating. Family D was built
// for this and is REFUSE (refuted at N1: rolling windows shared 29 of 30
// samples, and after the disjoint fix the construction still carried a
// refuted increment). This construction starts from an exact per-window
// uniform under the null instead of an asymptotic.
//
// Construction. Disjoint windows of W = 30 ticks (the window index is the
// martingale time — disjointness is the fix Family D lacked at its root).
// For each registered Fourier bin k in BINS_K3 = [1, 2, 3] (f_k = k/30),
// by direct DFT summation (three bins on a 30-point window is cheaper than
// an FFT setup, so no FFT dependency):
//
//     I(f_k) = |Σ_{t<W} x_t · e^(−i2πkt/W)|² / W
//     U_k    = I(f_k) / σ²
//     p_k    = exp(−U_k)
//
// Exactness identity (the docstring the design page requires): for iid
// N(0, σ²) noise, at any Fourier frequency k ∉ {0, W/2}, the real and
// imaginary DFT sums are iid N(0, σ²·W/2), so |Σ...|² / (σ²·W/2) is exactly
// chi-squared_2 — i.e. 2·U_k ~ chi²_2, so U_k ~ Exponential(1) and
// p_k = exp(−U_k) is EXACTLY Uniform(0,1). Not asymptotic: the identity
// holds at every finite W. Regime: iid Gaussian, KNOWN σ (the safe-t
// known-φ pattern — machine-encoded here via the `sigma` argument, not left
// to caller discipline). AR(1) colors the spectrum and breaks the per-bin
// independence this identity assumes, so the `-ar1` cell is out-of-claim by
// design, measured for the record only.
//
// Per-bin e-value through the same κp^(κ−1) calibrator as K4
// (point-tail-bet-e-value.ts):
//
//     e_k = κ · p_k^(κ−1)        κ = KAPPA_K3 = 0.1 (registered, shared
//                                 derivation with K4: log-optimal κ* ≈ 0.108
//                                 at the registered alternatives, rounded)
//
// ∫₀¹ κ·p^(κ−1) dp = 1 for any κ ∈ (0,1), so e_k is a valid e-value with
// E[e_k | H0] <= 1 per bin, per window.
//
// Bins combine by AVERAGING e-values — eAvg = mean_k(e_k) — valid under
// arbitrary dependence across bins (never max: an average of e-values with
// E[e]<=1 each still has E[eAvg]<=1; a max does not preserve validity).
// Windows combine by PRODUCT (disjoint ⇒ independent increments ⇒ a genuine
// test martingale), accumulated in the log domain per ADR 0026's house
// pattern (decisions/0026-log-domain-wealth.md; detectors/betting-e-process.ts,
// detectors/_wealth.ts): log-wealth is the single source of truth, the
// linear view saturates at Number.MAX_VALUE instead of overflowing to
// Infinity, and a degenerate (NaN or zero) window's e-value holds/floors
// the books rather than poisoning the run.
Object.defineProperty(exports, "__esModule", { value: true });
exports.KAPPA_K3 = exports.BINS_K3 = exports.W_K3 = void 0;
exports.spectralBetWindow = spectralBetWindow;
exports.spectralBetWealth = spectralBetWealth;
const _wealth_1 = require("./_wealth");
/** Disjoint-window length (registered, frozen). */
exports.W_K3 = 30;
/** Registered Fourier bins, k ∈ {1, 2, 3} ⇒ f_k ∈ {1/30, 2/30, 3/30}.
 *  Neither touches {0, W/2} = {0, 15}, where the exactness identity's
 *  hypotheses (nonzero, non-Nyquist frequency) fail. */
exports.BINS_K3 = [1, 2, 3];
/** κ for the e-value calibrator e = κ·p^(κ−1). Registered, shared
 *  derivation with K4 (point-tail-bet-e-value.ts's KAPPA). */
exports.KAPPA_K3 = 0.1;
/** Wealth floor, log domain — same value as betting-e-process.ts's
 *  WEALTH_FLOOR (1e-12); prevents underflow on long healthy runs where
 *  eAvg stays under 1 for many consecutive windows. */
const LOG_WEALTH_FLOOR_K3 = Math.log(1e-12);
/** Amendment v2.C1 (C1.9): the calibrator `e = kappa*p^(kappa-1)` is an e-value because
 *  `integral_0^1 kappa*p^(kappa-1) dp = 1`, and that identity needs kappa in the OPEN interval
 *  (0,1): kappa <= 0 diverges, kappa = 1 makes e identically 1 (no bet), kappa > 1 inverts the
 *  bet's direction so large p pays. kappa was a defaulted parameter no caller had to justify and
 *  nothing validated, so an out-of-domain value returned a number that is not an e-value. */
function assertKappaInUnitInterval(fn, kappa) {
    if (!Number.isFinite(kappa) || !(kappa > 0) || !(kappa < 1)) {
        throw new Error(`${fn}: kappa must be a finite number in the open interval (0,1), got ${kappa}`);
    }
}
/** Per-window periodogram bet: direct DFT summation over BINS_K3. Requires
 *  `window.length === W_K3` and `sigma > 0` — the known-σ regime is
 *  machine-encoded here, not left to the caller's discipline. */
function spectralBetWindow(window, sigma, kappa = exports.KAPPA_K3) {
    if (window.length !== exports.W_K3) {
        throw new Error(`spectralBetWindow: window.length must be ${exports.W_K3}, got ${window.length}`);
    }
    // Amendment v2.C1 (C1.9): FINITE and positive. `sigma > 0` alone admitted Infinity, which
    // makes U = I/sigma^2 exactly 0, p = exp(-0) = 1 and e = kappa on every bin -- a finite,
    // plausible-looking, wrong answer rather than a refusal. NaN was already rejected.
    if (!Number.isFinite(sigma) || !(sigma > 0)) {
        throw new Error(`spectralBetWindow: sigma must be a finite number > 0, got ${sigma}`);
    }
    assertKappaInUnitInterval('spectralBetWindow', kappa);
    const perBin = exports.BINS_K3.map((k) => {
        let re = 0;
        let im = 0;
        for (let t = 0; t < exports.W_K3; t++) {
            const theta = (-2 * Math.PI * k * t) / exports.W_K3;
            re += window[t] * Math.cos(theta);
            im += window[t] * Math.sin(theta);
        }
        const I = (re * re + im * im) / exports.W_K3;
        const U = I / (sigma * sigma);
        const p = Math.exp(-U);
        const e = kappa * Math.pow(p, kappa - 1);
        return { k, U, p, e };
    });
    const eAvg = perBin.reduce((s, b) => s + b.e, 0) / perBin.length;
    return { perBin, eAvg };
}
/** Wealth over disjoint windows: product of per-window eAvg, accumulated in
 *  the log domain (ADR 0026 convention — see module docstring). `log[i]`
 *  is the cumulative log-wealth through window i, the running trajectory an
 *  any-time (Ville-inequality) crossing check needs at every prefix, not
 *  just the final tick. Each window is validated by `spectralBetWindow`
 *  (propagates its guards). */
function spectralBetWealth(windows, sigma) {
    let logM = 0; // log(1) — wealth starts at 1
    const log = [];
    for (const w of windows) {
        const { eAvg } = spectralBetWindow(w, sigma);
        logM = (0, _wealth_1.advanceLogWealth)(logM, Math.log(eAvg), LOG_WEALTH_FLOOR_K3);
        log.push(logM);
    }
    return { wealth: (0, _wealth_1.wealthView)(logM), log };
}
//# sourceMappingURL=spectral-bet-e-process.js.map
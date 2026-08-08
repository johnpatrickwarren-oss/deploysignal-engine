"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// test/spectral-bet-e-process.test.ts — engine test pattern (node:test).
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const spectral_bet_e_process_1 = require("../detectors/spectral-bet-e-process");
const lcg = (s) => () => ((s = (s * 1664525 + 1013904223) >>> 0), s / 2 ** 32);
const gauss = (r) => Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r());
(0, node_test_1.test)('registered constants', () => {
    strict_1.default.equal(spectral_bet_e_process_1.W_K3, 30);
    strict_1.default.deepEqual(spectral_bet_e_process_1.BINS_K3, [1, 2, 3]);
    strict_1.default.equal(spectral_bet_e_process_1.KAPPA_K3, 0.1);
});
(0, node_test_1.test)('per-window p is Uniform(0,1) under iid N(0,sigma): moments at n=4000 windows', () => {
    const r = lcg(20260808);
    const ps = [];
    for (let w = 0; w < 4000; w++) {
        const win = Array.from({ length: 30 }, () => 2 * gauss(r));
        for (const b of (0, spectral_bet_e_process_1.spectralBetWindow)(win, 2).perBin)
            ps.push(b.p);
    }
    const m = ps.reduce((a, b) => a + b) / ps.length;
    const v = ps.reduce((a, b) => a + (b - m) ** 2, 0) / ps.length;
    strict_1.default.ok(Math.abs(m - 0.5) < 0.01, `mean ${m}`); // U(0,1): 0.5
    strict_1.default.ok(Math.abs(v - 1 / 12) < 0.005, `var ${v}`); // U(0,1): 1/12
});
(0, node_test_1.test)('healthy wealth crossing rate <= alpha at N=2000 trajectories of 6 windows', () => {
    const r = lcg(20260808 + 1);
    const alpha = 0.05;
    const threshold = 1 / alpha; // 20 — 1/alpha per the test-martingale Ville bound
    const logThreshold = Math.log(threshold);
    const N = 2000;
    let crossings = 0;
    for (let i = 0; i < N; i++) {
        const windows = [];
        for (let w = 0; w < 6; w++) {
            windows.push(Array.from({ length: 30 }, () => 2 * gauss(r)));
        }
        const { log } = (0, spectral_bet_e_process_1.spectralBetWealth)(windows, 2);
        if (log.some((l) => l >= logThreshold))
            crossings++;
    }
    const rate = crossings / N;
    // Ville's inequality bounds P(any-time crossing) <= alpha exactly for a
    // test martingale under H0; 3sigma binomial tolerance covers MC noise.
    const tol = 3 * Math.sqrt((alpha * (1 - alpha)) / N);
    strict_1.default.ok(rate < alpha + tol, `crossing rate ${rate}, tolerance ${alpha + tol}`);
});
(0, node_test_1.test)('an f=1/10 oscillation at amp 0.75sigma drives average wealth above 1 (power smoke, no endpoint)', () => {
    const sigma = 2;
    const amp = 0.75 * sigma;
    const freq = 1 / 10; // = 3/30 — an exact Fourier bin (k=3), not leakage
    const r = lcg(20260808 + 2);
    const N = 500;
    let totalWealth = 0;
    for (let i = 0; i < N; i++) {
        const windows = [];
        for (let w = 0; w < 6; w++) {
            const win = Array.from({ length: 30 }, (_, t) => amp * Math.sin(2 * Math.PI * freq * t) + sigma * gauss(r));
            windows.push(win);
        }
        const { wealth } = (0, spectral_bet_e_process_1.spectralBetWealth)(windows, sigma);
        totalWealth += wealth;
    }
    const avgWealth = totalWealth / N;
    strict_1.default.ok(avgWealth > 1, `average wealth ${avgWealth}`);
});
(0, node_test_1.test)('sigma and window-length guards throw', () => {
    const win30 = new Array(30).fill(0);
    strict_1.default.throws(() => (0, spectral_bet_e_process_1.spectralBetWindow)(new Array(29).fill(0), 1), /window\.length/);
    strict_1.default.throws(() => (0, spectral_bet_e_process_1.spectralBetWindow)(new Array(31).fill(0), 1), /window\.length/);
    strict_1.default.throws(() => (0, spectral_bet_e_process_1.spectralBetWindow)(win30, 0), /sigma/);
    strict_1.default.throws(() => (0, spectral_bet_e_process_1.spectralBetWindow)(win30, -1), /sigma/);
    strict_1.default.throws(() => (0, spectral_bet_e_process_1.spectralBetWealth)([new Array(29).fill(0)], 1));
});
//# sourceMappingURL=spectral-bet-e-process.test.js.map
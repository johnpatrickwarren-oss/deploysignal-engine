"use strict";
// ADR 0028 — martingale merging with the empirically adaptive bet, and the gate on the product.
// The monograph's claims each get a test: exactness on sequential exact e-values (Prop. 8.11),
// e-power dominance over the mean on iid powered e-values (Theorem 7.22 / Example 8.17), the
// product's maximal null variance (Prop. 8.16), λ convergence to the log-optimal 1/3 on
// Example 8.17's inputs, and the endpoints λ ≡ 0 / λ ≡ 1 / λ_k = 1/K.
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const combine_1 = require("../fleet/combine");
function mulberry32(a) {
    return () => {
        a |= 0;
        a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
/** Example 8.17's e-variable: 4 w.p. 1/2, 0 w.p. 1/2 (exact under Q with P(4) = 1/4 under the null). */
const exampleE = (rng, pFour) => (rng() < pFour ? Math.log(4) : -Infinity);
(0, node_test_1.test)('the gate: combineProduct refuses without the sequential assertion; the unguarded product is the raw sum', () => {
    strict_1.default.throws(() => (0, combine_1.combineProduct)([0.1, 0.2]), /sequential/);
    strict_1.default.equal((0, combine_1.combineProduct)([0.1, 0.2], { sequential: true }).log_fleet_e, 0.30000000000000004);
    strict_1.default.equal((0, combine_1.combineProductUnguarded)([0.1, 0.2]).log_fleet_e, 0.30000000000000004);
    strict_1.default.throws(() => (0, combine_1.combineProduct)([], { sequential: true }), /empty/);
});
(0, node_test_1.test)('endpoints: λ ≡ 0 is 1, λ ≡ 1 is the product, λ_k = 1/K reproduces the arithmetic mean only in expectation', () => {
    const xs = [0.3, -0.7, 1.2, 0.05];
    strict_1.default.equal((0, combine_1.combineMartingale)(xs, [0, 0, 0, 0]).log_fleet_e, 0);
    strict_1.default.ok(Math.abs((0, combine_1.combineMartingale)(xs, [1, 1, 1, 1]).log_fleet_e - (0, combine_1.combineProductUnguarded)(xs).log_fleet_e) < 1e-12);
    strict_1.default.throws(() => (0, combine_1.combineMartingale)(xs, [0, 0, 0]), /lambdas/);
    strict_1.default.throws(() => (0, combine_1.combineMartingale)(xs, [0, 0, 0, 1.5]), /outside/);
    // logMix stability at both tails
    strict_1.default.equal((0, combine_1.combineMartingale)([-Infinity], [0.5]).log_fleet_e, Math.log(0.5));
    strict_1.default.ok(Math.abs((0, combine_1.combineMartingale)([700], [0.5]).log_fleet_e - (Math.log(0.5) + 700)) < 1e-9);
});
(0, node_test_1.test)('exactness (Prop. 8.11): each adaptive factor (1 − λ_k + λ_k e_k) has conditional mean 1 on sequential exact e-values', () => {
    // The INCREMENT is the estimable object: a K-fold product's sample mean understates 1 at any
    // feasible N (knowledge stats/terminal-mean-is-not-measurable), so the test averages each
    // factor across trajectories, where it is bounded in [1 − γ, 1 + 3γ].
    // null: e ∈ {4, 0} with P(4) = 1/4 ⇒ E[e] = 1 exactly; iid ⇒ sequential.
    const rng = mulberry32(28);
    const N = 20000, K = 12;
    const sum = new Array(K).fill(0), sumsq = new Array(K).fill(0);
    for (let n = 0; n < N; n++) {
        const xs = Array.from({ length: K }, () => exampleE(rng, 0.25));
        const lam = (0, combine_1.adaptiveLambdas)(xs, 0.5);
        for (let k = 0; k < K; k++) {
            const f = 1 - lam[k] + lam[k] * Math.exp(xs[k]);
            sum[k] += f;
            sumsq[k] += f * f;
        }
    }
    for (let k = 0; k < K; k++) {
        const mean = sum[k] / N, sd = Math.sqrt(Math.max(0, sumsq[k] / N - mean * mean)), se = sd / Math.sqrt(N);
        strict_1.default.ok(Math.abs(mean - 1) <= 3.5 * se + 1e-9, `factor ${k}: mean ${mean.toFixed(4)} ± ${se.toFixed(4)} should be 1`);
    }
});
(0, node_test_1.test)('e-power (Thm 7.22 / Ex. 8.17): under the alternative the adaptive merge beats the mean and λ → 1/3', () => {
    const rng = mulberry32(817);
    const K = 3000;
    const xs = Array.from({ length: K }, () => exampleE(rng, 0.5)); // alternative: P(4) = 1/2
    // γ = ½ (the book's default): the log-optimal 1/3 is inside [0, ½]. With γ = 1 an early run of 4s
    // drives λ to 1 and the first 0 ruins the wealth — the all-in pathology, tested below.
    const lam = (0, combine_1.adaptiveLambdas)(xs, 0.5);
    const tail = lam.slice(K - 200);
    const lamMean = tail.reduce((a, b) => a + b, 0) / tail.length;
    strict_1.default.ok(Math.abs(lamMean - 1 / 3) < 0.05, `λ should converge to the log-optimal 1/3, got ${lamMean.toFixed(3)}`);
    const mart = (0, combine_1.combineMartingale)(xs, lam).log_fleet_e;
    const avg = (0, combine_1.combineAverage)(xs).log_fleet_e;
    // growth ≈ K·log(4/3) ≈ 863 nats vs the mean's log 2 ≈ 0.69
    strict_1.default.ok(mart > 0.8 * K * Math.log(4 / 3), `martingale growth ${mart.toFixed(1)} nats`);
    strict_1.default.ok(mart > avg + 500, 'the adaptive merge dominates the mean in e-power on iid powered inputs');
    // and the all-in product is the pathological one: it is 0 as soon as any e is 0
    strict_1.default.equal((0, combine_1.combineProductUnguarded)(xs).log_fleet_e, -Infinity);
});
(0, node_test_1.test)('variance (Prop. 8.16): among exact sequential merges the product has the largest null variance', () => {
    const rng = mulberry32(816);
    const N = 20000, K = 6;
    const acc = { prod: [0, 0], half: [0, 0], adapt: [0, 0] };
    const push = (k, v) => { acc[k][0] += v; acc[k][1] += v * v; };
    for (let n = 0; n < N; n++) {
        const xs = Array.from({ length: K }, () => exampleE(rng, 0.25));
        push('prod', Math.exp((0, combine_1.combineProductUnguarded)(xs).log_fleet_e));
        push('half', Math.exp((0, combine_1.combineMartingale)(xs, new Array(K).fill(0.5)).log_fleet_e));
        push('adapt', Math.exp((0, combine_1.combineMartingale)(xs, (0, combine_1.adaptiveLambdas)(xs, 0.5)).log_fleet_e));
    }
    const variance = (k) => acc[k][1] / N - (acc[k][0] / N) ** 2;
    strict_1.default.ok(variance('prod') > variance('half') && variance('prod') > variance('adapt'), `product var ${variance('prod').toFixed(1)} must exceed λ=½ ${variance('half').toFixed(2)} and adaptive ${variance('adapt').toFixed(2)}`);
});
(0, node_test_1.test)('adaptiveLambdas is predictable: λ_k does not change when e_k..e_K change', () => {
    const rng = mulberry32(5);
    const xs = Array.from({ length: 40 }, () => 2 * rng() - 1);
    const a = (0, combine_1.adaptiveLambdas)(xs);
    const ys = xs.slice();
    for (let i = 20; i < 40; i++)
        ys[i] = 3;
    const b = (0, combine_1.adaptiveLambdas)(ys);
    for (let k = 0; k <= 20; k++)
        strict_1.default.equal(a[k], b[k], `λ_${k} must depend only on e_1..e_${k - 1}`);
    strict_1.default.equal(a[0], 0);
    strict_1.default.throws(() => (0, combine_1.adaptiveLambdas)(xs, 0), /gamma/);
});
(0, node_test_1.test)('γ = 1 admits the all-in bet and Example 8.17 ruin: an early run of 4s sets λ = 1 and the first 0 sends the wealth to 0 forever', () => {
    const xs = [Math.log(4), Math.log(4), Math.log(4), -Infinity, Math.log(4)];
    const lam = (0, combine_1.adaptiveLambdas)(xs, 1);
    strict_1.default.equal(lam[3], 1, 'after three 4s and no 0, the unconstrained maximizer is all-in');
    strict_1.default.equal((0, combine_1.combineMartingale)(xs, lam).log_fleet_e, -Infinity);
    const capped = (0, combine_1.adaptiveLambdas)(xs, 0.5);
    strict_1.default.ok(Number.isFinite((0, combine_1.combineMartingale)(xs, capped).log_fleet_e), 'the ½ cap keeps the wealth alive');
});
//# sourceMappingURL=adr-0028-martingale-merging.test.js.map
// analysis/posthoc-noproceed.mjs — POST-HOC, no verdict. The registered gate config (alphaProceed 1e-12) let the
// proceed side end 8,431 of 10,000 V-m0.2-ψ1 replications before tick 300, so the validity cells' rollback
// rates are over paths truncated at proceed. This re-runs the three V cells and H with alphaProceed 1e-300
// (proceed unreachable) so the rollback e-process runs the full 300 ticks. Same generator, same seeds.
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const gate = require('../../../dist/per-shard/twin-gate.js');
const HERE = dirname(fileURLToPath(import.meta.url));
const R = 10000, ALPHA = 0.05, SEED0 = 20261003, BAR = ALPHA + 2.58 * Math.sqrt((ALPHA * (1 - ALPHA)) / R);
function lcg(seed) { let s = seed >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return (s + 0.5) / 4294967296; }; }
function gaussian(rng) { return Math.sqrt(-2 * Math.log(rng())) * Math.cos(2 * Math.PI * rng()); }
function poisson(rng, mean) { if (mean <= 0) return 0; if (mean > 30) return Math.max(0, Math.round(mean + Math.sqrt(mean) * gaussian(rng))); const L = Math.exp(-mean); let k = 0, p = 1; do { k++; p *= rng(); } while (p > L); return k - 1; }
function binomial(rng, n, p) { if (n <= 0 || p <= 0) return 0; if (p >= 1) return n; if (p > 0.5) return n - binomial(rng, n, 1 - p); const v = n * p * (1 - p); if (v >= 30) return Math.min(n, Math.max(0, Math.round(n * p + Math.sqrt(v) * gaussian(rng)))); const lq = Math.log(1 - p); let x = 0, k = 0; for (;;) { x += Math.floor(Math.log(rng()) / lq) + 1; if (x > n) return k; k++; } }
function oddsShift(p, psi) { return (psi * p) / (1 - p + psi * p); }
const CELLS = [[1, 'V-m0.2-ψ1', 1.0, false], [2, 'V-m0.2-ψ1.1', 1.1, false], [3, 'V-m0.2-ψ1.2', 1.2, false], [4, 'H-m0.2-ψ1', 1.0, true]];
function arm(rng, n, psi, het) { if (!het) return binomial(rng, n, oddsShift(0.005, psi)); const h = Math.round(n * 0.01); return binomial(rng, h, oddsShift(0.5, psi)) + binomial(rng, n - h, oddsShift(0.005, psi)); }
const out = [];
for (const [i, id, psi, het] of CELLS) {
  const rng = lcg(SEED0 + 7919 * i);
  const spec = { id: 'http_5xx', kind: 'rate', worse: 'higher', tolerance: 0.5, margin: { relative: 0.2 } };
  const cfg = { metrics: [spec], alphaRollback: ALPHA, alphaProceed: 1e-300, alphaSrm: 0.001, canaryWeight: 0.5, maxTicks: 300 };
  let rb = 0, pr = 0;
  for (let r = 0; r < R; r++) {
    let gs = gate.initTwinGate(cfg);
    for (let t = 1; t <= 300; t++) {
      const n = poisson(rng, 2440); const nc = binomial(rng, n, 0.5), nk = n - nc;
      const obs = { canaryEvents: arm(rng, nc, psi, het), canaryTotal: nc, controlEvents: arm(rng, nk, 1, het), controlTotal: nk };
      const step = gate.stepTwinGate(cfg, gs, { canaryRequests: nc, controlRequests: nk, observations: { http_5xx: obs } }); gs = step.state;
      if (step.decision.verdict === 'rollback') { rb++; break; }
      if (step.decision.verdict !== 'extend') { pr++; break; } // at alphaProceed 1e-300 this is the tick-300 'inconclusive', never a proceed
    }
  }
  out.push({ cell: id, psi, het, rollback: rb / R, ended_without_rollback: pr, under_bar: rb / R <= BAR });
  console.log(`${id.padEnd(14)} rollback=${(rb / R).toFixed(4)} ended_without_rollback=${pr} ${rb / R <= BAR ? 'under bar' : 'OVER BAR'} (post-hoc, no verdict)`);
}
writeFileSync(join(HERE, '..', 'results', 'run-20261003T123340Z', 'posthoc-noproceed.json'), JSON.stringify({ posthoc: true, note: 'alphaProceed 1e-300; validity cells over the full 300 ticks; no verdict', BAR, results: out }, null, 2));

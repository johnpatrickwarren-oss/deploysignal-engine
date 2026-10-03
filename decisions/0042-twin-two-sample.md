# ADR 0042 — Designed-null kinds, part 4: a two-sample betting kind between the twin's arms (Family C re-homed)

- **Date:** 2026-10-03
- **Status:** PROPOSED. ACCEPTED only if study `2026-10-twin-two-sample` (T1, registered beside this file
  before implementation) meets its ship rule. The real-data companion is DeploySignal
  `2026-10-twin-two-sample-replay` (T3 replay over the stored twin runs), registered separately.
- **Register:** ADR 0036 (the twin), ADR 0037 (the margin), ADRs 0038–0041 (parts 1–3); knowledge
  `methodology/detector-selection-history` (Family C: a Shekhar–Ramdas betting two-sample test shipped
  against a synthesized Gaussian reference); the May 2026 claim that the portfolio finds patterns a
  per-metric threshold misses, never tested on anything real.

## The gap

The twin's `rate` and `sign` kinds test one metric each and are combined by Bonferroni. A change that
moves two metrics together, or changes their joint distribution with each mean held (variance,
correlation), is invisible to them. Family C's construction tests exactly that, but it was shipped
comparing a deploy's tick vector against a reference synthesized from history
(`detectors/family-c-betting-e-process.ts`: P fixed from the per-cell baseline, Q streaming), which is
an estimated null. Between randomized arms the same construction has a designed null: at each tick
the canary's vector x_t and the control's y_t are exchangeable given the past.

## Decision

`detectors/twin-two-sample.ts`. **Spec** `{ id, alpha, coordinates: [{ id, margin?: { relative?,
absolute? } }], window?: 200, lambdaMax?: 0.5 }`. **Step** `(spec, state, x_t, y_t)` with x and y vectors
over the declared coordinates, one per arm per tick.

1. **Margin, coordinate-wise and swap-equivariant.** For coordinate i with band b_i = relative_i ·
   (|x_i| + |y_i|)/2 + absolute_i: d = x_i − y_i, d' = sign(d) · max(0, |d| − b_i), and the pair is
   replaced by (c + d'/2, c − d'/2) with c = (x_i + y_i)/2. Swapping x and y swaps the outputs, so an
   exchangeable pair stays exchangeable: the margin tests "a pattern beyond the declared bands" and
   costs nothing in validity. No margin on a coordinate is b_i = 0.
2. **Standardization from the past only.** Each coordinate is centred and scaled by the running mean and
   standard deviation of the pooled past values of both arms (predictable; the first tick is scored
   on raw values with scale 1).
3. **Witness, predictable.** f_{t−1}(z) = mean over the last `window` past canary vectors of K(z, x_s)
   − mean over the last `window` past control vectors of K(z, y_s), K the RBF kernel with bandwidth
   the median pairwise distance of the past pooled vectors (predictable; 1 before ten ticks). Payoff
   F_t = f_{t−1}(x'_t) − f_{t−1}(y'_t) ∈ [−1, 1].
4. **Bet.** S_t = S_{t−1} (1 + λ_{t−1} F_t), λ by the ONS update of `_family-c-betting-witness.ts`
   (`onsUpdate`, two-sided clamp at λ_max 0.5), λ_0 = 0. Under exchangeability E[F_t | past] = 0, so S is
   a test supermartingale; fires at S_t ≥ 1/α (Ville). A tick with a non-finite coordinate in either
   arm is counted (`missing`) and not scored, and the twin gate's ½ penalty is not applied here (the
   kind is advisory until measured; the companion reports missingness).

No proceed side: the kind is a veto on patterns. The caller applies Bonferroni beside the per-metric
kinds. The engine estimates nothing the bound depends on; the witness and the standardization are
power devices computed from the past.

## Rejected

Reusing `family-c-betting-e-process.ts` as is: its P side is a fixed pool, and its state is keyed by
calibration cell. The RFF variant: deferred; the kernel-MMD witness on a 200-tick window is O(window·d)
per tick and the twin's vectors are small.

## Ship rule

Study `2026-10-twin-two-sample` E1–E4: validity under exchangeable arms (iid, shared AR(1) shocks,
persistent sub-margin offset with the margin, missing ticks); the mechanism cell (persistent offset,
no margin) fires; power on a correlation change with means held and on a variance change, both
invisible to the `sign` kind, and on a supra-margin mean shift beside the `sign` kind's own figure.
Then `v0.17.0-pre`; otherwise REJECTED with the figure.

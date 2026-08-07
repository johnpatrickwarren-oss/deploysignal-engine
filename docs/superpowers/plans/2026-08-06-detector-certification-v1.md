# Detector Certification v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** First application of the ratified detector certification protocol — nine frozen claim cards, a mechanical verdict script that re-scores the existing study evidence into per-detector cards, and an enumeration of the missing cells.

**Architecture:** Plain-Node (`.mjs`) tooling under `validation/certification/` in `deploysignal-engine`, matching the existing harness pattern (`validation/detector-audit/harness/*.mjs`). Pure scoring functions in `lib/`, tested with `node --test`; a CLI (`verdict.mjs`) that loads frozen claim cards plus existing `results/live/*/summary.json` evidence and emits detector cards (JSON + markdown). Claim cards are frozen data committed **before** the re-score runs — that commit is the pre-registration event.

**Tech Stack:** Node ≥ 20 built-ins only (`node:fs`, `node:path`, `node:crypto`, `node:test`, `node:assert`). No new dependencies.

**Authority:** The protocol page `~/concord/knowledge/methodology/pages/detector-certification-protocol.md` (RATIFIED 2026-08-06) governs. Where this plan and that page disagree, the page wins and the disagreement is a plan bug to report.

## Global Constraints

- Repo: `~/concord/deploysignal-engine`. It is PR-gated: **never commit to `main`**. All work on branch `cert/protocol-v1` (create from `main` at start; use a worktree via superpowers:using-git-worktrees so the main checkout stays free for other sessions).
- Every commit scoped with a pathspec (`git commit -m "..." -- <paths>`). Note `-m` comes **before** `--`.
- No TypeScript for this tooling: `validation/**` harnesses are plain `.mjs` and are not part of `tsc`. Tests run with `node --test validation/certification/test/*.test.mjs` directly.
- Results are append-only: the re-score writes `validation/certification/results/run-<UTC>/`, never overwrites.
- Claim cards freeze in their own commit (Task 4) **before** any verdict run. After that commit, card edits require a new protocol-versioned freeze, not an amend.
- Registered constants, frozen now (protocol S3, mechanical verdict): **inertness floor = detection_rate < 0.10 at shift_sigma = 3**; vacuous-pass = increment sd == 0 (zero-width interval); tier map: every study under `validation/` is **T1** except runs whose manifest `study` contains `clustersynth` → **T2**. These land in `lib/constants.mjs` in Task 1 and do not move afterwards.
- Commit messages: prose per `~/concord/junction/writing/WRITING-STYLE.md` (no "not just X but Y", no weasel quantifiers). End with `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.

## File Structure

```
validation/certification/
├── README.md                  # what this is, how to run, protocol pointer (Task 8)
├── cards/                     # FROZEN claim cards, one per detector (Tasks 2–4)
│   └── <detector_id>.json
├── lib/
│   ├── constants.mjs          # registered floors, tier map, class→instrument table (Task 1)
│   ├── schema.mjs             # validateCard() (Task 1)
│   ├── freeze.mjs             # stampPins(): engine sha + source-file hashes (Task 2)
│   ├── guards.mjs             # vacuousPass, nonFinite, internalConsistency, meanRule (Task 5)
│   ├── collect.mjs            # loadEvidence(): walk validation/*/results/live (Task 6)
│   └── score.mjs              # scoreS1..scoreS4, tierOf, overallVerdict (Task 7)
├── test/
│   ├── schema.test.mjs
│   ├── freeze.test.mjs
│   ├── guards.test.mjs
│   ├── collect.test.mjs
│   ├── score.test.mjs
│   └── report-consistency.test.mjs   # machine-check: report vs card JSON (Task 8)
├── verdict.mjs                # CLI (Task 8)
├── expiry-check.mjs           # recompute hashes vs pins, exit 1 on drift (Task 9)
└── results/                   # append-only run output (Task 10)
```

---

### Task 1: Card schema, constants, validator

**Files:**
- Create: `validation/certification/lib/constants.mjs`
- Create: `validation/certification/lib/schema.mjs`
- Test: `validation/certification/test/schema.test.mjs`

**Interfaces:**
- Produces: `CLASSES`, `CLASS_INSTRUMENTS`, `INERTNESS_FLOOR`, `INERTNESS_SHIFT_SIGMA`, `TIERS`, `tierOfStudy(studyName)` from `constants.mjs`; `validateCard(card) -> string[]` (empty array = valid) from `schema.mjs`.

- [ ] **Step 1: Write the failing test**

```js
// validation/certification/test/schema.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateCard } from '../lib/schema.mjs';
import { CLASS_INSTRUMENTS, tierOfStudy } from '../lib/constants.mjs';

const goodCard = {
  protocol_version: 1,
  detector_id: 'family_A_betting_e_process',
  aliases: ['betting_e_process'],
  family: 'A',
  class: 'test_martingale',
  engine_pin: { version: 'v0.6.6-pre', sha: null },   // null until frozen
  source_files: [{ path: 'detectors/betting-e-process.ts', sha256: null }],
  guarantee: {
    sentence: 'E[e_t|F_{t-1}] <= 1 per tick under H0 given oracle (mu, sigma^2, phi).',
    quantifiers: [{ text: 'per tick', tag: 'empirical', proof_artifact: null }],
    regime: { phi_max: 0.9, m_min: 500, baseline: 'oracle-or-m>=500', nulls: 'N1,N3' },
  },
  shipped_path: { kind: 'wealth process, AR(1) pre-whitened', estimator: 'plug-in mu/sigma/phi', notes: '' },
  budget: { participating: true, alpha_booked: null, resolution_claim: null },
  falsifier: 'increment estimator lower95 > 1.0005 in a claimed-regime cell',
  prior_evidence: [{ stage: 'S2', study: 'detector-audit', runs: 'detector-audit/results/live/seq-*', wiki: 'stats/detector-audit-sequential-2026-08-05' }],
};

test('valid card returns no errors', () => {
  assert.deepEqual(validateCard(goodCard), []);
});

test('unknown class is rejected', () => {
  const errs = validateCard({ ...goodCard, class: 'martingale' });
  assert.ok(errs.some((e) => e.includes('class')));
});

test('quantifier tagged proof requires a proof_artifact', () => {
  const bad = structuredClone(goodCard);
  bad.guarantee.quantifiers = [{ text: 'for any sigma', tag: 'proof', proof_artifact: null }];
  const errs = validateCard(bad);
  assert.ok(errs.some((e) => e.includes('proof_artifact')));
});

test('missing falsifier is rejected', () => {
  const errs = validateCard({ ...goodCard, falsifier: '' });
  assert.ok(errs.some((e) => e.includes('falsifier')));
});

test('class fixes instruments per the protocol table', () => {
  assert.deepEqual(CLASS_INSTRUMENTS.test_martingale, ['increment_estimator']);
  assert.deepEqual(CLASS_INSTRUMENTS.terminal_e_value, ['exceedance', 'mean_above_1']);
  assert.deepEqual(CLASS_INSTRUMENTS.e_process, ['stopped_mean', 'crossing_rate']);
});

test('tier map: clustersynth studies are T2, others T1', () => {
  assert.equal(tierOfStudy('clustersynth-ui'), 'T2');
  assert.equal(tierOfStudy('detector-audit-sequential'), 'T1');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd ~/concord/deploysignal-engine && node --test validation/certification/test/schema.test.mjs`
Expected: FAIL — cannot find module `../lib/schema.mjs`

- [ ] **Step 3: Write minimal implementation**

```js
// validation/certification/lib/constants.mjs
export const CLASSES = ['test_martingale', 'terminal_e_value', 'e_process'];
export const CLASS_INSTRUMENTS = {
  test_martingale: ['increment_estimator'],
  terminal_e_value: ['exceedance', 'mean_above_1'],
  e_process: ['stopped_mean', 'crossing_rate'],
};
// Registered 2026-08-06 with the claim-card freeze; do not move (protocol: mechanical verdict).
export const INERTNESS_FLOOR = 0.10;
export const INERTNESS_SHIFT_SIGMA = 3;
export const TIERS = ['T1', 'T2', 'T3'];
export const tierOfStudy = (study) => (/clustersynth/i.test(study) ? 'T2' : 'T1');
export const VERDICTS = ['USE', 'ADVISORY', 'REFUSE', 'NOT_EXECUTABLE', 'EXPIRED'];
```

```js
// validation/certification/lib/schema.mjs
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test validation/certification/test/schema.test.mjs`
Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add validation/certification/lib/constants.mjs validation/certification/lib/schema.mjs validation/certification/test/schema.test.mjs
git commit -m "cert: card schema and registered constants

Class-instrument table, inertness floor 0.10 at 3 sigma, tier map.
Constants are registered with this commit and do not move inside
protocol v1.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>" -- validation/certification
```

---

### Task 2: Freeze tooling (pins and hashes)

**Files:**
- Create: `validation/certification/lib/freeze.mjs`
- Test: `validation/certification/test/freeze.test.mjs`

**Interfaces:**
- Consumes: card objects (Task 1 shape).
- Produces: `stampPins(card, { repoRoot, gitSha, version }) -> card` — returns a copy with `engine_pin.sha` set and every `source_files[i].sha256` filled from disk; `fileSha256(absPath) -> string`. Paths in `source_files[].path` resolve against `repoRoot`; paths beginning `../` resolve against the repo's parent (for consumer-repo calibrators).

- [ ] **Step 1: Write the failing test**

```js
// validation/certification/test/freeze.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { stampPins, fileSha256 } from '../lib/freeze.mjs';

test('stampPins fills engine sha and file hashes without mutating input', () => {
  const root = mkdtempSync(join(tmpdir(), 'cert-'));
  writeFileSync(join(root, 'a.ts'), 'export const x = 1;\n');
  const card = {
    engine_pin: { version: 'v0.6.6-pre', sha: null },
    source_files: [{ path: 'a.ts', sha256: null }],
  };
  const out = stampPins(card, { repoRoot: root, gitSha: 'abc123', version: 'v0.6.6-pre' });
  assert.equal(out.engine_pin.sha, 'abc123');
  assert.match(out.source_files[0].sha256, /^[0-9a-f]{64}$/);
  assert.equal(card.engine_pin.sha, null); // input untouched
});

test('fileSha256 is deterministic', () => {
  const root = mkdtempSync(join(tmpdir(), 'cert-'));
  const p = join(root, 'b.txt');
  writeFileSync(p, 'same bytes');
  assert.equal(fileSha256(p), fileSha256(p));
});

test('a missing source file throws with the path in the message', () => {
  const root = mkdtempSync(join(tmpdir(), 'cert-'));
  const card = { engine_pin: { version: 'x', sha: null }, source_files: [{ path: 'nope.ts', sha256: null }] };
  assert.throws(() => stampPins(card, { repoRoot: root, gitSha: 's', version: 'x' }), /nope\.ts/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test validation/certification/test/freeze.test.mjs`
Expected: FAIL — cannot find module `../lib/freeze.mjs`

- [ ] **Step 3: Write minimal implementation**

```js
// validation/certification/lib/freeze.mjs
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export function fileSha256(absPath) {
  return createHash('sha256').update(readFileSync(absPath)).digest('hex');
}

export function stampPins(card, { repoRoot, gitSha, version }) {
  const out = structuredClone(card);
  out.engine_pin = { version, sha: gitSha };
  out.source_files = out.source_files.map((f) => {
    const abs = resolve(repoRoot, f.path);
    let sha256;
    try { sha256 = fileSha256(abs); }
    catch { throw new Error(`source file not found while freezing: ${f.path}`); }
    return { ...f, sha256 };
  });
  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test validation/certification/test/freeze.test.mjs`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git commit -m "cert: freeze tooling stamps engine sha and source hashes

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>" -- validation/certification/lib/freeze.mjs validation/certification/test/freeze.test.mjs
```

---

### Task 3: Author the nine claim cards (content)

**Files:**
- Create: `validation/certification/cards/<id>.json` × 9 (contents below, with `sha: null` / `sha256: null` — Task 4 freezes them)
- Create: `validation/certification/tools/validate-cards.mjs` (small runner)

**Interfaces:**
- Consumes: `validateCard` (Task 1).
- Produces: nine card files whose `detector_id` values downstream tasks rely on verbatim: `family_A_betting_e_process`, `family_A_mixture_supermartingale`, `safe_t_e_value`, `universal_inference_e_value`, `sequential_ui_e_process`, `family_C_safe_hotelling`, `sequential_mmd_betting_e_process`, `family_D_spectral_e_detector`, `family_E_conformal`.

The card contents encode the wiki's evidence record. **The implementer copies these verbatim**; disagreements with the wiki are findings, not silent edits. Regime fields state what the detector *claims*, not what it achieves — the verdict script is what compares the two.

- [ ] **Step 1: Write the nine cards.** Each is the Task 1 `goodCard` shape. Field values per detector (fields not listed take: `protocol_version: 1`, `engine_pin: {version: 'v0.6.6-pre', sha: null}`, all `sha256: null`):

**1. `family_A_betting_e_process.json`** — aliases `['betting_e_process','family_A_betting']`; family A; class `test_martingale`; sources `detectors/betting-e-process.ts`; guarantee sentence `E[e_t|F_{t-1}] <= 1 per tick under H0, given oracle (mu, sigma^2, phi); under estimated parameters validity is claimed only at m >= 500 with a measured c-bound`; quantifiers `[{text:'per tick, any stopping time', tag:'empirical', proof_artifact:null}]`; regime `{phi_max: 0.9, m_min: 500, baseline: 'oracle-or-large-m', nulls: 'iid-gaussian, ar1'}`; shipped_path kind `wealth process (aGRAPA bet), AR(1) pre-whitened, bootstrap threshold substitution ~2.4e4x over 1/alpha`; budget `{participating: true, alpha_booked: null, resolution_claim: null}`; falsifier `increment lower95 > 1.0005 in a claimed-regime cell`; prior_evidence: S2 `detector-audit` runs `detector-audit/results/live/seq-*` wiki `stats/detector-audit-sequential-2026-08-05`; S3 `detector-audit-power` runs `detector-audit/results/live/power-*` wiki `stats/detector-audit-power-2026-08-05`; S2 `h0-battery` runs `h0-battery/results/live/run-*` wiki `stats/h0-battery-2026-08-01`.

**2. `family_A_mixture_supermartingale.json`** — as card 1 with: id/aliases `['mixture_supermartingale']`; sources `detectors/_page-cusum-mixture.ts`; guarantee sentence `Howard-Ramdas mixture supermartingale: E[M_t|F_{t-1}] <= M_{t-1} under H0 given oracle (mu, sigma^2, phi)`; shipped_path notes `known defects: NaN on right-skewed (N5), 8.5e46 on t3 (N6) — non-finite guard applies`.

**3. `safe_t_e_value.json`** — aliases `['safe-t','safe_t']`; family `-`; class `terminal_e_value`; sources `detectors/safe-t-e-value.ts`; guarantee sentence `E[e] <= 1 under H0 for any sigma (right-Haar/GROW, sigma integrated out), at any calibration length, given known phi <= 0.95`; quantifiers `[{text:'for any sigma', tag:'proof', proof_artifact:'ADR 0005 / Gruenwald safe-t; hypotheses checked at S2 N2'}, {text:'any calibration length', tag:'empirical', proof_artifact:null}]`; regime `{phi_max: 0.95, m_min: null, baseline: 'estimated', nulls: 'iid-gaussian, ar1 phi<=0.95'}`; shipped_path kind `terminal e-value, phi plug-in`; budget participating true; falsifier `exceedance > alpha or mean(e) materially > 1 in a cell with phi <= 0.95`; prior_evidence: S2 `terminal-evalue` runs `terminal-evalue/results/live/run-*` wiki `stats/terminal-evalue-2026-08-02`; S2+S3 `power-per-cell` runs `terminal-evalue/results/live/*` wiki `stats/power-per-cell-2026-08-05`.

**4. `universal_inference_e_value.json`** — aliases `['ui','universal_inference']`; class `terminal_e_value`; sources `detectors/universal-inference-e-value.ts`; guarantee sentence `E[e] <= 1 under H0 for any phi (split-LRT, no regularity conditions); power claimed only at phi <= 0.8`; quantifiers `[{text:'for any phi', tag:'proof', proof_artifact:'Wasserman-Ramdas-Balakrishnan 2020 universal inference; split independence checked at S2'}]`; regime `{phi_max: 0.99, m_min: null, baseline: 'estimated', nulls: 'any tested'}` plus `power_phi_max: 0.8` in regime; shipped_path kind `terminal e-value, fixed split`; budget participating true; falsifier `exceedance > alpha in any cell`; prior_evidence: S2 `detector-audit-terminal` wiki `stats/detector-audit-terminal-2026-08-05`; S2+S3 T2 `clustersynth-ui` runs `detector-audit/results/live/sui-*` wiki `stats/clustersynth-ui-2026-08-05`; S3 `power-per-cell` wiki `stats/power-per-cell-2026-08-05`.

**5. `sequential_ui_e_process.json`** — aliases `['sequential_ui','seq_ui']`; class `e_process`; sources `detectors/sequential-ui.ts`; guarantee sentence `E[E_tau] <= 1 at every stopping time for any phi including near unit root (numerator fit on strictly-past data, denominator a profiled sup)`; quantifiers `[{text:'every stopping time, any phi', tag:'empirical', proof_artifact:null}]` (the 'BY CONSTRUCTION' envelope claim has no machine-checked artifact — tag empirical per the three-guardians rule); regime `{phi_max: 0.99, m_min: null, baseline: 'estimated', nulls: 'any tested'}`; budget participating true; falsifier `crossing rate > alpha at a stopping rule inside the regime`; prior_evidence: S2 `detector-audit-arm3` wiki `stats/detector-audit-arm3-2026-08-05`; S2+S3 T2 `clustersynth-ui` runs `detector-audit/results/live/sui-*` wiki `stats/clustersynth-ui-2026-08-05`.

**6. `family_C_safe_hotelling.json`** — aliases `['safe_hotelling','hotelling_safe_test']`; family C; class `test_martingale`; sources `detectors/_hotelling-safe.ts`; guarantee sentence `Gruenwald GROW safe test on Hotelling T^2: E[e_t|F_{t-1}] <= 1 under H0 given the compiled (mu, Sigma) as truth`; quantifiers `[{text:'per tick', tag:'empirical', proof_artifact:null}]`; regime `{phi_max: null, m_min: null, baseline: 'oracle-compiled', nulls: 'multivariate gaussian'}`; shipped_path kind `wealth process, bootstrap threshold substitution ~3.6e76x over 1/alpha`; budget participating true; falsifier `increment lower95 > 1.0005 on the compiled-oracle null`; prior_evidence: S4 `bootstrap-overshoot` wiki `stats/ville-guarantee-is-empirical` (no S2/S3 audit runs exist — the re-score will list them missing).

**7. `sequential_mmd_betting_e_process.json`** — aliases `['family_C_mmd','mmd_betting']`; family C; class `test_martingale`; sources `detectors/sequential-mmd.ts`, `detectors/family-c-betting-e-process.ts`; guarantee sentence `Shekhar-Ramdas betting e-process on RFF-MMD: E[e_t|F_{t-1}] <= 1 under H0`; quantifiers `[{text:'per tick', tag:'empirical', proof_artifact:null}]`; regime `{phi_max: null, m_min: 100, baseline: 'compiled', nulls: 'multivariate'}`; shipped_path notes `retirement implemented on deploysignal branch retire/family-c-mmd, unmerged; refuted on own Gaussian control; blind to shape; compiles on zero real cells`; budget participating false; falsifier `already fired: crossing 0.1575 on Gaussian control under mrcd`; prior_evidence: S2 `family-c-shipped` wiki `stats/family-c-shipped-2026-08-04`; S1 `family-c-reachability` wiki `stats/family-c-reachability-2026-08-04`; S3 `family-c-blind-to-shape` wiki `stats/family-c-blind-to-shape-2026-08-04`.

**8. `family_D_spectral_e_detector.json`** — aliases `['family_D_spectral','spectral_e_detector']`; family D; class `test_martingale`; sources `detectors/spectral.ts`; guarantee sentence `Shin-Ramdas-Rinaldo e-detector on spectral peak; shipped rolling windows violate the martingale-difference condition; heuristic as shipped, priced c-bound optional (c = 1.064 at T=300, 1.108 at T=900, grows with horizon)`; quantifiers `[]`; regime `{phi_max: null, m_min: null, baseline: 'any', nulls: 'none claimed'}`; budget `{participating: false, alpha_booked: 0, resolution_claim: 'bootstrap resolves 2e-3 at N=500; do not book finer'}`; falsifier `already fired: REFUTED at N1 (increment 1.0012, crossing 1.0 at N7)`; prior_evidence: S2 `detector-audit` runs `detector-audit/results/live/seq-*` wiki `stats/detector-audit-sequential-2026-08-05`; S3 runs `detector-audit/results/live/power-*` wiki `stats/detector-audit-power-2026-08-05`.

**9. `family_E_conformal.json`** — aliases `['mahalanobis_conformal_baseline','family_E']`; family E; class `terminal_e_value`; sources `detectors/conformal.ts`, `../deploysignal/tools/calibrators/family-e.ts`; guarantee sentence `weighted_e_value kind: hedged indicator e-value; UNREACHABLE on the shipped path — the auto selector emits the pre-#19 parametric-bootstrap p-value kind because the ESS gate (0.9) never passes (measured 0.86562 at every span)`; quantifiers `[{text:'P(indicator=1|H0) = alpha_E by construction', tag:'empirical', proof_artifact:null}]`; regime `{phi_max: null, m_min: null, baseline: 'synthetic chi_p calibration, no real data', nulls: 'gaussian plug-in'}`; shipped_path kind `p-value (kind: unweighted)`; budget `{participating: true, alpha_booked: 1.0e-4, resolution_claim: null}` with notes `~12.5% of participating budget as a classical path — S4.1 adjudicates this`; falsifier `the ESS gate passing on a shipped config would falsify the unreachability claim`; prior_evidence: S1+S2 `detector-audit-arm3` wiki `stats/detector-audit-arm3-2026-08-05`; S2 `family-ce-nulls` runs `family-ce-nulls/results/live/*` wiki `stats/family-ce-nulls-2026-08-03`.

- [ ] **Step 2: Write the validation runner**

```js
// validation/certification/tools/validate-cards.mjs
import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateCard } from '../lib/schema.mjs';

const cardsDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'cards');
let failed = false;
for (const f of readdirSync(cardsDir).filter((n) => n.endsWith('.json')).sort()) {
  const card = JSON.parse(readFileSync(join(cardsDir, f), 'utf8'));
  const errs = validateCard(card);
  if (errs.length) { failed = true; console.error(`${f}:\n  ${errs.join('\n  ')}`); }
  else console.log(`${f}: OK`);
}
process.exit(failed ? 1 : 0);
```

- [ ] **Step 3: Run it; all nine must print OK**

Run: `node validation/certification/tools/validate-cards.mjs`
Expected: nine `OK` lines, exit 0. Fix schema violations in cards (not by loosening the schema).

- [ ] **Step 4: Cross-check card content against the wiki record.** For each card, open the wiki page named in its `prior_evidence` and confirm the guarantee sentence, regime bounds, and shipped-path notes match the page's claims. Any mismatch: fix the card if the card is wrong; **stop and report** if the wiki looks wrong.

- [ ] **Step 5: Commit (cards are still unfrozen — sha fields null)**

```bash
git add validation/certification/cards validation/certification/tools/validate-cards.mjs
git commit -m "cert: nine claim cards, unfrozen

Card content transcribes the wiki evidence record; the freeze commit
follows separately so the pre-registration event is its own SHA.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>" -- validation/certification
```

---

### Task 4: Freeze the cards (the pre-registration event)

**Files:**
- Create: `validation/certification/tools/freeze-cards.mjs`
- Modify: all nine `validation/certification/cards/*.json` (stamped in place)

**Interfaces:**
- Consumes: `stampPins` (Task 2).
- Produces: cards with `engine_pin.sha` and every `source_files[].sha256` non-null. Downstream (Task 9) verifies against exactly these.

- [ ] **Step 1: Write the freeze runner**

```js
// validation/certification/tools/freeze-cards.mjs
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { stampPins } from '../lib/freeze.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..', '..');
const cardsDir = join(here, '..', 'cards');
const gitSha = execSync('git rev-parse HEAD', { cwd: repoRoot }).toString().trim();
const version = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8')).version;

for (const f of readdirSync(cardsDir).filter((n) => n.endsWith('.json')).sort()) {
  const p = join(cardsDir, f);
  const stamped = stampPins(JSON.parse(readFileSync(p, 'utf8')), { repoRoot, gitSha, version });
  writeFileSync(p, JSON.stringify(stamped, null, 2) + '\n');
  console.log(`${f}: pinned ${gitSha.slice(0, 7)}`);
}
```

- [ ] **Step 2: Run freeze, then re-validate**

Run: `node validation/certification/tools/freeze-cards.mjs && node validation/certification/tools/validate-cards.mjs`
Expected: nine `pinned` lines then nine `OK` lines. Note the pinned SHA is the *pre-freeze* HEAD — the card records the tree its hashes describe; the freeze commit itself is the registration timestamp.

- [ ] **Step 3: Commit — this commit IS the freeze; cards do not change after it inside protocol v1**

```bash
git commit -m "cert: freeze the nine claim cards

Pre-registration event for certification v1. Cards pin engine
$(git rev-parse --short HEAD) and hash every source file.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>" -- validation/certification/cards validation/certification/tools/freeze-cards.mjs
```

---

### Task 5: Guards

**Files:**
- Create: `validation/certification/lib/guards.mjs`
- Test: `validation/certification/test/guards.test.mjs`

**Interfaces:**
- Consumes: cell objects in the `summary.json` shapes (validity cells carry `increment_estimator {mean, sd, lower95_one_sided}`, `crossing_rate`, `verdict`; power cells carry `detection_rate`, `shift_sigma`, `non_finite_wealth`, `adapter_failures`, `verdict`).
- Produces: `applyGuards(cell, cls) -> {status: 'OK'|'VACUOUS'|'NON_FINITE'|'VOID', reason: string|null}`; `internalConsistency(cells) -> string[]` (list of impossibility descriptions, empty = consistent).

Guard semantics, from the protocol (do not weaken):
- **VACUOUS** — a wealth process that never moved: `increment_estimator.sd === 0` (zero-width interval). A vacuous cell can never be CLEARED; it becomes NOT-EXECUTABLE.
- **NON_FINITE** — `!Number.isFinite(increment_estimator.mean)` or `non_finite_wealth > 0`: the cell is excluded as a named defect, counted neither way.
- **VOID** — instrument–class mismatch: an `increment_estimator` present on an `e_process` cell, or a cell for a `test_martingale` carrying only exceedance fields. Voids the run for that detector.
- **internalConsistency** — values impossible under one detector's own class across its cells, e.g. an increment mean > 1e6 alongside a crossing rate of 0 (the arm-3 catch: 1.1e8 beside a stopped mean of 1e-5).

- [ ] **Step 1: Write the failing test**

```js
// validation/certification/test/guards.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyGuards, internalConsistency } from '../lib/guards.mjs';

const seqCell = (over = {}) => ({
  detector: 'family_A_betting_e_process', null_id: 'N1', verdict: 'CLEARED',
  increment_estimator: { mean: 1.0000, sd: 0.0002, lower95_one_sided: 0.9999 },
  crossing_rate: 0, ...over,
});

test('zero-width interval is VACUOUS, not CLEARED', () => {
  const g = applyGuards(seqCell({ increment_estimator: { mean: 1.0, sd: 0, lower95_one_sided: 1.0 } }), 'test_martingale');
  assert.equal(g.status, 'VACUOUS');
});

test('NaN increment is NON_FINITE', () => {
  const g = applyGuards(seqCell({ increment_estimator: { mean: NaN, sd: NaN, lower95_one_sided: NaN } }), 'test_martingale');
  assert.equal(g.status, 'NON_FINITE');
});

test('increment instrument on an e_process cell is VOID', () => {
  const g = applyGuards(seqCell(), 'e_process');
  assert.equal(g.status, 'VOID');
});

test('healthy martingale cell passes', () => {
  assert.equal(applyGuards(seqCell(), 'test_martingale').status, 'OK');
});

test('internalConsistency flags an impossible increment/crossing pair', () => {
  const bad = seqCell({ increment_estimator: { mean: 1.1e8, sd: 1, lower95_one_sided: 1.1e8 }, crossing_rate: 0 });
  const flags = internalConsistency([bad]);
  assert.equal(flags.length, 1);
  assert.match(flags[0], /N1/);
});

test('power cell with non_finite_wealth > 0 is NON_FINITE', () => {
  const g = applyGuards({ detector: 'x', null_id: 'N5', detection_rate: 0, shift_sigma: 3, non_finite_wealth: 12, verdict: 'INERT' }, 'test_martingale');
  assert.equal(g.status, 'NON_FINITE');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test validation/certification/test/guards.test.mjs`
Expected: FAIL — cannot find module

- [ ] **Step 3: Write minimal implementation**

```js
// validation/certification/lib/guards.mjs
const isValidityCell = (c) => 'increment_estimator' in c || 'stopped_mean' in c || 'exceedance' in c;

export function applyGuards(cell, cls) {
  if (cell.non_finite_wealth > 0) return { status: 'NON_FINITE', reason: `non_finite_wealth=${cell.non_finite_wealth}` };
  const inc = cell.increment_estimator;
  if (inc) {
    if (cls === 'e_process' || cls === 'terminal_e_value')
      return { status: 'VOID', reason: `increment estimator is not a valid instrument for class ${cls}` };
    if (![inc.mean, inc.sd, inc.lower95_one_sided].every(Number.isFinite))
      return { status: 'NON_FINITE', reason: 'non-finite increment estimator' };
    if (inc.sd === 0) return { status: 'VACUOUS', reason: 'zero-width interval: the wealth process never moved' };
  }
  if (isValidityCell(cell) && !inc && cls === 'test_martingale')
    return { status: 'VOID', reason: 'test_martingale cell without an increment estimator' };
  return { status: 'OK', reason: null };
}

export function internalConsistency(cells) {
  const flags = [];
  for (const c of cells) {
    const inc = c.increment_estimator;
    if (inc && Number.isFinite(inc.mean) && inc.mean > 1e6 && c.crossing_rate === 0)
      flags.push(`${c.detector} ${c.null_id}: increment mean ${inc.mean} with crossing_rate 0 is internally impossible`);
  }
  return flags;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test validation/certification/test/guards.test.mjs`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git commit -m "cert: vacuous-pass, non-finite, void and consistency guards

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>" -- validation/certification/lib/guards.mjs validation/certification/test/guards.test.mjs
```

---

### Task 6: Evidence collector

**Files:**
- Create: `validation/certification/lib/collect.mjs`
- Test: `validation/certification/test/collect.test.mjs` (uses a fixture tree it builds in tmp, mirroring the real layout)

**Interfaces:**
- Consumes: the on-disk layout `validation/<study>/results/live/<run>/{manifest.json,summary.json}`. `summary.json` is either `{cells: [...]}` or a bare array of cells (both exist in the wild — the power runs are arrays).
- Produces: `loadEvidence(validationRoot) -> {cells: [], runs: []}` where every cell is annotated `{__study, __run, __git_sha, __tier}` (tier via `tierOfStudy(manifest.study)`); `cellsFor(evidence, card) -> []` matching `cell.detector` against `card.detector_id` or any alias.

- [ ] **Step 1: Write the failing test**

```js
// validation/certification/test/collect.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { loadEvidence, cellsFor } from '../lib/collect.mjs';

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'ev-'));
  const mk = (study, run, manifest, summary) => {
    const d = join(root, study, 'results', 'live', run);
    mkdirSync(d, { recursive: true });
    writeFileSync(join(d, 'manifest.json'), JSON.stringify(manifest));
    writeFileSync(join(d, 'summary.json'), JSON.stringify(summary));
  };
  mk('detector-audit', 'seq-1', { study: 'detector-audit-sequential', git_sha: 'aaa' },
    { cells: [{ detector: 'family_A_betting_e_process', null_id: 'N1', verdict: 'CLEARED' }] });
  mk('detector-audit', 'power-1', { study: 'detector-audit-power', git_sha: 'aaa' },
    [{ detector: 'betting_e_process', null_id: 'N1', shift_sigma: 3, detection_rate: 1, verdict: 'POWERED' }]);
  mk('shape-battery', 'sui-1', { study: 'clustersynth-ui', git_sha: 'bbb' },
    { cells: [{ detector: 'sequential_ui_e_process', null_id: 'CS1', verdict: 'CLEARED' }] });
  return root;
}

test('loads dict-shaped and array-shaped summaries, annotates study/run/tier', () => {
  const ev = loadEvidence(fixture());
  assert.equal(ev.cells.length, 3);
  const cs = ev.cells.find((c) => c.__study === 'clustersynth-ui');
  assert.equal(cs.__tier, 'T2');
  assert.equal(ev.cells.find((c) => c.__run === 'seq-1').__tier, 'T1');
});

test('cellsFor matches on detector_id and aliases', () => {
  const ev = loadEvidence(fixture());
  const card = { detector_id: 'family_A_betting_e_process', aliases: ['betting_e_process'] };
  assert.equal(cellsFor(ev, card).length, 2); // seq cell by id, power cell by alias
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test validation/certification/test/collect.test.mjs`
Expected: FAIL — cannot find module

- [ ] **Step 3: Write minimal implementation**

```js
// validation/certification/lib/collect.mjs
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tierOfStudy } from './constants.mjs';

const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));

export function loadEvidence(validationRoot) {
  const cells = [];
  const runs = [];
  for (const study of readdirSync(validationRoot, { withFileTypes: true }).filter((d) => d.isDirectory())) {
    const live = join(validationRoot, study.name, 'results', 'live');
    if (!existsSync(live)) continue;
    for (const run of readdirSync(live, { withFileTypes: true }).filter((d) => d.isDirectory())) {
      const dir = join(live, run.name);
      const mPath = join(dir, 'manifest.json');
      const sPath = join(dir, 'summary.json');
      if (!existsSync(sPath)) continue;
      const manifest = existsSync(mPath) ? readJson(mPath) : { study: study.name, git_sha: null };
      const summary = readJson(sPath);
      const rawCells = Array.isArray(summary) ? summary : (summary.cells ?? []);
      runs.push({ study: manifest.study ?? study.name, run: run.name, git_sha: manifest.git_sha ?? null });
      for (const c of rawCells) {
        cells.push({ ...c, __study: manifest.study ?? study.name, __run: run.name, __git_sha: manifest.git_sha ?? null, __tier: tierOfStudy(manifest.study ?? study.name) });
      }
    }
  }
  return { cells, runs };
}

export function cellsFor(evidence, card) {
  const ids = new Set([card.detector_id, ...(card.aliases ?? [])]);
  return evidence.cells.filter((c) => ids.has(c.detector));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test validation/certification/test/collect.test.mjs`
Expected: PASS (2 tests)

- [ ] **Step 5: Smoke against the real tree** (harness-discipline rule: smoke-check every interface before it feeds a measurement)

Run: `node -e "import('./validation/certification/lib/collect.mjs').then(m => { const ev = m.loadEvidence('validation'); console.log(ev.runs.length, 'runs,', ev.cells.length, 'cells'); })"`
Expected: nonzero runs and cells, no throw. If a study's summary shape breaks the loader, extend the loader (and the fixture) — do not skip the study silently; print skipped paths.

- [ ] **Step 6: Commit**

```bash
git commit -m "cert: evidence collector over validation results

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>" -- validation/certification/lib/collect.mjs validation/certification/test/collect.test.mjs
```

---

### Task 7: Stage scorers and the overall verdict

**Files:**
- Create: `validation/certification/lib/score.mjs`
- Test: `validation/certification/test/score.test.mjs`

**Interfaces:**
- Consumes: `applyGuards`, `internalConsistency` (Task 5); `INERTNESS_FLOOR`, `INERTNESS_SHIFT_SIGMA` (Task 1); annotated cells (Task 6).
- Produces:
  - `scoreS2(card, cells) -> {status: 'PASS'|'REFUTED'|'MISSING'|'VOID', perCell: [], excluded: [], missing: []}`
  - `scoreS3(card, cells) -> {status: 'PASS'|'INERT'|'MISSING', perCell: [], missing: []}`
  - `scoreS4(card) -> {status: 'PASS'|'REFUSE'|'UNPRICED', reasons: []}`
  - `overallVerdict(card, s2, s3, s4) -> {verdict, tier, regime, reasons: []}`
  - S1 note: reachability has no machine-readable runs yet (Family C's study predates the run-manifest convention) — `scoreS1(card)` returns `{status: card.prior_evidence.some(e => e.stage === 'S1') ? 'DECLARED' : 'MISSING'}` and the card page must cite the wiki page. This is v1's honest floor; upgrading S1 to run-backed is listed in MISSING-CELLS.

Scoring rules (protocol, verbatim — do not reinterpret):
- S2: guards first; NON_FINITE cells → `excluded` (named); VACUOUS → cell NOT-EXECUTABLE; VOID anywhere → stage VOID. Then the stage is the **worst surviving cell inside the claimed regime** (a cell is in-regime when `cell.phi == null || cell.phi <= regime.phi_max` and `cell.m == null || regime.m_min == null || cell.m >= regime.m_min`). Recorded per-cell `verdict` fields are trusted — they were computed under their own pre-registrations; this stage maps them, it does not re-derive them. Out-of-regime REFUTED cells go to `perCell` annotated `out_of_regime: true` and do not fail the stage.
- S3: only cells with `shift_sigma === INERTNESS_SHIFT_SIGMA` and in-regime count; `detection_rate < INERTNESS_FLOOR` → INERT. Zero such cells → MISSING.
- S4: `REFUSE` if `card.shipped_path.kind` contains `p-value` **and** `card.budget.participating` (the C25 rule: unanswered combination question is a refusal, not a pass). `UNPRICED` if the shipped path mentions `bootstrap threshold substitution` and no measured c-bound artifact is cited in `prior_evidence` (stage `S4`). Else PASS.
- Overall: any stage VOID → NOT_EXECUTABLE(void). S2 REFUTED in-regime → REFUSE. S2 MISSING or S3 MISSING → NOT_EXECUTABLE(missing evidence). S3 INERT across all claimed cells → ADVISORY (valid-but-inert fails USE). S4 REFUSE → budget participation refused: verdict ADVISORY with the reason recorded. S4 UNPRICED → USE is capped at ADVISORY until the c-bound is measured. All pass → USE with `tier` = the minimum tier across the stages' supporting cells (a stage supported only at T1 caps the verdict at T1) and `regime` copied from the card.

- [ ] **Step 1: Write the failing test**

```js
// validation/certification/test/score.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scoreS2, scoreS3, scoreS4, overallVerdict } from '../lib/score.mjs';

const card = {
  detector_id: 'd', aliases: [], class: 'test_martingale',
  guarantee: { regime: { phi_max: 0.9, m_min: 500 } },
  shipped_path: { kind: 'wealth process', notes: '' },
  budget: { participating: true },
  prior_evidence: [{ stage: 'S1', study: 'x', wiki: 'y' }],
};
const vCell = (over = {}) => ({ detector: 'd', null_id: 'N1', phi: 0, m: null, verdict: 'CLEARED',
  increment_estimator: { mean: 1.0, sd: 0.001, lower95_one_sided: 0.999 }, crossing_rate: 0, __tier: 'T1', ...over });
const pCell = (over = {}) => ({ detector: 'd', null_id: 'N1', phi: 0, m: null, shift_sigma: 3,
  detection_rate: 1.0, verdict: 'POWERED', __tier: 'T1', ...over });

test('S2 takes the worst in-regime cell; out-of-regime REFUTED does not fail it', () => {
  const s2 = scoreS2(card, [vCell(), vCell({ null_id: 'N4', phi: 0.99, verdict: 'REFUTED' })]);
  assert.equal(s2.status, 'PASS');
  assert.ok(s2.perCell.find((c) => c.null_id === 'N4').out_of_regime);
});

test('S2 in-regime REFUTED fails the stage', () => {
  const s2 = scoreS2(card, [vCell({ verdict: 'REFUTED' })]);
  assert.equal(s2.status, 'REFUTED');
});

test('S2 vacuous cell cannot pass: becomes NOT-EXECUTABLE per cell', () => {
  const s2 = scoreS2(card, [vCell({ increment_estimator: { mean: 1, sd: 0, lower95_one_sided: 1 } })]);
  assert.equal(s2.perCell[0].mapped, 'NOT_EXECUTABLE');
  assert.equal(s2.status, 'MISSING'); // no scoreable in-regime cell survived
});

test('S3 flags inert below the floor', () => {
  const s3 = scoreS3(card, [pCell({ detection_rate: 0.05, verdict: 'INERT' })]);
  assert.equal(s3.status, 'INERT');
});

test('S4 refuses a participating p-value path', () => {
  const s4 = scoreS4({ ...card, shipped_path: { kind: 'p-value (kind: unweighted)' } });
  assert.equal(s4.status, 'REFUSE');
});

test('S4 marks unmeasured bootstrap substitution UNPRICED', () => {
  const s4 = scoreS4({ ...card, shipped_path: { kind: 'wealth process, bootstrap threshold substitution ~2.4e4x' } });
  assert.equal(s4.status, 'UNPRICED');
});

test('overall: clean stages give USE at the evidence tier', () => {
  const v = overallVerdict(card, scoreS2(card, [vCell()]), scoreS3(card, [pCell()]), scoreS4(card));
  assert.equal(v.verdict, 'USE');
  assert.equal(v.tier, 'T1');
});

test('overall: valid-but-inert is ADVISORY, never USE', () => {
  const v = overallVerdict(card, scoreS2(card, [vCell()]), scoreS3(card, [pCell({ detection_rate: 0.0, verdict: 'INERT' })]), scoreS4(card));
  assert.equal(v.verdict, 'ADVISORY');
});

test('overall: in-regime refutation is REFUSE', () => {
  const v = overallVerdict(card, scoreS2(card, [vCell({ verdict: 'REFUTED' })]), scoreS3(card, [pCell()]), scoreS4(card));
  assert.equal(v.verdict, 'REFUSE');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test validation/certification/test/score.test.mjs`
Expected: FAIL — cannot find module

- [ ] **Step 3: Implement `score.mjs`** — follow the scoring rules block above literally; ~120 lines. In-regime helper:

```js
const inRegime = (cell, regime) =>
  (cell.phi == null || regime.phi_max == null || cell.phi <= regime.phi_max) &&
  (cell.m == null || regime.m_min == null || cell.m >= regime.m_min);
```

`scoreS2` maps each validity cell (cells carrying `increment_estimator`, `stopped_mean`, or `exceedance` fields) through `applyGuards`, then: VOID guard → stage VOID immediately; NON_FINITE → push to `excluded` with reason; VACUOUS → `mapped: 'NOT_EXECUTABLE'`; else `mapped: cell.verdict`. Stage status: `'VOID'` if voided; `'REFUTED'` if any in-regime mapped REFUTED; `'MISSING'` if zero in-regime cells mapped CLEARED/REFUTED; else `'PASS'`. `scoreS3` filters power cells (`'detection_rate' in cell`) at the registered shift, in-regime; INERT if any claimed cell is below floor, MISSING if none, else PASS. `scoreS4` and `overallVerdict` per the rules block. `overallVerdict` computes tier as the minimum `__tier` over the cells that supported S2 and S3 (T1 < T2 < T3).

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test validation/certification/test/score.test.mjs`
Expected: PASS (9 tests)

- [ ] **Step 5: Commit**

```bash
git commit -m "cert: stage scorers and mechanical overall verdict

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>" -- validation/certification/lib/score.mjs validation/certification/test/score.test.mjs
```

---

### Task 8: CLI, card emission, report, machine-check

**Files:**
- Create: `validation/certification/verdict.mjs`
- Create: `validation/certification/README.md`
- Test: `validation/certification/test/report-consistency.test.mjs`
- Modify: `package.json` (add script `"cert:verdict": "node validation/certification/verdict.mjs"`)

**Interfaces:**
- Consumes: everything above.
- Produces: `results/run-<UTC ISO basic>/` containing `manifest.json` (git sha, node version, card hashes, protocol_version), one `<detector_id>.card.json` per card (`{card, s1, s2, s3, s4, overall, generated_from: {runs}}`), `REPORT.md`, and `MISSING-CELLS.md`.

- [ ] **Step 1: Write `verdict.mjs`**

```js
// validation/certification/verdict.mjs
import { readdirSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { validateCard } from './lib/schema.mjs';
import { loadEvidence, cellsFor } from './lib/collect.mjs';
import { internalConsistency } from './lib/guards.mjs';
import { scoreS1, scoreS2, scoreS3, scoreS4, overallVerdict } from './lib/score.mjs';
import { fileSha256 } from './lib/freeze.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..');
const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..*/, 'Z');
const outDir = join(here, 'results', `run-${stamp}`);
mkdirSync(outDir, { recursive: true });

const evidence = loadEvidence(join(repoRoot, 'validation'));
const cardFiles = readdirSync(join(here, 'cards')).filter((f) => f.endsWith('.json')).sort();
const emitted = [];
for (const f of cardFiles) {
  const card = JSON.parse(readFileSync(join(here, 'cards', f), 'utf8'));
  const errs = validateCard(card);
  if (errs.length) throw new Error(`${f} fails schema: ${errs.join('; ')}`);
  if (card.engine_pin.sha == null) throw new Error(`${f} is unfrozen; run freeze-cards first`);
  const cells = cellsFor(evidence, card);
  const consistency = internalConsistency(cells);
  const validity = cells.filter((c) => 'increment_estimator' in c || 'stopped_mean' in c || 'exceedance' in c);
  const power = cells.filter((c) => 'detection_rate' in c);
  const s1 = scoreS1(card);
  const s2 = consistency.length ? { status: 'VOID', perCell: [], excluded: [], missing: [], void_reasons: consistency } : scoreS2(card, validity);
  const s3 = scoreS3(card, power);
  const s4 = scoreS4(card);
  const overall = overallVerdict(card, s2, s3, s4);
  const out = { card, s1, s2, s3, s4, overall, generated_from: { runs: [...new Set(cells.map((c) => `${c.__study}/${c.__run}`))] } };
  writeFileSync(join(outDir, `${card.detector_id}.card.json`), JSON.stringify(out, null, 2) + '\n');
  emitted.push(out);
}

const gitSha = execSync('git rev-parse HEAD', { cwd: repoRoot }).toString().trim();
writeFileSync(join(outDir, 'manifest.json'), JSON.stringify({
  study: 'detector-certification', protocol_version: 1, git_sha: gitSha,
  node: process.version, cards: cardFiles.map((f) => ({ file: f, sha256: fileSha256(join(here, 'cards', f)) })),
}, null, 2) + '\n');

const line = (o) => `| ${o.card.detector_id} | ${o.card.class} | ${o.s2.status} | ${o.s3.status} | ${o.s4.status} | **${o.overall.verdict}** | ${o.overall.tier ?? '—'} |`;
writeFileSync(join(outDir, 'REPORT.md'), [
  `# Certification re-score — protocol v1, engine ${gitSha.slice(0, 7)}`, '',
  'Verdicts computed mechanically from frozen cards and existing registered runs. See MISSING-CELLS.md for what this run could not adjudicate.', '',
  '| detector | class | S2 | S3 | S4 | verdict | tier |', '|---|---|---|---|---|---|---|',
  ...emitted.map(line), '',
].join('\n'));

const missing = emitted.flatMap((o) => [
  ...(o.s1.status === 'MISSING' ? [`- ${o.card.detector_id}: S1 reachability has no run-backed evidence`] : []),
  ...(o.s2.status === 'MISSING' ? [`- ${o.card.detector_id}: S2 has no scoreable in-regime validity cell`] : []),
  ...(o.s3.status === 'MISSING' ? [`- ${o.card.detector_id}: S3 has no in-regime power cell at the registered shift`] : []),
  ...(o.s4.status === 'UNPRICED' ? [`- ${o.card.detector_id}: S4 c-bound unmeasured behind a bootstrap-substituted threshold`] : []),
  ...o.s2.missing ?? [], ...o.s3.missing ?? [],
]);
writeFileSync(join(outDir, 'MISSING-CELLS.md'), ['# Missing cells (protocol v1 re-score)', '', ...(missing.length ? missing : ['(none)']), ''].join('\n'));
console.log(`emitted ${emitted.length} cards -> ${outDir}`);
```

- [ ] **Step 2: Write the machine-check test** (the runway `test_report_consistency` mechanism — the report cannot drift from the card JSONs)

```js
// validation/certification/test/report-consistency.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const resultsRoot = join(dirname(fileURLToPath(import.meta.url)), '..', 'results');

test('every REPORT.md verdict line matches its card JSON', (t) => {
  if (!existsSync(resultsRoot)) return t.skip('no runs yet');
  for (const run of readdirSync(resultsRoot).filter((d) => d.startsWith('run-'))) {
    const dir = join(resultsRoot, run);
    const report = readFileSync(join(dir, 'REPORT.md'), 'utf8');
    for (const f of readdirSync(dir).filter((n) => n.endsWith('.card.json'))) {
      const o = JSON.parse(readFileSync(join(dir, f), 'utf8'));
      const row = report.split('\n').find((l) => l.includes(`| ${o.card.detector_id} |`));
      assert.ok(row, `${run}: no report row for ${o.card.detector_id}`);
      assert.ok(row.includes(`**${o.overall.verdict}**`), `${run}/${f}: report says "${row}" but card verdict is ${o.overall.verdict}`);
      assert.ok(row.includes(`| ${o.s2.status} |`), `${run}/${f}: S2 mismatch`);
    }
  }
});
```

- [ ] **Step 3: Write `README.md`** — four short sections: what this directory is (pointer to the protocol page path in the knowledge wiki and its ratification date), how to run (`npm run cert:verdict`), what a card is (frozen input) vs a detector card (emitted output), and the append-only/frozen-constants rules. Add the `cert:verdict` script to `package.json`.

- [ ] **Step 4: Run the full test suite for the directory**

Run: `node --test validation/certification/test/*.test.mjs`
Expected: all PASS (report-consistency skips — no runs yet)

- [ ] **Step 5: Commit**

```bash
git commit -m "cert: verdict CLI, report with machine-checked lines, README

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>" -- validation/certification package.json
```

---

### Task 9: Expiry check

**Files:**
- Create: `validation/certification/expiry-check.mjs`
- Test: `validation/certification/test/expiry.test.mjs`

**Interfaces:**
- Consumes: frozen cards; `fileSha256` (Task 2).
- Produces: CLI exiting 0 when every card's `source_files[].sha256` still matches disk, 1 with a per-file drift listing otherwise. Exported `checkExpiry(cardsDir, repoRoot) -> [{card, path, expected, actual}]` for the test.

- [ ] **Step 1: Write the failing test**

```js
// validation/certification/test/expiry.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { checkExpiry } from '../expiry-check.mjs';
import { fileSha256 } from '../lib/freeze.mjs';

test('drifted source file is reported; matching one is not', () => {
  const root = mkdtempSync(join(tmpdir(), 'exp-'));
  const cards = join(root, 'cards');
  mkdirSync(cards);
  writeFileSync(join(root, 'ok.ts'), 'stable');
  writeFileSync(join(root, 'moved.ts'), 'v1');
  const card = (id, path, sha256) => writeFileSync(join(cards, `${id}.json`),
    JSON.stringify({ detector_id: id, source_files: [{ path, sha256 }] }));
  card('a', 'ok.ts', fileSha256(join(root, 'ok.ts')));
  card('b', 'moved.ts', fileSha256(join(root, 'moved.ts')));
  writeFileSync(join(root, 'moved.ts'), 'v2'); // drift after freeze
  const drifted = checkExpiry(cards, root);
  assert.equal(drifted.length, 1);
  assert.equal(drifted[0].card, 'b');
  assert.equal(drifted[0].path, 'moved.ts');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test validation/certification/test/expiry.test.mjs`
Expected: FAIL — cannot find module

- [ ] **Step 3: Implement**

```js
// validation/certification/expiry-check.mjs
import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fileSha256 } from './lib/freeze.mjs';

export function checkExpiry(cardsDir, repoRoot) {
  const drifted = [];
  for (const f of readdirSync(cardsDir).filter((n) => n.endsWith('.json')).sort()) {
    const card = JSON.parse(readFileSync(join(cardsDir, f), 'utf8'));
    for (const sf of card.source_files ?? []) {
      if (!sf.sha256) continue;
      let actual = null;
      try { actual = fileSha256(resolve(repoRoot, sf.path)); } catch { /* missing counts as drift */ }
      if (actual !== sf.sha256) drifted.push({ card: card.detector_id, path: sf.path, expected: sf.sha256, actual });
    }
  }
  return drifted;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const here = dirname(fileURLToPath(import.meta.url));
  const drifted = checkExpiry(join(here, 'cards'), join(here, '..', '..'));
  for (const d of drifted) console.error(`EXPIRED ${d.card}: ${d.path} (${d.actual === null ? 'missing' : 'changed'})`);
  if (!drifted.length) console.log('all cards current');
  process.exit(drifted.length ? 1 : 0);
}
```

- [ ] **Step 4: Run test, then the CLI against the real tree**

Run: `node --test validation/certification/test/expiry.test.mjs && node validation/certification/expiry-check.mjs`
Expected: test PASS; CLI prints `all cards current`, exit 0 (nothing has moved since the Task 4 freeze).

- [ ] **Step 5: Commit**

```bash
git commit -m "cert: expiry check compares frozen hashes against disk

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>" -- validation/certification/expiry-check.mjs validation/certification/test/expiry.test.mjs
```

---

### Task 10: The re-score run

**Files:**
- Create (generated): `validation/certification/results/run-<UTC>/` — committed as evidence, append-only.

- [ ] **Step 1: Run the engine's own suite first** — `npm test` must pass before the re-score is taken (a broken tree cannot certify anything). Expected: pass (289 at last count; more is fine).

- [ ] **Step 2: Run the re-score**

Run: `npm run cert:verdict`
Expected: `emitted 9 cards -> .../results/run-<stamp>`. Read `REPORT.md` and `MISSING-CELLS.md` in full.

- [ ] **Step 3: Sanity-read the verdicts against the wiki record — expected shape, not a target.** Plausible outcomes given the evidence: safe-t → USE or NOT_EXECUTABLE(S3 missing at the registered shift), UI → USE, sequential UI → ADVISORY (inert), Family A pair → REFUSE or ADVISORY (in-regime N2/N4 refutations are *out*-of-regime under the m≥500 claim — check the regime mapping carefully), Family C MMD → REFUSE, safe-Hotelling → NOT_EXECUTABLE(missing), Family D → REFUSE or ADVISORY (budget non-participating), Family E → ADVISORY via S4 REFUSE. **If a verdict surprises you, the finding is the surprise** — investigate whether the script, the card, or the wiki is wrong, and report it; do not adjust anything to match expectations. The script is the verdict; this step checks the *script*, not the detectors.

- [ ] **Step 4: Run the full test suite including the now-active report-consistency check**

Run: `node --test validation/certification/test/*.test.mjs`
Expected: all PASS, report-consistency no longer skipping.

- [ ] **Step 5: Commit the run**

```bash
git add validation/certification/results
git commit -m "cert: first re-score under protocol v1

Nine cards emitted from the frozen claim cards and the existing
registered runs. MISSING-CELLS.md enumerates what v1 could not
adjudicate; those cells are the next study's worklist.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>" -- validation/certification/results
```

---

### Task 11: PR and wiki write-back

- [ ] **Step 1: Push and open the PR**

```bash
git push -u origin cert/protocol-v1
gh pr create --title "Detector certification v1: frozen claim cards, mechanical verdict, first re-score" --body "$(cat <<'EOF'
First application of the detector certification protocol (knowledge wiki,
methodology/detector-certification-protocol, ratified 2026-08-06).

- Nine claim cards, frozen with engine SHA + source hashes (the freeze
  commit is the pre-registration event)
- Mechanical verdict script: guards (vacuous-pass, non-finite, class-
  instrument, internal-consistency), stage scorers, tier labels,
  machine-checked report lines
- First re-score over the existing registered runs; MISSING-CELLS.md
  enumerates what v1 could not adjudicate
- Expiry check: any drift in a pinned source file flips the card EXPIRED

Merging is the operator's call.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 2: Write the wiki source page** at `~/concord/knowledge/stats/pages/detector-certification-rescore-2026-08-06.md` (type `source`, topic `stats`): the verdict table verbatim from REPORT.md, the missing-cells list, the run id and engine SHA, per-detector one-line rationale, and a "what this does not establish" section (T1/T2 evidence only; S1 declared-not-run-backed; the ADR 0012 real-telemetry caveat attaches to every card). Frontmatter `checks`: one entry asserting the run directory exists on the PR branch or main (use the `sources` path); `sources`: the run directory and the protocol page; `refs`: `methodology/detector-certification-protocol`, `stats/detector-portfolio-current`, the audit pages. **Before writing: re-check the knowledge repo is on `main` and clean** (concurrent-session convention). Update `stats/index.md` (source group, one line), append to `log.md`, commit all three scoped:

```bash
cd ~/concord/knowledge && git branch --show-current   # must print main
git commit -m "cert re-score filed: nine verdicts under protocol v1

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>" -- stats/pages/detector-certification-rescore-2026-08-06.md stats/index.md log.md
```

- [ ] **Step 3: Update WORKLIST.md** — add a row (next free C-number; **check the highest existing id first**, the file has had four id collisions) for "missing cells from the v1 re-score" pointing at the new page, and note in the C25/C21 rows that the re-score encodes their dispositions (E refused from shared budget by S4; C MMD card records the retirement). Commit scoped to `WORKLIST.md`.

- [ ] **Step 4: Report to the operator**: PR URL, the verdict table, the missing-cells list, and the reminder that blog corrections wait for merged cards (protocol First-application step 5).

---

## Self-Review (completed at write time)

- **Spec coverage:** S0→cards (Tasks 3–4), S2 guards+scoring (5, 7), S3 (7), S4 (7), tiers (1, 6, 7), mechanical verdict + machine-checked report (8), expiry (9), re-score + missing-cell enumeration (10), wiki write-back (11). **Known v1 floor, stated in Task 7:** S1 is card-declared rather than run-backed — recorded in MISSING-CELLS by the script. P-gates: P1's status is already tracked by the protocol page's own frontmatter check; not re-implemented here.
- **Placeholder scan:** clean — every code step carries the code; Task 3's cards are specified field-by-field.
- **Type consistency:** `scoreS1/S2/S3/S4`, `overallVerdict`, `applyGuards`, `internalConsistency`, `loadEvidence`, `cellsFor`, `stampPins`, `fileSha256`, `checkExpiry` — names match across Tasks 1–10; cell field names (`increment_estimator`, `detection_rate`, `shift_sigma`, `__tier`) match the real `summary.json` shapes inspected 2026-08-06.

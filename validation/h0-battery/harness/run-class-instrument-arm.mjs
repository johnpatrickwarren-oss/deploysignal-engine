// harness/run-class-instrument-arm.mjs — Amendment A3's two arms. NOT §4's P1.
//
//   node harness/run-class-instrument-arm.mjs --mode live [--n 2000] [--t 300]
//
// WHAT THIS IS, AND WHY IT IS A SEPARATE FILE FROM run.mjs.
//
// §4's primary endpoint P1 is a CROSSING rate: it records fires/fire_rate/lower_95 and
// nothing else. The certification scorer's validity vocabulary
// (validation/certification/lib/score.mjs:11-12 `isValidityCell`) recognises none of those
// fields, so all 36 of this detector's P1 rows are POOLED and reach no stage — h0-battery
// PREREGISTRATION.md Amendment A1.3's second gap, left open by name in A1.8.
//
// `family_C_safe_hotelling` is the one h0-battery detector for which that gap costs a
// verdict, because it is the only one with no `increment_estimator` measurement in any other
// study: detector-audit's SEQUENTIAL set (validation/detector-audit/harness/
// run-sequential.mjs:31-35) covers the other three and omits this one, following that study's
// §2 scope table, which is derived from `fleet/e-bh-guarded.ts`'s DETECTOR_ENVELOPES — a map
// that carries no Hotelling variant at all.
//
// So this arm measures the instrument the card's own class carries
// (CLASS_INSTRUMENTS.test_martingale = ['increment_estimator'],
// validation/certification/lib/constants.mjs:9-13), which is also the instrument the card's
// frozen falsifier is written in ("increment lower95 > 1.0005 on the compiled-oracle null").
//
// TWO ARMS, both registered in Amendment A3 §A3.2:
//   A3-V — the increment estimator E[exp(Δ log M_t)] at each of §3's 12 nulls.
//   A3-W — §5's OWN P2 construction (3σ step at tick 100, detected in ticks 100-300) applied
//          per null and emitted WITH `null_id`, so `pairingGaps`
//          (certification/lib/score.mjs:475-489) can pair each validity cell. The existing
//          P2 record carries no `null_id` (run.mjs:118-133) and therefore pairs nothing;
//          registering A3-V without A3-W would trade one named gap for twelve.
//
// WHAT THIS FILE DOES NOT DO. It writes no `endpoints.json`, adds no analysis path (§10),
// touches no committed run directory, and re-runs no cell of §4/§5. Its output directory is
// prefixed `inc-`, NOT `run-`, because analysis/run_endpoints.mjs:6 selects the greatest
// `run-`-prefixed directory and rewrites that directory's endpoints.json and the study's
// REPORT.md — a `run-` name here would make this arm §10's analysis target (A3.2).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { DETECTORS } from './detectors.mjs';
import { NULLS, rng } from './nulls.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const STUDY = path.dirname(HERE);
const ENGINE_ROOT = path.resolve(STUDY, '..', '..');
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };

const MODE = arg('--mode', 'sim');
const N = Number(arg('--n', 2000));
const T = Number(arg('--t', 300));

// A3.2/A3.3, frozen at the registration commit. Moving any of these makes this a different arm.
const STUDY_ID = '2026-08-h0-battery-class-instrument-arm';
const DETECTOR_ID = 'family_C_safe_hotelling';
const SEED = 20260809;
const ALPHA = 0.05;
const SHIFT_SIGMA = 3;                   // = INERTNESS_SHIFT_SIGMA (certification constants.mjs:21)
const ONSET = 100;                       // §5
const CARD_FALSIFIER_BOUND = 1.0005;     // cards/family_C_safe_hotelling.json:62
const HOUSE_RULE_BOUND = 1;              // detector-audit PREREGISTRATION.md §3
const REGISTRATION_SHA = '3f556c196b4d47004e4cf755fa47bec1483336f8';   // A3's base
const REGISTRATION_COMMIT = '754787e42bfe8168262b45c035c53a2c6814725f'; // the commit that registered A3
const PIN_VERSION = '0.6.6-pre';
// cards/family_C_safe_hotelling.json source_files[0].sha256 — the certification protocol's own
// expiry surface, used here as an executability gate (A3.5 correction append, check 2).
const DETECTOR_SOURCE = 'detectors/_hotelling-safe.ts';
const DETECTOR_SHA256 = 'c5cc555982e09fce449f06cc96e5cda57bf017ea6c7f48f2cc4f450ff964185e';
const GUARDED_SOURCES = [DETECTOR_SOURCE, 'validation/h0-battery/harness/nulls.mjs',
  'validation/h0-battery/harness/detectors.mjs'];
const N_FLOOR = 1900;                    // A3.5 stop condition 5

const engineVersion = JSON.parse(
  fs.readFileSync(path.join(ENGINE_ROOT, 'package.json'), 'utf8')).version;
const gitSha = execSync('git rev-parse HEAD', { cwd: ENGINE_ROOT }).toString().trim();

/** A3.5, as replaced by its correction append — stop conditions, checked before a single
 *  trajectory runs. A stop condition that fires is reported in the words the amendment
 *  registered and NO run directory is written.
 *
 *  Check 1 is §8.1's version pin. Check 2 hashes the detector source against the sha256 the
 *  frozen card pins, which binds the arm to the exact source the claim is about — stronger than
 *  the HEAD comparison it replaces, and satisfiable, which that comparison was not. Check 3
 *  refuses a tree predating A3's own registration, or one with the detector or either harness
 *  module modified in the working tree. */
function assertExecutable() {
  const stops = [];
  if (engineVersion !== PIN_VERSION) {
    stops.push(`A3.5(1): engine version is ${engineVersion}, not ${PIN_VERSION}`);
  }
  const got = createHash('sha256')
    .update(fs.readFileSync(path.join(ENGINE_ROOT, DETECTOR_SOURCE))).digest('hex');
  if (got !== DETECTOR_SHA256) {
    stops.push(`A3.5(2): ${DETECTOR_SOURCE} hashes to ${got}, not the card's pinned `
      + `${DETECTOR_SHA256} — the arm would measure a detector the frozen claim is not about`);
  }
  try {
    execSync(`git merge-base --is-ancestor ${REGISTRATION_COMMIT} HEAD`, { cwd: ENGINE_ROOT, stdio: 'ignore' });
  } catch {
    stops.push(`A3.5(3): A3's registration commit ${REGISTRATION_COMMIT.slice(0, 7)} is not an `
      + `ancestor of HEAD ${gitSha.slice(0, 7)}`);
  }
  const dirty = execSync(`git status --porcelain -- ${GUARDED_SOURCES.join(' ')}`,
    { cwd: ENGINE_ROOT }).toString().trim();
  if (dirty) stops.push(`A3.5(3): guarded source modified in the working tree:\n${dirty}`);
  if (MODE !== 'live' && MODE !== 'sim') stops.push(`A3.5(2): --mode must be live or sim, got ${MODE}`);
  if (stops.length) {
    for (const s of stops) process.stderr.write(`NOT EXECUTABLE — ${s}\n`);
    process.exit(1);
  }
}

/** detector-audit/harness/run-sequential.mjs:37-44, reproduced with citation rather than
 *  imported: a cross-study import would make this arm's numbers move if that file were
 *  amended (A3.2). */
function summarise(xs) {
  const n = xs.length;
  const mean = xs.reduce((a, b) => a + b, 0) / n;
  const varr = n > 1 ? xs.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1) : 0;
  const se = Math.sqrt(varr / n);
  return { n, mean, sd: Math.sqrt(varr), se,
    lower95_one_sided: mean - 1.645 * se, upper95_one_sided: mean + 1.645 * se };
}

/** §3's estimated-parameter path, as run.mjs:44-52 runs it: μ̂/σ̂ (and φ̂ where the null is
 *  AR(1)) from a calibration window of length m, drawn from an INDEPENDENT stream
 *  (A3.3, mirroring run-sequential.mjs:76). σ̂² divides by m, not m-1 — run.mjs's own
 *  convention, and the low bias A3.6's derivation depends on. */
function calibrate(spec, r) {
  const m = spec.m ?? 100;
  const draw = spec.gen(r);
  const xs = [];
  for (let i = 0; i < m; i++) xs.push(draw());
  const mu = xs.reduce((a, b) => a + b, 0) / m;
  const sd = Math.sqrt(xs.reduce((a, b) => a + (b - mu) ** 2, 0) / m) || 1;
  let phiHat = 0;
  if (spec.phi !== undefined) {
    let num = 0, den = 0;
    for (let i = 1; i < m; i++) num += (xs[i] - mu) * (xs[i - 1] - mu);
    for (let i = 0; i < m; i++) den += (xs[i] - mu) ** 2;
    phiHat = den > 0 ? Math.max(-0.95, Math.min(0.95, num / den)) : 0;
  }
  return { mu, sigma: sd, phi: phiHat };
}

/** The per-(null, trajectory) seed of A3.3, shared by both arms so each shifted trajectory is
 *  paired with its own null trajectory (§5's P2 pattern, run.mjs:118-125). */
const trajSeed = (spec, det, i) => SEED + 7919 * i + spec.id.length * 104729 + det.id.length;

/** cfg for one trajectory, exactly as run.mjs:38-53 builds it. */
function configFor(spec, i) {
  if (spec.params === 'estimated') {
    const c = calibrate(spec, rng(SEED + 31 * i + spec.id.length));
    return { cfg: { mu: c.mu, sigma: c.sigma, phi: spec.phi !== undefined ? c.phi : 0,
      alpha: ALPHA, windows: spec.windows }, phiHat: c.phi };
  }
  return { cfg: { mu: 0, sigma: 1, phi: spec.phi ?? 0, alpha: ALPHA, windows: spec.windows },
    phiHat: null };
}

/** One trajectory. `shift` injects a step of `shift` sigma at ONSET on every coordinate — the
 *  §5 construction, verbatim from run.mjs:63-66. Returns the per-tick increment mean
 *  exp(Δ log M) over all T ticks (firing does NOT stop the walk: the increment estimand is
 *  α-independent, A3.2), the running max log-wealth, and whether/when it fired. */
function trajectory(det, spec, i, shift) {
  const r = rng(trajSeed(spec, det, i));
  const { cfg, phiHat } = configFor(spec, i);
  const src = spec.gen(r);
  const draw = () => (det.vector ? Array.from({ length: det.vector }, src) : src());
  const inst = det.make(cfg);
  const exps = [];
  let maxLog = 0, fired = false, firedTick = -1;
  for (let t = 0; t < T; t++) {
    let x = draw();
    if (shift && t >= ONSET) x = det.vector ? x.map((v) => v + shift) : x + shift;
    const before = inst.logM();
    const hit = inst.step(x);
    const after = inst.logM();
    if (Number.isFinite(before) && Number.isFinite(after)) exps.push(Math.exp(after - before));
    if (Number.isFinite(after) && after > maxLog) maxLog = after;
    if (hit && !fired) { fired = true; firedTick = t; }
  }
  const incMean = exps.length ? exps.reduce((a, b) => a + b, 0) / exps.length : null;
  return { incMean, maxLog, fired, firedTick, phiHat };
}

assertExecutable();

const det = DETECTORS.find((d) => d.id === DETECTOR_ID);
if (!det) { process.stderr.write(`NOT EXECUTABLE — no adapter for ${DETECTOR_ID}\n`); process.exit(1); }

const t0 = Date.now();
const cells = [];
const stops = [];

for (const spec of NULLS) {
  // ---- arm A3-V, validity: the increment estimator at the null.
  const incs = [], maxLogs = [], phis = [];
  for (let i = 0; i < N; i++) {
    const r = trajectory(det, spec, i, 0);
    if (r.incMean !== null) incs.push(r.incMean);
    maxLogs.push(r.maxLog);
    if (r.phiHat !== null) phis.push(r.phiHat);
  }
  const inc = summarise(incs);
  const crossings = maxLogs.filter((m) => m >= Math.log(1 / ALPHA)).length;
  const crossingRate = crossings / Math.max(maxLogs.length, 1);
  // A3.4 — the scored token is the CARD's frozen falsifier. The detector-audit reading is
  // recorded beside it with no verdict authority, under a name the scorer cannot read
  // (never `verdict` / `supermartingale_verdict` / `increment_verdict`).
  const verdict = inc.lower95_one_sided > CARD_FALSIFIER_BOUND ? 'REFUTED'
    : inc.upper95_one_sided < CARD_FALSIFIER_BOUND ? 'CLEARED' : 'inconclusive';
  const houseRuleVerdict = inc.lower95_one_sided > HOUSE_RULE_BOUND ? 'REFUTED'
    : inc.upper95_one_sided < CARD_FALSIFIER_BOUND ? 'CLEARED' : 'inconclusive';
  cells.push({
    detector: det.id, family: det.family, arm: 'A3-V',
    null_id: spec.id, null_label: spec.label,
    params: spec.params ?? 'oracle', m: spec.m ?? null, phi: spec.phi ?? 0,
    phi_hat_mean: phis.length ? phis.reduce((a, b) => a + b, 0) / phis.length : null,
    n: inc.n, ticks: T, alpha: ALPHA,
    increment_estimator: inc,
    crossing_rate: crossingRate,
    verdict,
    verdict_rule: `card falsifier: REFUTED iff lower95 > ${CARD_FALSIFIER_BOUND}, CLEARED iff upper95 < ${CARD_FALSIFIER_BOUND}`,
    house_rule_verdict: houseRuleVerdict,
    house_rule: `detector-audit PREREGISTRATION.md §3: REFUTED iff lower95 > ${HOUSE_RULE_BOUND}, CLEARED iff upper95 < ${CARD_FALSIFIER_BOUND}. RECORDED, no verdict authority (A3.4).`,
    mode: MODE, engine_version: engineVersion, git_sha: gitSha,
  });
  if (inc.n < N_FLOOR) {
    stops.push(`A3.5(5): ${spec.id} arm A3-V kept ${inc.n} trajectories, below the registered `
      + `absolute floor of ${N_FLOOR} (${N - inc.n} of ${N} lost to a continue path; at the `
      + 'registered N = 2000 the floor is the 5% loss bound A3.5(5) states)');
  }

  // ---- arm A3-W, power: §5's 3-sigma construction at THIS null, with null_id carried.
  let detected = 0;
  for (let i = 0; i < N; i++) {
    const r = trajectory(det, spec, i, SHIFT_SIGMA);
    if (r.fired && r.firedTick >= ONSET && r.firedTick <= ONSET + 200) detected++;
  }
  const rate = detected / N;
  cells.push({
    detector: det.id, family: det.family, arm: 'A3-W',
    null_id: spec.id, null_label: spec.label,
    shift_sigma: SHIFT_SIGMA, onset_tick: ONSET, detect_within: 200,
    n: N, ticks: T, alpha: ALPHA,
    detection_rate: rate,
    verdict: rate < 0.50 ? 'FAIL' : 'pass',
    verdict_rule: 'PREREGISTRATION §5: FAIL iff detection_rate < 0.50 at 3 sigma',
    mode: MODE, engine_version: engineVersion, git_sha: gitSha,
  });

  const v = cells[cells.length - 2];
  process.stderr.write(
    `${spec.id.padEnd(13)} inc=${inc.mean.toExponential(4)} `
    + `[${inc.lower95_one_sided.toExponential(3)},${inc.upper95_one_sided.toExponential(3)}] `
    + `${v.verdict.padEnd(12)} (house ${v.house_rule_verdict.padEnd(12)}) `
    + `cross=${crossingRate.toFixed(4)} power=${rate.toFixed(4)} `
    + `(${((Date.now() - t0) / 1000).toFixed(0)}s)\n`);
}

// A3.5(4) — the N1/N7 identity check. This detector is not windowed, so the two nulls differ
// only in a flag it never reads; a disagreement means the arm is not driving the detector the
// committed P1 rows drove. Not-executable condition, not a result.
const n1 = cells.find((c) => c.arm === 'A3-V' && c.null_id === 'N1');
const n7 = cells.find((c) => c.arm === 'A3-V' && c.null_id === 'N7');
const gap = Math.abs(n1.increment_estimator.mean - n7.increment_estimator.mean);
if (!(gap < 1e-12)) {
  stops.push(`A3.5(4): N1 and N7 increment means differ by ${gap} (must be < 1e-12): this `
    + 'arm is not driving the detector the committed P1 rows drove');
}

if (stops.length) {
  for (const s of stops) process.stderr.write(`NOT EXECUTABLE — ${s}\n`);
  process.stderr.write('no run directory written\n');
  process.exit(1);
}

const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
const outDir = path.join(STUDY, 'results', MODE === 'live' ? 'live' : 'sim', `inc-${stamp}`);
if (fs.existsSync(outDir)) { process.stderr.write(`A3.5(3): refusing to reuse ${outDir}\n`); process.exit(1); }
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'summary.json'), `${JSON.stringify({ cells }, null, 1)}\n`);
fs.writeFileSync(path.join(outDir, 'manifest.json'), `${JSON.stringify({
  study: STUDY_ID,
  prereg: '../PREREGISTRATION.md Amendment A3',
  arms: { 'A3-V': 'increment estimator, 12 nulls', 'A3-W': 'section 5 3-sigma power, per null' },
  detectors: [DETECTOR_ID], nulls: NULLS.map((s) => s.id),
  mode: MODE, engine_version: engineVersion, git_sha: gitSha, registration_sha: REGISTRATION_SHA, registration_commit: REGISTRATION_COMMIT,
  detector_source_sha256: DETECTOR_SHA256,
  node: process.version, seed: SEED, n: N, ticks: T, alpha: ALPHA,
  shift_sigma: SHIFT_SIGMA, onset_tick: ONSET,
  card_falsifier_bound: CARD_FALSIFIER_BOUND, house_rule_bound: HOUSE_RULE_BOUND,
  supersedes: null,
  elapsed_s: (Date.now() - t0) / 1000, argv: process.argv.slice(2), generated_at: stamp,
}, null, 1)}\n`);
process.stderr.write(`\n${cells.length} cells -> ${path.relative(STUDY, outDir)}\n`);

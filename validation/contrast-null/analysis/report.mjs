// validation/contrast-null/analysis/report.mjs — renders REPORT.md from a run directory's JSON, byte-stable.
// Every number in the report is a projection of cells.json / p1.json / p1_cells.json / manifest.json;
// check_report.mjs re-renders and diffs.
import fs from 'node:fs';
import path from 'node:path';

const f = (x, d = 3) => (x === null || x === undefined ? '—' : typeof x === 'number' ? x.toFixed(d) : String(x));

export function render(runDir) {
  const J = (n) => JSON.parse(fs.readFileSync(path.join(runDir, n), 'utf8'));
  const M = J('manifest.json'), cells = J('cells.json'), p1 = J('p1.json'), p1Cells = J('p1_cells.json');
  const K = M.constants;
  const nulls = K.NULL_IDS, ms = K.M_LIST;
  const L = [];
  L.push(`# 2026-09-contrast-null — report (${path.basename(runDir)})`, '');
  L.push(`Engine \`${M.engine.sha}\` (${M.engine.version}), node ${M.engine.node}; ${M.cells} cells × N = ${K.N} replications × 3 variants; ` +
    `${M.replications} replications; exceptions ${M.exceptions}; ${M.runtime_ms} ms. Bounded e-SR: ${M.bounded_esr}. ` +
    `Lockstep against Tessera: ${M.lockstep === 'absent' ? 'absent' : `${M.lockstep.comparisons} comparisons, ${M.lockstep.mismatches} mismatches (tessera ${M.lockstep.tessera_sha})`}.`);
  L.push(`Instrument check: ${M.instrument.ok ? 'ok' : 'FAILED'} (shared-step residual max |Δr| = ${M.instrument.shared_max_abs_residual_diff}; ` +
    `step-3σ fires ${JSON.stringify(M.instrument.step3_fires)}; clean at 1e-4 ${JSON.stringify(M.instrument.clean_quiet)}).`);
  L.push(`**Ship rule (§6): P1 ${M.p1_study}, P3 ${M.p3_study}.**`, '');

  // P1
  L.push('## P1 — the increment estimator per λ on the contrast residual (pooled null-variant monitoring ticks)', '');
  L.push('| cell | gaussian held / of | bounded held / of | verdict |', '|---|---|---|---|');
  for (const c of p1Cells) L.push(`| ${c.cell} | ${c.gaussian_held} / ${c.gaussian_of} | ${c.bounded_held} / ${c.bounded_of} | ${c.verdict} |`);
  L.push('');
  for (const fam of ['gaussian', 'bounded']) {
    const lams = [...new Set(p1.filter((p) => p.family === fam).map((p) => p.lambda))];
    L.push(`### P1 ${fam} family: mean of g_λ (se) per cell`, '');
    L.push(`| cell | ${lams.map((l) => `λ=${l}`).join(' | ')} |`, `|---|${lams.map(() => '---').join('|')}|`);
    for (const nid of nulls) for (const m of ms) {
      const cell = `${nid}-m${m}`;
      L.push(`| ${cell} | ${lams.map((l) => { const p = p1.find((q) => q.cell === cell && q.family === fam && q.lambda === l); return `${f(p.mean, 4)} (${f(p.se, 4)}) ${p.held === 'HELD' ? '✓' : '✗'}`; }).join(' | ')} |`);
    }
    L.push('');
  }

  // P2
  const cons = [...new Set(cells.filter((c) => c.path === 'contrast').map((c) => `${c.construction}@${c.level}`))];
  const tbl = (title, pathId, variant, field, extra) => {
    L.push(`## ${title}`, '');
    for (const key of cons) {
      const [construction, level] = key.split('@');
      const xs = cells.filter((c) => c.path === pathId && c.variant === variant && c.construction === construction && String(c.level) === level);
      if (!xs.length) continue;
      L.push(`### ${construction} @ ${level} (${pathId}, ${variant})`, '');
      L.push(`| null | ${ms.map((m) => `m=${m}`).join(' | ')} |`, `|---|${ms.map(() => '---').join('|')}|`);
      for (const nid of nulls) {
        L.push(`| ${nid} | ${ms.map((m) => { const c = xs.find((q) => q.null === nid && q.m === m); return c ? extra(c) : '—'; }).join(' | ')} |`);
      }
      L.push('');
    }
  };
  const p2fmt = (c) => `${c.alerting}/${c.bar} ${c.verdict} (${f(c.rate_per_1000, 3)}/1k)`;
  tbl('P2 — false alerts on the null contrast residual against the contract (alerting / bar, rate per 1,000 ticks)', 'contrast', 'null', 'alerting', p2fmt);
  tbl('P2 comparator — the temporal path on the treatment unit alone, same head', 'temporal', 'null', 'alerting', p2fmt);
  const p3fmt = (c) => `${c.alerting}/${c.bar}${c.verdict ? ' ' + c.verdict : ''} (adm ${c.admissible})`;
  tbl('P3 — a shared 1.5σ step in BOTH units: alerting after ν among replications quiet before it (contrast)', 'contrast', 'shared', 'alerting', p3fmt);
  tbl('P3 comparator — the same shared step on the temporal path (the false rollback)', 'temporal', 'shared', 'alerting', p3fmt);
  const p4fmt = (c) => `${f(c.detection, 3)}${c.verdict ? ' ' + c.verdict : ''} (med ${c.median_delay === null ? '—' : c.median_delay}; adm ${c.admissible})`;
  tbl('P4 — a treatment-only 1.5σ step: detection and median delay after ν (contrast)', 'contrast', 'treatment', 'detection', p4fmt);
  tbl('P4 comparator — the same treatment-only step on the temporal path', 'temporal', 'treatment', 'detection', p4fmt);
  return L.join('\n') + '\n';
}

if (process.argv[1] && path.resolve(process.argv[1]) === new URL(import.meta.url).pathname) {
  process.stdout.write(render(path.resolve(process.argv[2])));
}

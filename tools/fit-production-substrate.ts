#!/usr/bin/env node
// tools/fit-production-substrate.ts — Phase E SLICE 10 calibrator.
//
// Reads a CSV of production observations, fits AR(1) / AR(p) /
// seasonal-naive / spectral-bootstrap calibrations, and emits a
// ProductionArSubstrate JSON file. Decouples calibration from runtime
// detection per PHASE-E-SLICE-10-SPEC.md.
//
// CLI:
//   node dist/tools/fit-production-substrate.js \
//     --csv <path> --signal-name <name> --out <substrate.json> \
//     [--ar-p] [--seasonal] [--spectral] [--description "..."]
//
// All extended fits (ar_p, seasonal, spectral) are opt-in; minimal
// substrate ships baseline + AR(1).

import * as fs from 'node:fs';

import { fitArP } from '../detectors/ar-p';
import { decomposeSeasonal } from '../detectors/seasonal';
import { peakACF } from '../detectors/spectral';
import type { ProductionArSubstrate } from '../types/production-ar-substrate';

// ── Internal numerics (mirrored from run-nab-per-dataset.ts) ───────

function mean(xs: number[]): number {
  if (xs.length === 0) return 0;
  let s = 0; for (const x of xs) s += x;
  return s / xs.length;
}

function sampleVariance(xs: number[], mu: number): number {
  if (xs.length < 2) return 1e-12;
  let s2 = 0;
  for (const x of xs) { const d = x - mu; s2 += d * d; }
  return Math.max(s2 / (xs.length - 1), 1e-12);
}

function ar1Phi(xs: number[], mu: number): number {
  if (xs.length < 3) return 0;
  let num = 0, den = 0;
  for (let i = 1; i < xs.length; i++) num += (xs[i] - mu) * (xs[i - 1] - mu);
  for (let i = 0; i < xs.length; i++) { const d = xs[i] - mu; den += d * d; }
  if (den <= 0) return 0;
  return Math.max(-0.95, Math.min(0.95, num / den));
}

// ── Spectral bootstrap (mirrored from run-nab-per-dataset.ts) ──────

const SPECTRAL_WINDOW = 60;
const SPECTRAL_QUANTILE = 0.99;
const SPECTRAL_FALLBACK = 0.90;
const SPECTRAL_MIN_SUBWINDOWS = 30;
const SPECTRAL_MIN_LAG = 3;
const SPECTRAL_MAX_LAG = 10;

function calibrateSpectral(values: number[]): {
  bootstrap_null_quantile: number;
  min_peak_lag: number;
  max_peak_lag: number;
  empirically_calibrated: boolean;
} {
  if (values.length < SPECTRAL_WINDOW + SPECTRAL_MIN_LAG) {
    return { bootstrap_null_quantile: SPECTRAL_FALLBACK, min_peak_lag: SPECTRAL_MIN_LAG, max_peak_lag: SPECTRAL_MAX_LAG, empirically_calibrated: false };
  }
  const peaks: number[] = [];
  for (let i = 0; i + SPECTRAL_WINDOW <= values.length; i++) {
    const win = values.slice(i, i + SPECTRAL_WINDOW);
    peaks.push(peakACF(win, SPECTRAL_MIN_LAG, SPECTRAL_MAX_LAG).peak);
  }
  if (peaks.length < SPECTRAL_MIN_SUBWINDOWS) {
    return { bootstrap_null_quantile: SPECTRAL_FALLBACK, min_peak_lag: SPECTRAL_MIN_LAG, max_peak_lag: SPECTRAL_MAX_LAG, empirically_calibrated: false };
  }
  peaks.sort((a, b) => a - b);
  const idx = Math.min(peaks.length - 1, Math.floor(SPECTRAL_QUANTILE * peaks.length));
  return {
    bootstrap_null_quantile: peaks[idx],
    min_peak_lag: SPECTRAL_MIN_LAG,
    max_peak_lag: SPECTRAL_MAX_LAG,
    empirically_calibrated: true,
  };
}

// ── Main entry: fit a substrate from observations ─────────────────

export interface FitSubstrateOpts {
  signalName: string;
  description?: string;
  calibrationStart?: string;
  calibrationEnd?: string;
  fitArPCalibration?: boolean;
  arPMaxOrder?: number;
  arPInformationCriterion?: 'aic' | 'bic';
  fitSeasonalDecomposition?: boolean;
  seasonalMinAcf?: number;
  fitSpectral?: boolean;
}

export function fitProductionSubstrate(
  values: number[], opts: FitSubstrateOpts,
): ProductionArSubstrate {
  if (values.length < 4) {
    throw new Error(`fitProductionSubstrate: need ≥ 4 observations; got ${values.length}`);
  }
  const mu = mean(values);
  const sigma2 = sampleVariance(values, mu);
  const phi = ar1Phi(values, mu);
  const phiSq = Math.min(phi * phi, 0.9999);
  const innovationVar = Math.max(sigma2 * (1 - phiSq), 1e-12);

  const substrate: ProductionArSubstrate = {
    version: 'phase-e-slice10-v1',
    source: {
      signal_name: opts.signalName,
      description: opts.description,
      n_observations: values.length,
      calibration_start: opts.calibrationStart,
      calibration_end: opts.calibrationEnd,
    },
    baseline: { mean: mu, sigma_squared_marginal: sigma2 },
    ar1: { phi, sigma_squared_innovation: innovationVar },
    generated_at: new Date().toISOString(),
  };

  if (opts.fitArPCalibration) {
    const arP = fitArP(values, mu, {
      p_max: opts.arPMaxOrder,
      ic: opts.arPInformationCriterion,
    });
    substrate.ar_p = {
      p: arP.p,
      phi: arP.phi,
      sigma_squared_innovation: arP.sigma2_innovation,
      ic_kind: arP.ic_kind,
      reflection_coefficients: arP.reflection_coefficients,
    };
  }

  if (opts.fitSeasonalDecomposition) {
    const seas = decomposeSeasonal(values, mu, { min_acf: opts.seasonalMinAcf });
    if (seas.period > 0) {
      const phiDes = ar1Phi(seas.deseasonalized, mu);
      const sigma2Des = sampleVariance(seas.deseasonalized, mu);
      const phiDesSq = Math.min(phiDes * phiDes, 0.9999);
      substrate.seasonal = {
        period: seas.period,
        seasonal_means: seas.seasonal_means,
        acf_at_period: seas.acf_at_period,
        ar1_phi_deseasoned: phiDes,
        sigma_squared_innovation_deseasoned: Math.max(sigma2Des * (1 - phiDesSq), 1e-12),
      };
    }
  }

  if (opts.fitSpectral) {
    substrate.spectral = calibrateSpectral(values);
  }

  return substrate;
}

// ── CLI ────────────────────────────────────────────────────────────

function parseCsv(csvPath: string): { values: number[]; firstTs?: string; lastTs?: string } {
  const data = fs.readFileSync(csvPath, 'utf8');
  const lines = data.split('\n').filter((l) => l.trim().length > 0);
  const header = lines[0].split(',').map((s) => s.trim());
  const tsIdx = header.indexOf('timestamp');
  const valIdx = header.indexOf('value');
  if (valIdx < 0) throw new Error(`CSV missing 'value' column; got ${JSON.stringify(header)}`);
  const values: number[] = [];
  let firstTs: string | undefined;
  let lastTs: string | undefined;
  for (let i = 1; i < lines.length; i++) {
    const f = lines[i].split(',');
    if (tsIdx >= 0) {
      const ts = f[tsIdx];
      if (firstTs === undefined) firstTs = ts;
      lastTs = ts;
    }
    values.push(parseFloat(f[valIdx]));
  }
  return { values, firstTs, lastTs };
}

interface CliArgs {
  csv?: string;
  out?: string;
  signalName?: string;
  description?: string;
  fitArPCalibration?: boolean;
  arPMaxOrder?: number;
  arPInformationCriterion?: 'aic' | 'bic';
  fitSeasonalDecomposition?: boolean;
  seasonalMinAcf?: number;
  fitSpectral?: boolean;
}

function parseArgs(argv: string[]): CliArgs {
  const out: CliArgs = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    const v = argv[i + 1];
    switch (a) {
      case '--csv': out.csv = v; i++; break;
      case '--out': out.out = v; i++; break;
      case '--signal-name': out.signalName = v; i++; break;
      case '--description': out.description = v; i++; break;
      case '--ar-p': out.fitArPCalibration = true; break;
      case '--ar-p-max-order': out.arPMaxOrder = parseInt(v, 10); i++; break;
      case '--ar-p-ic':
        if (v !== 'aic' && v !== 'bic') throw new Error(`--ar-p-ic must be 'aic' or 'bic'; got ${v}`);
        out.arPInformationCriterion = v; i++; break;
      case '--seasonal': out.fitSeasonalDecomposition = true; break;
      case '--seasonal-min-acf': out.seasonalMinAcf = parseFloat(v); i++; break;
      case '--spectral': out.fitSpectral = true; break;
    }
  }
  if (!out.csv || !out.out || !out.signalName) {
    throw new Error('Required: --csv <path> --out <path> --signal-name <name>. Optional: --description "..." --ar-p [--ar-p-max-order N] [--ar-p-ic aic|bic] --seasonal [--seasonal-min-acf X] --spectral');
  }
  return out;
}

function main(): void {
  const args = parseArgs(process.argv);
  const { values, firstTs, lastTs } = parseCsv(args.csv!);
  console.log(`[fit-production-substrate] csv=${args.csv} n_obs=${values.length}`);
  const substrate = fitProductionSubstrate(values, {
    signalName: args.signalName!,
    description: args.description,
    calibrationStart: firstTs,
    calibrationEnd: lastTs,
    fitArPCalibration: args.fitArPCalibration,
    arPMaxOrder: args.arPMaxOrder,
    arPInformationCriterion: args.arPInformationCriterion,
    fitSeasonalDecomposition: args.fitSeasonalDecomposition,
    seasonalMinAcf: args.seasonalMinAcf,
    fitSpectral: args.fitSpectral,
  });
  fs.writeFileSync(args.out!, JSON.stringify(substrate, null, 2));
  console.log(`[fit-production-substrate] wrote ${args.out}`);
  console.log(`[fit-production-substrate]   baseline.mean=${substrate.baseline.mean.toFixed(4)}`);
  console.log(`[fit-production-substrate]   ar1.phi=${substrate.ar1.phi.toFixed(4)}`);
  if (substrate.ar_p) console.log(`[fit-production-substrate]   ar_p.p=${substrate.ar_p.p}`);
  if (substrate.seasonal) console.log(`[fit-production-substrate]   seasonal.period=${substrate.seasonal.period}`);
  if (substrate.spectral) console.log(`[fit-production-substrate]   spectral.quantile=${substrate.spectral.bootstrap_null_quantile.toFixed(4)}`);
}

if (require.main === module) {
  main();
}

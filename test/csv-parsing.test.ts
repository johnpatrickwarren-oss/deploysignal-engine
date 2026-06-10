// test/csv-parsing.test.ts — remediation 2026-06-10 (M7).
//
// Both offline CSV parsers (the substrate calibrator's parseCsv and the NAB
// loader's parseNABDatasetCsv) previously pushed parseFloat() results with no
// Number.isFinite check — a single short/malformed row silently poisoned
// every downstream statistic with NaN (serialized as null into substrate
// JSON). Empty files crashed with an unhelpful TypeError. Both parsers are
// offline tools writing production-consumed artifacts, so they throw with
// the offending row number.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { parseCsv, parseArgs } from '../tools/fit-production-substrate';
import { parseNABDatasetCsv } from '../tools/_nab-validation-loading';

function tmpCsv(name: string, content: string): string {
  const p = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'ds-csv-test-')), name);
  fs.writeFileSync(p, content);
  return p;
}

test('M7: calibrator parseCsv throws on a non-numeric value with the row number', () => {
  const p = tmpCsv('bad.csv', 'timestamp,value\n2026-01-01 00:00:00,1.5\n2026-01-01 00:05:00,oops\n');
  assert.throws(() => parseCsv(p), /row 3/);
});

test('M7: calibrator parseCsv throws on a short row (missing value column)', () => {
  const p = tmpCsv('short.csv', 'timestamp,value\n2026-01-01 00:00:00,1.5\n2026-01-01 00:05:00\n');
  assert.throws(() => parseCsv(p), /row 3/);
});

test('M7: calibrator parseCsv throws on an empty file instead of TypeError', () => {
  const p = tmpCsv('empty.csv', '');
  assert.throws(() => parseCsv(p), /empty/i);
});

test('M7: calibrator parseCsv accepts a well-formed file', () => {
  const p = tmpCsv('ok.csv', 'timestamp,value\n2026-01-01 00:00:00,1.5\n2026-01-01 00:05:00,2.5\n');
  const r = parseCsv(p);
  assert.deepEqual(r.values, [1.5, 2.5]);
  assert.equal(r.firstTs, '2026-01-01 00:00:00');
  assert.equal(r.lastTs, '2026-01-01 00:05:00');
});

test('M7: NAB parseNABDatasetCsv throws on a non-finite value with the row number', () => {
  const p = tmpCsv('nab-bad.csv', 'timestamp,value\n2014-04-10 07:15:00,12\n2014-04-10 07:20:00,\n');
  assert.throws(() => parseNABDatasetCsv(p), /row 3/);
});

test('M7: NAB parseNABDatasetCsv throws on an empty file instead of TypeError', () => {
  const p = tmpCsv('nab-empty.csv', '');
  assert.throws(() => parseNABDatasetCsv(p), /empty/i);
});

test('L5: fit-production-substrate CLI throws on unknown flags', () => {
  const base = ['node', 'fit-production-substrate.js', '--csv', 'a.csv', '--out', 'b.json', '--signal-name', 's'];
  assert.doesNotThrow(() => parseArgs(base));
  assert.throws(
    () => parseArgs([...base, '--ar-p-max-orde', '5']),
    /Unknown flag: --ar-p-max-orde/,
  );
});

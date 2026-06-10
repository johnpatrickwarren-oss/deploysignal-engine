"use strict";
// test/csv-parsing.test.ts — remediation 2026-06-10 (M7).
//
// Both offline CSV parsers (the substrate calibrator's parseCsv and the NAB
// loader's parseNABDatasetCsv) previously pushed parseFloat() results with no
// Number.isFinite check — a single short/malformed row silently poisoned
// every downstream statistic with NaN (serialized as null into substrate
// JSON). Empty files crashed with an unhelpful TypeError. Both parsers are
// offline tools writing production-consumed artifacts, so they throw with
// the offending row number.
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const fs = __importStar(require("node:fs"));
const os = __importStar(require("node:os"));
const path = __importStar(require("node:path"));
const fit_production_substrate_1 = require("../tools/fit-production-substrate");
const _nab_validation_loading_1 = require("../tools/_nab-validation-loading");
function tmpCsv(name, content) {
    const p = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'ds-csv-test-')), name);
    fs.writeFileSync(p, content);
    return p;
}
(0, node_test_1.test)('M7: calibrator parseCsv throws on a non-numeric value with the row number', () => {
    const p = tmpCsv('bad.csv', 'timestamp,value\n2026-01-01 00:00:00,1.5\n2026-01-01 00:05:00,oops\n');
    strict_1.default.throws(() => (0, fit_production_substrate_1.parseCsv)(p), /row 3/);
});
(0, node_test_1.test)('M7: calibrator parseCsv throws on a short row (missing value column)', () => {
    const p = tmpCsv('short.csv', 'timestamp,value\n2026-01-01 00:00:00,1.5\n2026-01-01 00:05:00\n');
    strict_1.default.throws(() => (0, fit_production_substrate_1.parseCsv)(p), /row 3/);
});
(0, node_test_1.test)('M7: calibrator parseCsv throws on an empty file instead of TypeError', () => {
    const p = tmpCsv('empty.csv', '');
    strict_1.default.throws(() => (0, fit_production_substrate_1.parseCsv)(p), /empty/i);
});
(0, node_test_1.test)('M7: calibrator parseCsv accepts a well-formed file', () => {
    const p = tmpCsv('ok.csv', 'timestamp,value\n2026-01-01 00:00:00,1.5\n2026-01-01 00:05:00,2.5\n');
    const r = (0, fit_production_substrate_1.parseCsv)(p);
    strict_1.default.deepEqual(r.values, [1.5, 2.5]);
    strict_1.default.equal(r.firstTs, '2026-01-01 00:00:00');
    strict_1.default.equal(r.lastTs, '2026-01-01 00:05:00');
});
(0, node_test_1.test)('M7: NAB parseNABDatasetCsv throws on a non-finite value with the row number', () => {
    const p = tmpCsv('nab-bad.csv', 'timestamp,value\n2014-04-10 07:15:00,12\n2014-04-10 07:20:00,\n');
    strict_1.default.throws(() => (0, _nab_validation_loading_1.parseNABDatasetCsv)(p), /row 3/);
});
(0, node_test_1.test)('M7: NAB parseNABDatasetCsv throws on an empty file instead of TypeError', () => {
    const p = tmpCsv('nab-empty.csv', '');
    strict_1.default.throws(() => (0, _nab_validation_loading_1.parseNABDatasetCsv)(p), /empty/i);
});
(0, node_test_1.test)('L5: fit-production-substrate CLI throws on unknown flags', () => {
    const base = ['node', 'fit-production-substrate.js', '--csv', 'a.csv', '--out', 'b.json', '--signal-name', 's'];
    strict_1.default.doesNotThrow(() => (0, fit_production_substrate_1.parseArgs)(base));
    strict_1.default.throws(() => (0, fit_production_substrate_1.parseArgs)([...base, '--ar-p-max-orde', '5']), /Unknown flag: --ar-p-max-orde/);
});
//# sourceMappingURL=csv-parsing.test.js.map
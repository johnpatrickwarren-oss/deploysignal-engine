"use strict";
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
// C65 — a zero Family E budget is advisory, not silence.
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const conformal_1 = require("../detectors/conformal");
const fire = {
    verdict: 'fire', statistic: 12.3, threshold: 1e-4, alpha_consumed: 1e-4, alpha_spent: 1e-4,
    reason_code: 'conformal_p_below_threshold', family: 'E',
};
(0, node_test_1.test)('an advisory fire keeps its verdict and statistic, spends nothing, and is tagged', () => {
    const a = (0, conformal_1.asAdvisory)(fire);
    strict_1.default.equal(a.verdict, 'fire');
    strict_1.default.equal(a.statistic, 12.3);
    strict_1.default.equal(a.alpha_spent, 0);
    strict_1.default.equal(a.alpha_consumed, 0);
    strict_1.default.equal(a.reason_code, 'advisory_zero_budget');
    strict_1.default.equal(a.family, 'E');
});
(0, node_test_1.test)('a clean or suppressed verdict is untouched except for the zero α accounting', () => {
    const clean = { ...fire, verdict: 'clean', alpha_consumed: 0, alpha_spent: 0, reason_code: 'below_threshold' };
    strict_1.default.deepEqual((0, conformal_1.asAdvisory)(clean), clean);
});
(0, node_test_1.test)('the source reads the budget with ?? and routes zero to the nominal level (the guard no longer sees 1/0)', async () => {
    const fs = await Promise.resolve().then(() => __importStar(require('node:fs')));
    const path = await Promise.resolve().then(() => __importStar(require('node:path')));
    const src = fs.readFileSync(path.join(process.cwd(), 'detectors', 'conformal.ts'), 'utf8');
    strict_1.default.ok(src.includes('const advisory = alphaBudget === 0;'));
    strict_1.default.ok(src.includes('const alphaE = advisory ? DEFAULT_ALPHA_E : alphaBudget;'));
    strict_1.default.ok(src.indexOf('const alphaE = advisory') < src.indexOf('Math.ceil(1 / alphaE)'), 'the nominal level is set before the sample guard');
});
//# sourceMappingURL=c65-family-e-advisory.test.js.map
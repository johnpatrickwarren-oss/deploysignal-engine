"use strict";
// engine/ds-integration/feed-contract.ts — Phase 3 SLICE 3 WU-Phase3-3A (R62).
//
// Tessera→DS feed contract. Wire-format types + HTTP transport metadata for
// Tessera-side WU-3B (R63+) to send VerdictGroup observations to DS's
// correlation layer.
//
// R62 deliverable: types + literal constants only. No HTTP client; no
// implementation; no auth-scheme decision. Server/client implementation
// lands at Wave 10 (R63+) WU-3B.
//
// Wire-format projection convention: VerdictGroupPayload is a
// structurally-independent projection of `engine/types/verdict.ts:198-231`
// VerdictGroup. The projection does NOT import from '../types' to preserve
// cross-repo decoupling — DS implements the contract against pure type
// definitions without consuming Tessera engine internals (per FR-D4 +
// AC-P9 + Option F re-scoping).
//
// Tessera-original code. Extract target: NONE in R62 (engine npm extract
// DEFERRED per Option F to Phase 4 / dedicated design cycle).
Object.defineProperty(exports, "__esModule", { value: true });
exports.TESSERA_TO_DS_FEED_ENDPOINT = void 0;
/** HTTP transport metadata pin (const form — runtime-accessible literal). */
exports.TESSERA_TO_DS_FEED_ENDPOINT = {
    path: '/v1/tessera/verdict-groups',
    method: 'POST',
};
//# sourceMappingURL=feed-contract.js.map
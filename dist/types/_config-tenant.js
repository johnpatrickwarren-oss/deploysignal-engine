"use strict";
// engine/types/_config-tenant.ts — split from config.ts (god-file decomposition).
// Tenant-tier configuration + misc shared config types + the tenant-tier resolver.
// Re-exported verbatim from ./config (facade); see config.ts header for vendoring policy.
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveTenantTier = resolveTenantTier;
/** Addition #23 — resolve a request's tenant_id to a tenant_tier using
 *  the compiled config's `tenant_tier_map`. Returns `'aggregate'` when
 *  no tenant_id is supplied, when the map is absent (pre-#23 configs),
 *  or when the tenant is unknown to the map — matches runtime fallback
 *  semantics in the detector cell-lookup path. */
function resolveTenantTier(cfg, tenantId) {
    if (!tenantId || !cfg?.tenant_tier_map)
        return 'aggregate';
    return cfg.tenant_tier_map[tenantId] ?? 'aggregate';
}
//# sourceMappingURL=_config-tenant.js.map
// types/audit.ts — the detector registry's import path.
//
// ADR 0033 (v0.9.0-pre): DeploySignal's audit-record schema (AuditRecord, AuditRecordV2,
// DetectorTripV2, the audit-event payloads, AuditWriter) and its OrchestrateParams left this package;
// DeploySignal owns them in its own tree and no other consumer imported them. What remains here is
// the registry, re-exported so `types/audit` keeps resolving for the tests and consumers that use it.
export * from './detector-registry';

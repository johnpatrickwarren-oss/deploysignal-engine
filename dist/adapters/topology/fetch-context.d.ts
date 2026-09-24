import type { FetchContext } from '../topology-overlay';
export interface TopologyFetchContext extends FetchContext {
    /** Bearer token / auth credential for future real-cluster fetch endpoints.
     *  Path B (R58): accepted in contract; unused at runtime. */
    authToken?: string;
    /** Real-cluster topology fetch endpoint URI. Path B (R58): if defined,
     *  adapter throws LIVE_FETCH_NOT_IMPLEMENTED_PATH_B. */
    apiEndpoint?: string;
    /** Real-cluster fetch deadline in milliseconds. Path B (R58): accepted
     *  in contract; unused at runtime. */
    timeoutMs?: number;
}
//# sourceMappingURL=fetch-context.d.ts.map
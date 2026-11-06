// Web client. Twin of apps/cli/src/orpc.ts — kept separate because env access
// differs: Vite exposes `import.meta.env.VITE_*` at build time, while the
// CLI reads the process env at run time.

import type { planetContract } from '@credit-sentry/api';
import { DEFAULT_REQUEST_TIMEOUT_MS, fetchWithTimeout, resolveApiUrl } from '@credit-sentry/utils';
import { createORPCClient } from '@orpc/client';
import { RPCLink } from '@orpc/client/fetch';
import type { ContractRouterClient } from '@orpc/contract';

/** Injectable dependencies for the oRPC client. */
export interface OrpcClientDeps {
    /** Override the default API URL. */
    url?: string;
    /** Inject a custom fetch implementation for testing. */
    fetch?: typeof globalThis.fetch;
    /** Request timeout in milliseconds (default 10 000). */
    timeout?: number;
}

let testFetch: typeof globalThis.fetch | undefined;

/** Override fetch for deterministic tests without mutating globalThis. */
export function setFetchForTesting(fetchImpl: typeof globalThis.fetch): void {
    testFetch = fetchImpl;
}

/** Restore the production fetch implementation after a test. */
export function resetFetchForTesting(): void {
    testFetch = undefined;
}

/** Create a typed oRPC client with injectable deps for testing. */
export function createOrpcClient(deps: OrpcClientDeps = {}): ContractRouterClient<typeof planetContract> {
    const url = deps.url ?? resolveApiUrl(import.meta.env.VITE_API_URL, globalThis.location?.origin);
    const timeout = deps.timeout ?? DEFAULT_REQUEST_TIMEOUT_MS;

    const link = new RPCLink({
        url,
        fetch: (input, init) => fetchWithTimeout(deps.fetch ?? testFetch ?? globalThis.fetch, input, init, timeout),
    });

    return createORPCClient(link);
}

/** Singleton client for the default entry point. */
export const orpc = createOrpcClient();

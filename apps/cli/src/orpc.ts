// CLI client. Twin of apps/web/src/orpc.ts — kept separate because env access
// differs: the CLI reads the process env (via `getEnvVar`) at run time, while the web client uses
// Vite's build-time `import.meta.env.VITE_*`.

import type { planetContract } from '@credit-sentry/api';
import { DEFAULT_REQUEST_TIMEOUT_MS, fetchWithTimeout, getEnvVar, resolveApiUrl } from '@credit-sentry/utils';
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
    const url = deps.url ?? resolveApiUrl(getEnvVar('API_URL'));
    const timeout = deps.timeout ?? DEFAULT_REQUEST_TIMEOUT_MS;

    const link = new RPCLink({
        url,
        fetch: (input, init) => fetchWithTimeout(deps.fetch ?? testFetch ?? globalThis.fetch, input, init, timeout),
    });

    return createORPCClient(link);
}

/** Singleton client for the default entry point. */
export const orpc = createOrpcClient();
